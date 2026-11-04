import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RendererDemo } from './RendererDemo';

describe('RendererDemo (R1)', () => {
  const html = renderToStaticMarkup(<RendererDemo />);

  it('renders the stage canvas with a text alternative', () => {
    expect(html).toMatch(/<canvas[^>]*class="stage"[^>]*aria-label="[^"]*dot-matrix[^"]*"/);
  });

  it('offers real-text pitch and mode controls', () => {
    for (const label of ['auto', '2', '3', '4', '6', 'dots', 'glyphs']) {
      expect(html).toContain(`>${label}</button>`);
    }
  });
});
