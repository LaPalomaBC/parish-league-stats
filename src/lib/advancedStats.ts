/**
 * Advanced Basketball Statistics — Sabermetrics Module
 * 
 * All formulas derived from NBA standard calculations.
 * Calculated exclusively from FBM box-score data.
 */

import type { PlayerStats, Match } from './types';

// ============================================
// PLAYER SHOOTING EFFICIENCY
// ============================================

/** True Shooting % — overall scoring efficiency including FTs and 3s */
export function calcTS(pts: number, fga: number, fta: number): number {
  const denom = 2 * (fga + 0.44 * fta);
  return denom > 0 ? (pts / denom) * 100 : 0;
}

/** Effective FG% — adjusts FG% for the extra value of 3-pointers */
export function calcEFG(fgMade: number, threeMade: number, fga: number): number {
  return fga > 0 ? ((fgMade + 0.5 * threeMade) / fga) * 100 : 0;
}

// ============================================
// PER 48 MINUTES
// ============================================

/** Project a counting stat to 48-minute pace */
export function per48(stat: number, minutes: number): number {
  return minutes > 0 ? (stat / minutes) * 48 : 0;
}

// ============================================
// GAME METRICS
// ============================================

/** Usage Rate — % of team plays used by player while on floor */
export function calcUSG(
  fga: number, fta: number, to: number, mp: number,
  teamFga: number, teamFta: number, teamTo: number, teamMp: number
): number {
  if (mp <= 0 || teamMp <= 0) return 0;
  const playerPoss = fga + 0.44 * fta + to;
  const teamPoss = teamFga + 0.44 * teamFta + teamTo;
  if (teamPoss <= 0) return 0;
  return 100 * (playerPoss * (teamMp / 5)) / (mp * teamPoss);
}

/** Assist-to-Turnover Ratio */
export function calcAstTo(ast: number, to: number): number {
  return to > 0 ? ast / to : ast > 0 ? ast : 0;
}

/** Turnover Rate — % of possessions ending in turnover */
export function calcTovPct(fga: number, fta: number, to: number): number {
  const denom = fga + 0.44 * fta + to;
  return denom > 0 ? (to / denom) * 100 : 0;
}

/** Game Score (Hollinger) — single-number productivity */
export function calcGameScore(
  pts: number, fgMade: number, fga: number,
  ftMade: number, fta: number,
  orb: number, drb: number,
  stl: number, ast: number, blk: number,
  pf: number, to: number
): number {
  return pts
    + 0.4 * fgMade
    - 0.7 * fga
    - 0.4 * (fta - ftMade)
    + 0.7 * orb
    + 0.3 * drb
    + stl
    + 0.7 * ast
    + 0.7 * blk
    - 0.4 * pf
    - to;
}

// ============================================
// REBOUND PERCENTAGES
// ============================================

/** Offensive Rebound % (team or player) */
export function calcORBPct(orb: number, oppDrb: number): number {
  const total = orb + oppDrb;
  return total > 0 ? (orb / total) * 100 : 0;
}

/** Defensive Rebound % (team or player) */
export function calcDRBPct(drb: number, oppOrb: number): number {
  const total = drb + oppOrb;
  return total > 0 ? (drb / total) * 100 : 0;
}

/** Total Rebound % — player's share of available rebounds while on floor */
export function calcTRBPct(
  orb: number, drb: number, mp: number,
  teamOrb: number, teamDrb: number, oppOrb: number, oppDrb: number, teamMp: number
): number {
  if (mp <= 0 || teamMp <= 0) return 0;
  const totalAvail = (teamOrb + oppDrb) + (teamDrb + oppOrb);
  if (totalAvail <= 0) return 0;
  return 100 * ((orb + drb) * (teamMp / 5)) / (mp * totalAvail);
}

// ============================================
// INDIVIDUAL DEFENSIVE METRICS
// ============================================

/** Steal % — steals per 100 opponent possessions while on floor */
export function calcStlPct(
  stl: number, mp: number,
  oppPoss: number, teamMp: number
): number {
  if (mp <= 0 || teamMp <= 0 || oppPoss <= 0) return 0;
  return 100 * (stl * (teamMp / 5)) / (mp * oppPoss);
}

