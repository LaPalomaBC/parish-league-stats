'use client';

import { useState, useRef, useEffect } from 'react';
import { Filter, X, ChevronDown } from 'lucide-react';
import TeamLogo from '@/components/TeamLogo';
import type { Team, Match } from '@/lib/types';

export interface StatsFilters {
  teamIds: string[];
  matchTypes: ('regular' | 'copa' | 'playoff')[];
  matchdays: number[];
}

interface StatsFilterBarProps {
  teams: Team[];
  matches: Match[];
  filters: StatsFilters;
  onChange: (filters: StatsFilters) => void;
  /** 'equipos' hides team filter; 'jugadores' shows it */
  mode: 'equipos' | 'jugadores';
}

const MATCH_TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  regular: { label: 'Liga Regular', color: 'var(--color-primary)', bg: 'rgba(0, 122, 255, 0.08)' },
  copa:    { label: 'Copa',         color: '#C08B1A',              bg: 'rgba(232, 163, 23, 0.08)' },
  playoff: { label: 'Playoff',      color: 'var(--color-danger)',   bg: 'rgba(255, 59, 48, 0.08)' },
};

export function emptyFilters(): StatsFilters {
  return { teamIds: [], matchTypes: [], matchdays: [] };
}

export function hasActiveFilters(f: StatsFilters): boolean {
  return f.teamIds.length > 0 || f.matchTypes.length > 0 || f.matchdays.length > 0;
}

/** Returns match IDs that pass the filters */
export function filterMatchIds(matches: Match[], filters: StatsFilters): Set<string> {
  let filtered = matches.filter(m => m.isPlayed && m.homeScore !== null);

  if (filters.matchTypes.length > 0) {
    filtered = filtered.filter(m => filters.matchTypes.includes(m.matchType));
  }
  if (filters.matchdays.length > 0) {
    filtered = filtered.filter(m => filters.matchdays.includes(m.matchday));
  }
  if (filters.teamIds.length > 0) {
    filtered = filtered.filter(m =>
      filters.teamIds.includes(m.homeTeamId) || filters.teamIds.includes(m.awayTeamId)
    );
  }

  return new Set(filtered.map(m => m.id));
}

