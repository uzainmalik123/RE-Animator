import { RaiseScene } from './raise/RaiseScene';
import { ReplayScene } from './replay/ReplayScene';
import { RendererDemo } from './RendererDemo';

// The raise is home (R2). The R1 renderer demo stays at ?renderer for tuning the look (KI-R2). The
// recorded replay (R11) is ?replay, and the hosted build (`npm run build:replay`) opens on it.
export function App() {
  const query = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  if (import.meta.env.VITE_REPLAY === '1' || query.has('replay')) return <ReplayScene />;
  return query.has('renderer') ? <RendererDemo /> : <RaiseScene />;
}
