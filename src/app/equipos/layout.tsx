import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Equipos — Parish League Stats',
  description: 'Todos los equipos de la Liga Parroquial de Baloncesto de Madrid.',
};

export default function EquiposLayout({ children }: { children: React.ReactNode }) {
  return children;
}
