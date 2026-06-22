/**
 * initData.ts — Inicialización determinista de archivos JSON
 *
 * Verifica que existan los archivos en data/ y, si no, los crea
 * con los datos por defecto de data.ts.
 * Ejecutado desde la API Route al detectar archivos faltantes.
 */
import { promises as fs } from 'fs';
import path from 'path';

import {
  players as defaultPlayers,
  teams as defaultTeams,
  matches as defaultMatches,
  playerStats as defaultPlayerStats,
  standings as defaultStandings,
} from '@/lib/data';

const DATA_DIR = path.join(process.cwd(), 'data');

const DEFAULTS: Record<string, unknown> = {
  'teams.json': defaultTeams,
  'players.json': defaultPlayers,
  'matches.json': defaultMatches,
  'playerStats.json': defaultPlayerStats,
  'standings.json': defaultStandings,
  'importHistory.json': [],
};

/**
 * Ensures all data files exist. Creates missing ones with defaults.
 * Returns true if any file was created.
 */
export async function ensureDataFiles(): Promise<boolean> {
  let created = false;

  // Ensure data directory exists
  await fs.mkdir(DATA_DIR, { recursive: true });

  for (const [filename, defaultData] of Object.entries(DEFAULTS)) {
    const filepath = path.join(DATA_DIR, filename);
    try {
      await fs.access(filepath);
    } catch {
      // File doesn't exist — create it with defaults
      await fs.writeFile(filepath, JSON.stringify(defaultData, null, 2), 'utf-8');
      created = true;
    }
  }

  return created;
}

/**
 * Read a single JSON data file.
 */
export async function readDataFile<T>(filename: string): Promise<T> {
  const filepath = path.join(DATA_DIR, filename);
  const raw = await fs.readFile(filepath, 'utf-8');
  return JSON.parse(raw) as T;
}

/**
 * Write a single JSON data file (atomic: write to tmp then rename).
 */
export async function writeDataFile(filename: string, data: unknown): Promise<void> {
  const filepath = path.join(DATA_DIR, filename);
  const tmpPath = filepath + '.tmp';
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  await fs.rename(tmpPath, filepath);
}
