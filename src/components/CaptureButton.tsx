'use client';

import { useCallback, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { Download, Share2, Loader2 } from 'lucide-react';

/**
 * Hook + Button for capturing a DOM element as PNG image.
 * - Desktop: downloads as PNG
 * - Mobile: uses Web Share API to share the image
 */

/** Cache of downscaled data URLs per original src (avoids re-encoding on every capture). */
const inlineCache = new Map<string, string>();

/**
 * Converts an image src into a small, already-decoded PNG data URL.
 * iOS Safari draws the html-to-image SVG onto the canvas before large embedded
 * images finish decoding, so heavy logos (100-300KB) end up missing. Downscaling
 * + pre-decoding them fixes it.
 */
async function toSmallDataUrl(src: string, maxPx = 160): Promise<string> {
  const cached = inlineCache.get(src);
  if (cached) return cached;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = src;
  await img.decode();
  const scale = Math.min(1, maxPx / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/png');
  inlineCache.set(src, dataUrl);
  return dataUrl;
}

/** Replaces every <img> src inside `root` with an inlined data URL. Returns a restore fn. */
async function inlineImages(root: HTMLElement): Promise<() => void> {
  const imgs = Array.from(root.querySelectorAll('img'));
  const originals = imgs.map(img => img.getAttribute('src'));
  await Promise.all(
    imgs.map(async img => {
      const src = img.currentSrc || img.src;
      if (!src || src.startsWith('data:')) return;
      try {
        img.loading = 'eager';
        img.src = await toSmallDataUrl(src);
        await img.decode().catch(() => {});
      } catch (err) {
        console.warn('Could not inline image', src, err);
      }
    })
  );
  return () => {
    imgs.forEach((img, i) => {
      const original = originals[i];
      if (original) img.setAttribute('src', original);
    });
  };
}

export function useCapture() {
  const ref = useRef<HTMLDivElement>(null);
  const [capturing, setCapturing] = useState(false);

  const capture = useCallback(async (filename: string) => {
    if (!ref.current || capturing) return;
    setCapturing(true);
    let restore: (() => void) | null = null;
    try {
      restore = await inlineImages(ref.current);

      const options = { backgroundColor: '#ffffff', pixelRatio: 2, cacheBust: false };
      // iOS/Safari quirk: first renders may still miss embedded images. Warm up first.
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
        (/Safari/i.test(navigator.userAgent) && !/Chrome|Android/i.test(navigator.userAgent));
      if (isIOS) {
        await toPng(ref.current, options);
        await toPng(ref.current, options);
      }
      const dataUrl = await toPng(ref.current, options);
      restore();
      restore = null;

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
    } finally {
      restore?.();
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
