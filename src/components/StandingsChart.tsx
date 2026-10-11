'use client';

import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useLeagueData } from '@/lib/DataContext';
import { isBeforeCopa, sortStandingRows } from '@/lib/importEngine';

interface StandingsChartProps {
  teamIds?: string[];
  showTeamFilter?: boolean;
}

export default function StandingsChart({ teamIds, showTeamFilter }: StandingsChartProps) {
  const { teams, matches, standings, isLoading } = useLeagueData();
  const playedMatches = matches.filter(m => m.isPlayed);

  // Team visibility toggle state — default all visible
  const [visibleTeamIds, setVisibleTeamIds] = useState<Set<string> | null>(null);

  if (isLoading || playedMatches.length === 0) {
    return (
      <div style={{ width: '100%', height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
        {isLoading ? 'Cargando...' : 'Sin partidos jugados todavía'}
      </div>
    );
  }

  const maxMatchday = Math.max(...playedMatches.map(m => m.matchday));
  const totalTeams = teams.length || 10;

  // If teamIds prop is set, use those (e.g. team detail page); otherwise use all
  const allDisplayTeams = teamIds
    ? teams.filter(t => teamIds.includes(t.id))
    : teams;

  // Apply visibility filter
  const activeVisibleIds = visibleTeamIds ?? new Set(allDisplayTeams.map(t => t.id));
  const displayTeams = allDisplayTeams.filter(t => activeVisibleIds.has(t.id));

  const toggleTeam = (teamId: string) => {
    setVisibleTeamIds(prev => {
      const current = prev ?? new Set(allDisplayTeams.map(t => t.id));
      const next = new Set(current);
      if (next.has(teamId)) {
        next.delete(teamId);
      } else {
        next.add(teamId);
      }
      return next;
    });
  };

  const selectAll = () => setVisibleTeamIds(new Set(allDisplayTeams.map(t => t.id)));
  const selectNone = () => setVisibleTeamIds(new Set());

  const allSelected = activeVisibleIds.size === allDisplayTeams.length;
  const noneSelected = activeVisibleIds.size === 0;

  // Calculate chart data
  const chartData = [];

  for (let md = 1; md <= maxMatchday; md++) {
    const playedUpToMd = matches.filter(m => m.isPlayed && m.homeScore !== null && m.awayScore !== null && m.matchday <= md);
    const useH2H = isBeforeCopa(playedUpToMd);

    const teamPoints: { teamId: string; leaguePoints: number; wins: number; pointsDiff: number; pointsFor: number }[] = [];

    for (const team of teams) {
      const teamMatches = playedUpToMd.filter(
        (m) => m.homeTeamId === team.id || m.awayTeamId === team.id
      );

      let wins = 0;
      let pointsFor = 0;
      let pointsAgainst = 0;

      teamMatches.forEach((m) => {
        if (m.homeTeamId === team.id) {
          pointsFor += m.homeScore ?? 0;
          pointsAgainst += m.awayScore ?? 0;
          if ((m.homeScore ?? 0) > (m.awayScore ?? 0)) wins++;
        } else {
          pointsFor += m.awayScore ?? 0;
          pointsAgainst += m.homeScore ?? 0;
          if ((m.awayScore ?? 0) > (m.homeScore ?? 0)) wins++;
        }
      });

      const leaguePoints = teamMatches.length + wins;
      teamPoints.push({ teamId: team.id, leaguePoints, wins, pointsDiff: pointsFor - pointsAgainst, pointsFor });
    }

    sortStandingRows(teamPoints, playedUpToMd, useH2H);

    const point: Record<string, number | string> = { matchday: `J${md}` };
    teamPoints.forEach((tp, index) => {
      const team = teams.find(t => t.id === tp.teamId);
      if (team && displayTeams.some(dt => dt.id === team.id)) {
        point[team.shortName] = index + 1;
      }
    });

    chartData.push(point);
  }

  return (
    <div>
      {/* Team filter chips */}
      {showTeamFilter && allDisplayTeams.length > 1 && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-3)',
            flexWrap: 'wrap',
          }}>
            <button
              onClick={allSelected ? selectNone : selectAll}
              style={{
                padding: '4px 12px',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--color-border)',
                background: allSelected ? 'var(--color-primary-bg)' : 'transparent',
                color: allSelected ? 'var(--color-primary)' : 'var(--color-text-tertiary)',
                fontSize: '10px',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                transition: 'all 0.15s ease',
              }}
            >
              {allSelected ? 'Quitar todos' : 'Todos'}
            </button>

            {allDisplayTeams.map(team => {
              const isActive = activeVisibleIds.has(team.id);
              return (
                <button
                  key={team.id}
                  onClick={() => toggleTeam(team.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-full)',
                    border: `1.5px solid ${isActive ? team.primaryColor : 'var(--color-border-light)'}`,
                    background: isActive ? `${team.primaryColor}12` : 'transparent',
                    color: isActive ? team.primaryColor : 'var(--color-text-tertiary)',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                    transition: 'all 0.15s ease',
                    opacity: isActive ? 1 : 0.5,
                  }}
                >
                  <span style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: isActive ? team.primaryColor : 'var(--color-border)',
                    flexShrink: 0,
                  }} />
                  {team.shortName}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Chart */}
      {noneSelected ? (
        <div style={{ width: '100%', height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
          Selecciona al menos un equipo para ver el gráfico
        </div>
      ) : (
        <div style={{ width: '100%', height: 320 }}>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
              <XAxis
                dataKey="matchday"
                tick={{ fill: '#6E6E73', fontSize: 12 }}
                axisLine={{ stroke: 'rgba(0,0,0,0.08)' }}
                tickLine={false}
              />
              <YAxis
                reversed
                domain={[1, totalTeams]}
                ticks={Array.from({ length: totalTeams }, (_, i) => i + 1)}
                tick={{ fill: '#6E6E73', fontSize: 11 }}
                axisLine={{ stroke: 'rgba(0,0,0,0.08)' }}
                tickLine={false}
                label={{
                  value: 'Posición',
                  angle: -90,
                  position: 'insideLeft',
                  offset: 15,
                  style: { fill: '#6E6E73', fontSize: 10, fontWeight: 600 },
                }}
              />
              <Tooltip
                contentStyle={{
                  background: 'rgba(255, 255, 255, 0.96)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(0,0,0,0.08)',
                  borderRadius: '12px',
                  color: '#1D1D1F',
                  fontSize: '13px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                }}
                formatter={(value: any, name: any) => [`${value}º`, String(name)]}
                itemSorter={(item: any) => item.value as number}
              />
              {!showTeamFilter && (
                <Legend wrapperStyle={{ fontSize: '11px', color: '#6E6E73' }} />
              )}
              {displayTeams.map((team) => (
                <Line
                  key={team.id}
                  type="monotone"
                  dataKey={team.shortName}
                  stroke={team.primaryColor}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: team.primaryColor, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: team.primaryColor, strokeWidth: 2, stroke: '#fff' }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
