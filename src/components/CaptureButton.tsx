'use client';

import { useCallback, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { Download, Share2, Loader2 } from 'lucide-react';

/**
 * Hook + Button for capturing a DOM element as PNG image.
 * - Desktop: downloads as PNG
 * - Mobile: uses Web Share API to share the image
 */

export function useCapture() {
  const ref = useRef<HTMLDivElement>(null);
  const [capturing, setCapturing] = useState(false);

  const capture = useCallback(async (filename: string) => {
    if (!ref.current || capturing) return;
    setCapturing(true);
    try {
      const dataUrl = await toPng(ref.current, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        cacheBust: true,
      });

      // Check for mobile Web Share API
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (isMobile && navigator.share && navigator.canShare) {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const file = new File([blob], `${filename}.png`, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: filename,
            files: [file],
          });
          setCapturing(false);
          return;
        }
      }

      // Desktop: download
      const link = document.createElement('a');
      link.download = `${filename}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Capture failed:', err);
    }
    setCapturing(false);
  }, [capturing]);

  return { ref, capture, capturing };
}

export function CaptureButton({
  onClick,
  capturing,
  label,
  style,
}: {
  onClick: () => void;
  capturing: boolean;
  label?: string;
  style?: React.CSSProperties;
}) {
  const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const Icon = capturing ? Loader2 : (isMobile ? Share2 : Download);
  const text = label || (isMobile ? 'Compartir' : 'Descargar');

  return (
    <button
      onClick={onClick}
      disabled={capturing}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        padding: 'var(--space-2) var(--space-3)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border-light)',
        background: 'var(--color-bg-secondary)',
        color: capturing ? 'var(--color-text-tertiary)' : 'var(--color-primary)',
        fontSize: 'var(--text-xs)',
        fontWeight: 600,
        fontFamily: 'var(--font-body)',
        cursor: capturing ? 'wait' : 'pointer',
        transition: 'all var(--transition-fast)',
        opacity: capturing ? 0.7 : 1,
        ...style,
      }}
      onMouseEnter={e => {
        if (!capturing) {
          e.currentTarget.style.background = 'var(--color-primary-bg)';
          e.currentTarget.style.borderColor = 'var(--color-primary)';
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'var(--color-bg-secondary)';
        e.currentTarget.style.borderColor = 'var(--color-border-light)';
      }}
    >
      <Icon size={14} style={capturing ? { animation: 'spin 1s linear infinite' } : undefined} />
      {text}
    </button>
  );
}
