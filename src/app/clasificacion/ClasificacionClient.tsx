'use client';

import { useRef, useState, useCallback } from 'react';
import { toPng } from 'html-to-image';
import { Download, Share2, Loader2, Trophy, Info } from 'lucide-react';
import StandingsTable from '@/components/StandingsTable';
import StandingsChart from '@/components/StandingsChart';
import type { StandingRow } from '@/lib/types';

function CaptureBtn({ onClick, busy }: { onClick: () => void; busy: boolean }) {
  const [isMobile, setIsMobile] = useState(false);
  // Check on first render
  if (typeof window !== 'undefined' && !isMobile && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    setIsMobile(true);
  }
  const Icon = busy ? Loader2 : (isMobile ? Share2 : Download);
  const text = isMobile ? 'Compartir' : 'Descargar';

  return (
    <button
      onClick={onClick}
      disabled={busy}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '6px 12px', borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border-light)',
        background: 'var(--color-bg-secondary)',
        color: busy ? 'var(--color-text-tertiary)' : 'var(--color-primary)',
        fontSize: 'var(--text-xs)', fontWeight: 600,
        fontFamily: 'var(--font-body)',
        cursor: busy ? 'wait' : 'pointer',
        transition: 'all var(--transition-fast)',
        opacity: busy ? 0.7 : 1,
      }}
      onMouseEnter={e => { if (!busy) { e.currentTarget.style.background = 'var(--color-primary-bg)'; e.currentTarget.style.borderColor = 'var(--color-primary)'; } }}
      onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-bg-secondary)'; e.currentTarget.style.borderColor = 'var(--color-border-light)'; }}
    >
      <Icon size={14} style={busy ? { animation: 'spin 1s linear infinite' } : undefined} />
      {text}
    </button>
  );
}

async function captureAndExport(element: HTMLElement | null, filename: string) {
  if (!element) return;
  try {
    const dataUrl = await toPng(element, {
      backgroundColor: '#ffffff',
      pixelRatio: 2,
      cacheBust: true,
    });
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile && navigator.share && navigator.canShare) {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `${filename}.png`, { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ title: filename, files: [file] });
        return;
      }
    }
    const link = document.createElement('a');
    link.download = `${filename}.png`;
    link.href = dataUrl;
    link.click();
  } catch (err) {
    console.error('Capture failed:', err);
  }
}

export default function ClasificacionClient({ standings }: { standings: StandingRow[] }) {
  const hasStandings = standings.length > 0;
  const tableRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const [busyTable, setBusyTable] = useState(false);
  const [busyChart, setBusyChart] = useState(false);

  const handleTableCapture = useCallback(async () => {
    setBusyTable(true);
    await captureAndExport(tableRef.current, 'clasificacion-parish-league');
    setBusyTable(false);
  }, []);

  const handleChartCapture = useCallback(async () => {
    setBusyChart(true);
    await captureAndExport(chartRef.current, 'evolucion-clasificacion');
    setBusyChart(false);
  }, []);

  return (
    <div className="page-container">
      <div className="section animate-fade-in-up">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-8)' }}>
          <Trophy size={32} style={{ color: 'var(--color-accent)' }} />
          Clasificación
        </h1>

        {hasStandings ? (
          <>
            {/* Legend */}
            <div
              className="card-flat"
              style={{
                display: 'flex',
                gap: 'var(--space-6)',
                marginBottom: 'var(--space-6)',
                padding: 'var(--space-4) var(--space-6)',
                fontSize: 'var(--text-sm)',
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span className="position-badge top-4" style={{ width: 20, height: 20, fontSize: '10px' }}>1</span>
                <span style={{ color: 'var(--color-text-secondary)' }}>Copa de Cristo Rey</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span className="position-badge playoff" style={{ width: 20, height: 20, fontSize: '10px' }}>5</span>
                <span style={{ color: 'var(--color-text-secondary)' }}>Playoffs</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span className="position-badge out" style={{ width: 20, height: 20, fontSize: '10px' }}>9</span>
                <span style={{ color: 'var(--color-text-secondary)' }}>Eliminado</span>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <CaptureBtn onClick={handleTableCapture} busy={busyTable} />
              </div>
            </div>

            <div ref={tableRef} style={{ padding: 'var(--space-4)' }}>
              <h3 style={{
                fontFamily: 'var(--font-display)', fontWeight: 800,
                fontSize: 'var(--text-base)', marginBottom: 'var(--space-4)',
                color: 'var(--color-text-primary)',
                display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
              }}>
                🏆 Clasificación — Parish League
              </h3>
              <StandingsTable standings={standings} />
            </div>
          </>
        ) : (
          <div className="card" style={{ textAlign: 'center', padding: 'var(--space-12) var(--space-8)' }}>
            <Trophy size={48} style={{ color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-4)' }} />
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
              La clasificación se generará automáticamente cuando se importen actas de partidos.
            </p>
          </div>
        )}
      </div>

      {hasStandings && (
        <>
          {/* Chart */}
          <div className="section animate-fade-in-up delay-2">
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-3)' }}>
                <CaptureBtn onClick={handleChartCapture} busy={busyChart} />
              </div>
              <div ref={chartRef} style={{ padding: 'var(--space-4)' }}>
                <h3 style={{
                  fontFamily: 'var(--font-display)', fontWeight: 800,
                  fontSize: 'var(--text-base)', marginBottom: 'var(--space-4)',
                  color: 'var(--color-text-primary)',
                }}>📈 Evolución de la Clasificación</h3>
                <StandingsChart showTeamFilter />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Info */}
      <div className="card-flat animate-fade-in-up delay-3" style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
        <Info size={20} style={{ color: 'var(--color-primary-light)', flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
          <strong>Sistema de puntos:</strong> Victoria = 2 puntos, Derrota = 1 punto.
          Los 4 primeros tras la jornada 9 disputan la Copa de Cristo Rey.
          Los 8 primeros tras la jornada 11 disputan los Playoffs.
        </div>
      </div>
    </div>
  );
}
