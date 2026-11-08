import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { App, TITLE } from './App';

describe('App', () => {
  it('shows only the title', () => {
    expect(renderToStaticMarkup(<App />)).toContain(`<h1`);
    expect(renderToStaticMarkup(<App />)).toContain(TITLE);
  });
});
