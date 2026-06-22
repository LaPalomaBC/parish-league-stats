/**
 * Serializes ALL Parish League data into a compact text format
 * suitable for LLM context window.
 * 
 * Includes: standings, rosters, results, upcoming matches,
 * player totals, averages, ALL advanced stats (TS%, eFG%, USG%,
 * GameScore, AST/TO, TOV%, Floor%, PPP), and ALL team advanced
 * stats (ORtg, DRtg, Net, Pace, TS%, eFG%, FTRate, 3PARate,
 * ASTRatio, TOV%, ORB%, DRB%, STL%, BLK%).
 */

import type { Team, Player, Match, PlayerStats, StandingRow } from './types';
import {
  calcTS, calcEFG, calcUSG, calcGameScore, calcAstTo, calcTovPct,
  calcFloorPct, calcPPP,
  estimatePossessions, calcPace, calcORtg, calcDRtg,
  calcTeamTS, calcTeamEFG, calcFTRate, calc3PARate,
  calcAstRatio, calcTeamTovRate, calcORBPct, calcDRBPct,
  calcStlRate, calcBlkRate,
  aggregatePlayerAdvanced, aggregateTeamAdvanced,
} from './advancedStats';

interface SerializeInput {
  teams: Team[];
  players: Player[];
  matches: Match[];
  playerStats: PlayerStats[];
  standings: StandingRow[];
}

