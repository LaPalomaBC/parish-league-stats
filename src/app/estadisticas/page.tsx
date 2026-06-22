import type { Metadata } from 'next';
import EstadisticasClient from './EstadisticasClient';

export const metadata: Metadata = {
  title: 'Estadísticas — Parish League Stats',
  description: 'Estadísticas avanzadas de equipos y jugadores de la Liga Parroquial de Baloncesto de Madrid.',
};

export default function EstadisticasPage() {
  return <EstadisticasClient />;
}
