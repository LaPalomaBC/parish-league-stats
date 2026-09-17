/**
 * serverData.ts — Server-side data access
 *
 * Reads data from Supabase.
 * Use this in Server Components and generateStaticParams/generateMetadata.
 * For Client Components, use DataContext instead.
 */
import { supabase } from './supabase';
import type { Team, Player, Match, PlayerStats, StandingRow, Season } from './types';

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

/**
 * Read a key with optional season prefix.
 * If seasonId is provided and is not the active season, reads "seasonId:key".
 * Otherwise reads the plain key (active season).
 */
async function readForSeason<T>(key: string, seasonId: string | undefined, fallback: T): Promise<T> {
  if (!seasonId) return readFromSupabase<T>(key, fallback);

  // Check if this season is the active one
  const seasons = await getSeasons();
  const season = seasons.find(s => s.id === seasonId);

  if (!season || season.isActive) {
    // Active season or unknown → read plain key
    return readFromSupabase<T>(key, fallback);
  }

  // Archived season → read prefixed key
  return readFromSupabase<T>(`${seasonId}:${key}`, fallback);
}

// ============================================
// SEASONS
// ============================================

export async function getSeasons(): Promise<Season[]> {
  return readFromSupabase<Season[]>('seasons', []);
}

export async function getActiveSeason(): Promise<Season | null> {
  const seasons = await getSeasons();
  return seasons.find(s => s.isActive) || null;
}

// ============================================
// ACTIVE SEASON DATA (default — backward compatible)
// ============================================

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
// SEASON-AWARE DATA (for archive views)
// ============================================

export async function getTeamsForSeason(seasonId?: string): Promise<Team[]> {
  return readForSeason<Team[]>('teams', seasonId, []);
}

export async function getPlayersForSeason(seasonId?: string): Promise<Player[]> {
  return readForSeason<Player[]>('players', seasonId, []);
}

export async function getMatchesForSeason(seasonId?: string): Promise<Match[]> {
  return readForSeason<Match[]>('matches', seasonId, []);
}

export async function getPlayerStatsForSeason(seasonId?: string): Promise<PlayerStats[]> {
  return readForSeason<PlayerStats[]>('playerStats', seasonId, []);
}

export async function getStandingsForSeason(seasonId?: string): Promise<StandingRow[]> {
  return readForSeason<StandingRow[]>('standings', seasonId, []);
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
