import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { App } from './App';

describe('App', () => {
  it('opens on the raise scene', () => {
    expect(renderToStaticMarkup(<App />)).toContain('Begin the ritual');
  });
});
