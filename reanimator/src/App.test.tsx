import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { App } from './App';

describe('App', () => {
  it('renders one labelled canvas and nothing else', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toMatch(
      /^<canvas[^>]*class="stage"[^>]*aria-label="Reanimator: an empty, dark stage"[^>]*><\/canvas>$/,
    );
  });
});
