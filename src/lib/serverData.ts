/**
 * serverData.ts — Server-side data access
 *
 * Reads data directly from JSON files on disk.
 * Use this in Server Components and generateStaticParams/generateMetadata.
 * For Client Components, use DataContext instead.
 */
import { promises as fs } from 'fs';
import path from 'path';
import type { Team, Player, Match, PlayerStats, StandingRow } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');

async function readJSON<T>(filename: string, fallback: T): Promise<T> {
  try {
    const filepath = path.join(DATA_DIR, filename);
    const raw = await fs.readFile(filepath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function getTeamsFromDisk(): Promise<Team[]> {
  return readJSON<Team[]>('teams.json', []);
}

export async function getPlayersFromDisk(): Promise<Player[]> {
  return readJSON<Player[]>('players.json', []);
}

export async function getMatchesFromDisk(): Promise<Match[]> {
  return readJSON<Match[]>('matches.json', []);
}

export async function getPlayerStatsFromDisk(): Promise<PlayerStats[]> {
  return readJSON<PlayerStats[]>('playerStats.json', []);
}

export async function getStandingsFromDisk(): Promise<StandingRow[]> {
  return readJSON<StandingRow[]>('standings.json', []);
}

// ============================================
// HELPERS (async, disk-based)
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
