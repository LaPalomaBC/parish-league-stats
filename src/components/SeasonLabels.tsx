'use client';

import { useLeagueData } from '@/lib/DataContext';

export function SeasonHeroSubtitle() {
  const { currentSeason } = useLeagueData();
  const label = currentSeason?.label || 'Liga Parroquial de Baloncesto de Madrid';

  return (
    <p className="hero-subtitle">
      Liga Parroquial de Baloncesto de Madrid — {label}
    </p>
  );
}

export function SeasonPageFooter() {
  const { currentSeason } = useLeagueData();
  const label = currentSeason?.label || 'Parish League Stats';
  const id = currentSeason?.id?.replace('-', '/') || '';

  return (
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
        {id ? `${label} — Liga Parroquial de Baloncesto de Madrid` : 'Liga Parroquial de Baloncesto de Madrid'}
      </p>
    </footer>
  );
}
