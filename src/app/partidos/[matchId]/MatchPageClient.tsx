'use client';

import Link from 'next/link';
import { useLeagueData } from '@/lib/DataContext';
import { formatDate } from '@/lib/data';
import TeamLogo from '@/components/TeamLogo';

interface MatchPageClientProps {
  matchId: string;
}

export default function MatchPageClient({ matchId }: MatchPageClientProps) {
  const { players, teams, matches, playerStats } = useLeagueData();
  const match = matches.find(m => m.id === matchId);

  if (!match) {
    return (
      <div className="page-container">
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--color-text-tertiary)' }}>
          <div style={{ fontSize: '48px', marginBottom: 'var(--space-4)' }}>🔍</div>
          <p style={{ fontSize: 'var(--text-lg)', fontWeight: 600 }}>Partido no encontrado</p>
        </div>
      </div>
    );
  }

  const homeTeam = teams.find(t => t.id === match.homeTeamId)!;
  const awayTeam = teams.find(t => t.id === match.awayTeamId)!;
  const stats = playerStats.filter(s => s.matchId === match.id);
  const homeStats = stats.filter(s => s.teamId === match.homeTeamId);
  const awayStats = stats.filter(s => s.teamId === match.awayTeamId);

  const homeWon = match.isPlayed && match.homeScore! > match.awayScore!;
  const awayWon = match.isPlayed && match.awayScore! > match.homeScore!;

  function BoxScoreTable({ teamStats, teamColor }: { teamStats: typeof homeStats; teamColor: string }) {
    if (teamStats.length === 0) {
      return (
        <div className="card-flat" style={{
          textAlign: 'center',
          padding: 'var(--space-8)',
          color: 'var(--color-text-tertiary)',
        }}>
          Estadísticas no disponibles
        </div>
      );
    }

    return (
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Jugador</th>
              <th className="text-center">MIN</th>
              <th className="text-center">PTS</th>
              <th className="text-center">T2</th>
              <th className="text-center">T3</th>
              <th className="text-center">TL</th>
              <th className="text-center">REB</th>
              <th className="text-center">AST</th>
              <th className="text-center">REC</th>
              <th className="text-center">PER</th>
              <th className="text-center">TAP</th>
              <th className="text-center">FC</th>
              <th className="text-center">VAL</th>
              <th className="text-center">+/-</th>
            </tr>
          </thead>
          <tbody>
            {teamStats.map(ps => {
              const player = players.find(p => p.id === ps.playerId);
              return (
                <tr key={ps.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <span style={{
                        fontWeight: 700,
                        fontSize: 'var(--text-xs)',
                        color: teamColor,
                        minWidth: 20,
                      }}>
                        #{player?.number}
                      </span>
                      <Link
                        href={`/jugadores/${ps.playerId}`}
                        style={{
                          fontWeight: 600,
                          color: 'inherit',
                          textDecoration: 'none',
                          transition: 'color var(--transition-fast)',
                        }}
                      >
                        {player?.name || 'Desconocido'}
                      </Link>
                    </div>
                  </td>
                  <td className="text-center">{ps.minutes}</td>
                  <td className="text-center" style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{ps.points}</td>
                  <td className="text-center">{ps.twoMade}/{ps.twoAttempted}</td>
                  <td className="text-center">{ps.threeMade}/{ps.threeAttempted}</td>
                  <td className="text-center">{ps.ftMade}/{ps.ftAttempted}</td>
                  <td className="text-center">{ps.offRebounds + ps.defRebounds}</td>
                  <td className="text-center">{ps.assists}</td>
                  <td className="text-center">{ps.recoveries}</td>
                  <td className="text-center">{ps.turnovers}</td>
                  <td className="text-center">{ps.blocks}</td>
                  <td className="text-center">{ps.fouls}</td>
                  <td className="text-center" style={{
                    fontWeight: 700,
                    color: ps.efficiency > 15 ? 'var(--color-success)' : ps.efficiency > 5 ? 'var(--color-text-primary)' : 'var(--color-danger)',
                  }}>
                    {ps.efficiency}
                  </td>
                  <td className="text-center" style={{
                    color: ps.plusMinus > 0 ? 'var(--color-success)' : ps.plusMinus < 0 ? 'var(--color-danger)' : 'inherit',
                  }}>
                    {ps.plusMinus > 0 ? '+' : ''}{ps.plusMinus}
                  </td>
                </tr>
              );
            })}
            {/* Totals */}
            {teamStats.length > 0 && (
              <tr style={{ background: 'var(--color-bg-secondary)', fontWeight: 700 }}>
                <td>TOTAL</td>
                <td className="text-center">-</td>
                <td className="text-center" style={{ color: 'var(--color-text-primary)' }}>
                  {teamStats.reduce((a, b) => a + b.points, 0)}
                </td>
                <td className="text-center">
                  {teamStats.reduce((a, b) => a + b.twoMade, 0)}/{teamStats.reduce((a, b) => a + b.twoAttempted, 0)}
                </td>
                <td className="text-center">
                  {teamStats.reduce((a, b) => a + b.threeMade, 0)}/{teamStats.reduce((a, b) => a + b.threeAttempted, 0)}
                </td>
                <td className="text-center">
                  {teamStats.reduce((a, b) => a + b.ftMade, 0)}/{teamStats.reduce((a, b) => a + b.ftAttempted, 0)}
                </td>
                <td className="text-center">
                  {teamStats.reduce((a, b) => a + b.offRebounds + b.defRebounds, 0)}
                </td>
                <td className="text-center">{teamStats.reduce((a, b) => a + b.assists, 0)}</td>
                <td className="text-center">{teamStats.reduce((a, b) => a + b.recoveries, 0)}</td>
                <td className="text-center">{teamStats.reduce((a, b) => a + b.turnovers, 0)}</td>
                <td className="text-center">{teamStats.reduce((a, b) => a + b.blocks, 0)}</td>
                <td className="text-center">{teamStats.reduce((a, b) => a + b.fouls, 0)}</td>
                <td className="text-center">
                  {teamStats.reduce((a, b) => a + b.efficiency, 0)}
                </td>
                <td className="text-center">
                  —
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Score Header */}
      <div
        className="card animate-fade-in-up"
        style={{
          textAlign: 'center',
          marginBottom: 'var(--space-8)',
          padding: 'var(--space-6) var(--space-4)',
        }}
        id="match-header"
      >
        <div style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--color-text-tertiary)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginBottom: 'var(--space-4)',
        }}>
          Jornada {match.matchday} — {formatDate(match.matchDate)}
        </div>

        <div className="match-header-row">
          {/* Home */}
          <Link href={`/equipos/${homeTeam.id}`} className="match-header-team">
            <TeamLogo team={homeTeam} size="lg" />
            <div className="match-header-team-name" style={{
              opacity: match.isPlayed && !homeWon ? 0.5 : 1,
            }}>
              <span className="match-header-fullname">{homeTeam.name}</span>
              <span className="match-header-shortname">{homeTeam.shortName}</span>
            </div>
          </Link>

          {/* Score */}
          {match.isPlayed ? (
            <div className="match-header-score">
              <span style={{ color: homeWon ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)' }}>
                {match.homeScore}
              </span>
              <span className="match-header-dash">—</span>
              <span style={{ color: awayWon ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)' }}>
                {match.awayScore}
              </span>
            </div>
          ) : (
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-base)',
              fontWeight: 700,
              color: 'var(--color-primary)',
              padding: 'var(--space-2) var(--space-4)',
              background: 'var(--color-primary-bg)',
              borderRadius: 'var(--radius-lg)',
            }}>
              PRÓXIMO
            </div>
          )}

          {/* Away */}
          <Link href={`/equipos/${awayTeam.id}`} className="match-header-team">
            <TeamLogo team={awayTeam} size="lg" />
            <div className="match-header-team-name" style={{
              opacity: match.isPlayed && !awayWon ? 0.5 : 1,
            }}>
              <span className="match-header-fullname">{awayTeam.name}</span>
              <span className="match-header-shortname">{awayTeam.shortName}</span>
            </div>
          </Link>
        </div>
      </div>

      {/* Box Scores */}
      {match.isPlayed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
          <div className="section animate-fade-in-up delay-1">
            <h2 className="section-title" style={{ marginBottom: 'var(--space-4)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <TeamLogo team={homeTeam} size="sm" />
                {homeTeam.name}
              </span>
            </h2>
            <BoxScoreTable teamStats={homeStats} teamColor={homeTeam.primaryColor} />
          </div>

          <div className="section animate-fade-in-up delay-2">
            <h2 className="section-title" style={{ marginBottom: 'var(--space-4)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <TeamLogo team={awayTeam} size="sm" />
                {awayTeam.name}
              </span>
            </h2>
            <BoxScoreTable teamStats={awayStats} teamColor={awayTeam.primaryColor} />
          </div>
        </div>
      )}
    </div>
  );
}
