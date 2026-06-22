'use client';

import { useState, useMemo, useCallback } from 'react';
import { CalendarDays, Plus, Trash2, Check, Save, AlertCircle, GripVertical, Ban } from 'lucide-react';
import { useLeagueData } from '@/lib/DataContext';
import { recalculateStandings } from '@/lib/importEngine';
import type { Match, Team } from '@/lib/types';
import TeamLogo from '@/components/TeamLogo';

export default function CalendarioAdminPage() {
  const { teams, matches, updateMatches, updateStandings, addImportRecord } = useLeagueData();
  const [saved, setSaved] = useState(false);
  const [editingMatches, setEditingMatches] = useState<Match[]>(matches);

  // Keep editingMatches in sync when context matches change (initial load)
  useState(() => {
    setEditingMatches(matches);
  });

  // Group matches by matchday
  const matchdays = useMemo(() => {
    const grouped = new Map<number, Match[]>();
    editingMatches.forEach(m => {
      const existing = grouped.get(m.matchday) || [];
      existing.push(m);
      grouped.set(m.matchday, existing);
    });
    // Sort by matchday number
    return Array.from(grouped.entries())
      .sort(([a], [b]) => a - b)
      .map(([matchday, mdMatches]) => ({ matchday, matches: mdMatches }));
  }, [editingMatches]);

  const maxMatchday = matchdays.length > 0
    ? Math.max(...matchdays.map(md => md.matchday))
    : 0;

  // Teams already assigned in a given matchday (for validation)
  const getUsedTeamsInMatchday = useCallback((matchday: number, excludeMatchId?: string) => {
    const used = new Set<string>();
    editingMatches
      .filter(m => m.matchday === matchday && m.id !== excludeMatchId)
      .forEach(m => {
        used.add(m.homeTeamId);
        used.add(m.awayTeamId);
      });
    return used;
  }, [editingMatches]);

  // Generate next match ID
  const nextMatchId = useCallback(() => {
    const maxId = editingMatches.reduce((max, m) => {
      const num = parseInt(m.id.replace('m-', ''), 10);
      return isNaN(num) ? max : Math.max(max, num);
    }, 0);
    return `m-${String(maxId + 1).padStart(2, '0')}`;
  }, [editingMatches]);

  // Add new matchday
  const handleAddMatchday = () => {
    const newMatchday = maxMatchday + 1;
    // Create an empty placeholder match so the matchday appears
    const newMatch: Match = {
      id: nextMatchId(),
      matchday: newMatchday,
      matchDate: '',
      homeTeamId: '',
      awayTeamId: '',
      homeScore: null,
      awayScore: null,
      matchType: newMatchday <= 9 ? 'regular' : 'regular',
      isPlayed: false,
    };
    setEditingMatches(prev => [...prev, newMatch]);
  };

  // Add match to matchday
  const handleAddMatch = (matchday: number) => {
    const newMatch: Match = {
      id: nextMatchId(),
      matchday,
      matchDate: '',
      homeTeamId: '',
      awayTeamId: '',
      homeScore: null,
      awayScore: null,
      matchType: 'regular',
      isPlayed: false,
    };
    setEditingMatches(prev => [...prev, newMatch]);
  };

  // Remove match
  const handleRemoveMatch = (matchId: string) => {
    setEditingMatches(prev => prev.filter(m => m.id !== matchId));
  };

  // Remove entire matchday
  const handleRemoveMatchday = (matchday: number) => {
    const mdMatches = editingMatches.filter(m => m.matchday === matchday);
    const hasPlayed = mdMatches.some(m => m.isPlayed);
    if (hasPlayed) return;
    setEditingMatches(prev => prev.filter(m => m.matchday !== matchday));
  };

  // Update match field
  const handleMatchField = (matchId: string, field: keyof Match, value: string) => {
    setEditingMatches(prev => prev.map(m =>
      m.id === matchId ? { ...m, [field]: value } : m
    ));
  };

  // Update individual match date
  const handleMatchDate = (matchId: string, date: string) => {
    setEditingMatches(prev => prev.map(m =>
      m.id === matchId ? { ...m, matchDate: date } : m
    ));
  };

  // Save
  const handleSave = () => {
    // Filter out incomplete matches (no teams selected)
    const validMatches = editingMatches.filter(m =>
      m.homeTeamId && m.awayTeamId
    );
    updateMatches(validMatches);
    setEditingMatches(validMatches);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  // Register forfeit (incomparecencia) without an acta
  const handleForfeit = (matchId: string, forfeitTeam: 'home' | 'away') => {
    const match = editingMatches.find(m => m.id === matchId);
    if (!match || match.isPlayed || !match.homeTeamId || !match.awayTeamId) return;

    const homeScore = forfeitTeam === 'home' ? 0 : 20;
    const awayScore = forfeitTeam === 'away' ? 0 : 20;

    const updatedMatch: Match = {
      ...match,
      homeScore,
      awayScore,
      isPlayed: true,
      matchDate: match.matchDate || new Date().toISOString().split('T')[0],
    };

    const newMatches = editingMatches.map(m => m.id === matchId ? updatedMatch : m);
    setEditingMatches(newMatches);
    updateMatches(newMatches);

    // Recalculate standings
    const newStandings = recalculateStandings(newMatches, teams);
    updateStandings(newStandings);

    // Add import record
    addImportRecord({
      matchId: match.id,
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      homeScore,
      awayScore,
      matchday: match.matchday,
      matchType: match.matchType,
      importedAt: new Date().toISOString(),
      fileName: 'incomparecencia-manual',
      isForfeit: true,
      forfeitTeam,
    });
  };

  // Stats
  const totalMatches = editingMatches.filter(m => m.homeTeamId && m.awayTeamId).length;
  const playedMatches = editingMatches.filter(m => m.isPlayed).length;
  const pendingMatches = totalMatches - playedMatches;

  return (
    <>
      {/* Summary + Actions */}
      <div className="section animate-fade-in-up">
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-6)',
          flexWrap: 'wrap',
          gap: 'var(--space-3)',
        }}>
          <div>
            <p style={{
              color: 'var(--color-text-secondary)',
              fontSize: 'var(--text-sm)',
              lineHeight: 1.6,
              maxWidth: 500,
            }}>
              Define los enfrentamientos de cada jornada. Al importar un acta de liga, el sistema detectará automáticamente la jornada correspondiente.
            </p>
            <div style={{
              display: 'flex',
              gap: 'var(--space-4)',
              marginTop: 'var(--space-3)',
            }}>
              <StatBadge label="Jornadas" value={matchdays.length} />
              <StatBadge label="Partidos" value={totalMatches} />
              <StatBadge label="Jugados" value={playedMatches} color="var(--color-success)" />
              <StatBadge label="Pendientes" value={pendingMatches} color="var(--color-accent)" />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button onClick={handleAddMatchday} style={btnOutline}>
              <Plus size={16} />
              Añadir Jornada
            </button>
            <button
              onClick={handleSave}
              style={{
                ...btnPrimary,
                background: saved ? 'var(--color-success)' : 'var(--color-primary)',
              }}
            >
              {saved ? <Check size={16} /> : <Save size={16} />}
              {saved ? 'Guardado' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>

      {/* Matchdays */}
      {matchdays.length === 0 ? (
        <div className="section animate-fade-in-up" style={{
          textAlign: 'center',
          padding: 'var(--space-12)',
          color: 'var(--color-text-tertiary)',
        }}>
          <CalendarDays size={48} style={{ marginBottom: 'var(--space-3)', opacity: 0.3 }} />
          <p style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>
            No hay jornadas configuradas
          </p>
          <p style={{ fontSize: 'var(--text-sm)' }}>
            Pulsa &quot;Añadir Jornada&quot; para empezar a definir el calendario de la liga.
          </p>
        </div>
      ) : (
        matchdays.map(({ matchday, matches: mdMatches }, mdIndex) => {
          const hasPlayedMatches = mdMatches.some(m => m.isPlayed);
          const usedTeams = getUsedTeamsInMatchday(matchday);
          const completeMatches = mdMatches.filter(m => m.homeTeamId && m.awayTeamId).length;

          return (
            <div
              key={matchday}
              className="section animate-fade-in-up"
              style={{
                marginBottom: 'var(--space-4)',
                animationDelay: `${mdIndex * 0.05}s`,
                opacity: 0,
              }}
            >
              {/* Matchday Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 'var(--space-4)',
                flexWrap: 'wrap',
                gap: 'var(--space-3)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 'var(--radius-lg)',
                    background: hasPlayedMatches
                      ? 'rgba(52, 199, 89, 0.1)'
                      : 'rgba(0, 122, 255, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 900,
                    fontSize: 'var(--text-lg)',
                    color: hasPlayedMatches ? 'var(--color-success)' : 'var(--color-primary)',
                  }}>
                    {matchday}
                  </div>
                  <div>
                    <h3 style={{
                      fontWeight: 700,
                      fontSize: 'var(--text-base)',
                      fontFamily: 'var(--font-display)',
                    }}>
                      Jornada {matchday}
                    </h3>
                    <span style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--color-text-tertiary)',
                    }}>
                      {completeMatches} partido{completeMatches !== 1 ? 's' : ''} definido{completeMatches !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {matchday <= 9 && (
                    <span className="badge badge-primary" style={{ fontSize: '10px' }}>Liga</span>
                  )}
                  {matchday > 9 && (
                    <span className="badge badge-accent" style={{ fontSize: '10px' }}>Extra</span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  {/* Delete matchday */}
                  {!hasPlayedMatches && (
                    <button
                      onClick={() => {
                        if (confirm(`¿Eliminar la Jornada ${matchday} y todos sus enfrentamientos?`)) {
                          handleRemoveMatchday(matchday);
                        }
                      }}
                      title="Eliminar jornada"
                      style={btnDanger}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Matches */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {mdMatches.map((match) => (
                  <MatchRow
                    key={match.id}
                    match={match}
                    teams={teams}
                    usedTeams={getUsedTeamsInMatchday(matchday, match.id)}
                    onChangeHome={(teamId) => handleMatchField(match.id, 'homeTeamId', teamId)}
                    onChangeAway={(teamId) => handleMatchField(match.id, 'awayTeamId', teamId)}
                    onChangeDate={(date) => handleMatchDate(match.id, date)}
                    onRemove={() => handleRemoveMatch(match.id)}
                    onForfeit={(forfeitTeam) => handleForfeit(match.id, forfeitTeam)}
                  />
                ))}
              </div>

              {/* Add match button */}
              {usedTeams.size < teams.length * 2 && mdMatches.length < 5 && (
                <button
                  onClick={() => handleAddMatch(matchday)}
                  style={{
                    ...btnOutlineSmall,
                    marginTop: 'var(--space-3)',
                    width: '100%',
                    justifyContent: 'center',
                  }}
                >
                  <Plus size={14} />
                  Añadir enfrentamiento
                </button>
              )}
            </div>
          );
        })
      )}

      {/* Info note */}
      <div className="card-flat animate-fade-in-up" style={{
        display: 'flex',
        gap: 'var(--space-3)',
        alignItems: 'flex-start',
        fontSize: 'var(--text-sm)',
        color: 'var(--color-text-secondary)',
        lineHeight: 1.6,
      }}>
        <AlertCircle size={18} style={{ color: 'var(--color-primary)', flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong>Nota:</strong> Los partidos ya jugados (con acta importada) no se pueden eliminar desde aquí.
          Para revertirlos, ve a <em>Importar Actas → Historial</em> y borra la importación.
        </div>
      </div>
    </>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

function StatBadge({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-2)',
      padding: 'var(--space-1) var(--space-3)',
      background: 'var(--color-bg-secondary)',
      borderRadius: 'var(--radius-full)',
    }}>
      <span style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 900,
        fontSize: 'var(--text-base)',
        color: color || 'var(--color-text-primary)',
      }}>
        {value}
      </span>
      <span style={{
        fontSize: '10px',
        color: 'var(--color-text-tertiary)',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        {label}
      </span>
    </div>
  );
}

interface MatchRowProps {
  match: Match;
  teams: Team[];
  usedTeams: Set<string>;
  onChangeHome: (teamId: string) => void;
  onChangeAway: (teamId: string) => void;
  onChangeDate: (date: string) => void;
  onRemove: () => void;
  onForfeit: (forfeitTeam: 'home' | 'away') => void;
}

function MatchRow({ match, teams, usedTeams, onChangeHome, onChangeAway, onChangeDate, onRemove, onForfeit }: MatchRowProps) {
  const homeTeam = teams.find(t => t.id === match.homeTeamId);
  const awayTeam = teams.find(t => t.id === match.awayTeamId);

  // Available teams for each dropdown (exclude already used, but keep current selection)
  const availableForHome = teams.filter(t =>
    !usedTeams.has(t.id) || t.id === match.homeTeamId || t.id === match.awayTeamId
  ).filter(t => t.id !== match.awayTeamId);

  const availableForAway = teams.filter(t =>
    !usedTeams.has(t.id) || t.id === match.awayTeamId || t.id === match.homeTeamId
  ).filter(t => t.id !== match.homeTeamId);

  if (match.isPlayed) {
    // Played match — read-only
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        padding: 'var(--space-3) var(--space-4)',
        background: 'rgba(52, 199, 89, 0.04)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid rgba(52, 199, 89, 0.15)',
        flexWrap: 'wrap',
      }}>
        <GripVertical size={14} style={{ color: 'var(--color-text-tertiary)', opacity: 0.3 }} />

        {/* Date display */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', minWidth: 100 }}>
          <CalendarDays size={12} style={{ color: 'var(--color-text-tertiary)' }} />
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
            {match.matchDate ? new Date(match.matchDate + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '—'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flex: 1 }}>
          {homeTeam && <TeamLogo team={homeTeam} size="sm" />}
          <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', minWidth: 40 }}>
            {homeTeam?.shortName || '?'}
          </span>
        </div>

        <div style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 900,
          fontSize: 'var(--text-base)',
          padding: 'var(--space-1) var(--space-3)',
          background: 'var(--color-bg-secondary)',
          borderRadius: 'var(--radius-md)',
          minWidth: 60,
          textAlign: 'center',
        }}>
          {match.homeScore} - {match.awayScore}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flex: 1, justifyContent: 'flex-end' }}>
          <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', minWidth: 40, textAlign: 'right' }}>
            {awayTeam?.shortName || '?'}
          </span>
          {awayTeam && <TeamLogo team={awayTeam} size="sm" />}
        </div>

        <span className="badge badge-success" style={{ fontSize: '10px', marginLeft: 'var(--space-2)' }}>
          <Check size={10} /> Jugado
        </span>
      </div>
    );
  }

  // Editable match
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-3)',
      padding: 'var(--space-3) var(--space-4)',
      background: 'var(--color-bg-card)',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--color-border-light)',
      transition: 'all var(--transition-fast)',
      flexWrap: 'wrap',
    }}>
      <GripVertical size={14} style={{ color: 'var(--color-text-tertiary)', opacity: 0.3 }} />

      {/* Date picker per match */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
        <CalendarDays size={12} style={{ color: 'var(--color-text-tertiary)' }} />
        <input
          type="date"
          value={match.matchDate}
          onChange={(e) => onChangeDate(e.target.value)}
          style={{ ...dateInputStyle, fontSize: 'var(--text-xs)', padding: 'var(--space-1) var(--space-2)', minWidth: 120 }}
        />
      </div>

      {/* Home team selector */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        {homeTeam && <TeamLogo team={homeTeam} size="sm" />}
        <select
          value={match.homeTeamId}
          onChange={(e) => onChangeHome(e.target.value)}
          style={teamSelectStyle}
        >
          <option value="">Local...</option>
          {availableForHome.map(t => (
            <option key={t.id} value={t.id}>{t.shortName} — {t.name}</option>
          ))}
        </select>
      </div>

      {/* VS */}
      <div style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 900,
        fontSize: 'var(--text-xs)',
        color: 'var(--color-text-tertiary)',
        padding: 'var(--space-1) var(--space-2)',
      }}>
        VS
      </div>

      {/* Away team selector */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
        <select
          value={match.awayTeamId}
          onChange={(e) => onChangeAway(e.target.value)}
          style={{ ...teamSelectStyle, textAlign: 'right' }}
        >
          <option value="">Visitante...</option>
          {availableForAway.map(t => (
            <option key={t.id} value={t.id}>{t.name} — {t.shortName}</option>
          ))}
        </select>
        {awayTeam && <TeamLogo team={awayTeam} size="sm" />}
      </div>

      {/* Remove */}
      <button onClick={onRemove} style={btnDangerSmall} title="Eliminar enfrentamiento">
        <Trash2 size={12} />
      </button>

      {/* Forfeit button */}
      {match.homeTeamId && match.awayTeamId && (
        <button
          onClick={() => {
            const homeName = homeTeam?.shortName || 'Local';
            const awayName = awayTeam?.shortName || 'Visitante';
            const choice = window.prompt(
              `🚫 INCOMPARECENCIA\n\n¿Quién NO se presentó?\n\n` +
              `1 → ${homeName} (resultado: 0-20)\n` +
              `2 → ${awayName} (resultado: 20-0)\n\n` +
              `Escribe 1 o 2:`
            );
            if (choice === '1') {
              onForfeit('home');
            } else if (choice === '2') {
              onForfeit('away');
            }
          }}
          style={{
            ...btnDangerSmall,
            color: '#E8A317',
            borderColor: 'rgba(255, 149, 0, 0.2)',
            background: 'var(--color-bg-secondary)',
          }}
          title="Registrar incomparecencia (20-0)"
        >
          <Ban size={12} />
        </button>
      )}
    </div>
  );
}

