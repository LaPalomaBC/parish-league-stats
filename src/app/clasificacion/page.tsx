import { getStandingsFromDisk } from '@/lib/serverData';
import ClasificacionClient from './ClasificacionClient';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Clasificación — Parish League Stats',
  description: 'Clasificación actual de la Liga Parroquial de Baloncesto de Madrid.',
};

export default async function ClasificacionPage() {
  const standings = await getStandingsFromDisk();
  return <ClasificacionClient standings={standings} />;
}