/** Block % — blocks per opponent 2-point FGA while on floor */
export function calcBlkPct(
  blk: number, mp: number,
  oppFga: number, oppThreeAtt: number, teamMp: number
): number {
  if (mp <= 0 || teamMp <= 0) return 0;
  const opp2PA = oppFga - oppThreeAtt;
  if (opp2PA <= 0) return 0;
  return 100 * (blk * (teamMp / 5)) / (mp * opp2PA);
}

// ============================================
// SCORING EFFICIENCY
// ============================================

/** Floor % — percentage of possessions used that result in a score */
export function calcFloorPct(fgMade: number, ftMade: number, fta: number, fga: number, to: number): number {
  // Simplified: scored possessions / total possessions used
  // A scored possession = made FG or set of made FTs (estimated at ~0.44 * FTA)
  const scoringPoss = fgMade + 0.44 * (ftMade > 0 ? fta : 0);
  const totalPoss = fga + 0.44 * fta + to;
  return totalPoss > 0 ? (scoringPoss / totalPoss) * 100 : 0;
}

/** Points per Individual Possession Used */
export function calcPPP(pts: number, fga: number, fta: number, to: number): number {
  const poss = fga + 0.44 * fta + to;
  return poss > 0 ? pts / poss : 0;
}

// ============================================
// TEAM ADVANCED METRICS
// ============================================

/** Estimate possessions from box score */
export function estimatePossessions(fga: number, fta: number, to: number, orb: number): number {
  return fga + 0.44 * fta + to - orb;
}

/** Pace — possessions per 48 minutes */
export function calcPace(poss: number, teamMp: number): number {
  return teamMp > 0 ? 48 * (poss / teamMp) : 0;
}

/** Offensive Rating — points per 100 possessions */
export function calcORtg(pts: number, poss: number): number {
  return poss > 0 ? (pts / poss) * 100 : 0;
}

/** Defensive Rating — opponent points per 100 possessions */
export function calcDRtg(oppPts: number, poss: number): number {
  return poss > 0 ? (oppPts / poss) * 100 : 0;
}

/** Team True Shooting % */
export function calcTeamTS(pts: number, fga: number, fta: number): number {
  const denom = 2 * (fga + 0.44 * fta);
  return denom > 0 ? (pts / denom) * 100 : 0;
}

/** Team Effective FG% */
export function calcTeamEFG(fgMade: number, threeMade: number, fga: number): number {
  return fga > 0 ? ((fgMade + 0.5 * threeMade) / fga) * 100 : 0;
}

/** Free Throw Rate (FTA per FGA) — measures ability to get to the line */
export function calcFTRate(fta: number, fga: number): number {
  return fga > 0 ? (fta / fga) * 100 : 0;
}

/** 3-Point Attempt Rate (3PA / FGA) — measures 3-point reliance */
export function calc3PARate(threeAtt: number, fga: number): number {
  return fga > 0 ? (threeAtt / fga) * 100 : 0;
}

/** Team Assist Ratio — assists per 100 possessions */
export function calcAstRatio(ast: number, poss: number): number {
  return poss > 0 ? (ast / poss) * 100 : 0;
}

/** Team Turnover Rate — turnovers per 100 possessions */
export function calcTeamTovRate(to: number, poss: number): number {
  return poss > 0 ? (to / poss) * 100 : 0;
}

/** Team Steal Rate — steals per 100 opponent possessions */
export function calcStlRate(stl: number, oppPoss: number): number {
  return oppPoss > 0 ? (stl / oppPoss) * 100 : 0;
}

/** Team Block Rate — blocks per opponent FGA */
export function calcBlkRate(blk: number, oppFga: number): number {
  return oppFga > 0 ? (blk / oppFga) * 100 : 0;
}

// ============================================
// AGGREGATE HELPERS
// ============================================

export interface PlayerAdvancedAgg {
  playerId: string;
  name: string;
  teamId: string;
  games: number;
  mins: number;
  pts: number;
  fgMade: number; fga: number;
  threeMade: number; threeAtt: number;
  twoMade: number; twoAtt: number;
  ftMade: number; fta: number;
  orb: number; drb: number;
  ast: number; stl: number; blk: number;
  to: number; pf: number;
  efficiency: number;
  plusMinus: number;
  // Per-match team context for USG%
  teamFga: number; teamFta: number; teamTo: number; teamMp: number;
  teamOrb: number; teamDrb: number;
  // Per-match opponent context
  oppOrb: number; oppDrb: number;
  oppFga: number; oppThreeAtt: number; oppFta: number; oppTo: number;
}

