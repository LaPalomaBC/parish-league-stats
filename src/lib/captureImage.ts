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

/**
 * Horizontally-scrollable containers (e.g. `.table-container` on mobile) only
 * render their visible part, so wide tables get clipped ("Racha"/"PTS" cut off).
 * Temporarily expand them (and the root) to their full scroll width.
 */
function expandScrollables(root: HTMLElement): { width: number; restore: () => void } {
  const saved: { el: HTMLElement; style: string | null }[] = [];
  const save = (el: HTMLElement) => saved.push({ el, style: el.getAttribute('style') });

  const candidates = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))];
  const scrollables = candidates.filter(el => {
    if (el.scrollWidth <= el.clientWidth + 1) return false;
    const ox = getComputedStyle(el).overflowX;
    return ox === 'auto' || ox === 'scroll';
  });
  // Expand innermost first so outer containers measure the already-expanded content.
  scrollables.reverse().forEach(el => {
    save(el);
    const full = el.scrollWidth + (el.offsetWidth - el.clientWidth);
    el.style.overflow = 'visible';
    el.style.width = `${full}px`;
    el.style.maxWidth = 'none';
  });

  // Root width = rightmost child edge + right padding (scrollWidth may omit padding).
  const rootRect = root.getBoundingClientRect();
  const padRight = parseFloat(getComputedStyle(root).paddingRight) || 0;
  const contentRight = Array.from(root.children).reduce(
    (max, child) => Math.max(max, child.getBoundingClientRect().right - rootRect.left),
    0
  );
  let width = root.offsetWidth;
  const needed = Math.ceil(contentRight + padRight);
  if (needed > width + 1) {
    if (!saved.some(s => s.el === root)) save(root);
    width = needed;
    root.style.width = `${width}px`;
    root.style.maxWidth = 'none';
  }

  return {
    width,
    restore: () => {
      saved.reverse().forEach(({ el, style }) => {
        if (style === null) el.removeAttribute('style');
        else el.setAttribute('style', style);
      });
    },
  };
}

/** Drop-in replacement for `toPng` that works reliably on iOS Safari. */
export async function safeToPng(
  element: HTMLElement,
  options: Parameters<typeof toPng>[1] = {}
): Promise<string> {
  const restoreImages = await inlineImages(element);
  const { width, restore: restoreLayout } = expandScrollables(element);
  const opts = {
    backgroundColor: '#ffffff',
    pixelRatio: 2,
    width,
    height: element.offsetHeight,
    ...options,
    cacheBust: false,
  };
  try {
    if (isSafariLike()) {
      await toPng(element, opts);
      await toPng(element, opts);
    }
    return await toPng(element, opts);
  } finally {
    restoreLayout();
    restoreImages();
  }
}
