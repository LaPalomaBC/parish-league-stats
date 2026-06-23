'use client';

import Link from 'next/link';
import { useLeagueData } from '@/lib/DataContext';
import { formatDate } from '@/lib/data';
import type { PlayerStats } from '@/lib/types';
import TeamLogo from '@/components/TeamLogo';
import PlayerGameLog from '@/components/PlayerGameLog';

interface PlayerPageClientProps {
  playerId: string;
}

// Compute league-wide and team rankings for a given stat
function computeRankings(
  allPlayers: { id: string; teamId: string }[],
  allStats: PlayerStats[],
  statFn: (ps: PlayerStats[]) => number,
) {
  const playerMap = new Map<string, { playerId: string; teamId: string; value: number }>();

  const grouped = new Map<string, PlayerStats[]>();
  allStats.forEach((ps) => {
    if (!grouped.has(ps.playerId)) grouped.set(ps.playerId, []);
    grouped.get(ps.playerId)!.push(ps);
  });

  grouped.forEach((stats, playerId) => {
    const player = allPlayers.find((p) => p.id === playerId);
    if (!player) return;
    playerMap.set(playerId, {
      playerId,
      teamId: player.teamId,
      value: statFn(stats),
    });
  });

  return Array.from(playerMap.values()).sort((a, b) => b.value - a.value);
}

function getAge(birthDate: string): number {
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function getAccentColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (luminance < 0.25 || luminance > 0.75) return '#007AFF';
  return hex;
}