export interface TeamAdvancedAgg {
  teamId: string;
  games: number;
  pts: number; oppPts: number;
  fga: number; fta: number; to: number; orb: number;
  oppFga: number; oppFta: number; oppTo: number; oppOrb: number;
  drb: number; oppDrb: number;
  teamMp: number;
  threeMade: number; threeAtt: number;
  fgMade: number;
  ftMade: number;
  ast: number; stl: number; blk: number; pf: number;
}

/** Aggregate player advanced stats from raw PlayerStats + matches */
export function aggregatePlayerAdvanced(
  playerStats: PlayerStats[],
  matches: Match[],
  playedMatchIds: Set<string>,
  players: { id: string; name: string; teamId: string }[]
): PlayerAdvancedAgg[] {
  // Pre-compute team totals per match
  const teamMatchTotals = new Map<string, {
    fga: number; fta: number; to: number; mp: number; orb: number; drb: number; threeAtt: number;
  }>();

  playerStats.forEach(ps => {
    if (!playedMatchIds.has(ps.matchId)) return;
    const key = `${ps.matchId}_${ps.teamId}`;
    if (!teamMatchTotals.has(key)) {
      teamMatchTotals.set(key, { fga: 0, fta: 0, to: 0, mp: 0, orb: 0, drb: 0, threeAtt: 0 });
    }
    const t = teamMatchTotals.get(key)!;
    t.fga += ps.twoAttempted + ps.threeAttempted;
    t.fta += ps.ftAttempted;
    t.to += ps.turnovers;
    t.mp += ps.minutes;
    t.orb += ps.offRebounds;
    t.drb += ps.defRebounds;
    t.threeAtt += ps.threeAttempted;
  });

  // Get opponent team ID for a match
  function getOpponentTeamId(matchId: string, teamId: string): string | null {
    const m = matches.find(m => m.id === matchId);
    if (!m) return null;
    return m.homeTeamId === teamId ? m.awayTeamId : m.homeTeamId;
  }

  const playerMap = new Map<string, PlayerAdvancedAgg>();

  playerStats.forEach(ps => {
    if (!playedMatchIds.has(ps.matchId)) return;
    const player = players.find(p => p.id === ps.playerId);
    if (!player) return;

    if (!playerMap.has(ps.playerId)) {
      playerMap.set(ps.playerId, {
        playerId: ps.playerId, name: player.name, teamId: player.teamId,
        games: 0, mins: 0, pts: 0,
        fgMade: 0, fga: 0, threeMade: 0, threeAtt: 0, twoMade: 0, twoAtt: 0,
        ftMade: 0, fta: 0, orb: 0, drb: 0,
        ast: 0, stl: 0, blk: 0, to: 0, pf: 0,
        efficiency: 0, plusMinus: 0,
        teamFga: 0, teamFta: 0, teamTo: 0, teamMp: 0,
        teamOrb: 0, teamDrb: 0,
        oppOrb: 0, oppDrb: 0, oppFga: 0, oppThreeAtt: 0, oppFta: 0, oppTo: 0,
      });
    }

    const p = playerMap.get(ps.playerId)!;
    p.games++;
    p.mins += ps.minutes;
    p.pts += ps.points;
    p.fgMade += ps.twoMade + ps.threeMade;
    p.fga += ps.twoAttempted + ps.threeAttempted;
    p.threeMade += ps.threeMade;
    p.threeAtt += ps.threeAttempted;
    p.twoMade += ps.twoMade;
    p.twoAtt += ps.twoAttempted;
    p.ftMade += ps.ftMade;
    p.fta += ps.ftAttempted;
    p.orb += ps.offRebounds;
    p.drb += ps.defRebounds;
    p.ast += ps.assists;
    p.stl += ps.recoveries;
    p.blk += ps.blocks;
    p.to += ps.turnovers;
    p.pf += ps.fouls;
    p.efficiency += ps.efficiency;
    p.plusMinus += ps.plusMinus;

    // Team context
    const teamKey = `${ps.matchId}_${ps.teamId}`;
    const teamTotals = teamMatchTotals.get(teamKey);
    if (teamTotals) {
      p.teamFga += teamTotals.fga;
      p.teamFta += teamTotals.fta;
      p.teamTo += teamTotals.to;
      p.teamMp += teamTotals.mp;
      p.teamOrb += teamTotals.orb;
      p.teamDrb += teamTotals.drb;
    }

    // Opponent context
    const oppTeamId = getOpponentTeamId(ps.matchId, ps.teamId);
    if (oppTeamId) {
      const oppKey = `${ps.matchId}_${oppTeamId}`;
      const oppTotals = teamMatchTotals.get(oppKey);
      if (oppTotals) {
        p.oppOrb += oppTotals.orb;
        p.oppDrb += oppTotals.drb;
        p.oppFga += oppTotals.fga;
        p.oppThreeAtt += oppTotals.threeAtt;
        p.oppFta += oppTotals.fta;
        p.oppTo += oppTotals.to;
      }
    }
  });

  return Array.from(playerMap.values());
}

