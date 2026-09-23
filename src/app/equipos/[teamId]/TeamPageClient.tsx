'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useLeagueData } from '@/lib/DataContext';
import TeamLogo from '@/components/TeamLogo';
import MatchCard from '@/components/MatchCard';

interface TeamPageClientProps {
  teamId: string;
}

export default function TeamPageClient({ teamId }: TeamPageClientProps) {
  const router = useRouter();
  const { players: allPlayers, teams, matches, standings } = useLeagueData();
  const team = teams.find(t => t.id === teamId);

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/equipos');
    }
  };

  if (!team) {
    return (
      <div className="page-container">
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <button
            onClick={handleBack}
            type="button"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              fontSize: 'var(--text-sm)',
              color: 'var(--color-primary)',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            <ArrowLeft size={16} /> Atrás
          </button>
        </div>
        <p>Equipo no encontrado</p>
      </div>
    );
  }

  const players = allPlayers.filter(p => p.teamId === teamId && p.isActive !== false);
  const teamMatches = matches.filter(m => m.homeTeamId === teamId || m.awayTeamId === teamId);
  const standing = standings.find(s => s.teamId === teamId);

  const playedMatches = teamMatches.filter(m => m.isPlayed);
  const upcomingMatches = teamMatches.filter(m => !m.isPlayed);

  return (
    <div className="page-container">
      {/* Back Button */}
      <div className="animate-fade-in-up" style={{ marginBottom: 'var(--space-4)' }}>
        <button
          onClick={handleBack}
          type="button"
          aria-label="Volver a la página anterior"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            fontSize: 'var(--text-sm)',
            color: 'var(--color-primary)',
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            fontWeight: 600,
            transition: 'opacity var(--transition-fast)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.7')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
          <ArrowLeft size={16} /> Atrás
        </button>
      </div>

      {/* Team Header */}
      <div
        className="card animate-fade-in-up"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-8)',
          marginBottom: 'var(--space-8)',
          background: `linear-gradient(135deg, ${team.primaryColor}15, ${team.secondaryColor}08)`,
          borderColor: `${team.primaryColor}30`,
        }}
        id="team-header"
      >
        <TeamLogo team={team} size="xl" />
        <div style={{ flex: 1 }}>
          <h1 style={{ marginBottom: 'var(--space-2)' }}>{team.name}</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-lg)' }}>
            {team.shortName} — Liga Parroquial
          </p>
          {standing && (
            <div style={{
              display: 'flex',
              gap: 'var(--space-6)',
              marginTop: 'var(--space-4)',
              flexWrap: 'wrap',
            }}>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Posición</div>
                <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, fontFamily: 'var(--font-display)' }}>{standing.position}º</div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Balance</div>
                <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, fontFamily: 'var(--font-display)' }}>
                  <span style={{ color: 'var(--color-success)' }}>{standing.wins}</span>
                  <span style={{ color: 'var(--color-text-tertiary)' }}> - </span>
                  <span style={{ color: 'var(--color-danger)' }}>{standing.losses}</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Puntos Liga</div>
                <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, fontFamily: 'var(--font-display)' }}>{standing.leaguePoints}</div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Diferencia</div>
                <div style={{
                  fontSize: 'var(--text-2xl)',
                  fontWeight: 800,
                  fontFamily: 'var(--font-display)',
                  color: standing.pointsDiff > 0 ? 'var(--color-success)' : 'var(--color-danger)',
                }}>
                  {standing.pointsDiff > 0 ? '+' : ''}{standing.pointsDiff}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* Roster */}
        <div className="section animate-fade-in-up delay-1">
          <h2 className="section-title" style={{ marginBottom: 'var(--space-6)' }}>
            🏀 Plantilla
          </h2>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th className="text-center" style={{ width: 50 }}>#</th>
                  <th>Jugador</th>
                  <th>Posición</th>
                </tr>
              </thead>
              <tbody>
                {players.length > 0 ? players.map(player => (
                  <tr key={player.id}>
                    <td className="text-center" style={{ fontWeight: 700, fontFamily: 'var(--font-display)' }}>
                      {player.number}
                    </td>
                    <td>
                      <Link
                        href={`/jugadores/${player.id}`}
                        style={{
                          fontWeight: 600,
                          color: 'inherit',
                          textDecoration: 'none',
                          transition: 'color var(--transition-fast)',
                        }}
                      >
                        {player.name}
                      </Link>
                    </td>
                    <td>
                      <span className="badge badge-primary">{Array.isArray(player.position) ? player.position.join(' / ') : player.position}</span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={3} className="text-center" style={{ color: 'var(--color-text-tertiary)', padding: 'var(--space-8)' }}>
                      Plantilla no disponible
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Matches */}
        <div className="animate-fade-in-up delay-2">
          {/* Played */}
          <div className="section">
            <h2 className="section-title" style={{ marginBottom: 'var(--space-6)' }}>
              📋 Resultados
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {playedMatches.length > 0 ? playedMatches.map(match => (
                <MatchCard key={match.id} match={match} />
              )) : (
                <p style={{ color: 'var(--color-text-tertiary)' }}>Sin partidos disputados</p>
              )}
            </div>
          </div>

          {/* Upcoming */}
          {upcomingMatches.length > 0 && (
            <div className="section">
              <h2 className="section-title" style={{ marginBottom: 'var(--space-6)' }}>
                📅 Próximos Partidos
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {upcomingMatches.map(match => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
