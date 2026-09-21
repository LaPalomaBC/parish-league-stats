import Link from 'next/link';
import { Match } from '@/lib/types';
import { getTeam, formatDate } from '@/lib/data';
import TeamLogo from './TeamLogo';

interface MatchCardProps {
  match: Match;
  showMatchday?: boolean;
}

export default function MatchCard({ match, showMatchday }: MatchCardProps) {
  const homeTeam = getTeam(match.homeTeamId);
  const awayTeam = getTeam(match.awayTeamId);

  if (!homeTeam || !awayTeam) return null;

  const homeWon = match.isPlayed && match.homeScore !== null && match.awayScore !== null && match.homeScore > match.awayScore;
  const awayWon = match.isPlayed && match.homeScore !== null && match.awayScore !== null && match.awayScore > match.homeScore;

  return (
    <Link
      href={`/partidos/${match.id}`}
      className="match-card"
      id={`match-${match.id}`}
    >
      {showMatchday && (
        <div style={{
          position: 'absolute',
          top: 6,
          left: 8,
          fontSize: '10px',
          fontWeight: 700,
          color: 'var(--color-text-tertiary)',
          fontFamily: 'var(--font-display)',
          letterSpacing: '0.02em',
        }}>
          J{match.matchday}
        </div>
      )}

      {(match.matchDate || match.matchTime) && (
        <div style={{
          position: 'absolute',
          top: 6,
          right: 8,
          fontSize: '10px',
          fontWeight: 500,
          color: 'var(--color-text-tertiary)',
          fontFamily: 'var(--font-body)',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}>
          {match.matchDate && <span>{formatDate(match.matchDate)}</span>}
          {match.matchDate && match.matchTime && <span>·</span>}
          {match.matchTime && (
            <span style={{
              fontWeight: 600,
              color: match.isPlayed ? 'var(--color-text-secondary)' : 'var(--color-accent)',
            }}>
              {match.matchTime}
            </span>
          )}
        </div>
      )}

      <div className="match-team">
        <TeamLogo team={homeTeam} size="sm" />
        <div>
          <div className="match-team-name" style={{ opacity: awayWon ? 0.5 : 1 }}>
            {homeTeam.shortName}
          </div>
        </div>
      </div>

      <div className="match-score">
        {match.isPlayed ? (
          <>
            <span className={`score ${homeWon ? 'winner' : ''}`}>
              {match.homeScore}
            </span>
            <span className="separator">-</span>
            <span className={`score ${awayWon ? 'winner' : ''}`}>
              {match.awayScore}
            </span>
          </>
        ) : (
          <div className="match-meta">
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
              vs
            </div>
            {match.matchTime ? (
              <div style={{
                fontSize: 'var(--text-xs)',
                marginTop: '3px',
                fontWeight: 700,
                color: 'var(--color-accent)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                background: 'rgba(255, 149, 0, 0.08)',
                padding: '1px 6px',
                borderRadius: 'var(--radius-sm)',
              }}>
                <span style={{ fontSize: '10px' }}>⏰</span>
                <span>{match.matchTime}</span>
              </div>
            ) : match.matchDate ? (
              <div style={{ fontSize: 'var(--text-xs)', marginTop: '2px' }}>
                {formatDate(match.matchDate)}
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="match-team away">
        <TeamLogo team={awayTeam} size="sm" />
        <div>
          <div className="match-team-name" style={{ opacity: homeWon ? 0.5 : 1 }}>
            {awayTeam.shortName}
          </div>
        </div>
      </div>
    </Link>
  );
}
