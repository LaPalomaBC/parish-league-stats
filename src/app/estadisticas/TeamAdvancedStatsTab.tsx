'use client';

import { useMemo, useCallback, useRef, useState } from 'react';
import {
  Target, Shield, TrendingUp, Clock, Crosshair, Brain,
  Activity, Zap, Hand, Download, Share2, Loader2,
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { useLeagueData } from '@/lib/DataContext';
import TeamLogo from '@/components/TeamLogo';
import type { Team } from '@/lib/types';
import {
  estimatePossessions, calcPace, calcORtg, calcDRtg,
  calcTeamTS, calcTeamEFG, calcFTRate, calc3PARate,
  calcAstRatio, calcTeamTovRate, calcORBPct, calcDRBPct,
  calcStlRate, calcBlkRate,
  aggregateTeamAdvanced,
} from '@/lib/advancedStats';

// ============================================
// STAT DEFINITIONS
// ============================================

interface TeamAdvStat {
  key: string;
  label: string;
  shortLabel: string;
  suffix: string;
  desc: boolean;
  icon: React.ReactNode;
  decimals?: number;
  description: string;
}

const RATING_STATS: TeamAdvStat[] = [
  { key: 'ortg', label: 'Offensive Rating', shortLabel: 'ORtg', suffix: '', desc: true, icon: <Target size={16} />, description: 'Puntos anotados por cada 100 posesiones — eficiencia ofensiva real del equipo' },
  { key: 'drtg', label: 'Defensive Rating', shortLabel: 'DRtg', suffix: '', desc: false, icon: <Shield size={16} />, description: 'Puntos encajados por cada 100 posesiones — cuanto menos, mejor defensa' },
  { key: 'netrtg', label: 'Net Rating', shortLabel: 'NET', suffix: '', desc: true, icon: <TrendingUp size={16} />, description: 'Diferencia entre ORtg y DRtg — el balance global del equipo, positivo = dominio' },
  { key: 'pace', label: 'Pace (Ritmo)', shortLabel: 'PACE', suffix: '', desc: true, icon: <Clock size={16} />, description: 'Posesiones estimadas por partido — mide la velocidad de juego del equipo' },
];

const SHOOTING_STATS: TeamAdvStat[] = [
  { key: 'ts', label: 'True Shooting %', shortLabel: 'TS%', suffix: '%', desc: true, icon: <Crosshair size={16} />, description: 'Eficiencia real de anotación del equipo contando 2s, 3s y tiros libres' },
  { key: 'efg', label: 'Effective FG%', shortLabel: 'eFG%', suffix: '%', desc: true, icon: <Target size={16} />, description: '% de tiro ajustado — valora el extra de anotar triples por encima de tiros de 2' },
  { key: 'ftRate', label: 'Free Throw Rate', shortLabel: 'FT Rate', suffix: '%', desc: true, icon: <Activity size={16} />, description: 'Tiros libres intentados por cada tiro de campo — capacidad de ir a la línea' },
  { key: 'threeRate', label: '3-Point Attempt Rate', shortLabel: '3PA Rate', suffix: '%', desc: true, icon: <Crosshair size={16} />, description: '% de tiros que son triples — indica la dependencia del tiro exterior' },
];

const PLAYMAKING_STATS: TeamAdvStat[] = [
  { key: 'astRatio', label: 'Assist Ratio', shortLabel: 'AST Ratio', suffix: '', desc: true, icon: <Brain size={16} />, description: 'Asistencias por cada 100 posesiones — mide el juego colectivo en ataque' },
  { key: 'tovRate', label: 'Turnover Rate', shortLabel: 'TOV%', suffix: '%', desc: false, icon: <Activity size={16} />, description: 'Pérdidas por cada 100 posesiones — cuanto menos, mejor cuidado del balón' },
  { key: 'astToRatio', label: 'AST/TO Ratio', shortLabel: 'AST/TO', suffix: '', desc: true, icon: <Brain size={16} />, decimals: 2, description: 'Asistencias por cada pérdida — equilibrio entre crear juego y perder el balón' },
];

const REBOUND_STATS: TeamAdvStat[] = [
  { key: 'orbPct', label: 'Off. Rebound %', shortLabel: 'ORB%', suffix: '%', desc: true, icon: <Hand size={16} />, description: '% de rebotes ofensivos capturados — segundas oportunidades de anotar' },
  { key: 'drbPct', label: 'Def. Rebound %', shortLabel: 'DRB%', suffix: '%', desc: true, icon: <Hand size={16} />, description: '% de rebotes defensivos capturados — cortar segundas oportunidades al rival' },
];

const DEFENSE_STATS: TeamAdvStat[] = [
  { key: 'stlRate', label: 'Steal Rate', shortLabel: 'STL%', suffix: '%', desc: true, icon: <Shield size={16} />, description: 'Recuperaciones por cada 100 posesiones del rival — presión defensiva' },
  { key: 'blkRate', label: 'Block Rate', shortLabel: 'BLK%', suffix: '%', desc: true, icon: <Shield size={16} />, description: 'Tapones por cada tiro del rival — intimidación interior' },
];

// ============================================
// MAIN COMPONENT
// ============================================

export default function TeamAdvancedStatsTab() {
  const { teams, matches, playerStats } = useLeagueData();

  const playedMatchIds = useMemo(() => {
    return new Set(matches.filter(m => m.isPlayed && m.homeScore !== null).map(m => m.id));
  }, [matches]);

  const aggs = useMemo(() => {
    return aggregateTeamAdvanced(playerStats, matches, playedMatchIds, teams);
  }, [playerStats, matches, playedMatchIds, teams]);

  const ranked = useMemo(() => {
    function rank(fn: (t: typeof aggs[0]) => number, desc: boolean) {
      return [...aggs]
        .map(t => ({ ...t, value: fn(t) }))
        .sort((a, b) => desc ? b.value - a.value : a.value - b.value);
    }

    return {
      ortg: rank(t => { const p = estimatePossessions(t.fga, t.fta, t.to, t.orb); return calcORtg(t.pts, p); }, true),
      drtg: rank(t => { const p = estimatePossessions(t.oppFga, t.oppFta, t.oppTo, t.oppOrb); return calcDRtg(t.oppPts, p); }, false),
      netrtg: rank(t => {
        const oP = estimatePossessions(t.fga, t.fta, t.to, t.orb);
        const dP = estimatePossessions(t.oppFga, t.oppFta, t.oppTo, t.oppOrb);
        return calcORtg(t.pts, oP) - calcDRtg(t.oppPts, dP);
      }, true),
      pace: rank(t => { const p = estimatePossessions(t.fga, t.fta, t.to, t.orb); return calcPace(p, t.teamMp); }, true),
      ts: rank(t => calcTeamTS(t.pts, t.fga, t.fta), true),
      efg: rank(t => calcTeamEFG(t.fgMade, t.threeMade, t.fga), true),
      ftRate: rank(t => calcFTRate(t.fta, t.fga), true),
      threeRate: rank(t => calc3PARate(t.threeAtt, t.fga), true),
      astRatio: rank(t => { const p = estimatePossessions(t.fga, t.fta, t.to, t.orb); return calcAstRatio(t.ast, p); }, true),
      tovRate: rank(t => { const p = estimatePossessions(t.fga, t.fta, t.to, t.orb); return calcTeamTovRate(t.to, p); }, false),
      astToRatio: rank(t => t.to > 0 ? t.ast / t.to : t.ast, true),
      orbPct: rank(t => calcORBPct(t.orb, t.oppDrb), true),
      drbPct: rank(t => calcDRBPct(t.drb, t.oppOrb), true),
      stlRate: rank(t => { const p = estimatePossessions(t.oppFga, t.oppFta, t.oppTo, t.oppOrb); return calcStlRate(t.stl, p); }, true),
      blkRate: rank(t => calcBlkRate(t.blk, t.oppFga), true),
    };
  }, [aggs]);

  return (
    <div className="animate-fade-in-up">
      <SectionHeader icon={<Zap size={20} />} title="Ratings" color="var(--color-success)" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        {RATING_STATS.map(stat => (
          <TeamStatCard key={stat.key} stat={stat} items={ranked[stat.key as keyof typeof ranked] || []} teams={teams} />
        ))}
      </div>

      <SectionHeader icon={<Crosshair size={20} />} title="Eficiencia de Tiro" color="var(--color-primary)" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        {SHOOTING_STATS.map(stat => (
          <TeamStatCard key={stat.key} stat={stat} items={ranked[stat.key as keyof typeof ranked] || []} teams={teams} />
        ))}
      </div>

      <SectionHeader icon={<Brain size={20} />} title="Creación de Juego y Control" color="#C08B1A" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        {PLAYMAKING_STATS.map(stat => (
          <TeamStatCard key={stat.key} stat={stat} items={ranked[stat.key as keyof typeof ranked] || []} teams={teams} />
        ))}
      </div>

      <SectionHeader icon={<Hand size={20} />} title="Rebote" color="var(--color-accent)" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        {REBOUND_STATS.map(stat => (
          <TeamStatCard key={stat.key} stat={stat} items={ranked[stat.key as keyof typeof ranked] || []} teams={teams} />
        ))}
      </div>

      <SectionHeader icon={<Shield size={20} />} title="Defensa" color="var(--color-danger)" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        {DEFENSE_STATS.map(stat => (
          <TeamStatCard key={stat.key} stat={stat} items={ranked[stat.key as keyof typeof ranked] || []} teams={teams} />
        ))}
      </div>
    </div>
  );
}

// ============================================
// UI COMPONENTS
// ============================================

function SectionHeader({ icon, title, color }: { icon: React.ReactNode; title: string; color: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
      marginBottom: 'var(--space-4)', paddingBottom: 'var(--space-2)',
      borderBottom: `2px solid ${color}20`,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 'var(--radius-lg)',
        background: `${color}12`, display: 'flex', alignItems: 'center',
        justifyContent: 'center', color,
      }}>
        {icon}
      </div>
      <h2 style={{
        fontFamily: 'var(--font-display)', fontWeight: 800,
        fontSize: 'var(--text-lg)', letterSpacing: '-0.02em',
      }}>
        {title}
      </h2>
    </div>
  );
}

