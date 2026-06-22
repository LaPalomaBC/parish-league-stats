/* ============================================
   Parish League Stats — Default Data
   Solo equipos reales. Todo lo demás se carga
   desde los archivos JSON en data/
   ============================================ */

import { Team, Player, Match, StandingRow, PlayerStats } from './types';

// ============================================
// EQUIPOS — Nombres reales de la liga
// ============================================
export const teams: Team[] = [
  {
    id: 'team-01',
    name: 'La Paloma BC',
    shortName: 'PAL',
    primaryColor: '#1D1D1F',
    secondaryColor: '#3A3A3C',
    logoUrl: '/teams/pal.png',
  },
  {
    id: 'team-02',
    name: 'Labouré Spinners',
    shortName: 'LAB',
    primaryColor: '#E67E22',
    secondaryColor: '#F39C12',
    logoStyle: 'outlined',
  },
  {
    id: 'team-03',
    name: 'Trigolution Magikikos',
    shortName: 'TRI',
    primaryColor: '#8E8E93',
    secondaryColor: '#AEAEB2',
  },
  {
    id: 'team-04',
    name: 'Siena Suns',
    shortName: 'SIE',
    primaryColor: '#AF52DE',
    secondaryColor: '#BF5AF2',
  },
  {
    id: 'team-05',
    name: 'Salterio Lauders',
    shortName: 'SAL',
    primaryColor: '#34C759',
    secondaryColor: '#30D158',
  },
  {
    id: 'team-06',
    name: 'Betsaida Boanerges',
    shortName: 'BET',
    primaryColor: '#FF9500',
    secondaryColor: '#FFB340',
  },
  {
    id: 'team-07',
    name: 'Snow Knights',
    shortName: 'SNO',
    primaryColor: '#1B3A5C',
    secondaryColor: '#2C5A8C',
  },
  {
    id: 'team-08',
    name: 'Begoña Bulls',
    shortName: 'BEG',
    primaryColor: '#FF3B30',
    secondaryColor: '#FF453A',
  },
  {
    id: 'team-09',
    name: 'The Valva Cherubs',
    shortName: 'VAL',
    primaryColor: '#5AC8FA',
    secondaryColor: '#64D2FF',
  },
  {
    id: 'team-10',
    name: 'Los Ángeles Prayers',
    shortName: 'LAP',
    primaryColor: '#E8A317',
    secondaryColor: '#FFD60A',
  },
];

// ============================================
// DATOS VACÍOS — Se nutren desde data/*.json
// ============================================
export const players: Player[] = [];
export const matches: Match[] = [];
export const playerStats: PlayerStats[] = [];
export const standings: StandingRow[] = [];

// ============================================
// HELPERS
// ============================================
export function getTeam(teamId: string): Team | undefined {
  return teams.find(t => t.id === teamId);
}

export function getTeamPlayers(teamId: string): Player[] {
  return players.filter(p => p.teamId === teamId);
}

export function getTeamMatches(teamId: string): Match[] {
  return matches.filter(m => m.homeTeamId === teamId || m.awayTeamId === teamId);
}

export function getMatchPlayerStats(matchId: string): PlayerStats[] {
  return playerStats.filter(ps => ps.matchId === matchId);
}

export function getPlayer(playerId: string): Player | undefined {
  return players.find(p => p.id === playerId);
}

export function getPlayerMatchStats(playerId: string): PlayerStats[] {
  return playerStats.filter(ps => ps.playerId === playerId);
}

export function getPlayedMatches(): Match[] {
  return matches.filter(m => m.isPlayed);
}

export function getUpcomingMatches(): Match[] {
  return matches.filter(m => !m.isPlayed);
}

export function getMatchdayMatches(matchday: number): Match[] {
  return matches.filter(m => m.matchday === matchday);
}

export function getMaxMatchday(): number {
  if (matches.length === 0) return 0;
  return Math.max(...matches.map(m => m.matchday));
}

export function getLatestPlayedMatchday(): number {
  const played = matches.filter(m => m.isPlayed);
  return played.length > 0 ? Math.max(...played.map(m => m.matchday)) : 0;
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
