import { Users } from 'lucide-react';
import Link from 'next/link';
import { getTeamsFromDisk, getStandingsFromDisk } from '@/lib/serverData';
import TeamLogo from '@/components/TeamLogo';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Equipos — Parish League Stats',
  description: 'Todos los equipos de la Liga Parroquial de Baloncesto de Madrid.',
};

export default async function EquiposPage() {
  const teams = await getTeamsFromDisk();
  const standings = await getStandingsFromDisk();

  // Sort teams by standings position (or alphabetically if no standings yet)
  const sortedTeams = [...teams].sort((a, b) => {
    const posA = standings.find(s => s.teamId === a.id)?.position ?? 99;
    const posB = standings.find(s => s.teamId === b.id)?.position ?? 99;
    if (posA !== posB) return posA - posB;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="page-container">
      <div className="section animate-fade-in-up">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-8)' }}>
          <Users size={32} style={{ color: 'var(--color-primary-light)' }} />
          Equipos
        </h1>

        <div className="grid-2">
          {sortedTeams.map((team, index) => {
            const standing = standings.find(s => s.teamId === team.id);
            return (
              <Link
                key={team.id}
                href={`/equipos/${team.id}`}
                className="card animate-fade-in-up"
                style={{
                  textDecoration: 'none',
                  color: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-5)',
                  animationDelay: `${index * 0.05}s`,
                  opacity: 0,
                }}
                id={`team-card-${team.id}`}
              >
                <TeamLogo team={team} size="lg" />
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--space-1)' }}>
                    {team.name}
                  </h3>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                    {team.shortName}
                  </p>
                  {standing && (
                    <div style={{
                      display: 'flex',
                      gap: 'var(--space-4)',
                      marginTop: 'var(--space-3)',
                      fontSize: 'var(--text-sm)',
                    }}>
                      <span>
                        <span style={{ color: 'var(--color-text-tertiary)' }}>Pos: </span>
                        <span style={{ fontWeight: 700 }}>{standing.position}º</span>
                      </span>
                      <span>
                        <span style={{ color: 'var(--color-success-light)' }}>{standing.wins}V</span>
                        {' - '}
                        <span style={{ color: 'var(--color-danger-light)' }}>{standing.losses}D</span>
                      </span>
                      <span className={`badge ${standing.streak.startsWith('W') ? 'badge-win' : 'badge-loss'}`}>
                        {standing.streak}
                      </span>
                    </div>
                  )}
                </div>
                <div
                  style={{
                    width: 4,
                    height: 48,
                    borderRadius: 'var(--radius-full)',
                    background: `linear-gradient(180deg, ${team.primaryColor}, ${team.secondaryColor})`,
                  }}
                />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
