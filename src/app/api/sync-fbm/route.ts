/**
 * API Route: /api/sync-fbm
 *
 * POST → Scrapes FBM website for Parish League results and syncs with Supabase.
 *         Updates match scores, dates, times, and recalculates standings.
 *         Protected by admin password (same as other admin endpoints).
 *
 * GET  → Called by Vercel Cron. Uses CRON_SECRET for auth.
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { fetchFbmPage, parseFbmMatches, computeSyncChanges } from '@/lib/fbmScraper';
import { recalculateStandings } from '@/lib/importEngine';
import type { Match, Team, StandingRow } from '@/lib/types';

/**
 * GET /api/sync-fbm — Vercel Cron entry point
 * Authenticated via CRON_SECRET header.
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return runSync();
}

/**
 * POST /api/sync-fbm — Manual sync from admin panel
 * Authenticated via admin password in request body.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body;

    // Verify admin password
    const { data: configRow } = await supabase
      .from('data_store')
      .select('value')
      .eq('key', 'adminConfig')
      .single();

    const storedPassword = configRow?.value?.adminPassword || process.env.ADMIN_PASSWORD;
    if (!storedPassword || password !== storedPassword) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    return runSync();
  } catch (error) {
    console.error('[sync-fbm POST] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/**
 * Core sync logic shared by GET (cron) and POST (manual).
 */
async function runSync(): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    // 1. Scrape FBM
    console.log('[sync-fbm] Fetching FBM page...');
    const html = await fetchFbmPage();

    // 2. Parse matches
    const fbmMatches = parseFbmMatches(html);
    if (fbmMatches.length === 0) {
      return NextResponse.json({
        ok: false,
        error: 'No matches parsed from FBM — page structure may have changed',
        duration: Date.now() - startTime,
      }, { status: 502 });
    }

    console.log(`[sync-fbm] Parsed ${fbmMatches.length} matches from FBM`);

    // 3. Read current data from Supabase
    const { data: rows, error: readError } = await supabase
      .from('data_store')
      .select('key, value')
      .in('key', ['matches', 'teams', 'standings']);

    if (readError) {
      throw new Error(`Supabase read error: ${readError.message}`);
    }

    const dataMap = new Map(rows?.map(r => [r.key, r.value]) ?? []);
    const internalMatches: Match[] = (dataMap.get('matches') as Match[]) ?? [];
    const teams: Team[] = (dataMap.get('teams') as Team[]) ?? [];

    // 4. Compute changes
    const { updatedMatches, result } = computeSyncChanges(fbmMatches, internalMatches);

    console.log(`[sync-fbm] Changes: ${result.scoresUpdated} scores, ${result.scheduleUpdated} schedule updates`);

    // 5. Write to Supabase if there are changes
    if (result.scoresUpdated > 0 || result.scheduleUpdated > 0) {
      // Write updated matches
      const { error: matchError } = await supabaseAdmin
        .from('data_store')
        .upsert({
          key: 'matches',
          value: updatedMatches,
          updated_at: new Date().toISOString(),
        });

      if (matchError) {
        throw new Error(`Failed to write matches: ${matchError.message}`);
      }

      // Recalculate standings if scores changed
      if (result.scoresUpdated > 0) {
        const newStandings = recalculateStandings(updatedMatches, teams);

        const { error: standingsError } = await supabaseAdmin
          .from('data_store')
          .upsert({
            key: 'standings',
            value: newStandings,
            updated_at: new Date().toISOString(),
          });

        if (standingsError) {
          throw new Error(`Failed to write standings: ${standingsError.message}`);
        }

        result.changes.push(`📊 Clasificación recalculada (${newStandings.length} equipos)`);
      }
    }

    return NextResponse.json({
      ok: true,
      ...result,
      duration: Date.now() - startTime,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[sync-fbm] Error:', message);
    return NextResponse.json({
      ok: false,
      error: message,
      duration: Date.now() - startTime,
    }, { status: 500 });
  }
}
