'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import {
  players as defaultPlayers,
  teams as defaultTeams,
  matches as defaultMatches,
  playerStats as defaultPlayerStats,
  standings as defaultStandings,
} from '@/lib/data';
import type { Player, Team, Match, PlayerStats, StandingRow, Season } from '@/lib/types';
import type { ImportedActaRecord } from '@/lib/importEngine';

interface LeagueData {
  players: Player[];
  teams: Team[];
  matches: Match[];
  playerStats: PlayerStats[];
  standings: StandingRow[];
  importHistory: ImportedActaRecord[];
  isLoading: boolean;
  // Season support
  seasons: Season[];
  currentSeason: Season | null;
  isArchive: boolean;
  setCurrentSeasonId: (seasonId: string) => void;
  // Mutations (disabled in archive mode)
  updatePlayers: (players: Player[]) => void;
  updateTeams: (teams: Team[]) => void;
  updateMatches: (matches: Match[]) => void;
  updatePlayerStats: (stats: PlayerStats[]) => void;
  updateStandings: (standings: StandingRow[]) => void;
  addImportRecord: (record: ImportedActaRecord) => void;
  removeImportRecord: (matchId: string) => void;
}

const LeagueDataContext = createContext<LeagueData>({
  players: defaultPlayers,
  teams: defaultTeams,
  matches: defaultMatches,
  playerStats: defaultPlayerStats,
  standings: defaultStandings,
  importHistory: [],
  isLoading: true,
  seasons: [],
  currentSeason: null,
  isArchive: false,
  setCurrentSeasonId: () => {},
  updatePlayers: () => {},
  updateTeams: () => {},
  updateMatches: () => {},
  updatePlayerStats: () => {},
  updateStandings: () => {},
  addImportRecord: () => {},
  removeImportRecord: () => {},
});

// ============================================
// PERSISTENCE HELPERS
// ============================================

/**
 * Save partial data to disk via API (active season only)
 */
async function saveToDisk(payload: Record<string, unknown>): Promise<void> {
  try {
    const res = await fetch('/api/data', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error('[DataContext] Failed to save:', await res.text());
    }
  } catch (err) {
    console.error('[DataContext] Error saving to disk:', err);
  }
}

/**
 * Load all data from disk via API, optionally for a specific season
 */
async function loadFromDisk(seasonId?: string): Promise<{
  teams: Team[];
  players: Player[];
  matches: Match[];
  playerStats: PlayerStats[];
  standings: StandingRow[];
  importHistory: ImportedActaRecord[];
} | null> {
  try {
    const url = seasonId ? `/api/data?season=${seasonId}` : '/api/data';
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('[DataContext] Error loading from disk:', err);
    return null;
  }
}

/**
 * Load seasons list from API
 */
async function loadSeasons(): Promise<Season[]> {
  try {
    const res = await fetch('/api/seasons');
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.error('[DataContext] Error loading seasons:', err);
    return [];
  }
}

// ============================================
// LOCALSTORAGE MIGRATION
// ============================================

const LS_KEYS = {
  players: 'parish-league-players',
  teams: 'parish-league-teams',
  matches: 'parish-league-matches',
  playerStats: 'parish-league-player-stats',
  standings: 'parish-league-standings',
  importHistory: 'parish-league-import-history',
} as const;

/**
 * Check if localStorage has data from a previous session.
 * If so, migrate it to disk and clean up localStorage.
 */
async function migrateFromLocalStorage(): Promise<void> {
  if (typeof window === 'undefined') return;

  const hasLocalData = Object.values(LS_KEYS).some(key => localStorage.getItem(key) !== null);
  if (!hasLocalData) return;

  console.log('[DataContext] Migrating localStorage data to disk...');

  const payload: Record<string, unknown> = {};
  for (const [dataKey, lsKey] of Object.entries(LS_KEYS)) {
    const raw = localStorage.getItem(lsKey);
    if (raw) {
      try {
        payload[dataKey] = JSON.parse(raw);
      } catch { /* skip corrupted data */ }
    }
  }

  if (Object.keys(payload).length > 0) {
    await saveToDisk(payload);
    // Clean up localStorage after successful migration
    Object.values(LS_KEYS).forEach(key => localStorage.removeItem(key));
    console.log('[DataContext] Migration complete. localStorage cleaned.');
  }
}

// ============================================
// SESSION STORAGE for selected season
// ============================================
const SEASON_STORAGE_KEY = 'parish-selected-season';

function getStoredSeasonId(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(SEASON_STORAGE_KEY);
}

function storeSeasonId(seasonId: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(SEASON_STORAGE_KEY, seasonId);
}

// ============================================
// PROVIDER
// ============================================

