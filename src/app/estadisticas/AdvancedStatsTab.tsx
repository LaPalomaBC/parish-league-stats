'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Crosshair, Clock, Brain, Zap, TrendingUp, Shield, Target, Activity, Hand } from 'lucide-react';
import { useLeagueData } from '@/lib/DataContext';
import TeamLogo from '@/components/TeamLogo';
import type { Team } from '@/lib/types';
import {
  calcTS, calcEFG, per48, calcUSG, calcAstTo, calcTovPct, calcGameScore,
  calcTRBPct, calcStlPct, calcBlkPct, calcFloorPct, calcPPP,
  estimatePossessions,
  aggregatePlayerAdvanced,
} from '@/lib/advancedStats';

// ============================================
// STAT DEFINITIONS
// ============================================

interface AdvStat {
  key: string;
  label: string;
  shortLabel: string;
  suffix: string;
  desc: boolean;
  icon: React.ReactNode;
  decimals?: number;
  description: string;
}

const SHOOTING_STATS: AdvStat[] = [
  { key: 'ts', label: 'True Shooting %', shortLabel: 'TS%', suffix: '%', desc: true, icon: <Crosshair size={16} />, description: 'Eficiencia real de anotación contando tiros de 2, triples y tiros libres' },
  { key: 'efg', label: 'Effective FG%', shortLabel: 'eFG%', suffix: '%', desc: true, icon: <Target size={16} />, description: '% de tiro ajustado por el valor extra de los triples' },
  { key: 'floorPct', label: 'Floor %', shortLabel: 'FLR%', suffix: '%', desc: true, icon: <Target size={16} />, description: '% de posesiones usadas que acaban en canasta — mide la eficiencia productiva' },
  { key: 'ppp', label: 'Points per Possession', shortLabel: 'PPP', suffix: '', desc: true, icon: <Zap size={16} />, decimals: 2, description: 'Puntos anotados por cada posesión individual usada — rendimiento puro' },
];

const PER48_STATS: AdvStat[] = [
  { key: 'pts48', label: 'Puntos / 48 min', shortLabel: 'PTS/48', suffix: '', desc: true, icon: <Target size={16} />, description: 'Puntos que haría si jugara un partido completo de 48 min' },
  { key: 'reb48', label: 'Rebotes / 48 min', shortLabel: 'REB/48', suffix: '', desc: true, icon: <Activity size={16} />, description: 'Rebotes proyectados a un partido completo de 48 min' },
  { key: 'ast48', label: 'Asistencias / 48 min', shortLabel: 'AST/48', suffix: '', desc: true, icon: <TrendingUp size={16} />, description: 'Asistencias proyectadas a un partido completo de 48 min' },
  { key: 'stl48', label: 'Recuperaciones / 48 min', shortLabel: 'STL/48', suffix: '', desc: true, icon: <Shield size={16} />, description: 'Recuperaciones proyectadas a un partido completo de 48 min' },
  { key: 'blk48', label: 'Tapones / 48 min', shortLabel: 'BLK/48', suffix: '', desc: true, icon: <Shield size={16} />, description: 'Tapones proyectados a un partido completo de 48 min' },
];

const GAME_STATS: AdvStat[] = [
  { key: 'usg', label: 'Usage Rate', shortLabel: 'USG%', suffix: '%', desc: true, icon: <Zap size={16} />, description: '% de jugadas del equipo que consume el jugador en pista' },
  { key: 'astto', label: 'Ratio AST/TO', shortLabel: 'AST/TO', suffix: '', desc: true, icon: <Brain size={16} />, decimals: 2, description: 'Asistencias por cada pérdida — mide visión de juego y cuidado del balón' },
  { key: 'tovpct', label: 'Turnover Rate', shortLabel: 'TOV%', suffix: '%', desc: false, icon: <Activity size={16} />, description: '% de posesiones que acaban en pérdida de balón (cuanto menos, mejor)' },
  { key: 'gamescore', label: 'Game Score', shortLabel: 'GmSc', suffix: '', desc: true, icon: <Zap size={16} />, description: 'Nota global por partido (Hollinger) — resume toda la producción en un solo número' },
];

const REBOUND_STATS: AdvStat[] = [
  { key: 'trbPct', label: 'Total Rebound %', shortLabel: 'TRB%', suffix: '%', desc: true, icon: <Hand size={16} />, description: '% de rebotes disponibles que captura el jugador estando en pista' },
  { key: 'orbPct', label: 'Off. Rebound %', shortLabel: 'ORB%', suffix: '%', desc: true, icon: <Hand size={16} />, description: '% de rebotes ofensivos capturados — segundas oportunidades' },
  { key: 'drbPct', label: 'Def. Rebound %', shortLabel: 'DRB%', suffix: '%', desc: true, icon: <Hand size={16} />, description: '% de rebotes defensivos capturados — limitar al rival' },
];

