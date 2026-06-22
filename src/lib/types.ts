/* ============================================
   Parish League Stats — Type Definitions
   ============================================ */

export interface Team {
  id: string;
  name: string;
  shortName: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl?: string;
  logoStyle?: 'outlined';
}

export interface Player {
  id: string;
  teamId: string;
  name: string;
  number: string;
  position: string[];  // Multiple positions: Base, Escolta, Alero, Ala-Pívot, Pívot
  birthDate?: string;
  photoUrl?: string;
  isActive: boolean;
}

export interface Match {
  id: string;
  matchday: number;
  matchDate: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  matchType: 'regular' | 'copa' | 'playoff';
  venue?: string;
  isPlayed: boolean;
}

// Estadísticas individuales por partido — campos del acta FBM
export interface PlayerStats {
  id: string;
  matchId: string;
  playerId: string;
  teamId: string;
  minutes: number;       // MIN (en minutos)
  points: number;        // PTS
  twoMade: number;       // TC 2P anotados
  twoAttempted: number;  // TC 2P intentados
  threeMade: number;     // TC 3P anotados
  threeAttempted: number; // TC 3P intentados
  ftMade: number;        // TL anotados
  ftAttempted: number;   // TL intentados
  offRebounds: number;   // REB OF
  defRebounds: number;   // REB DEF
  assists: number;       // AST
  recoveries: number;    // REC (Recuperaciones)
  turnovers: number;     // PER (Pérdidas)
  blocks: number;        // TAP TC (tapones realizados)
  blocksReceived: number; // TAP TR (tapones recibidos)
  fouls: number;         // FAL FC (faltas cometidas)
  foulsReceived: number; // FAL FR (faltas recibidas)
  efficiency: number;    // VAL (valoración FBM)
  plusMinus: number;     // +/-
}

export interface StandingRow {
  teamId: string;
  position: number;
  played: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointsDiff: number;
  streak: string;
  leaguePoints: number;
}

export interface PlayerAverages {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  gamesPlayed: number;
  ppg: number;   // Puntos
  rpg: number;   // Rebotes
  apg: number;   // Asistencias
  recpg: number; // Recuperaciones
  topg: number;  // Pérdidas
  bpg: number;   // Tapones
  fpg: number;   // Faltas
  fgPct: number; // % TC total
  threePct: number; // % T3
  ftPct: number; // % TL
  efficiency: number; // VAL
  plusMinus: number;  // +/-
}

// Resultado del parser de actas FBM
export interface ParsedActa {
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  season: string;
  homePlayers: ParsedPlayerLine[];
  awayPlayers: ParsedPlayerLine[];
}

export interface ParsedPlayerLine {
  number: string;
  name: string;
  minutes: number;
  points: number;
  twoMade: number;
  twoAttempted: number;
  threeMade: number;
  threeAttempted: number;
  ftMade: number;
  ftAttempted: number;
  defRebounds: number;
  offRebounds: number;
  assists: number;
  recoveries: number;
  turnovers: number;
  blocks: number;
  blocksReceived: number;
  fouls: number;
  foulsReceived: number;
  efficiency: number;
  plusMinus: number;
}