function TeamStatCard({ stat, items, teams }: {
  stat: TeamAdvStat;
  items: { teamId: string; value: number }[];
  teams: Team[];
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [capturing, setCapturing] = useState(false);
  const maxVal = Math.max(...items.map(x => Math.abs(x.value)), 1);
  const decimals = stat.decimals ?? 1;
  const showSign = stat.key === 'netrtg';

  const handleCapture = useCallback(async () => {
    if (!cardRef.current || capturing) return;
    setCapturing(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        cacheBust: true,
      });

      const filename = `parish-league-${stat.shortLabel.replace(/[^a-zA-Z0-9]/g, '')}`;
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

      if (isMobile && navigator.share && navigator.canShare) {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const file = new File([blob], `${filename}.png`, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ title: `${stat.label} — Parish League`, files: [file] });
          setCapturing(false);
          return;
        }
      }

      const link = document.createElement('a');
      link.download = `${filename}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Capture failed:', err);
    }
    setCapturing(false);
  }, [capturing, stat.shortLabel, stat.label]);

  const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const ShareIcon = capturing ? Loader2 : (isMobile ? Share2 : Download);

  return (
    <div ref={cardRef} className="card" style={{
      padding: 'var(--space-5)',
      transition: 'transform var(--transition-fast), box-shadow var(--transition-fast)',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
    >
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <h3 style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
          fontWeight: 700, fontSize: 'var(--text-sm)', marginBottom: 'var(--space-1)',
          textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          <span style={{ color: 'var(--color-success)' }}>{stat.icon}</span>
          {stat.label}
          <span style={{
            marginLeft: 'auto', fontSize: '10px', fontWeight: 600,
            background: 'rgba(52,199,89,0.08)', color: 'var(--color-success)',
            padding: '2px 8px', borderRadius: 'var(--radius-full)',
          }}>
            {stat.shortLabel}
          </span>
          <button
            onClick={handleCapture}
            disabled={capturing}
            title={isMobile ? 'Compartir' : 'Descargar imagen'}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-light)', background: 'var(--color-bg-secondary)',
              color: capturing ? 'var(--color-text-tertiary)' : 'var(--color-primary)',
              cursor: capturing ? 'wait' : 'pointer', transition: 'all var(--transition-fast)',
              flexShrink: 0,
            }}
          >
            <ShareIcon size={14} style={capturing ? { animation: 'spin 1s linear infinite' } : undefined} />
          </button>
        </h3>
        <p style={{
          fontSize: '11px', color: 'var(--color-text-tertiary)',
          lineHeight: 1.3, margin: 0, paddingLeft: 'calc(16px + var(--space-2))',
        }}>
          {stat.description}
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {items.map((item, i) => {
          const team = teams.find(t => t.id === item.teamId);
          if (!team) return null;
          const isFirst = i === 0;
          const barWidth = maxVal > 0 ? (Math.abs(item.value) / maxVal) * 100 : 0;
          return (
            <div key={item.teamId} style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
              padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-lg)',
              background: isFirst ? `${team.primaryColor}08` : 'transparent',
            }}>
              <span style={{
                width: 20, fontSize: 'var(--text-xs)', fontWeight: 700,
                color: isFirst ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
              }}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
              </span>
              <TeamLogo team={team} size="sm" />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{team.name}</div>
                <div style={{
                  height: 3, borderRadius: 2, background: 'var(--color-border-light)',
                  marginTop: 'var(--space-1)', overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', width: `${barWidth}%`,
                    background: isFirst ? team.primaryColor : 'var(--color-text-tertiary)',
                    borderRadius: 2, opacity: isFirst ? 1 : 0.4,
                    transition: 'width 0.6s ease',
                  }} />
                </div>
              </div>
              <div style={{
                fontFamily: 'var(--font-display)', fontWeight: 800,
                fontSize: 'var(--text-base)',
                color: isFirst ? 'var(--color-primary)' : 'var(--color-text-primary)',
                minWidth: 50, textAlign: 'right',
              }}>
                {showSign && item.value > 0 ? '+' : ''}{item.value.toFixed(decimals)}{stat.suffix}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
