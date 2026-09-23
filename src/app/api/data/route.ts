/**
 * API Route: /api/data
 *
 * GET  → Returns all league data from Supabase
 *        Accepts optional ?season=2025-26 to read archived data
 * PUT  → Receives partial updates { key: data } and writes to Supabase
 *        Always writes to the ACTIVE season (no prefix)
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import type { Player, Team, Match, PlayerStats, StandingRow, Season } from '@/lib/types';
import type { ImportedActaRecord } from '@/lib/importEngine';

const VALID_KEYS = ['teams', 'players', 'matches', 'playerStats', 'standings', 'importHistory'];

interface AllData {
  teams: Team[];
  players: Player[];
  matches: Match[];
  playerStats: PlayerStats[];
  standings: StandingRow[];
  importHistory: ImportedActaRecord[];
}

/**
 * GET /api/data — Read all data from Supabase
 * Optional: ?season=2025-26 for archived season data
 */
export async function GET(request: NextRequest) {
  try {
    const seasonId = request.nextUrl.searchParams.get('season') || undefined;

    // Determine the key prefix
    let keyPrefix = '';
    if (seasonId) {
      // Check if this season is archived (not active)
      const { data: seasonsRow } = await supabase
        .from('data_store')
        .select('value')
        .eq('key', 'seasons')
        .single();

      const seasons: Season[] = Array.isArray(seasonsRow?.value) ? seasonsRow.value : [];
      const season = seasons.find(s => s.id === seasonId);

      // If the season exists and is NOT active, use prefix
      if (season && !season.isActive) {
        keyPrefix = `${seasonId}:`;
      }
    }

    // Build the list of keys to fetch
    const keysToFetch = VALID_KEYS.map(k => `${keyPrefix}${k}`);

    const { data: rows, error } = await supabase
      .from('data_store')
      .select('key, value')
      .in('key', keysToFetch);

    if (error) {
      console.error('[API /data GET] Supabase error:', error.message);
      return NextResponse.json({ error: 'Failed to read data' }, { status: 500 });
    }

    const result: Record<string, unknown> = {};
    for (const row of rows || []) {
      // Strip the prefix to normalize keys in the response
      const normalizedKey = keyPrefix ? row.key.replace(keyPrefix, '') : row.key;
      result[normalizedKey] = row.value;
    }

    // Ensure all keys exist with defaults
    const allData: AllData = {
      teams: (result.teams as Team[]) || [],
      players: (result.players as Player[]) || [],
      matches: (result.matches as Match[]) || [],
      playerStats: (result.playerStats as PlayerStats[]) || [],
      standings: (result.standings as StandingRow[]) || [],
      importHistory: (result.importHistory as ImportedActaRecord[]) || [],
    };

    return NextResponse.json(allData);
  } catch (error) {
    console.error('[API /data GET] Error:', error);
    return NextResponse.json({ error: 'Failed to read data' }, { status: 500 });
  }
}

/**
 * PUT /api/data — Write partial updates to Supabase
 * Always writes to the ACTIVE season (no prefix).
 *
 * Body: { [key]: data }
 * Example: { "players": [...], "standings": [...] }
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    const writtenKeys: string[] = [];
    for (const [key, data] of Object.entries(body)) {
      if (!VALID_KEYS.includes(key)) {
        console.warn(`[API /data PUT] Unknown key: ${key}`);
        continue;
      }

      const { error } = await supabaseAdmin
        .from('data_store')
        .upsert({
          key,
          value: data,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        console.error(`[API /data PUT] Error writing ${key}:`, error.message);
        continue;
      }

      writtenKeys.push(key);
    }

    return NextResponse.json({ ok: true, written: writtenKeys });
  } catch (error) {
    console.error('[API /data PUT] Error:', error);
    return NextResponse.json({ error: 'Failed to write data' }, { status: 500 });
  }
}
