import { toPng } from 'html-to-image';

/**
 * iOS-safe wrapper around html-to-image's `toPng`.
 *
 * Problem: iOS Safari rasterizes the intermediate SVG before large embedded
 * images finish decoding, so heavy team logos (100-330KB PNGs) come out blank
 * in shared screenshots (only one or two appear).
 *
 * Fix:
 *  1. Replace every <img> inside the element with a small (160px), pre-decoded
 *     data URL (cached per src) so there is nothing left to fetch/decode.
 *  2. Run warm-up renders on Safari/iOS (well-known html-to-image workaround).
 *  3. Restore the original srcs afterwards.
 */

const inlineCache = new Map<string, string>();

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

async function inlineImages(root: HTMLElement): Promise<() => void> {
  const imgs = Array.from(root.querySelectorAll('img'));
  const originals = imgs.map(img => ({
    src: img.getAttribute('src'),
    srcset: img.getAttribute('srcset'),
  }));
  await Promise.all(
    imgs.map(async img => {
      const src = img.currentSrc || img.src;
      if (!src || src.startsWith('data:')) return;
      try {
        const dataUrl = await toSmallDataUrl(src);
        img.removeAttribute('srcset');
        img.loading = 'eager';
        img.src = dataUrl;
        await img.decode().catch(() => {});
      } catch (err) {
        console.warn('Could not inline image', src, err);
      }
    })
  );
  return () => {
    imgs.forEach((img, i) => {
      const { src, srcset } = originals[i];
      if (srcset) img.setAttribute('srcset', srcset);
      if (src) img.setAttribute('src', src);
    });
  };
}

function isSafariLike(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/i.test(ua) || (/Safari/i.test(ua) && !/Chrome|Chromium|Android/i.test(ua));
}

/** Drop-in replacement for `toPng` that works reliably on iOS Safari. */
export async function safeToPng(
  element: HTMLElement,
  options: Parameters<typeof toPng>[1] = {}
): Promise<string> {
  const opts = { backgroundColor: '#ffffff', pixelRatio: 2, ...options, cacheBust: false };
  const restore = await inlineImages(element);
  try {
    if (isSafariLike()) {
      await toPng(element, opts);
      await toPng(element, opts);
    }
    return await toPng(element, opts);
  } finally {
    restore();
  }
}
