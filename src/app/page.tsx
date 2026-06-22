import {
  Trophy,
  Flame,
  CalendarDays,
  TrendingUp,
  BarChart3,
  Users,
  Clock,
} from 'lucide-react';
import Link from 'next/link';
import {
  getTeamsFromDisk,
  getStandingsFromDisk,
  getPlayedMatchesFromDisk,
  getUpcomingMatchesFromDisk,
  getLatestPlayedMatchdayFromDisk,
  getMatchdayMatchesFromDisk,
  getMatchesFromDisk,
} from '@/lib/serverData';
import StandingsTable from '@/components/StandingsTable';
import MatchCard from '@/components/MatchCard';
import TopScorersChart from '@/components/TopScorersChart';
import StandingsChart from '@/components/StandingsChart';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const teams = await getTeamsFromDisk();
  const standings = await getStandingsFromDisk();
  const allMatches = await getMatchesFromDisk();
  const latestMatchday = await getLatestPlayedMatchdayFromDisk();
  const latestMatches = latestMatchday > 0 ? await getMatchdayMatchesFromDisk(latestMatchday) : [];
  const totalPlayed = (await getPlayedMatchesFromDisk()).length;
  const leader = standings.length > 0 ? standings[0] : null;
  const leaderTeam = leader ? teams.find(t => t.id === leader.teamId) : null;

  // Upcoming matches sorted by date (across all matchdays), take first 8
  const upcomingByDate = (await getUpcomingMatchesFromDisk())
    .sort((a, b) => {
      if (!a.matchDate && !b.matchDate) return a.matchday - b.matchday;
      if (!a.matchDate) return 1;
      if (!b.matchDate) return -1;
      return a.matchDate.localeCompare(b.matchDate);
    })
    .slice(0, 8);

  // Next matchday (first unplayed matchday)
  const unplayedMatchdays = allMatches
    .filter(m => !m.isPlayed)
    .map(m => m.matchday);
  const nextMatchday = unplayedMatchdays.length > 0 ? Math.min(...unplayedMatchdays) : 0;
  const nextMatchdayMatches = nextMatchday > 0
    ? allMatches.filter(m => m.matchday === nextMatchday)
    : [];

  const hasData = standings.length > 0 || latestMatches.length > 0;

  return (
    <div className="page-container">
      {/* Hero */}
      <div className="hero animate-fade-in-up" id="hero-section">
        <h1 className="hero-title">Parish League</h1>
        <p className="hero-subtitle">
          Liga Parroquial de Baloncesto de Madrid — Temporada 2025/26
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid-4 section animate-fade-in-up delay-1" id="quick-stats">
        <div className="card stat-card">
          <Users size={22} style={{ color: 'var(--color-primary)', marginBottom: 'var(--space-3)' }} />
          <div className="stat-value">{teams.length}</div>
          <div className="stat-label">Equipos</div>
        </div>
        <div className="card stat-card">
          <CalendarDays size={22} style={{ color: 'var(--color-accent)', marginBottom: 'var(--space-3)' }} />
          <div className="stat-value">{latestMatchday > 0 ? `J${latestMatchday}` : '—'}</div>
          <div className="stat-label">Última Jornada</div>
        </div>
        <div className="card stat-card">
          <Flame size={22} style={{ color: '#FF3B30', marginBottom: 'var(--space-3)' }} />
          <div className="stat-value">{totalPlayed}</div>
          <div className="stat-label">Partidos Jugados</div>
        </div>
        <div className="card stat-card">
          <Trophy size={22} style={{ color: '#FFD60A', marginBottom: 'var(--space-3)' }} />
          <div className="stat-value">{leaderTeam?.shortName ?? '—'}</div>
          <div className="stat-label">Líder</div>
        </div>
      </div>

      {hasData ? (
        <>
          {/* Main Content Grid */}
          <div className="grid-2" style={{ alignItems: 'start' }}>
            {/* Left: Standings */}
            <div className="section animate-fade-in-up delay-2">
              <div className="section-header">
                <h2 className="section-title">
                  <Trophy size={20} className="icon" />
                  Clasificación
                </h2>
                <Link
                  href="/clasificacion"
                  style={{
                    fontSize: 'var(--text-sm)',
                    color: 'var(--color-primary)',
                    fontWeight: 500,
                  }}
                >
                  Ver completa →
                </Link>
              </div>
              <StandingsTable standings={standings} compact />
            </div>

            {/* Right: Recent + Next Matchday + Upcoming */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
              {latestMatches.length > 0 && (
                <div className="section animate-fade-in-up delay-3">
                  <div className="section-header">
                    <h2 className="section-title">
                      <Flame size={20} className="icon" />
                      Jornada {latestMatchday}
                    </h2>
                    <Link
                      href="/calendario"
                      style={{
                        fontSize: 'var(--text-sm)',
                        color: 'var(--color-primary)',
                        fontWeight: 500,
                      }}
                    >
                      Ver calendario →
                    </Link>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {latestMatches.map((match) => (
                      <MatchCard key={match.id} match={match} />
                    ))}
                  </div>
                </div>
              )}

              {nextMatchdayMatches.length > 0 && (
                <div className="section animate-fade-in-up delay-4">
                  <div className="section-header">
                    <h2 className="section-title">
                      <Clock size={20} className="icon" />
                      Siguiente Jornada — J{nextMatchday}
                    </h2>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {nextMatchdayMatches.map((match) => (
                      <MatchCard key={match.id} match={match} />
                    ))}
                  </div>
                </div>
              )}

              {upcomingByDate.length > 0 && (
                <div className="section animate-fade-in-up delay-5">
                  <div className="section-header">
                    <h2 className="section-title">
                      <CalendarDays size={20} className="icon" />
                      Próximos Partidos
                    </h2>
                    <Link
                      href="/calendario"
                      style={{
                        fontSize: 'var(--text-sm)',
                        color: 'var(--color-primary)',
                        fontWeight: 500,
                      }}
                    >
                      Ver calendario →
                    </Link>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {upcomingByDate.map((match) => (
                      <MatchCard key={match.id} match={match} showMatchday />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Charts */}
          <div className="grid-2 section" style={{ marginTop: 'var(--space-4)' }}>
            <div className="card animate-fade-in-up delay-4">
              <h3 className="section-title" style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--text-base)' }}>
                <BarChart3 size={18} className="icon" />
                Puntos por Partido (Media)
              </h3>
              <TopScorersChart />
            </div>
            <div className="card animate-fade-in-up delay-5">
              <h3 className="section-title" style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--text-base)' }}>
                <TrendingUp size={18} className="icon" />
                Evolución Clasificación
              </h3>
              <StandingsChart />
            </div>
          </div>
        </>
      ) : (
        /* Empty state — no data yet */
        <div className="section animate-fade-in-up delay-2">
          <div className="card" style={{ textAlign: 'center', padding: 'var(--space-12) var(--space-8)' }}>
            <CalendarDays size={48} style={{ color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-4)' }} />
            <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--space-2)' }}>
              Temporada por comenzar
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', maxWidth: 400, margin: '0 auto' }}>
              Aún no hay partidos ni clasificación. Añade el calendario y las actas de los partidos desde el panel de administración.
            </p>
            <Link
              href="/admin"
              style={{
                display: 'inline-block',
                marginTop: 'var(--space-6)',
                padding: 'var(--space-3) var(--space-6)',
                background: 'var(--color-primary)',
                color: '#fff',
                borderRadius: 'var(--radius-lg)',
                fontWeight: 600,
                fontSize: 'var(--text-sm)',
                textDecoration: 'none',
              }}
            >
              Ir a Administración →
            </Link>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer
        style={{
          textAlign: 'center',
          padding: 'var(--space-12) 0 var(--space-8)',
          color: 'var(--color-text-tertiary)',
          fontSize: 'var(--text-sm)',
        }}
      >
        <p style={{ fontWeight: 500 }}>🏀 Parish League Stats</p>
        <p style={{ marginTop: 'var(--space-1)', fontSize: 'var(--text-xs)' }}>
          Temporada 2025/26 — Liga Parroquial de Baloncesto de Madrid
        </p>
      </footer>
    </div>
  );
}
