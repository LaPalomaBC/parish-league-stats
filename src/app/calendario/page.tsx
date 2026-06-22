'use client';

import { useState, useMemo } from 'react';
import { CalendarDays } from 'lucide-react';
import { useLeagueData } from '@/lib/DataContext';
import MatchCard from '@/components/MatchCard';

export default function CalendarioPage() {
  const { matches } = useLeagueData();

  const maxMatchday = useMemo(() => {
    if (matches.length === 0) return 0;
    return Math.max(...matches.map(m => m.matchday));
  }, [matches]);

  const [selectedMatchday, setSelectedMatchday] = useState<number | null>(null);

  // Auto-select the latest matchday with data on first render
  const activeMatchday = selectedMatchday ?? maxMatchday;

  const matchdayMatches = useMemo(() => {
    return matches
      .filter(m => m.matchday === activeMatchday)
      .sort((a, b) => {
        // Played matches first, then by date
        if (a.isPlayed !== b.isPlayed) return a.isPlayed ? -1 : 1;
        return 0;
      });
  }, [matches, activeMatchday]);

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
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-8)' }}>
          <CalendarDays size={32} style={{ color: 'var(--color-primary-light)' }} />
          Calendario
        </h1>

        {/* Matchday Tabs */}
        <div className="tabs" style={{ marginBottom: 'var(--space-8)' }} id="matchday-tabs">
          {Array.from({ length: maxMatchday }, (_, i) => i + 1).map(md => (
            <button
              key={md}
              className={`tab ${activeMatchday === md ? 'active' : ''}`}
              onClick={() => setSelectedMatchday(md)}
            >
              Jornada {md}
            </button>
          ))}
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
          </h2>
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
              padding: 'var(--space-12)',
              color: 'var(--color-text-tertiary)',
            }}>
              No hay partidos programados para esta jornada
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
