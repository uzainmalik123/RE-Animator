import { RaiseScene } from './raise/RaiseScene';
import { RendererDemo } from './RendererDemo';

// The raise is home (R2). The R1 renderer demo stays at ?renderer for tuning the look (KI-R2).
export function App() {
  const demo = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('renderer');
  return demo ? <RendererDemo /> : <RaiseScene />;
}
