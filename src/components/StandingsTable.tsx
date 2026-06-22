import Link from 'next/link';
import { StandingRow } from '@/lib/types';
import { getTeam } from '@/lib/data';
import TeamLogo from './TeamLogo';

interface StandingsTableProps {
  standings: StandingRow[];
  compact?: boolean;
}

export default function StandingsTable({ standings, compact = false }: StandingsTableProps) {
  return (
    <div className="table-container" id="standings-table">
      <table className="table">
        <thead>
          <tr>
            <th style={{ width: '40px' }} className="text-center">#</th>
            <th>Equipo</th>
            <th className="text-center">PJ</th>
            <th className="text-center">V</th>
            <th className="text-center">D</th>
            {!compact && (
              <>
                <th className="text-center">PF</th>
                <th className="text-center">PC</th>
              </>
            )}
            <th className="text-center">DIF</th>
            <th className="text-center">Racha</th>
            <th className="text-center">PTS</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row) => {
            const team = getTeam(row.teamId);
            if (!team) return null;

            const positionClass =
              row.position <= 4 ? 'top-4' :
              row.position <= 8 ? 'playoff' :
              'out';

            return (
              <tr key={row.teamId}>
                <td className="text-center">
                  <span className={`position-badge ${positionClass}`}>
                    {row.position}
                  </span>
                </td>
                <td>
                  <Link
                    href={`/equipos/${team.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-3)',
                      color: 'inherit',
                      textDecoration: 'none',
                    }}
                  >
                    <TeamLogo team={team} size="sm" />
                    <span style={{ fontWeight: 600 }}>
                      {compact ? team.shortName : team.name}
                    </span>
                  </Link>
                </td>
                <td className="text-center">{row.played}</td>
                <td className="text-center" style={{ color: 'var(--color-success)' }}>
                  {row.wins}
                </td>
                <td className="text-center" style={{ color: 'var(--color-danger)' }}>
                  {row.losses}
                </td>
                {!compact && (
                  <>
                    <td className="text-center">{row.pointsFor}</td>
                    <td className="text-center">{row.pointsAgainst}</td>
                  </>
                )}
                <td
                  className="text-center"
                  style={{
                    color: row.pointsDiff > 0
                      ? 'var(--color-success)'
                      : row.pointsDiff < 0
                      ? 'var(--color-danger)'
                      : 'var(--color-text-secondary)',
                    fontWeight: 600,
                  }}
                >
                  {row.pointsDiff > 0 ? '+' : ''}{row.pointsDiff}
                </td>
                <td className="text-center">
                  <span className={`badge ${row.streak.startsWith('W') ? 'badge-win' : 'badge-loss'}`}>
                    {row.streak}
                  </span>
                </td>
                <td
                  className="text-center"
                  style={{
                    fontWeight: 800,
                    fontFamily: 'var(--font-display)',
                    fontSize: 'var(--text-base)',
                  }}
                >
                  {row.leaguePoints}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
