import { getTeamsFromDisk } from '@/lib/serverData';
import { getTeam } from '@/lib/data';
import type { Metadata } from 'next';
import TeamPageClient from './TeamPageClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ teamId: string }>;
}

export async function generateStaticParams() {
  const teams = await getTeamsFromDisk();
  return teams.map((team) => ({ teamId: team.id }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { teamId } = await params;
  const team = getTeam(teamId);
  return {
    title: team ? `${team.name} — Parish League Stats` : 'Equipo no encontrado',
    description: team ? `Estadísticas y resultados de ${team.name} en la Parish League.` : '',
  };
}

export default async function TeamPage({ params }: PageProps) {
  const { teamId } = await params;
  return <TeamPageClient teamId={teamId} />;
}