export function LeagueDataProvider({ children }: { children: ReactNode }) {
  const [players, setPlayers] = useState<Player[]>(defaultPlayers);
  const [teams, setTeams] = useState<Team[]>(defaultTeams);
  const [matches, setMatches] = useState<Match[]>(defaultMatches);
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>(defaultPlayerStats);
  const [standings, setStandings] = useState<StandingRow[]>(defaultStandings);
  const [importHistory, setImportHistory] = useState<ImportedActaRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [currentSeason, setCurrentSeason] = useState<Season | null>(null);
  const initialized = useRef(false);

  const isArchive = currentSeason ? !currentSeason.isActive : false;

  // Load data for a specific season
  const loadSeasonData = useCallback(async (seasonId?: string) => {
    setIsLoading(true);
    const data = await loadFromDisk(seasonId);
    if (data) {
      setPlayers(data.players);
      setTeams(data.teams);
      setMatches(data.matches);
      setPlayerStats(data.playerStats);
      setStandings(data.standings);
      setImportHistory(data.importHistory);
    }
    setIsLoading(false);
  }, []);

  // Switch season
  const setCurrentSeasonId = useCallback(async (seasonId: string) => {
    const season = seasons.find(s => s.id === seasonId);
    if (!season) return;

    setCurrentSeason(season);
    storeSeasonId(seasonId);
    await loadSeasonData(seasonId);
  }, [seasons, loadSeasonData]);

  // Load from disk on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    async function init() {
      // Step 1: Migrate any existing localStorage data
      await migrateFromLocalStorage();

      // Step 2: Load seasons
      const fetchedSeasons = await loadSeasons();
      setSeasons(fetchedSeasons);

      // Step 3: Determine which season to load
      const storedId = getStoredSeasonId();
      const activeSeason = fetchedSeasons.find(s => s.isActive) || null;
      const targetSeason = storedId
        ? fetchedSeasons.find(s => s.id === storedId) || activeSeason
        : activeSeason;

      setCurrentSeason(targetSeason);

      // Step 4: Load data for the target season
      const seasonIdToLoad = targetSeason?.isActive ? undefined : targetSeason?.id;
      const data = await loadFromDisk(seasonIdToLoad);
      if (data) {
        setPlayers(data.players);
        setTeams(data.teams);
        setMatches(data.matches);
        setPlayerStats(data.playerStats);
        setStandings(data.standings);
        setImportHistory(data.importHistory);
      }
      setIsLoading(false);
    }

    init();
  }, []);

  // ============================================
  // UPDATE FUNCTIONS — write to state + disk
  // Only work for the active season (not archive)
  // ============================================

  const updatePlayers = useCallback((newPlayers: Player[]) => {
    if (isArchive) return;
    setPlayers(newPlayers);
    saveToDisk({ players: newPlayers });
  }, [isArchive]);

  const updateTeams = useCallback((newTeams: Team[]) => {
    if (isArchive) return;
    setTeams(newTeams);
    saveToDisk({ teams: newTeams });
  }, [isArchive]);

  const updateMatches = useCallback((newMatches: Match[]) => {
    if (isArchive) return;
    setMatches(newMatches);
    saveToDisk({ matches: newMatches });
  }, [isArchive]);

  const updatePlayerStats = useCallback((newStats: PlayerStats[]) => {
    if (isArchive) return;
    setPlayerStats(newStats);
    saveToDisk({ playerStats: newStats });
  }, [isArchive]);

  const updateStandings = useCallback((newStandings: StandingRow[]) => {
    if (isArchive) return;
    setStandings(newStandings);
    saveToDisk({ standings: newStandings });
  }, [isArchive]);

  const addImportRecord = useCallback((record: ImportedActaRecord) => {
    if (isArchive) return;
    setImportHistory(prev => {
      const updated = [...prev, record];
      saveToDisk({ importHistory: updated });
      return updated;
    });
  }, [isArchive]);

  const removeImportRecord = useCallback((matchId: string) => {
    if (isArchive) return;
    setImportHistory(prev => {
      const updated = prev.filter(r => r.matchId !== matchId);
      saveToDisk({ importHistory: updated });
      return updated;
    });
  }, [isArchive]);

  return (
    <LeagueDataContext.Provider value={{
      players, teams, matches, playerStats, standings, importHistory,
      isLoading,
      seasons, currentSeason, isArchive, setCurrentSeasonId,
      updatePlayers, updateTeams, updateMatches, updatePlayerStats,
      updateStandings, addImportRecord, removeImportRecord,
    }}>
      {children}
    </LeagueDataContext.Provider>
  );
}

export function useLeagueData() {
  return useContext(LeagueDataContext);
}
