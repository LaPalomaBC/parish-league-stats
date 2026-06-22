'use client';

import { useMemo, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, BarChart3, Download, Share2, Loader2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import { useLeagueData } from '@/lib/DataContext';
import TeamLogo from '@/components/TeamLogo';
import StatsFilterBar, { emptyFilters, filterMatchIds, type StatsFilters } from '@/components/StatsFilterBar';

const STAT_CONFIG: Record<string, {
  title: string;
  fn: (agg: TeamAgg) => number;
  desc: boolean;
  suffix: string;
  showSign?: boolean;
  chartLabel: string;
}> = {
  offense:   { title: 'Puntos por partido',   fn: a => a.totalPoints / a.games,        desc: true,  suffix: '',  chartLabel: 'PPP' },
  defense:   { title: 'Puntos encajados',     fn: a => a.totalPointsAgainst / a.games, desc: false, suffix: '',  chartLabel: 'PPP enc.' },
  rebounds:  { title: 'Rebotes por partido',   fn: a => a.totalRebounds / a.games,      desc: true,  suffix: '',  chartLabel: 'RPP' },
  assists:   { title: 'Asistencias por partido', fn: a => a.totalAssists / a.games,    desc: true,  suffix: '',  chartLabel: 'APP' },
  fgPct:     { title: '% Tiros de campo',     fn: a => a.totalFGAtt > 0 ? (a.totalFGMade / a.totalFGAtt) * 100 : 0, desc: true, suffix: '%', chartLabel: 'FG%' },
  threePct:  { title: '% Triples',            fn: a => a.total3Att > 0 ? (a.total3Made / a.total3Att) * 100 : 0,    desc: true, suffix: '%', chartLabel: '3P%' },
  ftPct:     { title: '% Tiros libres',       fn: a => a.totalFTAtt > 0 ? (a.totalFTMade / a.totalFTAtt) * 100 : 0, desc: true, suffix: '%', chartLabel: 'FT%' },
  blocks:    { title: 'Tapones por partido',   fn: a => a.totalBlocks / a.games,        desc: true,  suffix: '',  chartLabel: 'BPP' },
  turnovers: { title: 'Pérdidas por partido',  fn: a => a.totalTurnovers / a.games,     desc: false, suffix: '',  chartLabel: 'TPP' },
  pointDiff: { title: 'Diferencia de puntos',  fn: a => (a.totalPoints - a.totalPointsAgainst) / a.games, desc: true, suffix: '', showSign: true, chartLabel: '+/-' },
};

interface TeamAgg {
  games: number; totalPoints: number; totalPointsAgainst: number;
  totalRebounds: number; totalAssists: number; totalRecoveries: number;
  totalTurnovers: number; totalBlocks: number; totalFouls: number;
  totalFGMade: number; totalFGAtt: number;
  total3Made: number; total3Att: number;
  totalFTMade: number; totalFTAtt: number;
}

export default function TeamStatDetailPage() {
  const params = useParams();
  const statKey = params.statKey as string;
  const config = STAT_CONFIG[statKey];
  const { teams, matches, playerStats } = useLeagueData();
  const [filters, setFilters] = useState<StatsFilters>(emptyFilters());

  const ranked = useMemo(() => {
    const validMatchIds = filterMatchIds(matches, filters);
    const playedMatches = matches.filter(m => validMatchIds.has(m.id));
    const teamAgg = new Map<string, TeamAgg>();

    teams.forEach(t => {
      teamAgg.set(t.id, {
        games: 0, totalPoints: 0, totalPointsAgainst: 0,
        totalRebounds: 0, totalAssists: 0, totalRecoveries: 0,
        totalTurnovers: 0, totalBlocks: 0, totalFouls: 0,
        totalFGMade: 0, totalFGAtt: 0,
        total3Made: 0, total3Att: 0,
        totalFTMade: 0, totalFTAtt: 0,
      });
    });

    playedMatches.forEach(m => {
      const homeStats = playerStats.filter(ps => ps.matchId === m.id && ps.teamId === m.homeTeamId);
      const awayStats = playerStats.filter(ps => ps.matchId === m.id && ps.teamId === m.awayTeamId);
      [
        { teamId: m.homeTeamId, stats: homeStats, pointsAgainst: m.awayScore ?? 0 },
        { teamId: m.awayTeamId, stats: awayStats, pointsAgainst: m.homeScore ?? 0 },
      ].forEach(({ teamId, stats, pointsAgainst }) => {
        const agg = teamAgg.get(teamId);
        if (!agg) return;
        agg.games++;
        agg.totalPointsAgainst += pointsAgainst;
        stats.forEach(ps => {
          agg.totalPoints += ps.points;
          agg.totalRebounds += ps.offRebounds + ps.defRebounds;
          agg.totalAssists += ps.assists;
          agg.totalRecoveries += ps.recoveries;
          agg.totalTurnovers += ps.turnovers;
          agg.totalBlocks += ps.blocks;
          agg.totalFouls += ps.fouls;
          agg.totalFGMade += ps.twoMade + ps.threeMade;
          agg.totalFGAtt += ps.twoAttempted + ps.threeAttempted;
          agg.total3Made += ps.threeMade;
          agg.total3Att += ps.threeAttempted;
          agg.totalFTMade += ps.ftMade;
          agg.totalFTAtt += ps.ftAttempted;
        });
      });
    });

    if (!config) return [];

    return teams
      .map(t => {
        const agg = teamAgg.get(t.id)!;
        return { team: t, value: agg.games > 0 ? config.fn(agg) : 0, games: agg.games };
      })
      .filter(x => x.games > 0)
      .sort((a, b) => config.desc ? b.value - a.value : a.value - b.value);
  }, [teams, matches, playerStats, config, filters]);

  if (!config) {
    return (
      <div className="page-container">
        <p>Estadística no encontrada.</p>
        <Link href="/estadisticas?tab=equipos">← Volver</Link>
      </div>
    );
  }

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
        <Link href="/estadisticas?tab=equipos" style={{
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
      </div>

      {/* Filters */}
      <div className="animate-fade-in-up delay-1" style={{ position: 'relative', zIndex: 50 }}>
        <StatsFilterBar
          teams={teams}
          matches={matches}
          filters={filters}
          onChange={setFilters}
          mode="equipos"
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
            📊 {config.chartLabel} por equipo
          </h3>
          {ranked.length === 0 ? (
            <p style={{ color: 'var(--color-text-tertiary)', textAlign: 'center', padding: 'var(--space-6)' }}>
              No hay datos para los filtros seleccionados
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {ranked.map((item, i) => {
                const barWidth = maxVal > 0 ? (Math.abs(item.value) / maxVal) * 100 : 0;
                const isFirst = i === 0;
                return (
                  <div key={item.team.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <div style={{ width: 110, display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
                      <TeamLogo team={item.team} size="sm" />
                      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>{item.team.shortName}</span>
                    </div>
                    <div style={{ flex: 1, height: 28, background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${barWidth}%`,
                        background: `linear-gradient(90deg, ${item.team.primaryColor}, ${item.team.secondaryColor || item.team.primaryColor}cc)`,
                        borderRadius: 'var(--radius-md)',
                        transition: 'width 0.8s ease',
                        opacity: isFirst ? 1 : 0.7,
                      }} />
                    </div>
                    <span style={{
                      fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '12px',
                      color: isFirst ? 'var(--color-accent)' : 'var(--color-text-primary)',
                      minWidth: 55, textAlign: 'right', flexShrink: 0,
                    }}>
                      {config.showSign && item.value > 0 ? '+' : ''}{item.value.toFixed(1)}{config.suffix}
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
            Clasificación completa
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
                    <th>Equipo</th>
                    <th className="text-center">PJ</th>
                    <th className="text-center" style={{ fontWeight: 800 }}>{config.chartLabel}</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((item, i) => (
                    <tr key={item.team.id}>
                      <td style={{
                        fontWeight: 700, fontSize: 'var(--text-sm)',
                        color: i < 3 ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
                      }}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                      </td>
                      <td>
                        <Link href={`/equipos/${item.team.id}`} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', textDecoration: 'none', color: 'inherit' }}>
                          <TeamLogo team={item.team} size="sm" />
                          <span style={{ fontWeight: 600 }}>{item.team.name}</span>
                        </Link>
                      </td>
                      <td className="text-center" style={{ color: 'var(--color-text-tertiary)' }}>{item.games}</td>
                      <td className="text-center" style={{
                        fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--text-base)',
                        color: i === 0 ? 'var(--color-primary)' : 'var(--color-text-primary)',
                      }}>
                        {config.showSign && item.value > 0 ? '+' : ''}{item.value.toFixed(1)}{config.suffix}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