export function serializeLeagueContext(data: SerializeInput): string {
  const { teams, players, matches, playerStats, standings } = data;
  const lines: string[] = [];

  lines.push('=== PARISH LEAGUE 2025/26 — DATOS COMPLETOS ===');

  // ── CLASIFICACIÓN ──
  lines.push('## CLASIFICACIÓN');
  lines.push('#,Equipo,PJ,V,D,PF,PC,DIF,Racha,PTS');
  standings
    .sort((a, b) => a.position - b.position)
    .forEach(s => {
      const t = teams.find(t => t.id === s.teamId);
      lines.push(`${s.position},${t?.shortName||s.teamId},${s.played},${s.wins},${s.losses},${s.pointsFor},${s.pointsAgainst},${s.pointsDiff},${s.streak},${s.leaguePoints}`);
    });

  // ── EQUIPOS + PLANTILLAS ──
  lines.push('## EQUIPOS Y PLANTILLAS');
  teams.forEach(t => {
    const roster = players.filter(p => p.teamId === t.id && p.isActive);
    lines.push(`${t.shortName} (${t.name}): ${roster.map(p => `${p.name}#${p.number}(${p.position.join('/')})`).join(', ')}`);
  });

  // ── RESULTADOS ──
  const playedMatches = matches.filter(m => m.isPlayed && m.homeScore !== null);
  lines.push(`## RESULTADOS (${playedMatches.length} partidos)`);
  playedMatches.forEach(m => {
    const h = teams.find(t => t.id === m.homeTeamId)?.shortName;
    const a = teams.find(t => t.id === m.awayTeamId)?.shortName;
    const date = m.matchDate ? ` (${m.matchDate})` : '';
    lines.push(`J${m.matchday}:${h} ${m.homeScore}-${m.awayScore} ${a}${date}`);
  });

  // ── PRÓXIMOS PARTIDOS ──
  const upcoming = matches.filter(m => !m.isPlayed);
  if (upcoming.length > 0) {
    lines.push(`## PRÓXIMOS PARTIDOS (${upcoming.length})`);
    upcoming.sort((a, b) => a.matchday - b.matchday).forEach(m => {
      const h = teams.find(t => t.id === m.homeTeamId)?.shortName;
      const a = teams.find(t => t.id === m.awayTeamId)?.shortName;
      const date = m.matchDate ? ` (${m.matchDate})` : '';
      lines.push(`J${m.matchday}:${h} vs ${a}${date}`);
    });
  }

  // ── AGGREGATE PLAYER DATA ──
  const playerMap = new Map<string, {
    name: string; teamId: string; number: string; games: number;
    pts: number; ast: number; stl: number; blk: number;
    to: number; eff: number; mins: number;
    t2m: number; t2a: number; tpMade: number; tpAtt: number;
    ftMade: number; fta: number; orb: number; drb: number;
    pf: number; fgMade: number; fga: number; pm: number;
  }>();

  playerStats.forEach(ps => {
    const player = players.find(p => p.id === ps.playerId);
    if (!player) return;
    if (!playerMap.has(ps.playerId)) {
      playerMap.set(ps.playerId, {
        name: player.name, teamId: player.teamId, number: player.number, games: 0,
        pts: 0, ast: 0, stl: 0, blk: 0, to: 0, eff: 0, mins: 0,
        t2m: 0, t2a: 0, tpMade: 0, tpAtt: 0, ftMade: 0, fta: 0,
        orb: 0, drb: 0, pf: 0, fgMade: 0, fga: 0, pm: 0,
      });
    }
    const e = playerMap.get(ps.playerId)!;
    e.games++;
    e.pts += ps.points;
    e.ast += ps.assists;
    e.stl += ps.recoveries;
    e.blk += ps.blocks;
    e.to += ps.turnovers;
    e.eff += ps.efficiency;
    e.mins += ps.minutes;
    e.t2m += ps.twoMade;
    e.t2a += ps.twoAttempted;
    e.tpMade += ps.threeMade;
    e.tpAtt += ps.threeAttempted;
    e.ftMade += ps.ftMade;
    e.fta += ps.ftAttempted;
    e.orb += ps.offRebounds;
    e.drb += ps.defRebounds;
    e.pf += ps.fouls;
    e.fgMade += ps.twoMade + ps.threeMade;
    e.fga += ps.twoAttempted + ps.threeAttempted;
    e.pm += ps.plusMinus;
  });

  // ── TOTALES JUGADORES ──
  lines.push('## TOTALES JUGADORES (temporada completa)');
  lines.push('Nombre,Eq,#,PJ,MIN,PTS,T2m,T2a,T2%,T3m,T3a,T3%,TLm,TLa,TL%,ROF,RDEF,REB,AST,REC,PER,TAP,FC,VAL,+/-');
  Array.from(playerMap.entries())
    .sort((a, b) => b[1].pts - a[1].pts)
    .forEach(([, p]) => {
      const t = teams.find(t => t.id === p.teamId)?.shortName;
      const pct = (m: number, a: number) => a > 0 ? ((m / a) * 100).toFixed(0) : '0';
      lines.push(
        `${p.name},${t},${p.number},${p.games},${p.mins},${p.pts},${p.t2m},${p.t2a},${pct(p.t2m, p.t2a)},${p.tpMade},${p.tpAtt},${pct(p.tpMade, p.tpAtt)},${p.ftMade},${p.fta},${pct(p.ftMade, p.fta)},${p.orb},${p.drb},${p.orb + p.drb},${p.ast},${p.stl},${p.to},${p.blk},${p.pf},${p.eff},${p.pm > 0 ? '+' : ''}${p.pm}`
      );
    });

  // ── MEDIAS JUGADORES ──
  lines.push('## MEDIAS JUGADORES (por partido)');
  lines.push('Nombre,Eq,PJ,PTS,REB,AST,REC,TAP,PER,VAL,TC%,T3%,TL%');
  Array.from(playerMap.entries())
    .sort((a, b) => (b[1].pts / b[1].games) - (a[1].pts / a[1].games))
    .forEach(([, p]) => {
      const t = teams.find(t => t.id === p.teamId)?.shortName;
      const g = p.games;
      const pct = (m: number, a: number) => a > 0 ? ((m / a) * 100).toFixed(0) : '0';
      lines.push(
        `${p.name},${t},${g},${(p.pts/g).toFixed(1)},${((p.orb+p.drb)/g).toFixed(1)},${(p.ast/g).toFixed(1)},${(p.stl/g).toFixed(1)},${(p.blk/g).toFixed(1)},${(p.to/g).toFixed(1)},${(p.eff/g).toFixed(1)},${pct(p.fgMade, p.fga)},${pct(p.tpMade, p.tpAtt)},${pct(p.ftMade, p.fta)}`
      );
    });

  // ── AVANZADAS JUGADORES (ALL) ──
  const playedMatchIds = new Set(playedMatches.map(m => m.id));
  const advPlayers = aggregatePlayerAdvanced(playerStats, matches, playedMatchIds, players).filter(p => p.mins >= 10);

  lines.push('## AVANZADAS JUGADORES (completas)');
  lines.push('Nombre,Eq,PJ,TS%,eFG%,USG%,GmSc,AST/TO,TOV%,Floor%,PPP');
  advPlayers
    .sort((a, b) => {
      const gsA = calcGameScore(a.pts, a.fgMade, a.fga, a.ftMade, a.fta, a.orb, a.drb, a.stl, a.ast, a.blk, a.pf, a.to) / a.games;
      const gsB = calcGameScore(b.pts, b.fgMade, b.fga, b.ftMade, b.fta, b.orb, b.drb, b.stl, b.ast, b.blk, b.pf, b.to) / b.games;
      return gsB - gsA;
    })
    .forEach(p => {
      const t = teams.find(t => t.id === p.teamId)?.shortName;
      const ts = calcTS(p.pts, p.fga, p.fta);
      const efg = calcEFG(p.fgMade, p.threeMade, p.fga);
      const usg = calcUSG(p.fga, p.fta, p.to, p.mins, p.teamFga, p.teamFta, p.teamTo, p.teamMp);
      const gs = calcGameScore(p.pts, p.fgMade, p.fga, p.ftMade, p.fta, p.orb, p.drb, p.stl, p.ast, p.blk, p.pf, p.to) / p.games;
      const astTo = calcAstTo(p.ast, p.to);
      const tovPct = calcTovPct(p.fga, p.fta, p.to);
      const floorPct = calcFloorPct(p.fgMade, p.ftMade, p.fta, p.fga, p.to);
      const ppp = calcPPP(p.pts, p.fga, p.fta, p.to);
      lines.push(`${p.name},${t},${p.games},${ts.toFixed(1)},${efg.toFixed(1)},${usg.toFixed(1)},${gs.toFixed(1)},${astTo.toFixed(2)},${tovPct.toFixed(1)},${floorPct.toFixed(1)},${ppp.toFixed(2)}`);
    });

  // ── AVANZADAS EQUIPOS (ALL) ──
  const advTeams = aggregateTeamAdvanced(playerStats, matches, playedMatchIds, teams);
  lines.push('## AVANZADAS EQUIPOS (completas)');
  lines.push('Eq,ORtg,DRtg,Net,Pace,TS%,eFG%,FTRate,3PARate,ASTRatio,TOV%,ORB%,DRB%,STL%,BLK%');
  advTeams.forEach(t => {
    const team = teams.find(tm => tm.id === t.teamId);
    const poss = estimatePossessions(t.fga, t.fta, t.to, t.orb);
    const oppPoss = estimatePossessions(t.oppFga, t.oppFta, t.oppTo, t.oppOrb);
    const ortg = calcORtg(t.pts, poss);
    const drtg = calcDRtg(t.oppPts, oppPoss);
    const pace = calcPace(poss, t.teamMp);
    const ts = calcTeamTS(t.pts, t.fga, t.fta);
    const efg = calcTeamEFG(t.fgMade, t.threeMade, t.fga);
    const ftRate = calcFTRate(t.fta, t.fga);
    const threeRate = calc3PARate(t.threeAtt, t.fga);
    const astRatio = calcAstRatio(t.ast, poss);
    const tovRate = calcTeamTovRate(t.to, poss);
    const orbPct = calcORBPct(t.orb, t.oppDrb);
    const drbPct = calcDRBPct(t.drb, t.oppOrb);
    const stlRate = calcStlRate(t.stl, oppPoss);
    const blkRate = calcBlkRate(t.blk, t.oppFga);
    lines.push(
      `${team?.shortName},${ortg.toFixed(0)},${drtg.toFixed(0)},${(ortg - drtg).toFixed(0)},${pace.toFixed(0)},${ts.toFixed(1)},${efg.toFixed(1)},${ftRate.toFixed(1)},${threeRate.toFixed(1)},${astRatio.toFixed(1)},${tovRate.toFixed(1)},${orbPct.toFixed(1)},${drbPct.toFixed(1)},${stlRate.toFixed(1)},${blkRate.toFixed(1)}`
    );
  });

  // ── RANKINGS (top 5 por categoría) ──
  lines.push('## RANKINGS TOP 5');
  const sorted = Array.from(playerMap.entries());
  const top = (label: string, fn: (p: typeof sorted[0][1]) => number, minGames = 3) => {
    const filtered = sorted.filter(([, p]) => p.games >= minGames);
    const ranked = [...filtered].sort((a, b) => fn(b[1]) - fn(a[1])).slice(0, 5);
    const t = (p: typeof sorted[0][1]) => teams.find(t => t.id === p.teamId)?.shortName;
    lines.push(`${label}: ${ranked.map(([, p], i) => `${i+1}.${p.name}(${t(p)})=${fn(p).toFixed(1)}`).join(', ')}`);
  };
  top('PTS/partido', p => p.pts / p.games);
  top('REB/partido', p => (p.orb + p.drb) / p.games);
  top('AST/partido', p => p.ast / p.games);
  top('REC/partido', p => p.stl / p.games);
  top('TAP/partido', p => p.blk / p.games);
  top('VAL/partido', p => p.eff / p.games);
  top('TL% (min 10 TLa)', p => p.fta >= 10 ? (p.ftMade / p.fta) * 100 : -1, 1);
  top('T3% (min 10 T3a)', p => p.tpAtt >= 10 ? (p.tpMade / p.tpAtt) * 100 : -1, 1);
  top('TC%', p => p.fga > 0 ? (p.fgMade / p.fga) * 100 : 0);

  return lines.join('\n');
}
