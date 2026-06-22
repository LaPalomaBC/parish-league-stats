/**
 * API Route: /api/data
 *
 * GET  → Returns all league data from Supabase
 * PUT  → Receives partial updates { key: data } and writes to Supabase
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import type { Player, Team, Match, PlayerStats, StandingRow } from '@/lib/types';
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
 */
export async function GET() {
  try {
    const { data: rows, error } = await supabase
      .from('data_store')
      .select('key, value')
      .in('key', VALID_KEYS);

    if (error) {
      console.error('[API /data GET] Supabase error:', error.message);
      return NextResponse.json({ error: 'Failed to read data' }, { status: 500 });
    }

    const result: Record<string, unknown> = {};
    for (const row of rows || []) {
      result[row.key] = row.value;
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

      const { error } = await supabase
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
