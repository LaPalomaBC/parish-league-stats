/**
 * serverData.ts — Server-side data access
 *
 * Reads data from Supabase.
 * Use this in Server Components and generateStaticParams/generateMetadata.
 * For Client Components, use DataContext instead.
 */
import { supabase } from './supabase';
import type { Team, Player, Match, PlayerStats, StandingRow } from './types';

async function readFromSupabase<T>(key: string, fallback: T): Promise<T> {
  try {
    const { data, error } = await supabase
      .from('data_store')
      .select('value')
      .eq('key', key)
      .single();

    if (error || !data) return fallback;
    return data.value as T;
  } catch {
    return fallback;
  }
}

export async function getTeamsFromDisk(): Promise<Team[]> {
  return readFromSupabase<Team[]>('teams', []);
}

export async function getPlayersFromDisk(): Promise<Player[]> {
  return readFromSupabase<Player[]>('players', []);
}

export async function getMatchesFromDisk(): Promise<Match[]> {
  return readFromSupabase<Match[]>('matches', []);
}

export async function getPlayerStatsFromDisk(): Promise<PlayerStats[]> {
  return readFromSupabase<PlayerStats[]>('playerStats', []);
}

export async function getStandingsFromDisk(): Promise<StandingRow[]> {
  return readFromSupabase<StandingRow[]>('standings', []);
}

// ============================================
// HELPERS
// ============================================

export async function getPlayedMatchesFromDisk(): Promise<Match[]> {
  const matches = await getMatchesFromDisk();
  return matches.filter(m => m.isPlayed);
}

export async function getUpcomingMatchesFromDisk(): Promise<Match[]> {
  const matches = await getMatchesFromDisk();
  return matches.filter(m => !m.isPlayed);
}

export async function getLatestPlayedMatchdayFromDisk(): Promise<number> {
  const played = await getPlayedMatchesFromDisk();
  return played.length > 0 ? Math.max(...played.map(m => m.matchday)) : 0;
}

export async function getMatchdayMatchesFromDisk(matchday: number): Promise<Match[]> {
  const matches = await getMatchesFromDisk();
  return matches.filter(m => m.matchday === matchday);
}
