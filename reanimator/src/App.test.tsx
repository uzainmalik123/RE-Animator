import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { App } from './App';

describe('App', () => {
  it('opens on the raise scene', () => {
    expect(renderToStaticMarkup(<App />)).toContain('Begin the ritual');
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