export default function PlayerPageClient({ playerId }: PlayerPageClientProps) {
  const { players, teams, matches, playerStats: allStats } = useLeagueData();
  const player = players.find((p) => p.id === playerId);

  if (!player) {
    return (
      <div className="page-container">
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--color-text-tertiary)' }}>
          <div style={{ fontSize: '48px', marginBottom: 'var(--space-4)' }}>🔍</div>
          <p style={{ fontSize: 'var(--text-lg)', fontWeight: 600 }}>Jugador no encontrado</p>
        </div>
      </div>
    );
  }

  const team = teams.find(t => t.id === player.teamId);
  if (!team) return null;

  const stats = allStats.filter(ps => ps.playerId === playerId);
  const gamesPlayed = stats.length;

  // Compute averages
  const avg = gamesPlayed > 0
    ? {
        min: stats.reduce((a, b) => a + b.minutes, 0) / gamesPlayed,
        pts: stats.reduce((a, b) => a + b.points, 0) / gamesPlayed,
        reb: stats.reduce((a, b) => a + b.offRebounds + b.defRebounds, 0) / gamesPlayed,
        ast: stats.reduce((a, b) => a + b.assists, 0) / gamesPlayed,
        stl: stats.reduce((a, b) => a + b.recoveries, 0) / gamesPlayed,
        blk: stats.reduce((a, b) => a + b.blocks, 0) / gamesPlayed,
        to: stats.reduce((a, b) => a + b.turnovers, 0) / gamesPlayed,
        fouls: stats.reduce((a, b) => a + b.fouls, 0) / gamesPlayed,
        eff: stats.reduce((a, b) => a + b.efficiency, 0) / gamesPlayed,
        fgPct:
          stats.reduce((a, b) => a + b.twoMade + b.threeMade, 0) /
          Math.max(stats.reduce((a, b) => a + b.twoAttempted + b.threeAttempted, 0), 1) * 100,
        threePct:
          stats.reduce((a, b) => a + b.threeMade, 0) /
          Math.max(stats.reduce((a, b) => a + b.threeAttempted, 0), 1) * 100,
        ftPct:
          stats.reduce((a, b) => a + b.ftMade, 0) /
          Math.max(stats.reduce((a, b) => a + b.ftAttempted, 0), 1) * 100,
      }
    : null;

  // Unified stat definitions — used for averages AND rankings
  const statDefs = [
    { key: 'min', label: 'Minutos', fn: (s: PlayerStats[]) => s.reduce((a, b) => a + b.minutes, 0) / s.length },
    { key: 'pts', label: 'Puntos', fn: (s: PlayerStats[]) => s.reduce((a, b) => a + b.points, 0) / s.length },
    { key: 'reb', label: 'Rebotes', fn: (s: PlayerStats[]) => s.reduce((a, b) => a + b.offRebounds + b.defRebounds, 0) / s.length },
    { key: 'ast', label: 'Asistencias', fn: (s: PlayerStats[]) => s.reduce((a, b) => a + b.assists, 0) / s.length },
    { key: 'stl', label: 'Recuperaciones', fn: (s: PlayerStats[]) => s.reduce((a, b) => a + b.recoveries, 0) / s.length },
    { key: 'blk', label: 'Tapones', fn: (s: PlayerStats[]) => s.reduce((a, b) => a + b.blocks, 0) / s.length },
  ];

  const rankings = statDefs.map((sd) => {
    const all = computeRankings(players, allStats, sd.fn);
    const leagueRank = all.findIndex((r) => r.playerId === playerId) + 1;
    const teamPlayers = all.filter((r) => r.teamId === player.teamId);
    const teamRank = teamPlayers.findIndex((r) => r.playerId === playerId) + 1;
    return {
      key: sd.key,
      label: sd.label,
      avgValue: avg ? avg[sd.key as keyof typeof avg] as number : 0,
      leagueRank: leagueRank || '-',
      teamRank: teamRank || '-',
    };
  });

  // Build game log entries
  interface GameLogEntry {
    matchId: string;
    matchday: number;
    date: string;
    opponentName: string;
    opponentShortName: string;
    opponentColor: string;
    isHome: boolean;
    result: string;
    matchType: 'regular' | 'copa' | 'playoff';
    stats: typeof stats[number];
  }

  const getTeam = (id: string) => teams.find(t => t.id === id);

  const gameLogEntries: GameLogEntry[] = stats
    .map((ps): GameLogEntry | null => {
      const match = matches.find((m) => m.id === ps.matchId);
      if (!match) return null;
      const isHome = match.homeTeamId === player.teamId;
      const opponentId = isHome ? match.awayTeamId : match.homeTeamId;
      const opponent = getTeam(opponentId);
      const myScore = isHome ? match.homeScore : match.awayScore;
      const oppScore = isHome ? match.awayScore : match.homeScore;
      const isWin = (myScore ?? 0) > (oppScore ?? 0);
      return {
        matchId: match.id,
        matchday: match.matchday,
        date: match.matchDate,
        opponentName: opponent?.name ?? 'Desconocido',
        opponentShortName: opponent?.shortName ?? '???',
        opponentColor: opponent?.primaryColor ?? '#999',
        isHome,
        result: `${isWin ? 'W' : 'L'} ${myScore}-${oppScore}`,
        matchType: match.matchType,
        stats: ps,
      };
    })
    .filter((e): e is GameLogEntry => e !== null);

  return (
    <div className="page-container">
      {/* Player Card Hero */}
      <div
        className="card animate-fade-in-up"
        style={{
          padding: 0,
          overflow: 'hidden',
          marginBottom: 'var(--space-6)',
          border: 'none',
        }}
        id="player-hero"
      >
        {/* Top color bar */}
        <div
          style={{
            height: 6,
            background: `linear-gradient(90deg, ${team.primaryColor}, ${team.secondaryColor})`,
          }}
        />

        <div style={{
          display: 'flex',
          gap: 'var(--space-8)',
          padding: 'var(--space-8)',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
        }}>
          {/* Left: Photo */}
          <div style={{
            width: 200,
            height: 240,
            borderRadius: 'var(--radius-xl)',
            overflow: 'hidden',
            background: `linear-gradient(135deg, ${team.primaryColor}18, ${team.secondaryColor}10)`,
            border: '1px solid var(--color-border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            position: 'relative',
          }}>
            {player.photoUrl ? (
              <img
                src={player.photoUrl}
                alt={player.name}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 'var(--space-2)',
              }}>
                <div style={{
                  fontSize: '72px',
                  fontWeight: 900,
                  fontFamily: 'var(--font-display)',
                  color: team.primaryColor,
                  opacity: 0.2,
                  lineHeight: 1,
                }}>
                  {player.number}
                </div>
                <div style={{
                  width: 64,
                  height: 64,
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--color-bg-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '28px',
                }}>
                  🏀
                </div>
              </div>
            )}
          </div>

          {/* Right: Info */}
          <div style={{ flex: 1, minWidth: 280 }}>
            {/* Name + Number */}
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <div style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 'var(--space-3)',
                marginBottom: 'var(--space-1)',
              }}>
                <h1 style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(1.8rem, 4vw, 2.5rem)',
                  fontWeight: 900,
                  letterSpacing: '-0.02em',
                  textTransform: 'uppercase',
                  lineHeight: 1.1,
                }}>
                  {player.name}
                </h1>
                <span style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(1.8rem, 4vw, 2.5rem)',
                  fontWeight: 900,
                  color: team.primaryColor,
                  lineHeight: 1.1,
                }}>
                  {player.number}
                </span>
              </div>
            </div>

            {/* Team badge */}
            <Link
              href={`/equipos/${team.id}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-1) var(--space-3) var(--space-1) var(--space-1)',
                borderRadius: 'var(--radius-full)',
                background: `${team.primaryColor}10`,
                border: `1px solid ${team.primaryColor}30`,
                textDecoration: 'none',
                color: 'inherit',
                marginBottom: 'var(--space-5)',
                transition: 'all var(--transition-fast)',
              }}
            >
              <TeamLogo team={team} size="sm" />
              <span style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                color: team.primaryColor,
              }}>
                {team.name}
              </span>
            </Link>

            {/* Info fields */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
              marginTop: 'var(--space-5)',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--space-2) 0',
                borderBottom: '1px solid var(--color-border-light)',
                maxWidth: 320,
              }}>
                <span style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--color-text-tertiary)',
                }}>
                  Posición
                </span>
                <span style={{
                  fontWeight: 700,
                  fontSize: 'var(--text-sm)',
                }}>
                  {Array.isArray(player.position) ? player.position.join(' / ') : player.position}
                </span>
              </div>

              {player.height && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--space-2) 0',
                  borderBottom: '1px solid var(--color-border-light)',
                  maxWidth: 320,
                }}>
                  <span style={{
                    fontSize: 'var(--text-xs)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--color-text-tertiary)',
                  }}>
                    Altura
                  </span>
                  <span style={{
                    fontWeight: 700,
                    fontSize: 'var(--text-sm)',
                  }}>
                    {(player.height / 100).toFixed(2).replace('.', ',')}m
                  </span>
                </div>
              )}

              {player.birthDate && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--space-2) 0',
                  borderBottom: '1px solid var(--color-border-light)',
                  maxWidth: 320,
                }}>
                  <span style={{
                    fontSize: 'var(--text-xs)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--color-text-tertiary)',
                  }}>
                    Nacimiento
                  </span>
                  <span style={{
                    fontWeight: 700,
                    fontSize: 'var(--text-sm)',
                  }}>
                    {formatDate(player.birthDate)} ({getAge(player.birthDate)} años)
                  </span>
                </div>
              )}

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--space-2) 0',
                maxWidth: 320,
              }}>
                <span style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--color-text-tertiary)',
                }}>
                  Partidos
                </span>
                <span style={{
                  fontWeight: 700,
                  fontSize: 'var(--text-sm)',
                }}>
                  {gamesPlayed}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Stats Summary + Rankings — unified card grid */}
      {avg && (
        <div className="animate-fade-in-up delay-1">
          <div style={{
            marginBottom: 'var(--space-3)',
            display: 'flex',
            alignItems: 'baseline',
            gap: 'var(--space-2)',
          }}>
            <h2 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-sm)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}>
              Estadísticas por partido
            </h2>
            <span style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-tertiary)',
            }}>
              (Media)
            </span>
          </div>

          {/* Row 1: Averages */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '90px repeat(6, 1fr)',
            gap: 'var(--space-3)',
            marginBottom: 'var(--space-3)',
          }}>
            {/* Label */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-1)',
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-xl)',
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border-light)',
            }}>
              <span style={{ fontSize: '20px' }}>📊</span>
              <span style={{
                fontSize: '9px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--color-text-tertiary)',
              }}>
                Media
              </span>
            </div>
            {rankings.map((r) => (
              <div
                key={r.key}
                className="card"
                style={{
                  textAlign: 'center',
                  padding: 'var(--space-5) var(--space-3)',
                }}
              >
                <div style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-text-tertiary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  fontWeight: 600,
                  marginBottom: 'var(--space-2)',
                }}>
                  {r.label}
                </div>
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'var(--text-3xl)',
                  fontWeight: 900,
                  color: getAccentColor(team.primaryColor),
                  letterSpacing: '-0.02em',
                  lineHeight: 1,
                }}>
                  {r.avgValue.toFixed(1)}
                </div>
              </div>
            ))}
          </div>

          {/* Row 2: Team Rankings */}
          {gamesPlayed > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '90px repeat(6, 1fr)',
              gap: 'var(--space-3)',
              marginBottom: 'var(--space-3)',
            }}>
              {/* Label */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-1)',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-xl)',
                background: `${team.primaryColor}10`,
                border: `1px solid ${team.primaryColor}20`,
              }}>
                <TeamLogo team={team} size="sm" />
                <span style={{
                  fontSize: '9px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: getAccentColor(team.primaryColor),
                }}>
                  Equipo
                </span>
              </div>
              {/* Cards */}
              {rankings.map((r) => {
                const isTop3 = typeof r.teamRank === 'number' && r.teamRank <= 3;
                return (
                  <div
                    key={r.key}
                    style={{
                      textAlign: 'center',
                      padding: 'var(--space-5) var(--space-3)',
                      borderRadius: 'var(--radius-xl)',
                      background: isTop3 ? `${team.primaryColor}12` : `${team.primaryColor}06`,
                      border: `1px solid ${team.primaryColor}${isTop3 ? '25' : '12'}`,
                    }}
                  >
                    <div style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--color-text-tertiary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      fontWeight: 600,
                      marginBottom: 'var(--space-2)',
                    }}>
                      {r.label}
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 'var(--text-3xl)',
                      fontWeight: 900,
                      color: isTop3 ? getAccentColor(team.primaryColor) : 'var(--color-text-secondary)',
                      letterSpacing: '-0.02em',
                      lineHeight: 1,
                    }}>
                      {r.teamRank}º
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Row 3: League Rankings */}
          {gamesPlayed > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '90px repeat(6, 1fr)',
              gap: 'var(--space-3)',
            }}>
              {/* Label */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-1)',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-xl)',
                background: 'linear-gradient(135deg, rgba(232, 163, 23, 0.1), rgba(255, 149, 0, 0.06))',
                border: '1px solid rgba(232, 163, 23, 0.2)',
              }}>
                <span style={{ fontSize: '20px' }}>🏆</span>
                <span style={{
                  fontSize: '9px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: '#C08B1A',
                }}>
                  Liga
                </span>
              </div>
              {/* Cards */}
              {rankings.map((r) => {
                const isTop3 = typeof r.leagueRank === 'number' && r.leagueRank <= 3;
                return (
                  <div
                    key={r.key}
                    style={{
                      textAlign: 'center',
                      padding: 'var(--space-5) var(--space-3)',
                      borderRadius: 'var(--radius-xl)',
                      background: isTop3
                        ? 'linear-gradient(135deg, rgba(232, 163, 23, 0.1), rgba(255, 149, 0, 0.06))'
                        : 'rgba(232, 163, 23, 0.03)',
                      border: `1px solid rgba(232, 163, 23, ${isTop3 ? '0.25' : '0.1'})`,
                    }}
                  >
                    <div style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--color-text-tertiary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      fontWeight: 600,
                      marginBottom: 'var(--space-2)',
                    }}>
                      {r.label}
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 'var(--text-3xl)',
                      fontWeight: 900,
                      color: isTop3 ? '#C08B1A' : 'var(--color-text-secondary)',
                      letterSpacing: '-0.02em',
                      lineHeight: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '3px',
                    }}>
                      {isTop3 && (
                        <span style={{ fontSize: '14px' }}>
                          {r.leagueRank === 1 ? '🥇' : r.leagueRank === 2 ? '🥈' : '🥉'}
                        </span>
                      )}
                      {r.leagueRank}º
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Shooting Splits */}
      {avg && (
        <div className="section animate-fade-in-up delay-3" style={{ marginTop: 'var(--space-8)' }}>
          <h2 className="section-title" style={{ marginBottom: 'var(--space-4)' }}>
            🎯 Tiro
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 'var(--space-3)',
          }}>
            {[
              { label: 'Tiros de campo', value: avg.fgPct },
              { label: 'Triples', value: avg.threePct },
              { label: 'Tiros libres', value: avg.ftPct },
            ].map((shot) => (
              <div
                key={shot.label}
                className="card-flat"
                style={{
                  textAlign: 'center',
                  padding: 'var(--space-5) var(--space-4)',
                }}
              >
                <div style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-text-tertiary)',
                  fontWeight: 600,
                  marginBottom: 'var(--space-3)',
                }}>
                  {shot.label}
                </div>

                {/* Circular progress */}
                <div style={{
                  position: 'relative',
                  width: 80,
                  height: 80,
                  margin: '0 auto',
                }}>
                  <svg viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
                    <circle
                      cx="18" cy="18" r="15.5"
                      fill="none"
                      stroke="var(--color-border-light)"
                      strokeWidth="2.5"
                    />
                    <circle
                      cx="18" cy="18" r="15.5"
                      fill="none"
                      stroke={getAccentColor(team.primaryColor)}
                      strokeWidth="2.5"
                      strokeDasharray={`${(shot.value / 100) * 97.4} 97.4`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 800,
                    fontSize: 'var(--text-sm)',
                  }}>
                    {shot.value.toFixed(0)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Game Log */}
      <PlayerGameLog entries={gameLogEntries} accentColor={getAccentColor(team.primaryColor)} />

      {/* No stats message */}
      {gamesPlayed === 0 && (
        <div className="card animate-fade-in-up delay-1" style={{
          textAlign: 'center',
          padding: 'var(--space-12)',
          color: 'var(--color-text-tertiary)',
        }}>
          <div style={{ fontSize: '48px', marginBottom: 'var(--space-4)' }}>📊</div>
          <p style={{ fontSize: 'var(--text-lg)', fontWeight: 600 }}>Sin estadísticas disponibles</p>
          <p style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-2)' }}>
            Las estadísticas se mostrarán cuando haya datos de partidos.
          </p>
        </div>
      )}
    </div>
  );
}
