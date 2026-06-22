'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import {
  players as defaultPlayers,
  teams as defaultTeams,
  matches as defaultMatches,
  playerStats as defaultPlayerStats,
  standings as defaultStandings,
} from '@/lib/data';
import type { Player, Team, Match, PlayerStats, StandingRow } from '@/lib/types';
import type { ImportedActaRecord } from '@/lib/importEngine';

interface LeagueData {
  players: Player[];
  teams: Team[];
  matches: Match[];
  playerStats: PlayerStats[];
  standings: StandingRow[];
  importHistory: ImportedActaRecord[];
  isLoading: boolean;
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
 * Save partial data to disk via API
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
 * Load all data from disk via API
 */
async function loadFromDisk(): Promise<{
  teams: Team[];
  players: Player[];
  matches: Match[];
  playerStats: PlayerStats[];
  standings: StandingRow[];
  importHistory: ImportedActaRecord[];
} | null> {
  try {
    const res = await fetch('/api/data');
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('[DataContext] Error loading from disk:', err);
    return null;
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
  const initialized = useRef(false);

  // Load from disk on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    async function init() {
      // Step 1: Migrate any existing localStorage data
      await migrateFromLocalStorage();

      // Step 2: Load all data from disk
      const data = await loadFromDisk();
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
  // ============================================

  const updatePlayers = useCallback((newPlayers: Player[]) => {
    setPlayers(newPlayers);
    saveToDisk({ players: newPlayers });
  }, []);

  const updateTeams = useCallback((newTeams: Team[]) => {
    setTeams(newTeams);
    saveToDisk({ teams: newTeams });
  }, []);

  const updateMatches = useCallback((newMatches: Match[]) => {
    setMatches(newMatches);
    saveToDisk({ matches: newMatches });
  }, []);

  const updatePlayerStats = useCallback((newStats: PlayerStats[]) => {
    setPlayerStats(newStats);
    saveToDisk({ playerStats: newStats });
  }, []);

  const updateStandings = useCallback((newStandings: StandingRow[]) => {
    setStandings(newStandings);
    saveToDisk({ standings: newStandings });
  }, []);

  const addImportRecord = useCallback((record: ImportedActaRecord) => {
    setImportHistory(prev => {
      const updated = [...prev, record];
      saveToDisk({ importHistory: updated });
      return updated;
    });
  }, []);

  const removeImportRecord = useCallback((matchId: string) => {
    setImportHistory(prev => {
      const updated = prev.filter(r => r.matchId !== matchId);
      saveToDisk({ importHistory: updated });
      return updated;
    });
  }, []);

  return (
    <LeagueDataContext.Provider value={{
      players, teams, matches, playerStats, standings, importHistory,
      isLoading,
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
