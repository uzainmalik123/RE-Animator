import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { App } from './App';

describe('App', () => {
  it('opens on the graveyard (R6)', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('The graveyard');
    expect(html).toContain('Dig a new grave');
  });

  it('opens on the replay at ?replay (R11)', () => {
    vi.stubGlobal('window', { location: { search: '?replay' } });
    try {
      expect(renderToStaticMarkup(<App />)).toContain('Opening the recording');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
