'use client';

import Link from 'next/link';
import type { PlayerStats } from '@/lib/types';

interface GameLogEntry {
  matchId: string;
  matchday: number;
  date: string;
  opponentName: string;
  opponentShortName: string;
  opponentColor: string;
  isHome: boolean;
  result: string; // "W 68-62" or "L 55-60"
  matchType: 'regular' | 'copa' | 'playoff';
  stats: PlayerStats;
}

interface PlayerGameLogProps {
  entries: GameLogEntry[];
  accentColor: string;
}

const matchTypeLabels: Record<string, { label: string; color: string; bg: string }> = {
  regular: { label: 'Liga', color: 'var(--color-primary)', bg: 'rgba(0, 122, 255, 0.08)' },
  copa: { label: 'Copa', color: '#E8A317', bg: 'rgba(232, 163, 23, 0.08)' },
  playoff: { label: 'Playoff', color: 'var(--color-danger)', bg: 'rgba(255, 59, 48, 0.08)' },
};

export default function PlayerGameLog({ entries, accentColor }: PlayerGameLogProps) {
  if (entries.length === 0) return null;

  return (
    <div className="section animate-fade-in-up delay-4">
      <h2 className="section-title" style={{ marginBottom: 'var(--space-4)' }}>
        🗓️ Historial de partidos
      </h2>

      <div className="table-container" style={{ overflow: 'auto' }}>
        <table className="table" style={{ minWidth: 1050 }}>
          <thead>
            <tr>
              <th style={{ position: 'sticky', left: 0, background: 'var(--color-bg-card)', zIndex: 2 }}>
                Partido
              </th>
              <th className="text-center">COMP</th>
              <th className="text-center">RES</th>
              <th className="text-center">MIN</th>
              <th className="text-center" style={{ fontWeight: 700 }}>PTS</th>
              <th className="text-center">T2</th>
              <th className="text-center">T3</th>
              <th className="text-center">TL</th>
              <th className="text-center">REB</th>
              <th className="text-center">AST</th>
              <th className="text-center">REC</th>
              <th className="text-center">PER</th>
              <th className="text-center">TAP</th>
              <th className="text-center">FC</th>
              <th className="text-center">FR</th>
              <th className="text-center">VAL</th>
              <th className="text-center">+/-</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const isWin = entry.result.startsWith('W');
              const mt = matchTypeLabels[entry.matchType] || matchTypeLabels.regular;
              return (
                <tr key={entry.matchId}>
                  <td style={{
                    position: 'sticky',
                    left: 0,
                    background: 'var(--color-bg-card)',
                    zIndex: 1,
                  }}>
                    <Link
                      href={`/partidos/${entry.matchId}`}
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span style={{
                          fontSize: 'var(--text-xs)',
                          color: 'var(--color-text-tertiary)',
                          minWidth: 20,
                        }}>
                          J{entry.matchday}
                        </span>
                        <div style={{
                          width: 22,
                          height: 22,
                          borderRadius: 'var(--radius-sm)',
                          background: entry.opponentColor,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '8px',
                          fontWeight: 800,
                          color: '#fff',
                          flexShrink: 0,
                        }}>
                          {entry.opponentShortName}
                        </div>
                        <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                          {entry.isHome ? 'vs' : '@'} {entry.opponentShortName}
                        </span>
                      </div>
                    </Link>
                  </td>
                  <td className="text-center">
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '10px',
                      fontWeight: 700,
                      background: mt.bg,
                      color: mt.color,
                      letterSpacing: '0.02em',
                    }}>
                      {mt.label}
                    </span>
                  </td>
                  <td className="text-center">
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 700,
                      background: isWin ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                      color: isWin ? 'var(--color-success)' : 'var(--color-danger)',
                    }}>
                      {entry.result}
                    </span>
                  </td>
                  <td className="text-center">{entry.stats.minutes}</td>
                  <td className="text-center" style={{ fontWeight: 700, color: accentColor }}>
                    {entry.stats.points}
                  </td>
                  <td className="text-center">
                    {entry.stats.twoMade}/{entry.stats.twoAttempted}
                  </td>
                  <td className="text-center">
                    {entry.stats.threeMade}/{entry.stats.threeAttempted}
                  </td>
                  <td className="text-center">
                    {entry.stats.ftMade}/{entry.stats.ftAttempted}
                  </td>
                  <td className="text-center">
                    {entry.stats.offRebounds + entry.stats.defRebounds}
                  </td>
                  <td className="text-center">{entry.stats.assists}</td>
                  <td className="text-center">{entry.stats.recoveries}</td>
                  <td className="text-center">{entry.stats.turnovers}</td>
                  <td className="text-center">{entry.stats.blocks}</td>
                  <td className="text-center">{entry.stats.fouls}</td>
                  <td className="text-center">{entry.stats.foulsReceived}</td>
                  <td className="text-center" style={{
                    fontWeight: 700,
                    color: entry.stats.efficiency > 0 ? 'var(--color-success)' : entry.stats.efficiency < 0 ? 'var(--color-danger)' : 'inherit',
                  }}>
                    {entry.stats.efficiency}
                  </td>
                  <td className="text-center" style={{
                    color: entry.stats.plusMinus > 0 ? 'var(--color-success)' : entry.stats.plusMinus < 0 ? 'var(--color-danger)' : 'inherit',
                  }}>
                    {entry.stats.plusMinus > 0 ? '+' : ''}{entry.stats.plusMinus}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
