'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useLeagueData } from '@/lib/DataContext';

export default function TopScorersChart() {
  const { teams, standings, isLoading } = useLeagueData();

  if (isLoading || standings.length === 0) {
    return (
      <div style={{ width: '100%', height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
        {isLoading ? 'Cargando...' : 'Sin datos de clasificación todavía'}
      </div>
    );
  }

  const data = [...standings]
    .sort((a, b) => b.pointsFor - a.pointsFor)
    .slice(0, 5)
    .map((s) => {
      const team = teams.find((t) => t.id === s.teamId);
      return {
        name: team?.shortName || '',
        ppg: s.played > 0 ? Math.round((s.pointsFor / s.played) * 10) / 10 : 0,
        color: team?.primaryColor || '#007AFF',
        fullName: team?.name || '',
      };
    });

  return (
    <div style={{ width: '100%', height: 260 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
          <XAxis
            dataKey="name"
            tick={{ fill: '#6E6E73', fontSize: 12 }}
            axisLine={{ stroke: 'rgba(0,0,0,0.08)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#6E6E73', fontSize: 12 }}
            axisLine={{ stroke: 'rgba(0,0,0,0.08)' }}
            tickLine={false}
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
            formatter={(value: any) => [`${value} PPG`, 'Media de puntos']}
            labelFormatter={(label) => {
              const item = data.find((d) => d.name === label);
              return item?.fullName || label;
            }}
          />
          <Bar dataKey="ppg" radius={[8, 8, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
