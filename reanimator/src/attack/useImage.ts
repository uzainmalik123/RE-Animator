import { useEffect, useState, type RefObject } from 'react';

// The last image at `url` that loaded. A failed load (a 404, a run dir already gone) keeps the
// previous one, so the body never blinks out.
export function useImage(url: string | null): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!url) return;
    const img = new Image();
    let live = true;
    img.onload = () => live && setImage(img);
    img.src = url;
    return () => {
      live = false;
    };
  }, [url]);
  return image;
}

// An element's CSS size, tracked; 0×0 until it's laid out (and on the server).
export function useSize(ref: RefObject<HTMLElement | null>): { w: number; h: number } {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}
