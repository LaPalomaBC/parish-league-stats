'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { BarChart3, Award, Target, Shield, Users, User, TrendingUp, Crosshair, Hand, Zap, Sparkles, Hash } from 'lucide-react';
import AdvancedStatsTab from './AdvancedStatsTab';
import TeamAdvancedStatsTab from './TeamAdvancedStatsTab';

import { useLeagueData } from '@/lib/DataContext';
import TeamLogo from '@/components/TeamLogo';
import type { Team, PlayerStats } from '@/lib/types';

type TabType = 'equipos' | 'jugadores' | 'totales' | 'avanzadas' | 'equiposAvz';

const VALID_TABS: TabType[] = ['equipos', 'jugadores', 'totales', 'avanzadas', 'equiposAvz'];

export default function EstadisticasClient() {
  const { teams, players, matches, playerStats, standings } = useLeagueData();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') as TabType | null;
  const [activeTab, setActiveTab] = useState<TabType>(
    initialTab && VALID_TABS.includes(initialTab) ? initialTab : 'equipos'
  );

  // =============================================
  // TEAM STATS — computed from matches + standings
  // =============================================
  const teamDashboard = useMemo(() => {
    const playedMatches = matches.filter(m => m.isPlayed && m.homeScore !== null);

    // Per-team aggregated stats from playerStats
    const teamAgg = new Map<string, {
      games: number;
      totalPoints: number;
      totalPointsAgainst: number;
      totalRebounds: number;
      totalAssists: number;
      totalRecoveries: number;
      totalTurnovers: number;
      totalBlocks: number;
      totalFouls: number;
      totalFGMade: number;
      totalFGAttempted: number;
      total3Made: number;
      total3Attempted: number;
      totalFTMade: number;
      totalFTAttempted: number;
    }>();

    teams.forEach(t => {
      teamAgg.set(t.id, {
        games: 0, totalPoints: 0, totalPointsAgainst: 0,
        totalRebounds: 0, totalAssists: 0, totalRecoveries: 0,
        totalTurnovers: 0, totalBlocks: 0, totalFouls: 0,
        totalFGMade: 0, totalFGAttempted: 0,
        total3Made: 0, total3Attempted: 0,
        totalFTMade: 0, totalFTAttempted: 0,
      });
    });

    // Aggregate from playerStats by team
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
          agg.totalFGAttempted += ps.twoAttempted + ps.threeAttempted;
          agg.total3Made += ps.threeMade;
          agg.total3Attempted += ps.threeAttempted;
          agg.totalFTMade += ps.ftMade;
          agg.totalFTAttempted += ps.ftAttempted;
        });
      });
    });

    function rankTeams(fn: (agg: typeof teamAgg extends Map<string, infer V> ? V : never) => number, desc = true) {
      return teams
        .map(t => {
          const agg = teamAgg.get(t.id)!;
          return { team: t, value: agg.games > 0 ? fn(agg) : 0, games: agg.games };
        })
        .filter(x => x.games > 0)
        .sort((a, b) => desc ? b.value - a.value : a.value - b.value);
    }

    return {
      offense: rankTeams(a => a.totalPoints / a.games),
      defense: rankTeams(a => a.totalPointsAgainst / a.games, false),
      rebounds: rankTeams(a => a.totalRebounds / a.games),
      assists: rankTeams(a => a.totalAssists / a.games),
      turnovers: rankTeams(a => a.totalTurnovers / a.games, false),
      blocks: rankTeams(a => a.totalBlocks / a.games),
      fgPct: rankTeams(a => a.totalFGAttempted > 0 ? (a.totalFGMade / a.totalFGAttempted) * 100 : 0),
      threePct: rankTeams(a => a.total3Attempted > 0 ? (a.total3Made / a.total3Attempted) * 100 : 0),
      ftPct: rankTeams(a => a.totalFTAttempted > 0 ? (a.totalFTMade / a.totalFTAttempted) * 100 : 0),
      pointDiff: rankTeams(a => (a.totalPoints - a.totalPointsAgainst) / a.games),
      // TOTALS
      totalPoints: rankTeams(a => a.totalPoints),
      totalRebounds: rankTeams(a => a.totalRebounds),
      totalAssists: rankTeams(a => a.totalAssists),
      totalRecoveries: rankTeams(a => a.totalRecoveries),
      totalBlocks: rankTeams(a => a.totalBlocks),
      totalTurnovers: rankTeams(a => a.totalTurnovers),
      totalFouls: rankTeams(a => a.totalFouls),
      totalFGMade: rankTeams(a => a.totalFGMade),
      total3Made: rankTeams(a => a.total3Made),
      totalFTMade: rankTeams(a => a.totalFTMade),
    };
  }, [teams, matches, playerStats]);

  // =============================================
  // PLAYER STATS — computed from playerStats
  // =============================================
  const playerDashboard = useMemo(() => {
    const playerMap = new Map<string, {
      playerId: string; name: string; teamId: string; games: number;
      pts: number; reb: number; ast: number; stl: number; blk: number;
      to: number; eff: number; fouls: number;
      fgMade: number; fgAtt: number; tpMade: number; tpAtt: number;
      ftMade: number; ftAtt: number; mins: number;
    }>();

    playerStats.forEach(ps => {
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

    const all = Array.from(playerMap.values());

    function rankPlayers(fn: (p: typeof all[0]) => number, desc = true) {
      return all
        .map(p => ({ ...p, value: fn(p) }))
        .sort((a, b) => desc ? b.value - a.value : a.value - b.value);
    }

    return {
      scorers: rankPlayers(p => p.pts / p.games),
      rebounders: rankPlayers(p => p.reb / p.games),
      assisters: rankPlayers(p => p.ast / p.games),
      stealers: rankPlayers(p => p.stl / p.games),
      blockers: rankPlayers(p => p.blk / p.games),
      efficient: rankPlayers(p => p.eff / p.games),
      fgPct: rankPlayers(p => p.fgAtt > 0 ? (p.fgMade / p.fgAtt) * 100 : 0),
      threePct: rankPlayers(p => p.tpAtt >= 3 ? (p.tpMade / p.tpAtt) * 100 : 0),
      ftPct: rankPlayers(p => p.ftAtt >= 3 ? (p.ftMade / p.ftAtt) * 100 : 0),
      minutes: rankPlayers(p => p.mins / p.games),
      // TOTALS
      totalPts: rankPlayers(p => p.pts),
      totalReb: rankPlayers(p => p.reb),
      totalAst: rankPlayers(p => p.ast),
      totalStl: rankPlayers(p => p.stl),
      totalBlk: rankPlayers(p => p.blk),
      totalTo: rankPlayers(p => p.to),
      totalEff: rankPlayers(p => p.eff),
      totalMins: rankPlayers(p => p.mins),
      totalFgMade: rankPlayers(p => p.fgMade),
      totalTpMade: rankPlayers(p => p.tpMade),
      totalFtMade: rankPlayers(p => p.ftMade),
    };
  }, [players, playerStats]);

  const tabs = [
    { id: 'equipos' as const, label: 'Equipos', icon: <Users size={16} /> },
    { id: 'jugadores' as const, label: 'Jugadores', icon: <User size={16} /> },
    { id: 'totales' as const, label: 'Totales', icon: <Hash size={16} /> },
    { id: 'avanzadas' as const, label: 'Avanzadas', icon: <Sparkles size={16} /> },
    { id: 'equiposAvz' as const, label: 'Equipos Avz.', icon: <TrendingUp size={16} /> },
  ];

  return (
    <div className="page-container">
      {/* Header */}
      <div className="section animate-fade-in-up">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
          <BarChart3 size={32} style={{ color: 'var(--color-primary-light)' }} />
          Estadísticas
        </h1>

        {/* Tab bar */}
        <div style={{
          display: 'flex',
          gap: 'var(--space-1)',
          padding: 'var(--space-1)',
          background: 'var(--color-bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: 'fit-content',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
        }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-2) var(--space-4)',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: activeTab === tab.id ? 'var(--color-bg-card)' : 'transparent',
                color: activeTab === tab.id ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                fontWeight: activeTab === tab.id ? 600 : 500,
                fontSize: 'var(--text-sm)',
                fontFamily: 'var(--font-body)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                boxShadow: activeTab === tab.id ? 'var(--shadow-sm)' : 'none',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* =============================================
          EQUIPOS TAB
          ============================================= */}
      {activeTab === 'equipos' && (
        <div className="animate-fade-in-up">
          {/* Highlight cards row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 'var(--space-4)',
            marginBottom: 'var(--space-6)',
          }}>
            <HighlightCard
              label="Mejor Ataque"
              team={teamDashboard.offense[0]?.team}
              value={teamDashboard.offense[0]?.value}
              suffix="PPP"
              icon={<Target size={18} />}
              color="var(--color-primary)"
            />
            <HighlightCard
              label="Mejor Defensa"
              team={teamDashboard.defense[0]?.team}
              value={teamDashboard.defense[0]?.value}
              suffix="PPP enc."
              icon={<Shield size={18} />}
              color="var(--color-success)"
            />
            <HighlightCard
              label="Mejor Diferencia"
              team={teamDashboard.pointDiff[0]?.team}
              value={teamDashboard.pointDiff[0]?.value}
              suffix="+/- por P."
              icon={<TrendingUp size={18} />}
              color="var(--color-accent)"
              prefix={teamDashboard.pointDiff[0]?.value > 0 ? '+' : ''}
            />
          </div>

          {/* Team rankings grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: 'var(--space-4)',
          }}>
            <TeamLeaderCard statKey="offense" title="Puntos por partido" icon={<Target size={18} />} items={teamDashboard.offense} suffix="" />
            <TeamLeaderCard statKey="defense" title="Puntos encajados" icon={<Shield size={18} />} items={teamDashboard.defense} suffix="" lowIsBetter />
            <TeamLeaderCard statKey="rebounds" title="Rebotes por partido" icon={<Hand size={18} />} items={teamDashboard.rebounds} suffix="" />
            <TeamLeaderCard statKey="assists" title="Asistencias por partido" icon={<Award size={18} />} items={teamDashboard.assists} suffix="" />
            <TeamLeaderCard statKey="fgPct" title="% Tiros de campo" icon={<Crosshair size={18} />} items={teamDashboard.fgPct} suffix="%" />
            <TeamLeaderCard statKey="threePct" title="% Triples" icon={<Crosshair size={18} />} items={teamDashboard.threePct} suffix="%" />
            <TeamLeaderCard statKey="ftPct" title="% Tiros libres" icon={<Crosshair size={18} />} items={teamDashboard.ftPct} suffix="%" />
            <TeamLeaderCard statKey="blocks" title="Tapones por partido" icon={<Shield size={18} />} items={teamDashboard.blocks} suffix="" />
            <TeamLeaderCard statKey="turnovers" title="Pérdidas por partido" icon={<Zap size={18} />} items={teamDashboard.turnovers} suffix="" lowIsBetter />
            <TeamLeaderCard statKey="pointDiff" title="Diferencia de puntos" icon={<TrendingUp size={18} />} items={teamDashboard.pointDiff} suffix="" showSign />
          </div>
        </div>
      )}

      {/* =============================================
          JUGADORES TAB
          ============================================= */}
      {activeTab === 'jugadores' && (
        <div className="animate-fade-in-up">
          {/* Highlight cards row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 'var(--space-4)',
            marginBottom: 'var(--space-6)',
          }}>
            <PlayerHighlightCard
              label="Máximo anotador"
              player={playerDashboard.scorers[0]}
              teams={teams}
              suffix="PPP"
              icon={<Target size={18} />}
              color="var(--color-primary)"
            />
            <PlayerHighlightCard
              label="Máximo reboteador"
              player={playerDashboard.rebounders[0]}
              teams={teams}
              suffix="RPP"
              icon={<Hand size={18} />}
              color="var(--color-success)"
            />
            <PlayerHighlightCard
              label="Más eficiente"
              player={playerDashboard.efficient[0]}
              teams={teams}
              suffix="VAL"
              icon={<Zap size={18} />}
              color="var(--color-accent)"
            />
          </div>

          {/* Player rankings grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: 'var(--space-4)',
          }}>
            <PlayerLeaderCard statKey="scorers" title="Anotadores" icon={<Target size={18} />} items={playerDashboard.scorers} teams={teams} suffix="" />
            <PlayerLeaderCard statKey="rebounders" title="Reboteadores" icon={<Hand size={18} />} items={playerDashboard.rebounders} teams={teams} suffix="" />
            <PlayerLeaderCard statKey="assisters" title="Asistentes" icon={<Award size={18} />} items={playerDashboard.assisters} teams={teams} suffix="" />
            <PlayerLeaderCard statKey="stealers" title="Recuperaciones" icon={<Shield size={18} />} items={playerDashboard.stealers} teams={teams} suffix="" />
            <PlayerLeaderCard statKey="blockers" title="Taponadores" icon={<Shield size={18} />} items={playerDashboard.blockers} teams={teams} suffix="" />
            <PlayerLeaderCard statKey="efficient" title="Eficiencia" icon={<Zap size={18} />} items={playerDashboard.efficient} teams={teams} suffix="" />
            <PlayerLeaderCard statKey="fgPct" title="% Tiros de campo" icon={<Crosshair size={18} />} items={playerDashboard.fgPct} teams={teams} suffix="%" />
            <PlayerLeaderCard statKey="threePct" title="% Triples" icon={<Crosshair size={18} />} items={playerDashboard.threePct} teams={teams} suffix="%" />
            <PlayerLeaderCard statKey="ftPct" title="% Tiros libres" icon={<Crosshair size={18} />} items={playerDashboard.ftPct} teams={teams} suffix="%" />
            <PlayerLeaderCard statKey="minutes" title="Minutos por partido" icon={<BarChart3 size={18} />} items={playerDashboard.minutes} teams={teams} suffix="" />
          </div>
        </div>
      )}

      {/* =============================================
          TOTALES TAB
          ============================================= */}
      {activeTab === 'totales' && (
        <div className="animate-fade-in-up">
          {/* Section: Equipos Totales */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
            marginBottom: 'var(--space-4)', paddingBottom: 'var(--space-2)',
            borderBottom: '2px solid rgba(26,115,232,0.12)',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 'var(--radius-lg)',
              background: 'rgba(26,115,232,0.08)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: 'var(--color-primary)',
            }}>
              <Users size={20} />
            </div>
            <h2 style={{
              fontFamily: 'var(--font-display)', fontWeight: 800,
              fontSize: 'var(--text-lg)', letterSpacing: '-0.02em',
            }}>
              Totales por Equipo
            </h2>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: 'var(--space-4)', marginBottom: 'var(--space-6)',
          }}>
            <TotalTeamCard title="Puntos totales" icon={<Target size={18} />} items={teamDashboard.totalPoints} />
            <TotalTeamCard title="Rebotes totales" icon={<Hand size={18} />} items={teamDashboard.totalRebounds} />
            <TotalTeamCard title="Asistencias totales" icon={<Award size={18} />} items={teamDashboard.totalAssists} />
            <TotalTeamCard title="Recuperaciones totales" icon={<Shield size={18} />} items={teamDashboard.totalRecoveries} />
            <TotalTeamCard title="Tapones totales" icon={<Shield size={18} />} items={teamDashboard.totalBlocks} />
            <TotalTeamCard title="Tiros de campo anotados" icon={<Crosshair size={18} />} items={teamDashboard.totalFGMade} />
            <TotalTeamCard title="Triples anotados" icon={<Crosshair size={18} />} items={teamDashboard.total3Made} />
            <TotalTeamCard title="Tiros libres anotados" icon={<Crosshair size={18} />} items={teamDashboard.totalFTMade} />
            <TotalTeamCard title="Pérdidas totales" icon={<Zap size={18} />} items={teamDashboard.totalTurnovers} lowIsBetter />
            <TotalTeamCard title="Faltas totales" icon={<Zap size={18} />} items={teamDashboard.totalFouls} lowIsBetter />
          </div>

          {/* Section: Jugadores Totales */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
            marginBottom: 'var(--space-4)', paddingBottom: 'var(--space-2)',
            borderBottom: '2px solid rgba(255,149,0,0.15)',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 'var(--radius-lg)',
              background: 'rgba(255,149,0,0.08)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: 'var(--color-accent)',
            }}>
              <User size={20} />
            </div>
            <h2 style={{
              fontFamily: 'var(--font-display)', fontWeight: 800,
              fontSize: 'var(--text-lg)', letterSpacing: '-0.02em',
            }}>
              Totales por Jugador
            </h2>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: 'var(--space-4)',
          }}>
            <TotalPlayerCard title="Puntos totales" icon={<Target size={18} />} items={playerDashboard.totalPts} teams={teams} />
            <TotalPlayerCard title="Rebotes totales" icon={<Hand size={18} />} items={playerDashboard.totalReb} teams={teams} />
            <TotalPlayerCard title="Asistencias totales" icon={<Award size={18} />} items={playerDashboard.totalAst} teams={teams} />
            <TotalPlayerCard title="Recuperaciones totales" icon={<Shield size={18} />} items={playerDashboard.totalStl} teams={teams} />
            <TotalPlayerCard title="Tapones totales" icon={<Shield size={18} />} items={playerDashboard.totalBlk} teams={teams} />
            <TotalPlayerCard title="Valoración total" icon={<Zap size={18} />} items={playerDashboard.totalEff} teams={teams} />
            <TotalPlayerCard title="Minutos totales" icon={<BarChart3 size={18} />} items={playerDashboard.totalMins} teams={teams} />
            <TotalPlayerCard title="TC anotados" icon={<Crosshair size={18} />} items={playerDashboard.totalFgMade} teams={teams} />
            <TotalPlayerCard title="Triples anotados" icon={<Crosshair size={18} />} items={playerDashboard.totalTpMade} teams={teams} />
            <TotalPlayerCard title="TL anotados" icon={<Crosshair size={18} />} items={playerDashboard.totalFtMade} teams={teams} />
            <TotalPlayerCard title="Pérdidas totales" icon={<Zap size={18} />} items={playerDashboard.totalTo} teams={teams} lowIsBetter />
          </div>
        </div>
      )}

      {/* =============================================
          AVANZADAS TAB
          ============================================= */}
      {activeTab === 'avanzadas' && <AdvancedStatsTab />}

      {/* =============================================
          EQUIPOS AVANZADAS TAB
          ============================================= */}
      {activeTab === 'equiposAvz' && <TeamAdvancedStatsTab />}


    </div>
  );
}

