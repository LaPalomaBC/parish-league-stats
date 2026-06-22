/**
 * Import Engine — Motor determinista de importación de actas FBM
 * 
 * Recibe un ParsedActa + datos actuales del sistema y produce:
 * - Match nuevo (o actualizado)
 * - PlayerStats[] nuevos
 * - Jugadores nuevos (auto-creados si no existen)
 * - Standings recalculados
 */
import type { ParsedActa, ParsedPlayerLine, Match, PlayerStats, Player, Team, StandingRow } from './types';

// ============================================
// FORFEIT (INCOMPARECENCIA) DETECTION
// ============================================

/**
 * Detects if a team didn't show up (incomparecencia).
 * Signal: fewer than 5 players listed in the acta (basketball requires minimum 5).
 */
export function detectForfeit(players: ParsedPlayerLine[]): boolean {
  return players.length < 5;
}

export interface ForfeitInfo {
  isForfeit: boolean;
  forfeitTeam: 'home' | 'away' | null;
  /** The overridden score for display: 20-0 or 0-20 */
  homeScore: number;
  awayScore: number;
}

// ============================================
// TEAM MATCHING
// ============================================

/**
 * Fuzzy match de nombre del acta FBM → equipo del sistema
 */
export function matchTeamByName(actaName: string, teams: Team[]): Team | undefined {
  const normalize = (s: string) => s
    .toLowerCase()
    .replace(/b\.c\./g, 'bc')
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const normalizedActa = normalize(actaName);
  return teams.find(t => {
    const normalizedTeam = normalize(t.name);
    return normalizedActa.includes(normalizedTeam)
      || normalizedTeam.includes(normalizedActa)
      || normalizedActa.split(' ').some(word => word.length > 3 && normalizedTeam.includes(word));
  });
}

// ============================================
// PLAYER MATCHING
// ============================================

export interface PlayerMatchResult {
  player: Player;
  isNew: boolean;
}

/**
 * Busca jugador por dorsal + equipo. Si no existe, crea uno nuevo.
 */
