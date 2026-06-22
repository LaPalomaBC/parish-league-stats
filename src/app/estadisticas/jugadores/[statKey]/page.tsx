'use client';

import { useMemo, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, BarChart3, Download, Share2, Loader2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import { useLeagueData } from '@/lib/DataContext';
import TeamLogo from '@/components/TeamLogo';
import StatsFilterBar, { emptyFilters, filterMatchIds, type StatsFilters } from '@/components/StatsFilterBar';

interface PlayerAgg {
  playerId: string; name: string; teamId: string; games: number;
  pts: number; reb: number; ast: number; stl: number; blk: number;
  to: number; eff: number; fouls: number;
  fgMade: number; fgAtt: number; tpMade: number; tpAtt: number;
  ftMade: number; ftAtt: number; mins: number;
}

const STAT_CONFIG: Record<string, {
  title: string;
  fn: (p: PlayerAgg) => number;
  desc: boolean;
  suffix: string;
  chartLabel: string;
  minReq?: (p: PlayerAgg) => boolean;
}> = {
  scorers:    { title: 'Anotadores',           fn: p => p.pts / p.games,  desc: true,  suffix: '',  chartLabel: 'PPP' },
  rebounders: { title: 'Reboteadores',         fn: p => p.reb / p.games,  desc: true,  suffix: '',  chartLabel: 'RPP' },
  assisters:  { title: 'Asistentes',           fn: p => p.ast / p.games,  desc: true,  suffix: '',  chartLabel: 'APP' },
  stealers:   { title: 'Recuperaciones',       fn: p => p.stl / p.games,  desc: true,  suffix: '',  chartLabel: 'RCpp' },
  blockers:   { title: 'Taponadores',          fn: p => p.blk / p.games,  desc: true,  suffix: '',  chartLabel: 'BPP' },
  efficient:  { title: 'Eficiencia',           fn: p => p.eff / p.games,  desc: true,  suffix: '',  chartLabel: 'VAL' },
  fgPct:      { title: '% Tiros de campo',     fn: p => p.fgAtt > 0 ? (p.fgMade / p.fgAtt) * 100 : 0,  desc: true, suffix: '%', chartLabel: 'FG%' },
  threePct:   { title: '% Triples',            fn: p => p.tpAtt > 0 ? (p.tpMade / p.tpAtt) * 100 : 0,  desc: true, suffix: '%', chartLabel: '3P%', minReq: p => p.tpAtt >= 3 },
  ftPct:      { title: '% Tiros libres',       fn: p => p.ftAtt > 0 ? (p.ftMade / p.ftAtt) * 100 : 0,  desc: true, suffix: '%', chartLabel: 'FT%', minReq: p => p.ftAtt >= 3 },
  minutes:    { title: 'Minutos por partido',   fn: p => p.mins / p.games, desc: true,  suffix: '',  chartLabel: 'MPP' },
};

export default function PlayerStatDetailPage() {
  const params = useParams();
  const statKey = params.statKey as string;
  const config = STAT_CONFIG[statKey];
  const { teams, players, matches, playerStats } = useLeagueData();
  const [filters, setFilters] = useState<StatsFilters>(emptyFilters());

  const ranked = useMemo(() => {
    const validMatchIds = filterMatchIds(matches, filters);
    const playerMap = new Map<string, PlayerAgg>();

    playerStats.forEach(ps => {
      if (!validMatchIds.has(ps.matchId)) return;

      // If team filter is active, only include stats from those teams
      if (filters.teamIds.length > 0 && !filters.teamIds.includes(ps.teamId)) return;

      const player = players.find(p => p.id === ps.playerId);
      if (!player) return;
      if (!playerMap.has(ps.playerId)) {
        playerMap.set(ps.playerId, {
          playerId: ps.playerId, name: player.name, teamId: player.teamId, games: 0,
          pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, to: 0, eff: 0, fouls: 0,
          fgMade: 0, fgAtt: 0, tpMade: 0, tpAtt: 0, ftMade: 0, ftAtt: 0, mins: 0,
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
      e.fouls += ps.fouls;
      e.fgMade += ps.twoMade + ps.threeMade;
      e.fgAtt += ps.twoAttempted + ps.threeAttempted;
      e.tpMade += ps.threeMade;
      e.tpAtt += ps.threeAttempted;
      e.ftMade += ps.ftMade;
      e.ftAtt += ps.ftAttempted;
      e.mins += ps.minutes;
    });

    if (!config) return [];

    let all = Array.from(playerMap.values());
    if (config.minReq) all = all.filter(config.minReq);

    return all
      .map(p => ({ ...p, value: config.fn(p) }))
      .sort((a, b) => config.desc ? b.value - a.value : a.value - b.value);
  }, [players, playerStats, matches, config, filters]);

  if (!config) {
    return (
      <div className="page-container">
        <p>Estadística no encontrada.</p>
        <Link href="/estadisticas?tab=jugadores">← Volver</Link>
      </div>
    );
  }

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
        <Link href="/estadisticas?tab=jugadores" style={{
          display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)',
          fontSize: 'var(--text-sm)', color: 'var(--color-primary)', textDecoration: 'none',
          fontWeight: 600, marginBottom: 'var(--space-4)',
        }}>
          <ArrowLeft size={16} /> Estadísticas
        </Link>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <BarChart3 size={28} style={{ color: 'var(--color-primary-light)' }} />
          {config.title}
        </h1>
        {config.minReq && (
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-2)' }}>
            * Mínimo de intentos requerido
          </p>
        )}
      </div>

      {/* Filters */}
      <div className="animate-fade-in-up delay-1" style={{ position: 'relative', zIndex: 50 }}>
        <StatsFilterBar
          teams={teams}
          matches={matches}
          filters={filters}
          onChange={setFilters}
          mode="jugadores"
        />
      </div>

      {/* Top 10 Chart */}
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
            🏆 Top 10 — {config.chartLabel}
          </h3>
          {ranked.length === 0 ? (
            <p style={{ color: 'var(--color-text-tertiary)', textAlign: 'center', padding: 'var(--space-6)' }}>
              No hay datos para los filtros seleccionados
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {ranked.slice(0, 10).map((item, i) => {
                const team = teams.find(t => t.id === item.teamId);
                const maxVal = Math.max(...ranked.slice(0, 10).map(r => Math.abs(r.value)), 1);
                const barWidth = maxVal > 0 ? (Math.abs(item.value) / maxVal) * 100 : 0;
                const isFirst = i === 0;
                return (
                  <div key={item.playerId} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <span style={{
                      width: 20, fontSize: 'var(--text-xs)', fontWeight: 700, textAlign: 'center',
                      color: i < 3 ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
                    }}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                    </span>
                    <div style={{ width: 200, display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
                      {team && <TeamLogo team={team} size="sm" />}
                      <Link href={`/jugadores/${item.playerId}`}
                        style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'inherit', textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.name}
                      </Link>
                    </div>
                    <div style={{ flex: 1, height: 24, background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${barWidth}%`,
                        background: team ? `linear-gradient(90deg, ${team.primaryColor}, ${team.secondaryColor || team.primaryColor}cc)` : 'var(--color-primary)',
                        borderRadius: 'var(--radius-md)',
                        transition: 'width 0.8s ease',
                        opacity: isFirst ? 1 : 0.65,
                      }} />
                    </div>
                    <span style={{
                      fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '12px',
                      color: isFirst ? 'var(--color-accent)' : 'var(--color-text-primary)',
                      minWidth: 50, textAlign: 'right', flexShrink: 0,
                    }}>
                      {item.value.toFixed(1)}{config.suffix}
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
            Tabla completa ({ranked.length} jugadores)
          </h2>
          {ranked.length === 0 ? (
            <p style={{ color: 'var(--color-text-tertiary)', textAlign: 'center', padding: 'var(--space-6)' }}>
              No hay datos para los filtros seleccionados
            </p>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th>Jugador</th>
                    <th>Equipo</th>
                    <th className="text-center">PJ</th>
                    <th className="text-center" style={{ fontWeight: 800 }}>{config.chartLabel}</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((item, i) => {
                    const team = teams.find(t => t.id === item.teamId);
                    return (
                      <tr key={item.playerId}>
                        <td style={{
                          fontWeight: 700, fontSize: 'var(--text-sm)',
                          color: i < 3 ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
                        }}>
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                        </td>
                        <td>
                          <Link href={`/jugadores/${item.playerId}`}
                            style={{ fontWeight: 600, color: 'inherit', textDecoration: 'none', fontSize: 'var(--text-sm)' }}>
                            {item.name}
                          </Link>
                        </td>
                        <td>
                          {team && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                              <TeamLogo team={team} size="sm" />
                              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{team.shortName}</span>
                            </div>
                          )}
                        </td>
                        <td className="text-center" style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
                          {item.games}
                        </td>
                        <td className="text-center" style={{
                          fontFamily: 'var(--font-display)', fontWeight: 800,
                          color: i === 0 ? 'var(--color-primary)' : 'var(--color-text-primary)',
                        }}>
                          {item.value.toFixed(1)}{config.suffix}
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
