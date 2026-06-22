import { getPlayersFromDisk } from '@/lib/serverData';
import { getTeam } from '@/lib/data';
import type { Metadata } from 'next';
import PlayerPageClient from './PlayerPageClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ playerId: string }>;
}

export async function generateStaticParams() {
  const players = await getPlayersFromDisk();
  return players.map((p) => ({ playerId: p.id }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { playerId } = await params;
  const players = await getPlayersFromDisk();
  const player = players.find((p) => p.id === playerId);
  if (!player) return { title: 'Jugador no encontrado' };
  const team = getTeam(player.teamId);
  return {
    title: `${player.name} — ${team?.shortName} — Parish League Stats`,
    description: `Ficha y estadísticas de ${player.name} en la Parish League.`,
  };
}

export default async function PlayerPage({ params }: PageProps) {
  const { playerId } = await params;
  return <PlayerPageClient playerId={playerId} />;
}