// ============================================
// HIGHLIGHT CARDS (top row)
// ============================================

function HighlightCard({ label, team, value, suffix, icon, color, prefix = '' }: {
  label: string; team?: Team; value?: number; suffix: string;
  icon: React.ReactNode; color: string; prefix?: string;
}) {
  if (!team || value === undefined) return null;
  return (
    <div className="card" style={{ padding: 'var(--space-5)', position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, ${team.primaryColor}, ${team.secondaryColor})`,
      }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
        <span style={{ color }}>{icon}</span>
        <span style={{
          fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.08em', color: 'var(--color-text-tertiary)',
        }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <TeamLogo team={team} size="md" />
        <div>
          <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>{team.name}</div>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)',
            fontWeight: 900, color, letterSpacing: '-0.02em',
          }}>
            {prefix}{value.toFixed(1)} <span style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--color-text-tertiary)' }}>{suffix}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayerHighlightCard({ label, player, teams, suffix, icon, color }: {
  label: string; player?: { playerId: string; name: string; teamId: string; value: number };
  teams: Team[]; suffix: string; icon: React.ReactNode; color: string;
}) {
  if (!player) return null;
  const team = teams.find(t => t.id === player.teamId);
  return (
    <div className="card" style={{ padding: 'var(--space-5)', position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: team ? `linear-gradient(90deg, ${team.primaryColor}, ${team.secondaryColor})` : color,
      }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
        <span style={{ color }}>{icon}</span>
        <span style={{
          fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.08em', color: 'var(--color-text-tertiary)',
        }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        {team && <TeamLogo team={team} size="md" />}
        <div>
          <Link href={`/jugadores/${player.playerId}`} style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'inherit', textDecoration: 'none' }}>
            {player.name}
          </Link>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{team?.name}</div>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)',
            fontWeight: 900, color, letterSpacing: '-0.02em',
          }}>
            {player.value.toFixed(1)} <span style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--color-text-tertiary)' }}>{suffix}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// LEADER CARDS (ranking lists)
// ============================================

function TeamLeaderCard({ statKey, title, icon, items, suffix, lowIsBetter = false, showSign = false }: {
  statKey: string;
  title: string;
  icon: React.ReactNode;
  items: { team: Team; value: number }[];
  suffix: string;
  lowIsBetter?: boolean;
  showSign?: boolean;
}) {
  return (
    <Link href={`/estadisticas/equipos/${statKey}`} style={{ textDecoration: 'none', color: 'inherit' }}>
    <div className="card" style={{ padding: 'var(--space-5)', cursor: 'pointer', transition: 'transform var(--transition-fast), box-shadow var(--transition-fast)' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
    >
      <h3 style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
        fontWeight: 700, fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)',
        textTransform: 'uppercase', letterSpacing: '0.04em',
      }}>
        <span style={{ color: 'var(--color-primary)' }}>{icon}</span>
        {title}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {items.slice(0, 5).map((item, i) => {
          const isFirst = i === 0;
          const maxVal = Math.max(...items.slice(0, 5).map(x => Math.abs(x.value)));
          const barWidth = maxVal > 0 ? (Math.abs(item.value) / maxVal) * 100 : 0;
          return (
            <div key={item.team.id} style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-lg)',
              background: isFirst ? `${item.team.primaryColor}08` : 'transparent',
            }}>
              <span style={{
                width: 20, fontSize: 'var(--text-xs)', fontWeight: 700,
                color: isFirst ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
              }}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
              </span>
              <TeamLogo team={item.team} size="sm" />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{item.team.name}</div>
                {/* Mini bar */}
                <div style={{
                  height: 3, borderRadius: 2, background: 'var(--color-border-light)',
                  marginTop: 'var(--space-1)', overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', width: `${barWidth}%`,
                    background: isFirst ? item.team.primaryColor : 'var(--color-text-tertiary)',
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
                {showSign && item.value > 0 ? '+' : ''}{item.value.toFixed(1)}{suffix}
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

function PlayerLeaderCard({ statKey, title, icon, items, teams, suffix }: {
  statKey: string;
  title: string;
  icon: React.ReactNode;
  items: { playerId: string; name: string; teamId: string; value: number }[];
  teams: Team[];
  suffix: string;
}) {
  return (
    <Link href={`/estadisticas/jugadores/${statKey}`} style={{ textDecoration: 'none', color: 'inherit' }}>
    <div className="card" style={{ padding: 'var(--space-5)', cursor: 'pointer', transition: 'transform var(--transition-fast), box-shadow var(--transition-fast)' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
    >
      <h3 style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
        fontWeight: 700, fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)',
        textTransform: 'uppercase', letterSpacing: '0.04em',
      }}>
        <span style={{ color: 'var(--color-primary)' }}>{icon}</span>
        {title}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {items.slice(0, 5).map((item, i) => {
          const team = teams.find(t => t.id === item.teamId);
          const isFirst = i === 0;
          const maxVal = Math.max(...items.slice(0, 5).map(x => x.value));
          const barWidth = maxVal > 0 ? (item.value / maxVal) * 100 : 0;
          return (
            <div key={item.playerId} style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-lg)',
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
                <Link href={`/jugadores/${item.playerId}`}
                  style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'inherit', textDecoration: 'none' }}>
                  {item.name}
                </Link>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                  {team?.shortName}
                </div>
                {/* Mini bar */}
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
                {item.value.toFixed(1)}{suffix}
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

// ============================================
// TOTAL CARDS (integer totals, no decimals)
// ============================================

function TotalTeamCard({ title, icon, items, lowIsBetter = false }: {
  title: string;
  icon: React.ReactNode;
  items: { team: Team; value: number }[];
  lowIsBetter?: boolean;
}) {
  return (
    <div className="card" style={{ padding: 'var(--space-5)' }}>
      <h3 style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
        fontWeight: 700, fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)',
        textTransform: 'uppercase', letterSpacing: '0.04em',
      }}>
        <span style={{ color: 'var(--color-primary)' }}>{icon}</span>
        {title}
        <span style={{
          marginLeft: 'auto', fontSize: '10px', fontWeight: 600,
          background: 'rgba(26,115,232,0.06)', color: 'var(--color-primary)',
          padding: '2px 8px', borderRadius: 'var(--radius-full)',
        }}>
          TOTAL
        </span>
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {items.slice(0, 5).map((item, i) => {
          const isFirst = i === 0;
          const maxVal = Math.max(...items.slice(0, 5).map(x => Math.abs(x.value)));
          const barWidth = maxVal > 0 ? (Math.abs(item.value) / maxVal) * 100 : 0;
          return (
            <div key={item.team.id} style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-lg)',
              background: isFirst ? `${item.team.primaryColor}08` : 'transparent',
            }}>
              <span style={{
                width: 20, fontSize: 'var(--text-xs)', fontWeight: 700,
                color: isFirst ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
              }}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
              </span>
              <TeamLogo team={item.team} size="sm" />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{item.team.name}</div>
                <div style={{
                  height: 3, borderRadius: 2, background: 'var(--color-border-light)',
                  marginTop: 'var(--space-1)', overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', width: `${barWidth}%`,
                    background: isFirst ? item.team.primaryColor : 'var(--color-text-tertiary)',
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
                {Math.round(item.value)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TotalPlayerCard({ title, icon, items, teams, lowIsBetter = false }: {
  title: string;
  icon: React.ReactNode;
  items: { playerId: string; name: string; teamId: string; value: number }[];
  teams: Team[];
  lowIsBetter?: boolean;
}) {
  return (
    <div className="card" style={{ padding: 'var(--space-5)' }}>
      <h3 style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
        fontWeight: 700, fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)',
        textTransform: 'uppercase', letterSpacing: '0.04em',
      }}>
        <span style={{ color: 'var(--color-accent)' }}>{icon}</span>
        {title}
        <span style={{
          marginLeft: 'auto', fontSize: '10px', fontWeight: 600,
          background: 'rgba(255,149,0,0.06)', color: 'var(--color-accent)',
          padding: '2px 8px', borderRadius: 'var(--radius-full)',
        }}>
          TOTAL
        </span>
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {items.slice(0, 5).map((item, i) => {
          const team = teams.find(t => t.id === item.teamId);
          const isFirst = i === 0;
          const maxVal = Math.max(...items.slice(0, 5).map(x => x.value));
          const barWidth = maxVal > 0 ? (item.value / maxVal) * 100 : 0;
          return (
            <div key={item.playerId} style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-lg)',
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
                <Link href={`/jugadores/${item.playerId}`}
                  style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'inherit', textDecoration: 'none' }}>
                  {item.name}
                </Link>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                  {team?.shortName}
                </div>
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
                {Math.round(item.value)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
