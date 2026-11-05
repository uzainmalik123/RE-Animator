import { useEffect, useState } from 'react';

const LETTERS_PER_FRAME = 2;

// Letters appear only with a browser that animates and motion allowed (THEME §9).
const animates = () => typeof requestAnimationFrame === 'function' && !(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);

// Kiro's reply in the quill's hand (THEME §8): real text, revealed a letter at a time as it streams
// in. With reduced motion (or no browser, as in a server render) it is simply all there.
export function Quill({ text }: { text: string }) {
  const [shown, setShown] = useState(0);
  const [moving] = useState(animates);
  const done = !moving || shown >= text.length;
  useEffect(() => {
    if (done) return;
    const frame = requestAnimationFrame(() => setShown((n) => Math.min(text.length, n + LETTERS_PER_FRAME)));
    return () => cancelAnimationFrame(frame);
  }, [done, shown, text.length]);
  return <p className="quill">{moving ? text.slice(0, shown) : text}</p>;
}
