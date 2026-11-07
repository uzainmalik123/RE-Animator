import { isHeadstone, type Headstone } from '../../shared/graveyard';
import type { FetchLike } from '../raise/ritualClient';

// The browser side of the graveyard (R6), free of React so it can be tested: the prepared graves the
// backend lists, or why it couldn't.
export async function fetchGraveyard(fetchFn: FetchLike): Promise<{ graves: Headstone[] } | { error: string }> {
  let res: Response;
  try {
    res = await fetchFn('/api/graveyard', { method: 'GET' });
  } catch {
    return { error: 'the backend is not answering (npm run server)' };
  }
  if (res.status !== 200) return { error: `the backend would not open the graveyard (HTTP ${res.status})` };
  const body = (await res.json().catch(() => null)) as { graves?: unknown } | null;
  if (!body || !Array.isArray(body.graves) || !body.graves.every(isHeadstone)) return { error: 'the graveyard answered with something unreadable' };
  return { graves: body.graves };
}