/** Aggregate team advanced stats */
export function aggregateTeamAdvanced(
  playerStats: PlayerStats[],
  matches: Match[],
  playedMatchIds: Set<string>,
  teams: { id: string }[]
): TeamAdvancedAgg[] {
  const teamMap = new Map<string, TeamAdvancedAgg>();

  teams.forEach(t => {
    teamMap.set(t.id, {
      teamId: t.id, games: 0,
      pts: 0, oppPts: 0,
      fga: 0, fta: 0, to: 0, orb: 0,
      oppFga: 0, oppFta: 0, oppTo: 0, oppOrb: 0,
      drb: 0, oppDrb: 0, teamMp: 0,
      threeMade: 0, threeAtt: 0, fgMade: 0, ftMade: 0,
      ast: 0, stl: 0, blk: 0, pf: 0,
    });
  });

  const playedMatches = matches.filter(m => playedMatchIds.has(m.id));

  playedMatches.forEach(m => {
    const homeStats = playerStats.filter(ps => ps.matchId === m.id && ps.teamId === m.homeTeamId);
    const awayStats = playerStats.filter(ps => ps.matchId === m.id && ps.teamId === m.awayTeamId);

    function sumStats(stats: PlayerStats[]) {
      return stats.reduce((acc, ps) => ({
        pts: acc.pts + ps.points,
        fga: acc.fga + ps.twoAttempted + ps.threeAttempted,
        fta: acc.fta + ps.ftAttempted,
        to: acc.to + ps.turnovers,
        orb: acc.orb + ps.offRebounds,
        drb: acc.drb + ps.defRebounds,
        mp: acc.mp + ps.minutes,
        threeMade: acc.threeMade + ps.threeMade,
        threeAtt: acc.threeAtt + ps.threeAttempted,
        fgMade: acc.fgMade + ps.twoMade + ps.threeMade,
        ftMade: acc.ftMade + ps.ftMade,
        ast: acc.ast + ps.assists,
        stl: acc.stl + ps.recoveries,
        blk: acc.blk + ps.blocks,
        pf: acc.pf + ps.fouls,
      }), { pts: 0, fga: 0, fta: 0, to: 0, orb: 0, drb: 0, mp: 0, threeMade: 0, threeAtt: 0, fgMade: 0, ftMade: 0, ast: 0, stl: 0, blk: 0, pf: 0 });
    }

    const homeTotals = sumStats(homeStats);
    const awayTotals = sumStats(awayStats);

    [
      { teamId: m.homeTeamId, own: homeTotals, opp: awayTotals, oppPts: m.awayScore ?? 0 },
      { teamId: m.awayTeamId, own: awayTotals, opp: homeTotals, oppPts: m.homeScore ?? 0 },
    ].forEach(({ teamId, own, opp, oppPts }) => {
      const t = teamMap.get(teamId);
      if (!t) return;
      t.games++;
      t.pts += own.pts;
      t.oppPts += oppPts;
      t.fga += own.fga;
      t.fta += own.fta;
      t.to += own.to;
      t.orb += own.orb;
      t.drb += own.drb;
      t.teamMp += own.mp;
      t.threeMade += own.threeMade;
      t.threeAtt += own.threeAtt;
      t.fgMade += own.fgMade;
      t.ftMade += own.ftMade;
      t.ast += own.ast;
      t.stl += own.stl;
      t.blk += own.blk;
      t.pf += own.pf;
      t.oppFga += opp.fga;
      t.oppFta += opp.fta;
      t.oppTo += opp.to;
      t.oppOrb += opp.orb;
      t.oppDrb += opp.drb;
    });
  });

  return Array.from(teamMap.values()).filter(t => t.games > 0);
}
