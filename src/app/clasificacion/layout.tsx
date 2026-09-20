import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Clasificación — Parish League Stats',
  description: 'Clasificación actual de la Liga Parroquial de Baloncesto de Madrid.',
};

export default function ClasificacionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