const DEFENSE_STATS: AdvStat[] = [
  { key: 'stlPct', label: 'Steal %', shortLabel: 'STL%', suffix: '%', desc: true, icon: <Shield size={16} />, description: '% de posesiones rivales que acaban en robo estando en pista' },
  { key: 'blkPct', label: 'Block %', shortLabel: 'BLK%', suffix: '%', desc: true, icon: <Shield size={16} />, description: '% de tiros de 2 del rival que son taponados estando en pista' },
];

// ============================================
// MAIN COMPONENT
// ============================================

export default function AdvancedStatsTab() {
  const { teams, players, matches, playerStats } = useLeagueData();

  const playedMatchIds = useMemo(() => {
    return new Set(matches.filter(m => m.isPlayed && m.homeScore !== null).map(m => m.id));
  }, [matches]);

  // ---- Player advanced stats ----
  const playerAdvanced = useMemo(() => {
    const aggs = aggregatePlayerAdvanced(playerStats, matches, playedMatchIds, players);
    // Minimum 10 minutes total to qualify
    return aggs.filter(p => p.mins >= 10);
  }, [playerStats, matches, playedMatchIds, players]);

  const shootingRanked = useMemo(() => {
    const minFga = 3;
    return {
      ts: [...playerAdvanced].filter(p => p.fga >= minFga).sort((a, b) =>
        calcTS(b.pts, b.fga, b.fta) - calcTS(a.pts, a.fga, a.fta)
      ).map(p => ({ ...p, value: calcTS(p.pts, p.fga, p.fta) })),
      efg: [...playerAdvanced].filter(p => p.fga >= minFga).sort((a, b) =>
        calcEFG(b.fgMade, b.threeMade, b.fga) - calcEFG(a.fgMade, a.threeMade, a.fga)
      ).map(p => ({ ...p, value: calcEFG(p.fgMade, p.threeMade, p.fga) })),
      floorPct: [...playerAdvanced].filter(p => p.fga >= minFga).sort((a, b) =>
        calcFloorPct(b.fgMade, b.ftMade, b.fta, b.fga, b.to) - calcFloorPct(a.fgMade, a.ftMade, a.fta, a.fga, a.to)
      ).map(p => ({ ...p, value: calcFloorPct(p.fgMade, p.ftMade, p.fta, p.fga, p.to) })),
      ppp: [...playerAdvanced].filter(p => p.fga >= minFga).sort((a, b) =>
        calcPPP(b.pts, b.fga, b.fta, b.to) - calcPPP(a.pts, a.fga, a.fta, a.to)
      ).map(p => ({ ...p, value: calcPPP(p.pts, p.fga, p.fta, p.to) })),
    };
  }, [playerAdvanced]);

  const per48Ranked = useMemo(() => {
    return {
      pts48: [...playerAdvanced].sort((a, b) => per48(b.pts, b.mins) - per48(a.pts, a.mins))
        .map(p => ({ ...p, value: per48(p.pts, p.mins) })),
      reb48: [...playerAdvanced].sort((a, b) => per48(b.orb + b.drb, b.mins) - per48(a.orb + a.drb, a.mins))
        .map(p => ({ ...p, value: per48(p.orb + p.drb, p.mins) })),
      ast48: [...playerAdvanced].sort((a, b) => per48(b.ast, b.mins) - per48(a.ast, a.mins))
        .map(p => ({ ...p, value: per48(p.ast, p.mins) })),
      stl48: [...playerAdvanced].sort((a, b) => per48(b.stl, b.mins) - per48(a.stl, a.mins))
        .map(p => ({ ...p, value: per48(p.stl, p.mins) })),
      blk48: [...playerAdvanced].sort((a, b) => per48(b.blk, b.mins) - per48(a.blk, a.mins))
        .map(p => ({ ...p, value: per48(p.blk, p.mins) })),
    };
  }, [playerAdvanced]);

  const gameRanked = useMemo(() => {
    return {
      usg: [...playerAdvanced].sort((a, b) =>
        calcUSG(b.fga, b.fta, b.to, b.mins, b.teamFga, b.teamFta, b.teamTo, b.teamMp) -
        calcUSG(a.fga, a.fta, a.to, a.mins, a.teamFga, a.teamFta, a.teamTo, a.teamMp)
      ).map(p => ({ ...p, value: calcUSG(p.fga, p.fta, p.to, p.mins, p.teamFga, p.teamFta, p.teamTo, p.teamMp) })),
      astto: [...playerAdvanced].sort((a, b) => calcAstTo(b.ast, b.to) - calcAstTo(a.ast, a.to))
        .map(p => ({ ...p, value: calcAstTo(p.ast, p.to) })),
      tovpct: [...playerAdvanced].sort((a, b) => calcTovPct(a.fga, a.fta, a.to) - calcTovPct(b.fga, b.fta, b.to))
        .map(p => ({ ...p, value: calcTovPct(p.fga, p.fta, p.to) })),
      gamescore: [...playerAdvanced].sort((a, b) => {
        const gsB = calcGameScore(b.pts, b.fgMade, b.fga, b.ftMade, b.fta, b.orb, b.drb, b.stl, b.ast, b.blk, b.pf, b.to) / b.games;
        const gsA = calcGameScore(a.pts, a.fgMade, a.fga, a.ftMade, a.fta, a.orb, a.drb, a.stl, a.ast, a.blk, a.pf, a.to) / a.games;
        return gsB - gsA;
      }).map(p => ({
        ...p,
        value: calcGameScore(p.pts, p.fgMade, p.fga, p.ftMade, p.fta, p.orb, p.drb, p.stl, p.ast, p.blk, p.pf, p.to) / p.games,
      })),
    };
  }, [playerAdvanced]);

  const reboundRanked = useMemo(() => {
    return {
      trbPct: [...playerAdvanced].sort((a, b) =>
        calcTRBPct(b.orb, b.drb, b.mins, b.teamOrb, b.teamDrb, b.oppOrb, b.oppDrb, b.teamMp) -
        calcTRBPct(a.orb, a.drb, a.mins, a.teamOrb, a.teamDrb, a.oppOrb, a.oppDrb, a.teamMp)
      ).map(p => ({ ...p, value: calcTRBPct(p.orb, p.drb, p.mins, p.teamOrb, p.teamDrb, p.oppOrb, p.oppDrb, p.teamMp) })),
      orbPct: [...playerAdvanced].sort((a, b) => {
        const aT = a.orb + a.oppDrb; const bT = b.orb + b.oppDrb;
        const aP = aT > 0 ? (a.orb / aT) * 100 : 0;
        const bP = bT > 0 ? (b.orb / bT) * 100 : 0;
        return bP - aP;
      }).map(p => {
        const total = p.orb + p.oppDrb;
        return { ...p, value: total > 0 ? (p.orb / total) * 100 : 0 };
      }),
      drbPct: [...playerAdvanced].sort((a, b) => {
        const aT = a.drb + a.oppOrb; const bT = b.drb + b.oppOrb;
        const aP = aT > 0 ? (a.drb / aT) * 100 : 0;
        const bP = bT > 0 ? (b.drb / bT) * 100 : 0;
        return bP - aP;
      }).map(p => {
        const total = p.drb + p.oppOrb;
        return { ...p, value: total > 0 ? (p.drb / total) * 100 : 0 };
      }),
    };
  }, [playerAdvanced]);

  const defenseRanked = useMemo(() => {
    return {
      stlPct: [...playerAdvanced].sort((a, b) => {
        const oppPossA = estimatePossessions(a.oppFga, a.oppFta, a.oppTo, a.oppOrb);
        const oppPossB = estimatePossessions(b.oppFga, b.oppFta, b.oppTo, b.oppOrb);
        return calcStlPct(b.stl, b.mins, oppPossB, b.teamMp) - calcStlPct(a.stl, a.mins, oppPossA, a.teamMp);
      }).map(p => {
        const oppPoss = estimatePossessions(p.oppFga, p.oppFta, p.oppTo, p.oppOrb);
        return { ...p, value: calcStlPct(p.stl, p.mins, oppPoss, p.teamMp) };
      }),
      blkPct: [...playerAdvanced].sort((a, b) =>
        calcBlkPct(b.blk, b.mins, b.oppFga, b.oppThreeAtt, b.teamMp) -
        calcBlkPct(a.blk, a.mins, a.oppFga, a.oppThreeAtt, a.teamMp)
      ).map(p => ({ ...p, value: calcBlkPct(p.blk, p.mins, p.oppFga, p.oppThreeAtt, p.teamMp) })),
    };
  }, [playerAdvanced]);

  return (
    <div className="animate-fade-in-up">
      {/* Shooting & Scoring Efficiency */}
      <SectionHeader icon={<Crosshair size={20} />} title="Eficiencia de Tiro y Anotación" color="var(--color-primary)" />
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: 'var(--space-4)', marginBottom: 'var(--space-6)',
      }}>
        {SHOOTING_STATS.map(stat => (
          <AdvancedLeaderCard key={stat.key} stat={stat} items={shootingRanked[stat.key as keyof typeof shootingRanked] || []} teams={teams} />
        ))}
      </div>

      {/* Per 48 Minutes */}
      <SectionHeader icon={<Clock size={20} />} title="Per 48 Minutos" color="#C08B1A" />
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: 'var(--space-4)', marginBottom: 'var(--space-6)',
      }}>
        {PER48_STATS.map(stat => (
          <AdvancedLeaderCard key={stat.key} stat={stat} items={per48Ranked[stat.key as keyof typeof per48Ranked] || []} teams={teams} />
        ))}
      </div>

      {/* Game Metrics */}
      <SectionHeader icon={<Brain size={20} />} title="Métricas de Juego" color="var(--color-danger)" />
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: 'var(--space-4)', marginBottom: 'var(--space-6)',
      }}>
        {GAME_STATS.map(stat => (
          <AdvancedLeaderCard key={stat.key} stat={stat} items={gameRanked[stat.key as keyof typeof gameRanked] || []} teams={teams} />
        ))}
      </div>

      {/* Rebounding */}
      <SectionHeader icon={<Hand size={20} />} title="Rebote" color="var(--color-accent)" />
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: 'var(--space-4)', marginBottom: 'var(--space-6)',
      }}>
        {REBOUND_STATS.map(stat => (
          <AdvancedLeaderCard key={stat.key} stat={stat} items={reboundRanked[stat.key as keyof typeof reboundRanked] || []} teams={teams} />
        ))}
      </div>

      {/* Individual Defense */}
      <SectionHeader icon={<Shield size={20} />} title="Defensa Individual" color="var(--color-success)" />
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: 'var(--space-4)', marginBottom: 'var(--space-6)',
      }}>
        {DEFENSE_STATS.map(stat => (
          <AdvancedLeaderCard key={stat.key} stat={stat} items={defenseRanked[stat.key as keyof typeof defenseRanked] || []} teams={teams} />
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

function AdvancedLeaderCard({ stat, items, teams }: {
  stat: AdvStat;
  items: { playerId: string; name: string; teamId: string; value: number }[];
  teams: Team[];
}) {
  const top5 = items.slice(0, 5);
  const maxVal = Math.max(...top5.map(x => Math.abs(x.value)), 1);
  const decimals = stat.decimals ?? 1;

  return (
    <Link href={`/estadisticas/avanzadas/${stat.key}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className="card" style={{
        padding: 'var(--space-5)', cursor: 'pointer',
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
            <span style={{ color: 'var(--color-primary)' }}>{stat.icon}</span>
            {stat.label}
            <span style={{
              marginLeft: 'auto', fontSize: '10px', fontWeight: 600,
              background: 'var(--color-primary-bg)', color: 'var(--color-primary)',
              padding: '2px 8px', borderRadius: 'var(--radius-full)',
            }}>
              ADV
            </span>
          </h3>
          <p style={{
            fontSize: '11px', color: 'var(--color-text-tertiary)',
            lineHeight: 1.3, margin: 0, paddingLeft: 'calc(16px + var(--space-2))',
          }}>
            {stat.description}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {top5.map((item, i) => {
            const team = teams.find(t => t.id === item.teamId);
            const isFirst = i === 0;
            const barWidth = maxVal > 0 ? (Math.abs(item.value) / maxVal) * 100 : 0;
            return (
              <div key={item.playerId} style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-lg)',
                background: isFirst && team ? `${team.primaryColor}08` : 'transparent',
              }}>
                <span style={{
                  width: 20, fontSize: 'var(--text-xs)', fontWeight: 700,
                  color: isFirst ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
                }}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                </span>
                {team && <TeamLogo team={team} size="sm" />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{item.name}</div>
                  <div style={{
                    height: 3, borderRadius: 2, background: 'var(--color-border-light)',
                    marginTop: 'var(--space-1)', overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%', width: `${barWidth}%`,
                      background: isFirst && team ? team.primaryColor : 'var(--color-text-tertiary)',
                      borderRadius: 2, opacity: isFirst ? 1 : 0.4,
                      transition: 'width 0.6s ease',
                    }} />
                  </div>
                </div>
                <div style={{
                  fontFamily: 'var(--font-display)', fontWeight: 800,
                  fontSize: 'var(--text-base)',
                  color: isFirst ? 'var(--color-primary)' : 'var(--color-text-primary)',
                }}>
                  {item.value.toFixed(decimals)}{stat.suffix}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 'var(--space-3)', textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--color-primary)', fontWeight: 600 }}>
          Ver tabla completa →
        </div>
      </div>
    </Link>
  );
}
