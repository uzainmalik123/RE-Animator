import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { QUIET, type AttackState, type Ghost } from '../../shared/attack';
import { AttackScene } from './AttackScene';

const ghost = (o: Partial<Ghost> = {}): Ghost => ({ ghostId: 'g1', criterion: '1.2', persona: 'wraith', rep: 1, trail: [], done: false, ...o });

describe('AttackScene', () => {
  it('labels the scene and stacks a bone and a death canvas', () => {
    const html = renderToStaticMarkup(<AttackScene attackId="a1" state={{ ...QUIET, status: 'attacking', ghosts: { g1: ghost({ x: 10, y: 10 }) } }} />);
    expect(html).toContain('aria-label="Death attacks: 1 minion, 0 wounds"');
    expect(html).toContain('class="attack-body"');
    expect(html).toContain('class="attack-death"');
  });

  it('labels each wound in real text where its minion struck', () => {
    const state: AttackState = {
      ...QUIET,
      status: 'finished',
      ghosts: { g1: ghost({ x: 640, y: 360, done: true }) },
      wounds: [{ criterion: '1.2', text: 't', persona: 'wraith', reason: 'r', steps: [], expected: [], failing: [], artifacts: [] }],
    };
    const html = renderToStaticMarkup(<AttackScene attackId="a1" state={state} />);
    expect(html).toMatch(/<ol class="attack-wounds"[^>]*><li style="left:50%;top:50%"[^>]*>1\.2 · wraith<\/li>/);
  });
});
