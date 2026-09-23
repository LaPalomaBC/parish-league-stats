'use client';

import { useState, useMemo, useEffect } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, List, Filter, X } from 'lucide-react';
import Link from 'next/link';
import { useLeagueData } from '@/lib/DataContext';
import { formatDate, getTeam } from '@/lib/data';
import MatchCard from '@/components/MatchCard';
import TeamLogo from '@/components/TeamLogo';

// ============================================
// HELPERS
// ============================================

/** Build calendar grid for a given year/month (0-indexed month) */
function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // European convention: Monday = 0, Sunday = 6
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const days: { date: Date; dateKey: string; isCurrentMonth: boolean }[] = [];

  // Previous month padding
  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({ date: d, dateKey: toDateKey(d), isCurrentMonth: false });
  }

  // Current month days
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(year, month, d);
    days.push({ date, dateKey: toDateKey(date), isCurrentMonth: true });
  }

  // Next month padding (fill to complete last row)
  const remaining = 7 - (days.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      const date = new Date(year, month + 1, d);
      days.push({ date, dateKey: toDateKey(date), isCurrentMonth: false });
    }
  }

  return days;
}

/** Convert a Date to YYYY-MM-DD string */
function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Format month/year label */
function formatMonthLabel(year: number, month: number): string {
  const d = new Date(year, month, 1);
  return d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
}