// ============================================
// STYLES
// ============================================

const teamSelectStyle: React.CSSProperties = {
  flex: 1,
  padding: 'var(--space-2) var(--space-3)',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-bg-secondary)',
  color: 'var(--color-text-primary)',
  fontSize: 'var(--text-sm)',
  fontFamily: 'var(--font-body)',
  fontWeight: 500,
  cursor: 'pointer',
  outline: 'none',
  maxWidth: 220,
};

const dateInputStyle: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-3)',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-bg-secondary)',
  color: 'var(--color-text-primary)',
  fontSize: 'var(--text-sm)',
  fontFamily: 'var(--font-body)',
  cursor: 'pointer',
  outline: 'none',
};

const btnPrimary: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  padding: 'var(--space-2) var(--space-5)',
  borderRadius: 'var(--radius-full)',
  border: 'none',
  background: 'var(--color-primary)',
  color: '#fff',
  fontSize: 'var(--text-sm)',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'var(--font-body)',
  transition: 'all var(--transition-fast)',
};

const btnOutline: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  padding: 'var(--space-2) var(--space-5)',
  borderRadius: 'var(--radius-full)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-bg-card)',
  color: 'var(--color-text-secondary)',
  fontSize: 'var(--text-sm)',
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'var(--font-body)',
  transition: 'all var(--transition-fast)',
};

const btnOutlineSmall: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  padding: 'var(--space-2) var(--space-4)',
  borderRadius: 'var(--radius-md)',
  border: '1px dashed var(--color-border-hover)',
  background: 'transparent',
  color: 'var(--color-text-tertiary)',
  fontSize: 'var(--text-xs)',
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'var(--font-body)',
  transition: 'all var(--transition-fast)',
};

const btnDanger: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border-light)',
  background: 'var(--color-bg-secondary)',
  color: 'var(--color-danger)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all var(--transition-fast)',
};

const btnDangerSmall: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border-light)',
  background: 'var(--color-bg-secondary)',
  color: 'var(--color-danger)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

const forfeitOptionStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  width: '100%',
  padding: 'var(--space-2) var(--space-3)',
  borderRadius: 'var(--radius-sm)',
  border: 'none',
  background: 'transparent',
  color: 'var(--color-text-primary)',
  fontSize: 'var(--text-sm)',
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'var(--font-body)',
  transition: 'background 0.1s ease',
};
