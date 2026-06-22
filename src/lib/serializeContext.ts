/**
 * Serializes all Parish League data into a compact text format
 * suitable for LLM context window.
 * 
 * IMPORTANT: This sends ALL available data so the chatbot can
 * answer any question about the league without guessing.
 */

import type { Team, Player, Match, PlayerStats, StandingRow } from './types';
import {
  calcTS, calcEFG, per48, calcUSG, calcGameScore, calcAstTo,
  estimatePossessions, calcPace, calcORtg, calcDRtg,
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

  lines.push('=== PARISH LEAGUE 2025/26 ===');

  // --- Standings (compact CSV) ---
  lines.push('## CLASIFICACIÓN');
  lines.push('#,Equipo,PJ,V,D,PF,PC,DIF,Racha,PTS');
  standings
    .sort((a, b) => a.position - b.position)
    .forEach(s => {
      const t = teams.find(t => t.id === s.teamId);
      lines.push(`${s.position},${t?.shortName||s.teamId},${s.played},${s.wins},${s.losses},${s.pointsFor},${s.pointsAgainst},${s.pointsDiff},${s.streak},${s.leaguePoints}`);
    });

  // --- Teams + rosters ---
  lines.push('## EQUIPOS');
  teams.forEach(t => {
    const roster = players.filter(p => p.teamId === t.id && p.isActive);
    lines.push(`${t.shortName} (${t.name}): ${roster.map(p => `${p.name}#${p.number}(${p.position.join('/')})`).join(',')}`);
  });

  // --- ALL Match Results (compact) ---
  const playedMatches = matches.filter(m => m.isPlayed && m.homeScore !== null);
  lines.push(`## RESULTADOS (${playedMatches.length} partidos jugados)`);
  playedMatches.forEach(m => {
    const h = teams.find(t => t.id === m.homeTeamId)?.shortName;
    const a = teams.find(t => t.id === m.awayTeamId)?.shortName;
    const date = m.matchDate ? ` (${m.matchDate})` : '';
    lines.push(`J${m.matchday}:${h} ${m.homeScore}-${m.awayScore} ${a}${date}`);
  });

  // --- Upcoming matches ---
  const upcoming = matches.filter(m => !m.isPlayed);
  if (upcoming.length > 0) {
    lines.push(`## PRÓXIMOS PARTIDOS (${upcoming.length})`);
    upcoming
      .sort((a, b) => a.matchday - b.matchday)
      .forEach(m => {
        const h = teams.find(t => t.id === m.homeTeamId)?.shortName;
        const a = teams.find(t => t.id === m.awayTeamId)?.shortName;
        const date = m.matchDate ? ` (${m.matchDate})` : '';
        lines.push(`J${m.matchday}:${h} vs ${a}${date}`);
      });
  }

  // --- Aggregate player totals ---
  const playerMap = new Map<string, {
    name: string; teamId: string; number: string; games: number;
    pts: number; reb: number; ast: number; stl: number; blk: number;
    to: number; eff: number; mins: number;
    t2m: number; t2a: number; tpMade: number; tpAtt: number;
    ftMade: number; fta: number; orb: number; drb: number; pf: number;
    fgMade: number; fga: number; pm: number;
  }>();

  playerStats.forEach(ps => {
    const player = players.find(p => p.id === ps.playerId);
    if (!player) return;
    if (!playerMap.has(ps.playerId)) {
      playerMap.set(ps.playerId, {
        name: player.name, teamId: player.teamId, number: player.number, games: 0,
        pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, to: 0, eff: 0, mins: 0,
        t2m: 0, t2a: 0, tpMade: 0, tpAtt: 0, ftMade: 0, fta: 0,
        orb: 0, drb: 0, pf: 0, fgMade: 0, fga: 0, pm: 0,
      });
    }
    const e = playerMap.get(ps.playerId)!;
    e.games++;
    e.pts += ps.points;
    e.reb += ps.offRebounds + ps.defRebounds;
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

  // --- Player TOTALS (all stats) ---
  lines.push('## TOTALES JUGADORES (toda la temporada)');
  lines.push('Nombre,Eq,#,PJ,MIN,PTS,T2m,T2a,T2%,T3m,T3a,T3%,TLm,TLa,TL%,ROF,RDEF,REB,AST,REC,PER,TAP,FC,VAL,+/-');
  Array.from(playerMap.entries())
    .sort((a, b) => b[1].pts - a[1].pts)
    .forEach(([, p]) => {
      const t = teams.find(t => t.id === p.teamId)?.shortName;
      const t2pct = p.t2a > 0 ? ((p.t2m / p.t2a) * 100).toFixed(0) : '0';
      const t3pct = p.tpAtt > 0 ? ((p.tpMade / p.tpAtt) * 100).toFixed(0) : '0';
      const tlpct = p.fta > 0 ? ((p.ftMade / p.fta) * 100).toFixed(0) : '0';
      lines.push(
        `${p.name},${t},${p.number},${p.games},${p.mins},${p.pts},${p.t2m},${p.t2a},${t2pct},${p.tpMade},${p.tpAtt},${t3pct},${p.ftMade},${p.fta},${tlpct},${p.orb},${p.drb},${p.reb},${p.ast},${p.stl},${p.to},${p.blk},${p.pf},${p.eff},${p.pm > 0 ? '+' : ''}${p.pm}`
      );
    });

  // --- Player AVERAGES (per game) ---
  lines.push('## MEDIAS JUGADORES (por partido)');
  lines.push('Nombre,Eq,PJ,PTS,REB,AST,REC,TAP,PER,VAL,TC%,T3%,TL%');
  Array.from(playerMap.entries())
    .sort((a, b) => (b[1].pts / b[1].games) - (a[1].pts / a[1].games))
    .forEach(([, p]) => {
      const t = teams.find(t => t.id === p.teamId)?.shortName;
      const g = p.games;
      lines.push(
        `${p.name},${t},${g},${(p.pts/g).toFixed(1)},${(p.reb/g).toFixed(1)},${(p.ast/g).toFixed(1)},${(p.stl/g).toFixed(1)},${(p.blk/g).toFixed(1)},${(p.to/g).toFixed(1)},${(p.eff/g).toFixed(1)},${p.fga>0?((p.fgMade/p.fga)*100).toFixed(0):'0'},${p.tpAtt>0?((p.tpMade/p.tpAtt)*100).toFixed(0):'0'},${p.fta>0?((p.ftMade/p.fta)*100).toFixed(0):'0'}`
      );
    });

  // --- ALL Advanced Stats (compact CSV) ---
  const playedMatchIds = new Set(playedMatches.map(m => m.id));
  const advPlayers = aggregatePlayerAdvanced(playerStats, matches, playedMatchIds, players).filter(p => p.mins >= 10);

  lines.push('## AVANZADAS JUGADORES');
  lines.push('Nombre,Eq,TS%,eFG%,GmSc');
  advPlayers
    .sort((a, b) => calcGameScore(b.pts, b.fgMade, b.fga, b.ftMade, b.fta, b.orb, b.drb, b.stl, b.ast, b.blk, b.pf, b.to) / b.games
      - calcGameScore(a.pts, a.fgMade, a.fga, a.ftMade, a.fta, a.orb, a.drb, a.stl, a.ast, a.blk, a.pf, a.to) / a.games)
    .forEach(p => {
      const t = teams.find(t => t.id === p.teamId)?.shortName;
      const ts = calcTS(p.pts, p.fga, p.fta);
      const efg = calcEFG(p.fgMade, p.threeMade, p.fga);
      const gs = calcGameScore(p.pts, p.fgMade, p.fga, p.ftMade, p.fta, p.orb, p.drb, p.stl, p.ast, p.blk, p.pf, p.to) / p.games;
      lines.push(`${p.name},${t},${ts.toFixed(0)},${efg.toFixed(0)},${gs.toFixed(1)}`);
    });

  // --- Team Advanced (compact) ---
  const advTeams = aggregateTeamAdvanced(playerStats, matches, playedMatchIds, teams);
  lines.push('## AVANZADAS EQUIPOS');
  lines.push('Eq,ORtg,DRtg,Net,Pace');
  advTeams.forEach(t => {
    const team = teams.find(tm => tm.id === t.teamId);
    const poss = estimatePossessions(t.fga, t.fta, t.to, t.orb);
    const oppPoss = estimatePossessions(t.oppFga, t.oppFta, t.oppTo, t.oppOrb);
    const pace = calcPace(poss, t.teamMp);
    lines.push(`${team?.shortName},${calcORtg(t.pts, poss).toFixed(0)},${calcDRtg(t.oppPts, oppPoss).toFixed(0)},${(calcORtg(t.pts, poss) - calcDRtg(t.oppPts, oppPoss)).toFixed(0)},${pace.toFixed(0)}`);
  });

  return lines.join('\n');
}