export default function StatsFilterBar({ teams, matches, filters, onChange, mode }: StatsFilterBarProps) {
  // Compute available matchdays from matches
  const availableMatchdays = [...new Set(
    matches.filter(m => m.isPlayed).map(m => m.matchday)
  )].sort((a, b) => a - b);

  const availableTypes = [...new Set(
    matches.filter(m => m.isPlayed).map(m => m.matchType)
  )];

  const activeCount = (filters.teamIds.length > 0 ? 1 : 0) +
    (filters.matchTypes.length > 0 ? 1 : 0) +
    (filters.matchdays.length > 0 ? 1 : 0);

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', alignItems: 'center',
      gap: 'var(--space-3)', padding: 'var(--space-4)',
      background: 'var(--color-bg-card)', borderRadius: 'var(--radius-xl)',
      border: '1px solid var(--color-border-light)',
      marginBottom: 'var(--space-5)',
      position: 'relative', zIndex: 50, overflow: 'visible',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
        color: 'var(--color-text-tertiary)', fontSize: 'var(--text-xs)',
        fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
        flexShrink: 0,
      }}>
        <Filter size={14} />
        Filtros
        {activeCount > 0 && (
          <span style={{
            background: 'var(--color-primary)', color: '#fff',
            fontSize: '10px', fontWeight: 800, borderRadius: 'var(--radius-full)',
            width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {activeCount}
          </span>
        )}
      </div>

      {/* Competition type */}
      {availableTypes.length > 0 && (
        <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
          {availableTypes.map(type => {
            const mt = MATCH_TYPE_LABELS[type];
            const isActive = filters.matchTypes.includes(type);
            return (
              <button
                key={type}
                onClick={() => {
                  const next = isActive
                    ? filters.matchTypes.filter(t => t !== type)
                    : [...filters.matchTypes, type];
                  onChange({ ...filters, matchTypes: next as StatsFilters['matchTypes'] });
                }}
                style={{
                  padding: '4px 12px', borderRadius: 'var(--radius-full)',
                  border: `1.5px solid ${isActive ? mt.color : 'var(--color-border-light)'}`,
                  background: isActive ? mt.bg : 'transparent',
                  color: isActive ? mt.color : 'var(--color-text-tertiary)',
                  fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                  transition: 'all var(--transition-fast)',
                }}
              >
                {mt.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Matchday dropdown */}
      {availableMatchdays.length > 0 && (
        <DropdownMulti
          label="Jornada"
          options={availableMatchdays.map(md => ({ value: md, label: `J${md}` }))}
          selected={filters.matchdays}
          onChange={matchdays => onChange({ ...filters, matchdays })}
        />
      )}

      {/* Team selector (only for jugadores mode) */}
      {mode === 'jugadores' && (
        <TeamMultiSelect
          teams={teams}
          selected={filters.teamIds}
          onChange={teamIds => onChange({ ...filters, teamIds })}
        />
      )}

      {/* Clear all */}
      {activeCount > 0 && (
        <button
          onClick={() => onChange(emptyFilters())}
          style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-1)',
            padding: '4px 12px', borderRadius: 'var(--radius-full)',
            border: '1px solid var(--color-danger)', background: 'rgba(255,59,48,0.06)',
            color: 'var(--color-danger)', fontSize: 'var(--text-xs)', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'var(--font-body)',
          }}
        >
          <X size={12} /> Limpiar
        </button>
      )}
    </div>
  );
}

// ============================================
// Generic multi-select dropdown
// ============================================

function DropdownMulti<T extends string | number>({ label, options, selected, onChange }: {
  label: string;
  options: { value: T; label: string }[];
  selected: T[];
  onChange: (selected: T[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const hasSelection = selected.length > 0;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-1)',
          padding: '4px 12px', borderRadius: 'var(--radius-full)',
          border: `1.5px solid ${hasSelection ? 'var(--color-primary)' : 'var(--color-border-light)'}`,
          background: hasSelection ? 'rgba(0,122,255,0.06)' : 'transparent',
          color: hasSelection ? 'var(--color-primary)' : 'var(--color-text-tertiary)',
          fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer',
          fontFamily: 'var(--font-body)',
        }}
      >
        {label}{hasSelection ? ` (${selected.length})` : ''}
        <ChevronDown size={12} style={{ transform: open ? 'rotate(180deg)' : '', transition: 'transform 0.2s' }} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '110%', left: 0, zIndex: 100,
          background: 'var(--color-bg-card)', border: '1px solid var(--color-border-light)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
          padding: 'var(--space-2)', minWidth: 140, maxHeight: 260, overflowY: 'auto',
        }}>
          {options.map(opt => {
            const isSelected = selected.includes(opt.value);
            return (
              <button
                key={String(opt.value)}
                onClick={() => {
                  const next = isSelected
                    ? selected.filter(v => v !== opt.value)
                    : [...selected, opt.value];
                  onChange(next);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--space-2)', width: '100%',
                  padding: 'var(--space-2) var(--space-3)', border: 'none', borderRadius: 'var(--radius-md)',
                  background: isSelected ? 'rgba(0,122,255,0.08)' : 'transparent',
                  color: isSelected ? 'var(--color-primary)' : 'var(--color-text-primary)',
                  fontWeight: isSelected ? 600 : 400, fontSize: 'var(--text-xs)',
                  cursor: 'pointer', fontFamily: 'var(--font-body)', textAlign: 'left',
                }}
              >
                <span style={{
                  width: 14, height: 14, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: isSelected ? '2px solid var(--color-primary)' : '2px solid var(--color-border)',
                  background: isSelected ? 'var(--color-primary)' : 'transparent',
                  color: '#fff', fontSize: '9px',
                }}>
                  {isSelected && '✓'}
                </span>
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================
// Team multi-select dropdown
// ============================================

function TeamMultiSelect({ teams, selected, onChange }: {
  teams: Team[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const hasSelection = selected.length > 0;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-1)',
          padding: '4px 12px', borderRadius: 'var(--radius-full)',
          border: `1.5px solid ${hasSelection ? 'var(--color-primary)' : 'var(--color-border-light)'}`,
          background: hasSelection ? 'rgba(0,122,255,0.06)' : 'transparent',
          color: hasSelection ? 'var(--color-primary)' : 'var(--color-text-tertiary)',
          fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer',
          fontFamily: 'var(--font-body)',
        }}
      >
        Equipo{hasSelection ? ` (${selected.length})` : ''}
        <ChevronDown size={12} style={{ transform: open ? 'rotate(180deg)' : '', transition: 'transform 0.2s' }} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '110%', left: 0, zIndex: 100,
          background: 'var(--color-bg-card)', border: '1px solid var(--color-border-light)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
          padding: 'var(--space-2)', minWidth: 200, maxHeight: 300, overflowY: 'auto',
        }}>
          {teams.map(team => {
            const isSelected = selected.includes(team.id);
            return (
              <button
                key={team.id}
                onClick={() => {
                  const next = isSelected
                    ? selected.filter(id => id !== team.id)
                    : [...selected, team.id];
                  onChange(next);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--space-2)', width: '100%',
                  padding: 'var(--space-2) var(--space-3)', border: 'none', borderRadius: 'var(--radius-md)',
                  background: isSelected ? `${team.primaryColor}10` : 'transparent',
                  color: 'var(--color-text-primary)', fontWeight: isSelected ? 600 : 400,
                  fontSize: 'var(--text-xs)', cursor: 'pointer', fontFamily: 'var(--font-body)',
                  textAlign: 'left',
                }}
              >
                <span style={{
                  width: 14, height: 14, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: isSelected ? `2px solid ${team.primaryColor}` : '2px solid var(--color-border)',
                  background: isSelected ? team.primaryColor : 'transparent',
                  color: '#fff', fontSize: '9px',
                }}>
                  {isSelected && '✓'}
                </span>
                <TeamLogo team={team} size="sm" />
                {team.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