export function matchOrCreatePlayer(
  line: ParsedPlayerLine,
  teamId: string,
  existingPlayers: Player[],
): PlayerMatchResult {
  // Try exact match by number + team
  const byNumber = existingPlayers.find(p => p.teamId === teamId && p.number === line.number);
  if (byNumber) {
    return { player: byNumber, isNew: false };
  }

  // Try by name + team (in case number changed)
  const byName = existingPlayers.find(p => {
    if (p.teamId !== teamId) return false;
    const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
    return normalize(p.name) === normalize(line.name);
  });
  if (byName) {
    return { player: byName, isNew: false };
  }

  // Create new player
  const newPlayer: Player = {
    id: `p-auto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    teamId,
    name: line.name,
    number: line.number,
    position: [],
    isActive: true,
  };

  return { player: newPlayer, isNew: true };
}

// ============================================
// DUPLICATE DETECTION
// ============================================

export interface ImportedActaRecord {
  matchId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  matchday: number;
  matchType: string;
  importedAt: string;
  fileName: string;
  isForfeit?: boolean;
  forfeitTeam?: 'home' | 'away' | null;
}

/**
 * Checks if an acta has already been imported.
 * Only considers it a duplicate if there's a played match between the same
 * teams in the SAME matchday — allows rematches in later jornadas (10, 11).
 */
export function checkDuplicate(
  homeTeamId: string,
  awayTeamId: string,
  matchday: number,
  matches: Match[],
): Match | undefined {
  return matches.find(m =>
    m.isPlayed &&
    m.matchday === matchday &&
    ((m.homeTeamId === homeTeamId && m.awayTeamId === awayTeamId) ||
     (m.homeTeamId === awayTeamId && m.awayTeamId === homeTeamId))
  );
}

// ============================================
// MATCH CREATION
// ============================================

export function createMatch(
  homeTeamId: string,
  awayTeamId: string,
  homeScore: number,
  awayScore: number,
  matchday: number,
  matchType: 'regular' | 'copa' | 'playoff',
  existingMatches: Match[],
): Match {
  // Check if there's an existing unplayed match between these teams
  const existing = existingMatches.find(m =>
    !m.isPlayed &&
    ((m.homeTeamId === homeTeamId && m.awayTeamId === awayTeamId) ||
     (m.homeTeamId === awayTeamId && m.awayTeamId === homeTeamId))
  );

  if (existing) {
    // Update existing match
    return {
      ...existing,
      homeTeamId,
      awayTeamId,
      homeScore,
      awayScore,
      matchday,
      matchType,
      isPlayed: true,
      matchDate: new Date().toISOString().split('T')[0],
    };
  }

  // Create new match
  const maxId = existingMatches.reduce((max, m) => {
    const num = parseInt(m.id.replace('m-', ''), 10);
    return isNaN(num) ? max : Math.max(max, num);
  }, 0);

  return {
    id: `m-${String(maxId + 1).padStart(2, '0')}`,
    matchday,
    matchDate: new Date().toISOString().split('T')[0],
    homeTeamId,
    awayTeamId,
    homeScore,
    awayScore,
    matchType,
    isPlayed: true,
  };
}

// ============================================
// PLAYER STATS CREATION
// ============================================

export function createPlayerStats(
  matchId: string,
  teamId: string,
  lines: ParsedPlayerLine[],
  playerMap: Map<string, Player>, // dorsal → Player
  existingStats: PlayerStats[],
): PlayerStats[] {
  const maxId = existingStats.reduce((max, ps) => {
    const num = parseInt(ps.id.replace('ps-', ''), 10);
    return isNaN(num) ? max : Math.max(max, num);
  }, 0);

  let nextId = maxId + 1;

  return lines.map(line => {
    const player = playerMap.get(line.number);
    if (!player) throw new Error(`Player not found for number ${line.number}`);

    return {
      id: `ps-${String(nextId++).padStart(3, '0')}`,
      matchId,
      playerId: player.id,
      teamId,
      minutes: line.minutes,
      points: line.points,
      twoMade: line.twoMade,
      twoAttempted: line.twoAttempted,
      threeMade: line.threeMade,
      threeAttempted: line.threeAttempted,
      ftMade: line.ftMade,
      ftAttempted: line.ftAttempted,
      offRebounds: line.offRebounds,
      defRebounds: line.defRebounds,
      assists: line.assists,
      recoveries: line.recoveries,
      turnovers: line.turnovers,
      blocks: line.blocks,
      blocksReceived: line.blocksReceived,
      fouls: line.fouls,
      foulsReceived: line.foulsReceived,
      efficiency: line.efficiency,
      plusMinus: line.plusMinus,
    };
  });
}

// ============================================
// STANDINGS RECALCULATION
// ============================================

/**
 * Recalculates the full standings from scratch using all played matches.
 * 
 * Tiebreaker rules:
 * - Jornadas 1-9 (Liga Regular / Copa): head-to-head record between tied teams
 * - Jornadas 10+ (Playoffs): overall point differential (average)
 */
export function recalculateStandings(matches: Match[], teams: Team[]): StandingRow[] {
  const playedMatches = matches.filter(m => m.isPlayed && m.homeScore !== null && m.awayScore !== null);
  const maxMatchday = playedMatches.length > 0 ? Math.max(...playedMatches.map(m => m.matchday)) : 0;
  const useHeadToHead = maxMatchday <= 9;

  const teamStats = new Map<string, {
    played: number;
    wins: number;
    losses: number;
    pointsFor: number;
    pointsAgainst: number;
    results: ('W' | 'L')[];
  }>();

  // Initialize all teams
  teams.forEach(t => {
    teamStats.set(t.id, { played: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, results: [] });
  });

  // Process each match
  for (const match of playedMatches) {
    const home = teamStats.get(match.homeTeamId);
    const away = teamStats.get(match.awayTeamId);
    if (!home || !away) continue;

    const hs = match.homeScore!;
    const as = match.awayScore!;

    home.played++;
    away.played++;
    home.pointsFor += hs;
    home.pointsAgainst += as;
    away.pointsFor += as;
    away.pointsAgainst += hs;

    if (hs > as) {
      home.wins++;
      away.losses++;
      home.results.push('W');
      away.results.push('L');
    } else {
      home.losses++;
      away.wins++;
      home.results.push('L');
      away.results.push('W');
    }
  }

  // Calculate streak
  function getStreak(results: ('W' | 'L')[]): string {
    if (results.length === 0) return '-';
    const last = results[results.length - 1];
    let count = 0;
    for (let i = results.length - 1; i >= 0; i--) {
      if (results[i] === last) count++;
      else break;
    }
    return `${last}${count}`;
  }

  /**
   * Head-to-head tiebreaker: given a group of tied teams, compute
   * head-to-head wins between them to determine order.
   * Returns a "h2h score" for each team — more h2h wins = higher rank.
   */
  function getHeadToHeadScore(teamId: string, tiedTeamIds: string[]): { h2hWins: number; h2hDiff: number } {
    let h2hWins = 0;
    let h2hPF = 0;
    let h2hPA = 0;
    for (const m of playedMatches) {
      const isHome = m.homeTeamId === teamId && tiedTeamIds.includes(m.awayTeamId);
      const isAway = m.awayTeamId === teamId && tiedTeamIds.includes(m.homeTeamId);
      if (!isHome && !isAway) continue;
      const myScore = isHome ? m.homeScore! : m.awayScore!;
      const oppScore = isHome ? m.awayScore! : m.homeScore!;
      h2hPF += myScore;
      h2hPA += oppScore;
      if (myScore > oppScore) h2hWins++;
    }
    return { h2hWins, h2hDiff: h2hPF - h2hPA };
  }

  // Build standings array
  const rows: StandingRow[] = [];
  teamStats.forEach((stats, teamId) => {
    rows.push({
      teamId,
      position: 0,
      played: stats.played,
      wins: stats.wins,
      losses: stats.losses,
      pointsFor: stats.pointsFor,
      pointsAgainst: stats.pointsAgainst,
      pointsDiff: stats.pointsFor - stats.pointsAgainst,
      streak: getStreak(stats.results),
      leaguePoints: stats.played + stats.wins,
    });
  });

  if (useHeadToHead) {
    // Phase 1 (J1-J9): Sort by leaguePoints, then head-to-head within tied groups
    // First, sort by leaguePoints DESC
    rows.sort((a, b) => b.leaguePoints - a.leaguePoints);

    // Group teams with same leaguePoints
    const sortedRows: StandingRow[] = [];
    let i = 0;
    while (i < rows.length) {
      // Collect all teams with the same leaguePoints
      const group: StandingRow[] = [rows[i]];
      let j = i + 1;
      while (j < rows.length && rows[j].leaguePoints === rows[i].leaguePoints) {
        group.push(rows[j]);
        j++;
      }

      if (group.length === 1) {
        sortedRows.push(group[0]);
      } else {
        // Sort tied group by head-to-head
        const tiedIds = group.map(r => r.teamId);
        group.sort((a, b) => {
          const h2hA = getHeadToHeadScore(a.teamId, tiedIds);
          const h2hB = getHeadToHeadScore(b.teamId, tiedIds);
          // More h2h wins = higher rank
          if (h2hB.h2hWins !== h2hA.h2hWins) return h2hB.h2hWins - h2hA.h2hWins;
          // Tied h2h wins → h2h point differential
          if (h2hB.h2hDiff !== h2hA.h2hDiff) return h2hB.h2hDiff - h2hA.h2hDiff;
          // Still tied → fall back to overall point differential
          if (b.pointsDiff !== a.pointsDiff) return b.pointsDiff - a.pointsDiff;
          return b.pointsFor - a.pointsFor;
        });
        sortedRows.push(...group);
      }
      i = j;
    }

    // Replace rows content with sorted
    rows.length = 0;
    rows.push(...sortedRows);
  } else {
    // Phase 2 (J10+): Sort by leaguePoints, then overall pointsDiff, then pointsFor
    rows.sort((a, b) => {
      if (b.leaguePoints !== a.leaguePoints) return b.leaguePoints - a.leaguePoints;
      if (b.pointsDiff !== a.pointsDiff) return b.pointsDiff - a.pointsDiff;
      return b.pointsFor - a.pointsFor;
    });
  }

  // Assign positions
  rows.forEach((row, idx) => {
    row.position = idx + 1;
  });

  return rows;
}

// ============================================
// FULL IMPORT ORCHESTRATOR
// ============================================

export interface ImportResult {
  match: Match;
  homeStats: PlayerStats[];
  awayStats: PlayerStats[];
  newPlayers: Player[];
  updatedMatches: Match[];
  updatedPlayerStats: PlayerStats[];
  updatedPlayers: Player[];
  updatedStandings: StandingRow[];
  importRecord: ImportedActaRecord;
  forfeitInfo: ForfeitInfo;
}

/**
 * Orchestrates the full import of a parsed acta into the system.
 * Returns all updated data arrays ready to be saved.
 */
export function executeImport(
  acta: ParsedActa,
  homeTeamId: string,
  awayTeamId: string,
  matchday: number,
  matchType: 'regular' | 'copa' | 'playoff',
  currentMatches: Match[],
  currentPlayerStats: PlayerStats[],
  currentPlayers: Player[],
  currentTeams: Team[],
  fileName: string,
): ImportResult {
  // 0. Check for forfeit (incomparecencia)
  const homeForfeit = detectForfeit(acta.homePlayers);
  const awayForfeit = detectForfeit(acta.awayPlayers);
  const isForfeit = homeForfeit || awayForfeit;

  const forfeitInfo: ForfeitInfo = {
    isForfeit,
    forfeitTeam: homeForfeit ? 'home' : awayForfeit ? 'away' : null,
    homeScore: isForfeit ? (homeForfeit ? 0 : 20) : acta.homeScore,
    awayScore: isForfeit ? (awayForfeit ? 0 : 20) : acta.awayScore,
  };

  const finalHomeScore = forfeitInfo.homeScore;
  const finalAwayScore = forfeitInfo.awayScore;

  // 1. Create/update match with (possibly overridden) score
  const match = createMatch(homeTeamId, awayTeamId, finalHomeScore, finalAwayScore, matchday, matchType, currentMatches);

  // 2. Match/create players for both teams (even for forfeits, to register them)
  let workingPlayers = [...currentPlayers];
  const newPlayers: Player[] = [];

  // Home team players
  const homePlayerMap = new Map<string, Player>();
  for (const line of acta.homePlayers) {
    const result = matchOrCreatePlayer(line, homeTeamId, workingPlayers);
    homePlayerMap.set(line.number, result.player);
    if (result.isNew) {
      newPlayers.push(result.player);
      workingPlayers.push(result.player);
    }
  }

  // Away team players
  const awayPlayerMap = new Map<string, Player>();
  for (const line of acta.awayPlayers) {
    const result = matchOrCreatePlayer(line, awayTeamId, workingPlayers);
    awayPlayerMap.set(line.number, result.player);
    if (result.isNew) {
      newPlayers.push(result.player);
      workingPlayers.push(result.player);
    }
  }

  // 3. Create player stats — skip if forfeit (no stats recorded for either team)
  let homeStats: PlayerStats[] = [];
  let awayStats: PlayerStats[] = [];

  if (!isForfeit) {
    homeStats = createPlayerStats(match.id, homeTeamId, acta.homePlayers, homePlayerMap, currentPlayerStats);
    awayStats = createPlayerStats(match.id, awayTeamId, acta.awayPlayers, awayPlayerMap, [...currentPlayerStats, ...homeStats]);
  }

  // 4. Build updated arrays
  const updatedMatches = currentMatches.some(m => m.id === match.id)
    ? currentMatches.map(m => m.id === match.id ? match : m)
    : [...currentMatches, match];

  // Remove any existing stats for this match (in case of re-import)
  const filteredStats = currentPlayerStats.filter(ps => ps.matchId !== match.id);
  const updatedPlayerStats = [...filteredStats, ...homeStats, ...awayStats];

  // 5. Recalculate standings
  const updatedStandings = recalculateStandings(updatedMatches, currentTeams);

  // 6. Create import record
  const importRecord: ImportedActaRecord = {
    matchId: match.id,
    homeTeamId,
    awayTeamId,
    homeScore: finalHomeScore,
    awayScore: finalAwayScore,
    matchday,
    matchType,
    importedAt: new Date().toISOString(),
    fileName,
    isForfeit,
    forfeitTeam: forfeitInfo.forfeitTeam,
  };

  return {
    match,
    homeStats,
    awayStats,
    newPlayers,
    updatedMatches,
    updatedPlayerStats,
    updatedPlayers: workingPlayers,
    updatedStandings,
    importRecord,
    forfeitInfo,
  };
}
