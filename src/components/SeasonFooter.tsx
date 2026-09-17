'use client';

import { useLeagueData } from '@/lib/DataContext';

export default function SeasonFooter() {
  const { currentSeason } = useLeagueData();
  const seasonLabel = currentSeason?.label || 'Parish League';

  return (
    <footer className="site-footer">
      <span>Created by <strong>Josugeos</strong></span>
      <span className="footer-dot">·</span>
      <span>{seasonLabel}</span>
    </footer>
  );
}
