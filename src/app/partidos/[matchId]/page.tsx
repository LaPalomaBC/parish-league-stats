import { getMatchesFromDisk, getTeamsFromDisk } from '@/lib/serverData';
import type { Metadata } from 'next';
import MatchPageClient from './MatchPageClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ matchId: string }>;
}

export async function generateStaticParams() {
  const matches = await getMatchesFromDisk();
  return matches.map((match) => ({ matchId: match.id }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { matchId } = await params;
  const matches = await getMatchesFromDisk();
  const teams = await getTeamsFromDisk();
  const match = matches.find(m => m.id === matchId);
  if (!match) return { title: 'Partido no encontrado' };

  const home = teams.find(t => t.id === match.homeTeamId);
  const away = teams.find(t => t.id === match.awayTeamId);
  return {
    title: `${home?.shortName} vs ${away?.shortName} — Parish League Stats`,
    description: `Box score y estadísticas del partido ${home?.name} vs ${away?.name}.`,
  };
}

export default async function MatchPage({ params }: PageProps) {
  const { matchId } = await params;
  return <MatchPageClient matchId={matchId} />;
}