/** Format a full date label */
function formatDayLabel(dateKey: string): string {
  const d = new Date(dateKey + 'T12:00:00');
  return d.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const DOW_HEADERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

// ============================================
// MAIN COMPONENT
// ============================================

type ViewMode = 'jornadas' | 'calendario';

export default function CalendarioPage() {
  const { matches, teams } = useLeagueData();
  const [viewMode, setViewMode] = useState<ViewMode>('jornadas');
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);

  // Read URL query parameter for team preselection (e.g. /calendario?equipo=team-01)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const teamParam = params.get('equipo') || params.get('team');
      if (teamParam && teams.some(t => t.id === teamParam)) {
        setSelectedTeamIds([teamParam]);
      }
    }
  }, [teams]);

  // Teams sorted by ID (league official order)
  const sortedTeams = useMemo(() => {
    return [...teams].sort((a, b) => a.id.localeCompare(b.id));
  }, [teams]);

  const toggleTeam = (teamId: string) => {
    setSelectedTeamIds(prev =>
      prev.includes(teamId)
        ? prev.filter(id => id !== teamId)
        : [...prev, teamId]
    );
  };

  // Filtered matches based on selected teams
  const filteredMatches = useMemo(() => {
    if (selectedTeamIds.length === 0) return matches;
    return matches.filter(m =>
      selectedTeamIds.includes(m.homeTeamId) || selectedTeamIds.includes(m.awayTeamId)
    );
  }, [matches, selectedTeamIds]);

  // ── Shared data ──
  const maxMatchday = useMemo(() => {
    if (matches.length === 0) return 0;
    return Math.max(...matches.map(m => m.matchday));
  }, [matches]);

  // ── Jornadas view state ──
  const matchdayDates = useMemo(() => {
    const dateMap: Record<number, string> = {};
    for (const m of matches) {
      if (m.matchDate && !dateMap[m.matchday]) {
        dateMap[m.matchday] = m.matchDate;
      }
    }
    return dateMap;
  }, [matches]);

  const [selectedMatchday, setSelectedMatchday] = useState<number | null>(null);

  const defaultMatchday = useMemo(() => {
    const played = matches.filter(m => m.isPlayed);
    if (played.length > 0) {
      return Math.max(...played.map(m => m.matchday));
    }
    const unplayed = matches.filter(m => !m.isPlayed);
    if (unplayed.length > 0) {
      return Math.min(...unplayed.map(m => m.matchday));
    }
    return maxMatchday || 1;
  }, [matches, maxMatchday]);

  const activeMatchday = selectedMatchday ?? defaultMatchday;

  const matchdayMatches = useMemo(() => {
    return filteredMatches
      .filter(m => m.matchday === activeMatchday)
      .sort((a, b) => {
        if (a.isPlayed !== b.isPlayed) return a.isPlayed ? -1 : 1;
        if (a.matchDate && b.matchDate && a.matchDate !== b.matchDate) {
          return a.matchDate.localeCompare(b.matchDate);
        }
        if (a.matchTime && b.matchTime) {
          return a.matchTime.localeCompare(b.matchTime);
        }
        if (a.matchTime) return -1;
        if (b.matchTime) return 1;
        return a.id.localeCompare(b.id);
      });
  }, [filteredMatches, activeMatchday]);

  // ── Calendar view state ──
  const matchesByDate = useMemo(() => {
    const map: Record<string, typeof matches> = {};
    for (const m of filteredMatches) {
      if (m.matchDate) {
        const dateKey = m.matchDate.split('T')[0];
        if (!map[dateKey]) map[dateKey] = [];
        map[dateKey].push(m);
      }
    }
    // Sort matches within each date by matchTime (if present), then matchday / id
    for (const dateKey in map) {
      map[dateKey].sort((a, b) => {
        if (a.matchTime && b.matchTime) {
          return a.matchTime.localeCompare(b.matchTime);
        }
        if (a.matchTime) return -1;
        if (b.matchTime) return 1;
        return a.matchday - b.matchday;
      });
    }
    return map;
  }, [filteredMatches]);

  // Determine the month range from match dates
  const monthRange = useMemo(() => {
    const dates = matches
      .filter(m => m.matchDate)
      .map(m => new Date(m.matchDate!));
    if (dates.length === 0) return null;
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    return {
      minYear: minDate.getFullYear(),
      minMonth: minDate.getMonth(),
      maxYear: maxDate.getFullYear(),
      maxMonth: maxDate.getMonth(),
    };
  }, [matches]);

  // Default to current month if it has matches, otherwise first month with matches
  const [calYear, setCalYear] = useState(() => {
    const now = new Date();
    return monthRange ? monthRange.minYear : now.getFullYear();
  });
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    if (!monthRange) return now.getMonth();
    // If current month is within range, use it
    const nowKey = now.getFullYear() * 12 + now.getMonth();
    const minKey = monthRange.minYear * 12 + monthRange.minMonth;
    const maxKey = monthRange.maxYear * 12 + monthRange.maxMonth;
    if (nowKey >= minKey && nowKey <= maxKey) return now.getMonth();
    return monthRange.minMonth;
  });

  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  const calDays = useMemo(() => getCalendarDays(calYear, calMonth), [calYear, calMonth]);

  const todayKey = toDateKey(new Date());

  const canGoPrev = monthRange
    ? calYear * 12 + calMonth > monthRange.minYear * 12 + monthRange.minMonth
    : true;
  const canGoNext = monthRange
    ? calYear * 12 + calMonth < monthRange.maxYear * 12 + monthRange.maxMonth
    : true;

  function goMonth(delta: number) {
    let newMonth = calMonth + delta;
    let newYear = calYear;
    if (newMonth < 0) { newMonth = 11; newYear--; }
    if (newMonth > 11) { newMonth = 0; newYear++; }
    setCalMonth(newMonth);
    setCalYear(newYear);
    setSelectedDateKey(null);
  }

  // Matches for selected day
  const selectedDayMatches = selectedDateKey ? (matchesByDate[selectedDateKey] || []) : [];

  // ── Empty state ──
  if (maxMatchday === 0) {
    return (
      <div className="page-container">
        <div className="section animate-fade-in-up" style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
          <CalendarDays size={48} style={{ color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-3)', opacity: 0.3 }} />
          <p style={{ fontWeight: 600, color: 'var(--color-text-tertiary)' }}>
            No hay partidos programados todavía
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="section animate-fade-in-up">
        {/* Header with title + view toggle */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-8)',
          flexWrap: 'wrap',
        }}>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', margin: 0 }}>
            <CalendarDays size={32} style={{ color: 'var(--color-primary-light)' }} />
            Calendario
          </h1>

          <div className="view-toggle">
            <button
              className={`view-toggle-btn ${viewMode === 'jornadas' ? 'active' : ''}`}
              onClick={() => setViewMode('jornadas')}
            >
              <List size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
              Jornadas
            </button>
            <button
              className={`view-toggle-btn ${viewMode === 'calendario' ? 'active' : ''}`}
              onClick={() => setViewMode('calendario')}
            >
              <CalendarDays size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
              Calendario
            </button>
          </div>
        </div>

        {/* ════════════════════════════════════════ */}
        {/* TEAM FILTER BAR                         */}
        {/* ════════════════════════════════════════ */}
        <div className="cal-filter-bar" id="calendar-team-filter">
          <div className="cal-filter-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Filter size={14} style={{ color: selectedTeamIds.length > 0 ? 'var(--color-primary)' : 'var(--color-text-tertiary)' }} />
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-secondary)' }}>
                Filtrar por equipo:
              </span>
              {selectedTeamIds.length > 0 && (
                <span className="badge badge-primary" style={{ fontSize: '10px', padding: '1px 6px' }}>
                  {selectedTeamIds.length} {selectedTeamIds.length === 1 ? 'equipo' : 'equipos'}
                </span>
              )}
            </div>

            {selectedTeamIds.length > 0 && (
              <button
                onClick={() => setSelectedTeamIds([])}
                className="cal-filter-clear-btn"
                title="Ver todos los partidos de la liga"
              >
                <X size={12} />
                Ver todos ({matches.length})
              </button>
            )}
          </div>

          {/* Quick Team Chips */}
          <div className="cal-team-chips-container">
            <button
              onClick={() => setSelectedTeamIds([])}
              className={`cal-team-chip ${selectedTeamIds.length === 0 ? 'active' : ''}`}
            >
              <span>Todos los equipos</span>
              <span className="cal-team-chip-count">{matches.length}</span>
            </button>

            {sortedTeams.map(team => {
              const isSelected = selectedTeamIds.includes(team.id);
              const teamMatchesCount = matches.filter(m => m.homeTeamId === team.id || m.awayTeamId === team.id).length;

              return (
                <button
                  key={team.id}
                  onClick={() => toggleTeam(team.id)}
                  className={`cal-team-chip ${isSelected ? 'active' : ''}`}
                  style={isSelected ? {
                    borderColor: team.primaryColor,
                    background: `${team.primaryColor}15`,
                    color: 'var(--color-text-primary)',
                  } : undefined}
                  title={`${team.name} (${teamMatchesCount} partidos)`}
                >
                  <TeamLogo team={team} size="xs" />
                  <span style={{ fontWeight: isSelected ? 700 : 500 }}>{team.shortName}</span>
                  {isSelected ? (
                    <span style={{
                      width: 14, height: 14, borderRadius: '50%',
                      background: team.primaryColor, color: '#fff',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '9px', marginLeft: 2,
                    }}>
                      ✓
                    </span>
                  ) : (
                    <span className="cal-team-chip-count">{teamMatchesCount}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ════════════════════════════════════════ */}
        {/* JORNADAS VIEW                           */}
        {/* ════════════════════════════════════════ */}
        {viewMode === 'jornadas' && (
          <>
            {/* Matchday Tabs */}
            <div className="tabs calendario-tabs" style={{ marginBottom: 'var(--space-8)' }} id="matchday-tabs">
              {Array.from({ length: maxMatchday }, (_, i) => i + 1).map(md => {
                const dateStr = matchdayDates[md];
                const shortDate = dateStr
                  ? new Date(dateStr).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
                  : null;
                return (
                  <button
                    key={md}
                    className={`tab tab-with-date ${activeMatchday === md ? 'active' : ''}`}
                    onClick={() => setSelectedMatchday(md)}
                  >
                    <span className="tab-label">J{md}</span>
                    {shortDate && <span className="tab-date">{shortDate}</span>}
                  </button>
                );
              })}
            </div>

            {/* Match Type Badge */}
            <div style={{ marginBottom: 'var(--space-6)' }}>
              <h2 className="section-title">
                <CalendarDays size={22} className="icon" />
                Jornada {activeMatchday}
                {activeMatchday <= 9 && (
                  <span className="badge badge-primary" style={{ marginLeft: 'var(--space-2)' }}>
                    Liga Regular
                  </span>
                )}
                {activeMatchday > 9 && activeMatchday <= 11 && (
                  <span className="badge badge-accent" style={{ marginLeft: 'var(--space-2)' }}>
                    Jornada Extra
                  </span>
                )}
                {selectedTeamIds.length > 0 && (
                  <span className="badge badge-accent" style={{ marginLeft: 'var(--space-2)', fontSize: '10px' }}>
                    {matchdayMatches.length} {matchdayMatches.length === 1 ? 'partido filtrado' : 'partidos filtrados'}
                  </span>
                )}
              </h2>
              {matchdayDates[activeMatchday] && (
                <p style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-text-tertiary)',
                  marginTop: 'var(--space-1)',
                  fontWeight: 500,
                }}>
                  📅 {formatDate(matchdayDates[activeMatchday])}
                </p>
              )}
            </div>

            {/* Matches */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', maxWidth: 700 }}>
              {matchdayMatches.length > 0 ? (
                matchdayMatches.map(match => (
                  <MatchCard key={match.id} match={match} />
                ))
              ) : (
                <div className="card-flat" style={{
                  textAlign: 'center',
                  padding: 'var(--space-10) var(--space-6)',
                  color: 'var(--color-text-secondary)',
                }}>
                  {selectedTeamIds.length > 0 ? (
                    <>
                      <p style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>
                        {selectedTeamIds.length === 1
                          ? `El equipo seleccionado no juega en la Jornada ${activeMatchday}`
                          : `Ninguno de los equipos seleccionados juega en la Jornada ${activeMatchday}`}
                      </p>
                      <button
                        onClick={() => setSelectedTeamIds([])}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--color-primary)',
                          fontSize: 'var(--text-xs)',
                          fontWeight: 600,
                          cursor: 'pointer',
                          textDecoration: 'underline',
                        }}
                      >
                        Ver todos los partidos de la jornada
                      </button>
                    </>
                  ) : (
                    <span style={{ color: 'var(--color-text-tertiary)' }}>
                      No hay partidos programados para esta jornada
                    </span>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* ════════════════════════════════════════ */}
        {/* CALENDAR VIEW                           */}
        {/* ════════════════════════════════════════ */}
        {viewMode === 'calendario' && (
          <>
            {/* Month Navigation */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              marginBottom: 'var(--space-6)',
            }}>
              <div className="cal-month-nav">
                <button
                  className="cal-month-btn"
                  onClick={() => goMonth(-1)}
                  disabled={!canGoPrev}
                  aria-label="Mes anterior"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="cal-month-label">
                  {formatMonthLabel(calYear, calMonth)}
                </span>
                <button
                  className="cal-month-btn"
                  onClick={() => goMonth(1)}
                  disabled={!canGoNext}
                  aria-label="Mes siguiente"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="cal-grid">
              {/* Day of week headers */}
              {DOW_HEADERS.map(dow => (
                <div key={dow} className="cal-dow">{dow}</div>
              ))}

              {/* Day cells */}
              {calDays.map((day) => {
                const dayMatches = matchesByDate[day.dateKey] || [];
                const hasMatches = dayMatches.length > 0;
                const isToday = day.dateKey === todayKey;
                const isSelected = day.dateKey === selectedDateKey;
                const maxPills = 3;

                return (
                  <div
                    key={day.dateKey + (day.isCurrentMonth ? '' : '-other')}
                    className={[
                      'cal-day',
                      !day.isCurrentMonth && 'other-month',
                      hasMatches && 'has-matches',
                      isToday && 'today',
                      isSelected && 'selected',
                    ].filter(Boolean).join(' ')}
                    onClick={() => {
                      if (hasMatches) {
                        setSelectedDateKey(isSelected ? null : day.dateKey);
                      }
                    }}
                  >
                    <span className="cal-day-num">{day.date.getDate()}</span>
                    {day.isCurrentMonth && dayMatches.slice(0, maxPills).map(m => {
                      const home = teams.find(t => t.id === m.homeTeamId) || getTeam(m.homeTeamId);
                      const away = teams.find(t => t.id === m.awayTeamId) || getTeam(m.awayTeamId);
                      const mdLabel = m.matchType === 'copa' ? 'COP'
                        : m.matchType === 'playoff' ? 'PO'
                        : `J${m.matchday}`;
                      const pillContent = (
                        <>
                          <span className="cal-pill-md">{mdLabel}</span>
                          {m.matchTime && (
                            <span className="cal-pill-time">{m.matchTime}</span>
                          )}
                          <span>{home?.shortName}</span>
                          {m.isPlayed ? (
                            <span className="cal-pill-score">{m.homeScore}-{m.awayScore}</span>
                          ) : (
                            <span className="cal-pill-vs">vs</span>
                          )}
                          <span>{away?.shortName}</span>
                        </>
                      );
                      if (m.isPlayed) {
                        return (
                          <Link
                            key={m.id}
                            href={`/partidos/${m.id}`}
                            className={`cal-match-pill played clickable`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {pillContent}
                          </Link>
                        );
                      }
                      return (
                        <div
                          key={m.id}
                          className="cal-match-pill upcoming"
                        >
                          {pillContent}
                        </div>
                      );
                    })}
                    {day.isCurrentMonth && dayMatches.length > maxPills && (
                      <span className="cal-more-matches">+{dayMatches.length - maxPills} más</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Selected Day Detail */}
            {selectedDateKey && selectedDayMatches.length > 0 && (
              <div className="cal-day-detail">
                <div className="cal-day-detail-header">
                  <span className="cal-day-detail-date">
                    📅 {formatDayLabel(selectedDateKey)}
                  </span>
                  <span className="cal-day-detail-badge">
                    {selectedDayMatches.length} {selectedDayMatches.length === 1 ? 'partido' : 'partidos'}
                    {selectedTeamIds.length > 0 && ' (filtrado)'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', maxWidth: 700 }}>
                  {selectedDayMatches.map(match => (
                    <MatchCard key={match.id} match={match} showMatchday />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
