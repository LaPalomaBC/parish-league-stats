'use client';

import { useMemo, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, BarChart3, Download, Share2, Loader2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import { useLeagueData } from '@/lib/DataContext';
import TeamLogo from '@/components/TeamLogo';
import StatsFilterBar, { emptyFilters, filterMatchIds, type StatsFilters } from '@/components/StatsFilterBar';
import {
  calcTS, calcEFG, per48, calcUSG, calcAstTo, calcTovPct, calcGameScore,
  calcFloorPct, calcPPP, calcTRBPct, calcStlPct, calcBlkPct,
  estimatePossessions, calcPace, calcORtg, calcDRtg,
  aggregatePlayerAdvanced, aggregateTeamAdvanced,
  type PlayerAdvancedAgg, type TeamAdvancedAgg,
} from '@/lib/advancedStats';

// ============================================
// Stat config: maps statKey → title, calc fn, etc.
// ============================================

type PlayerCalcFn = (p: PlayerAdvancedAgg) => number;
type TeamCalcFn = (t: TeamAdvancedAgg) => number;

interface StatDef {
  title: string;
  chartLabel: string;
  suffix: string;
  desc: boolean;
  decimals?: number;
  showSign?: boolean;
  type: 'player' | 'team';
  playerFn?: PlayerCalcFn;
  teamFn?: TeamCalcFn;
  minFilter?: (p: PlayerAdvancedAgg) => boolean;
  description: string;
}

const STAT_DEFS: Record<string, StatDef> = {
  // Shooting
  ts:   { title: 'True Shooting %', chartLabel: 'TS%', suffix: '%', desc: true, type: 'player',
          playerFn: p => calcTS(p.pts, p.fga, p.fta), minFilter: p => p.fga >= 3,
          description: 'Eficiencia real de anotación contando tiros de 2, triples y tiros libres' },
  efg:  { title: 'Effective FG%', chartLabel: 'eFG%', suffix: '%', desc: true, type: 'player',
          playerFn: p => calcEFG(p.fgMade, p.threeMade, p.fga), minFilter: p => p.fga >= 3,
          description: '% de tiro ajustado por el valor extra de los triples' },
  // Per 48
  pts48: { title: 'Puntos / 48 min', chartLabel: 'PTS/48', suffix: '', desc: true, type: 'player',
           playerFn: p => per48(p.pts, p.mins),
           description: 'Puntos que haría si jugara un partido completo de 48 min' },
  reb48: { title: 'Rebotes / 48 min', chartLabel: 'REB/48', suffix: '', desc: true, type: 'player',
           playerFn: p => per48(p.orb + p.drb, p.mins),
           description: 'Rebotes proyectados a un partido completo de 48 min' },
  ast48: { title: 'Asistencias / 48 min', chartLabel: 'AST/48', suffix: '', desc: true, type: 'player',
           playerFn: p => per48(p.ast, p.mins),
           description: 'Asistencias proyectadas a un partido completo de 48 min' },
  stl48: { title: 'Recuperaciones / 48 min', chartLabel: 'STL/48', suffix: '', desc: true, type: 'player',
           playerFn: p => per48(p.stl, p.mins),
           description: 'Recuperaciones proyectadas a un partido completo de 48 min' },
  blk48: { title: 'Tapones / 48 min', chartLabel: 'BLK/48', suffix: '', desc: true, type: 'player',
           playerFn: p => per48(p.blk, p.mins),
           description: 'Tapones proyectados a un partido completo de 48 min' },
  // Game Metrics
  usg:      { title: 'Usage Rate', chartLabel: 'USG%', suffix: '%', desc: true, type: 'player',
              playerFn: p => calcUSG(p.fga, p.fta, p.to, p.mins, p.teamFga, p.teamFta, p.teamTo, p.teamMp),
              description: '% de jugadas del equipo que consume el jugador en pista' },
  astto:    { title: 'Ratio AST/TO', chartLabel: 'AST/TO', suffix: '', desc: true, decimals: 2, type: 'player',
              playerFn: p => calcAstTo(p.ast, p.to),
              description: 'Asistencias por cada pérdida — mide visión de juego y cuidado del balón' },
  tovpct:   { title: 'Turnover Rate', chartLabel: 'TOV%', suffix: '%', desc: false, type: 'player',
              playerFn: p => calcTovPct(p.fga, p.fta, p.to),
              description: '% de posesiones que acaban en pérdida de balón (cuanto menos, mejor)' },
  gamescore: { title: 'Game Score', chartLabel: 'GmSc', suffix: '', desc: true, type: 'player',
               playerFn: p => calcGameScore(p.pts, p.fgMade, p.fga, p.ftMade, p.fta, p.orb, p.drb, p.stl, p.ast, p.blk, p.pf, p.to) / p.games,
               description: 'Nota global del partido — resume toda la producción en un solo número' },
  // Shooting extended
  floorPct: { title: 'Floor %', chartLabel: 'FLR%', suffix: '%', desc: true, type: 'player',
              playerFn: p => calcFloorPct(p.fgMade, p.ftMade, p.fta, p.fga, p.to), minFilter: p => p.fga >= 3,
              description: '% de posesiones usadas que acaban en canasta' },
  ppp:      { title: 'Points per Possession', chartLabel: 'PPP', suffix: '', desc: true, decimals: 2, type: 'player',
              playerFn: p => calcPPP(p.pts, p.fga, p.fta, p.to), minFilter: p => p.fga >= 3,
              description: 'Puntos por cada posesión individual usada' },
  // Rebounding
  trbPct:   { title: 'Total Rebound %', chartLabel: 'TRB%', suffix: '%', desc: true, type: 'player',
              playerFn: p => calcTRBPct(p.orb, p.drb, p.mins, p.teamOrb, p.teamDrb, p.oppOrb, p.oppDrb, p.teamMp),
              description: '% de rebotes disponibles que captura el jugador estando en pista' },
  orbPct:   { title: 'Off. Rebound %', chartLabel: 'ORB%', suffix: '%', desc: true, type: 'player',
              playerFn: p => { const t = p.orb + p.oppDrb; return t > 0 ? (p.orb / t) * 100 : 0; },
              description: '% de rebotes ofensivos capturados' },
  drbPct:   { title: 'Def. Rebound %', chartLabel: 'DRB%', suffix: '%', desc: true, type: 'player',
              playerFn: p => { const t = p.drb + p.oppOrb; return t > 0 ? (p.drb / t) * 100 : 0; },
              description: '% de rebotes defensivos capturados' },
  // Individual Defense
  stlPct:   { title: 'Steal %', chartLabel: 'STL%', suffix: '%', desc: true, type: 'player',
              playerFn: p => { const opp = estimatePossessions(p.oppFga, p.oppFta, p.oppTo, p.oppOrb); return calcStlPct(p.stl, p.mins, opp, p.teamMp); },
              description: '% de posesiones rivales que acaban en robo estando en pista' },
  blkPct:   { title: 'Block %', chartLabel: 'BLK%', suffix: '%', desc: true, type: 'player',
              playerFn: p => calcBlkPct(p.blk, p.mins, p.oppFga, p.oppThreeAtt, p.teamMp),
              description: '% de tiros de 2 del rival que son taponados estando en pista' },
  // Team Advanced
  pace:   { title: 'Pace (Ritmo)', chartLabel: 'PACE', suffix: '', desc: true, type: 'team',
            teamFn: t => calcPace(estimatePossessions(t.fga, t.fta, t.to, t.orb), t.teamMp),
            description: 'Posesiones por partido — mide lo rápido que juega el equipo' },
  ortg:   { title: 'Offensive Rating', chartLabel: 'ORtg', suffix: '', desc: true, type: 'team',
            teamFn: t => calcORtg(t.pts, estimatePossessions(t.fga, t.fta, t.to, t.orb)),
            description: 'Puntos anotados cada 100 posesiones — eficiencia ofensiva real' },
  drtg:   { title: 'Defensive Rating', chartLabel: 'DRtg', suffix: '', desc: false, type: 'team',
            teamFn: t => calcDRtg(t.oppPts, estimatePossessions(t.oppFga, t.oppFta, t.oppTo, t.oppOrb)),
            description: 'Puntos encajados cada 100 posesiones (cuanto menos, mejor defensa)' },
  netrtg: { title: 'Net Rating', chartLabel: 'NET', suffix: '', desc: true, showSign: true, type: 'team',
            teamFn: t => {
              const oPoss = estimatePossessions(t.fga, t.fta, t.to, t.orb);
              const dPoss = estimatePossessions(t.oppFga, t.oppFta, t.oppTo, t.oppOrb);
              return calcORtg(t.pts, oPoss) - calcDRtg(t.oppPts, dPoss);
            },
            description: 'Diferencia entre ORtg y DRtg — balance global del equipo' },
};

// ============================================
// PAGE
// ============================================

export default function AdvancedStatDetailPage() {
  const params = useParams();
  const statKey = params.statKey as string;
  const config = STAT_DEFS[statKey];
  const { teams, players, matches, playerStats } = useLeagueData();
  const [filters, setFilters] = useState<StatsFilters>(emptyFilters());

  const validMatchIds = useMemo(() => filterMatchIds(matches, filters), [matches, filters]);

  // Player stats
  const playerRanked = useMemo(() => {
    if (!config || config.type !== 'player' || !config.playerFn) return [];
    const aggs = aggregatePlayerAdvanced(playerStats, matches, validMatchIds, players);
    let qualified = aggs.filter(p => p.mins >= 10);
    if (config.minFilter) qualified = qualified.filter(config.minFilter);
    if (filters.teamIds.length > 0) qualified = qualified.filter(p => filters.teamIds.includes(p.teamId));

    return qualified
      .map(p => ({ ...p, value: config.playerFn!(p) }))
      .sort((a, b) => config.desc ? b.value - a.value : a.value - b.value);
  }, [config, playerStats, matches, validMatchIds, players, filters]);

  // Team stats
  const teamRanked = useMemo(() => {
    if (!config || config.type !== 'team' || !config.teamFn) return [];
    const aggs = aggregateTeamAdvanced(playerStats, matches, validMatchIds, teams);
    return aggs
      .map(t => ({ ...t, value: config.teamFn!(t) }))
      .sort((a, b) => config.desc ? b.value - a.value : a.value - b.value);
  }, [config, playerStats, matches, validMatchIds, teams]);

  if (!config) {
    return (
      <div className="page-container">
        <p>Estadística no encontrada.</p>
        <Link href="/estadisticas?tab=avanzadas">← Volver</Link>
      </div>
    );
  }

  const decimals = config.decimals ?? 1;
  const isTeam = config.type === 'team';
  const ranked = isTeam ? teamRanked : playerRanked;
  const maxVal = Math.max(...ranked.map(r => Math.abs(r.value)), 1);
  const chartRef = useRef<HTMLDivElement>(null);
  const [busyCapture, setBusyCapture] = useState(false);

  const handleCapture = useCallback(async () => {
    if (!chartRef.current || busyCapture) return;
    setBusyCapture(true);
    try {
      const dataUrl = await toPng(chartRef.current, { backgroundColor: '#ffffff', pixelRatio: 2, cacheBust: true });
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (isMobile && navigator.share && navigator.canShare) {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const file = new File([blob], `${statKey}.png`, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ title: config.title, files: [file] });
          setBusyCapture(false);
          return;
        }
      }
      const link = document.createElement('a');
      link.download = `${statKey}-parish-league.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) { console.error('Capture failed:', err); }
    setBusyCapture(false);
  }, [busyCapture, statKey, config]);

  return (
    <div className="page-container">
      {/* Header */}
      <div className="section animate-fade-in-up">
        <Link href="/estadisticas?tab=avanzadas" style={{
          display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)',
          fontSize: 'var(--text-sm)', color: 'var(--color-primary)', textDecoration: 'none',
          fontWeight: 600, marginBottom: 'var(--space-4)',
        }}>
          <ArrowLeft size={16} /> Estadísticas
        </Link>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <BarChart3 size={28} style={{ color: 'var(--color-primary-light)' }} />
          {config.title}
          <span style={{
            fontSize: 'var(--text-xs)', fontWeight: 700, padding: '4px 12px',
            borderRadius: 'var(--radius-full)',
            background: isTeam ? 'rgba(52,199,89,0.08)' : 'var(--color-primary-bg)',
            color: isTeam ? 'var(--color-success)' : 'var(--color-primary)',
          }}>
            {isTeam ? 'TEAM' : 'ADV'}
          </span>
        </h1>
        <p style={{
          fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)',
          marginTop: 'var(--space-2)', lineHeight: 1.4,
        }}>
          {config.description}
        </p>
      </div>

      {/* Filters */}
      <div className="animate-fade-in-up delay-1" style={{ position: 'relative', zIndex: 50 }}>
        <StatsFilterBar
          teams={teams} matches={matches} filters={filters} onChange={setFilters}
          mode={isTeam ? 'equipos' : 'jugadores'}
        />
      </div>

      {/* Bar Chart */}
      <div className="section animate-fade-in-up delay-1">
        <div className="card" style={{ padding: 'var(--space-6)' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-3)' }}>
            <button
              onClick={handleCapture}
              disabled={busyCapture}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-light)',
                background: 'var(--color-bg-secondary)',
                color: busyCapture ? 'var(--color-text-tertiary)' : 'var(--color-primary)',
                fontSize: 'var(--text-xs)', fontWeight: 600,
                fontFamily: 'var(--font-body)',
                cursor: busyCapture ? 'wait' : 'pointer',
                transition: 'all var(--transition-fast)',
                opacity: busyCapture ? 0.7 : 1,
              }}
              onMouseEnter={e => { if (!busyCapture) { e.currentTarget.style.background = 'var(--color-primary-bg)'; e.currentTarget.style.borderColor = 'var(--color-primary)'; } }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-bg-secondary)'; e.currentTarget.style.borderColor = 'var(--color-border-light)'; }}
            >
              {busyCapture ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={14} />}
              Descargar
            </button>
          </div>
          <div ref={chartRef} style={{ padding: 'var(--space-4)' }}>
          <h3 style={{
            fontFamily: 'var(--font-display)', fontWeight: 800,
            fontSize: 'var(--text-base)', marginBottom: 'var(--space-4)',
            color: 'var(--color-text-primary)',
          }}>
            📊 {isTeam ? `${config.chartLabel} por equipo` : `Top 10 — ${config.chartLabel}`}
          </h3>
          {ranked.length === 0 ? (
            <p style={{ color: 'var(--color-text-tertiary)', textAlign: 'center', padding: 'var(--space-6)' }}>
              No hay datos para los filtros seleccionados
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {ranked.slice(0, isTeam ? ranked.length : 10).map((item, i) => {
                const team = teams.find(t => t.id === ('teamId' in item ? item.teamId : ''));
                const barWidth = maxVal > 0 ? (Math.abs(item.value) / maxVal) * 100 : 0;
                const isFirst = i === 0;
                const name = isTeam ? team?.name || '' : ('name' in item ? (item as { name: string }).name : '');
                const playerId = !isTeam && 'playerId' in item ? (item as { playerId: string }).playerId : '';

                return (
                  <div key={isTeam ? (item as TeamAdvancedAgg & { value: number }).teamId : playerId} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <span style={{
                      width: 20, fontSize: 'var(--text-xs)', fontWeight: 700, textAlign: 'center',
                      color: i < 3 ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
                    }}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                    </span>
                    <div style={{ width: isTeam ? 140 : 200, display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
                      {team && <TeamLogo team={team} size="sm" />}
                      {isTeam ? (
                        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>{team?.shortName}</span>
                      ) : (
                        <Link href={`/jugadores/${playerId}`}
                          style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'inherit', textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {name}
                        </Link>
                      )}
                    </div>
                    <div style={{ flex: 1, height: 24, background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${barWidth}%`,
                        background: team ? `linear-gradient(90deg, ${team.primaryColor}, ${team.secondaryColor || team.primaryColor}cc)` : 'var(--color-primary)',
                        borderRadius: 'var(--radius-md)', transition: 'width 0.8s ease',
                        opacity: isFirst ? 1 : 0.65,
                      }} />
                    </div>
                    <span style={{
                      fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '12px',
                      color: isFirst ? 'var(--color-accent)' : 'var(--color-text-primary)',
                      minWidth: 55, textAlign: 'right', flexShrink: 0,
                    }}>
                      {config.showSign && item.value > 0 ? '+' : ''}{item.value.toFixed(decimals)}{config.suffix}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Full Table */}
      <div className="section animate-fade-in-up delay-2">
        <div className="card" style={{ padding: 'var(--space-5)' }}>
          <h2 className="section-title" style={{ marginBottom: 'var(--space-4)' }}>
            {isTeam ? 'Clasificación completa' : `Tabla completa (${ranked.length} jugadores)`}
          </h2>
          {ranked.length === 0 ? (
            <p style={{ color: 'var(--color-text-tertiary)', textAlign: 'center', padding: 'var(--space-6)' }}>
              No hay datos
            </p>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th>{isTeam ? 'Equipo' : 'Jugador'}</th>
                    {!isTeam && <th>Equipo</th>}
                    <th className="text-center">PJ</th>
                    {!isTeam && <th className="text-center">MIN</th>}
                    <th className="text-center" style={{ fontWeight: 800 }}>{config.chartLabel}</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((item, i) => {
                    const team = teams.find(t => t.id === ('teamId' in item ? item.teamId : ''));
                    const name = !isTeam && 'name' in item ? (item as { name: string }).name : team?.name || '';
                    const playerId = !isTeam && 'playerId' in item ? (item as { playerId: string }).playerId : '';
                    const games = 'games' in item ? (item as { games: number }).games : 0;
                    const mins = !isTeam && 'mins' in item ? (item as { mins: number }).mins : 0;

                    return (
                      <tr key={isTeam ? `team-${i}` : playerId}>
                        <td style={{
                          fontWeight: 700, fontSize: 'var(--text-sm)',
                          color: i < 3 ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
                        }}>
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                        </td>
                        <td>
                          {isTeam ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                              {team && <TeamLogo team={team} size="sm" />}
                              <span style={{ fontWeight: 600 }}>{team?.name}</span>
                            </div>
                          ) : (
                            <Link href={`/jugadores/${playerId}`}
                              style={{ fontWeight: 600, color: 'inherit', textDecoration: 'none', fontSize: 'var(--text-sm)' }}>
                              {name}
                            </Link>
                          )}
                        </td>
                        {!isTeam && (
                          <td>
                            {team && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                <TeamLogo team={team} size="sm" />
                                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{team.shortName}</span>
                              </div>
                            )}
                          </td>
                        )}
                        <td className="text-center" style={{ color: 'var(--color-text-tertiary)' }}>{games}</td>
                        {!isTeam && (
                          <td className="text-center" style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
                            {mins.toFixed(0)}
                          </td>
                        )}
                        <td className="text-center" style={{
                          fontFamily: 'var(--font-display)', fontWeight: 800,
                          color: i === 0 ? 'var(--color-primary)' : 'var(--color-text-primary)',
                        }}>
                          {config.showSign && item.value > 0 ? '+' : ''}{item.value.toFixed(decimals)}{config.suffix}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
