import { useEffect, useRef } from 'react';
import { sizeCanvas } from './canvas';

const VOID_FALLBACK = '#06060a';

// R0: one full-viewport canvas painted --void. The dot-matrix renderer (R1) draws onto it later.
export function App() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const paint = () => {
      const { width, height } = sizeCanvas(window.innerWidth, window.innerHeight, window.devicePixelRatio);
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const voidColour = getComputedStyle(document.documentElement).getPropertyValue('--void').trim();
      ctx.fillStyle = voidColour || VOID_FALLBACK;
      ctx.fillRect(0, 0, width, height);
    };
    paint();
    window.addEventListener('resize', paint);
    return () => window.removeEventListener('resize', paint);
  }, []);

  return <canvas ref={ref} className="stage" aria-label="Reanimator: an empty, dark stage" />;
}
