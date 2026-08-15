import { existsSync, readFileSync } from 'node:fs';

import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

const projectRoot = new URL('../../', import.meta.url);
const html = readFileSync(new URL('index.html', projectRoot), 'utf8');
const uiSources = ['src/main.ts', 'src/ui/events.ts', 'src/ui/render.ts'].map(
  (path) => readFileSync(new URL(path, projectRoot), 'utf8'),
);

describe('legacy static application shell', () => {
  it('uses separate flat asset/account tabs and portfolio-only history', () => {
    const document = new JSDOM(html).window.document;
    expect(
      Array.from(document.querySelectorAll<HTMLElement>('.tab[data-nav]')).map(
        ({ dataset }) => dataset.nav,
      ),
    ).toEqual(['homeView', 'assetsView', 'accountsView', 'historyView']);
    expect(document.getElementById('positionsView')).toBeNull();
    expect(document.getElementById('portfolioSegment')).toBeNull();
    expect(document.getElementById('historyScope')).toBeNull();
    expect(document.getElementById('assetsList')).not.toBeNull();
    expect(document.getElementById('accountsList')).not.toBeNull();
    expect(document.getElementById('entityDetailView')).not.toBeNull();
    expect(document.getElementById('entityDetailChart')).not.toBeNull();
    expect(document.getElementById('portfolioRates')).not.toBeNull();
    expect(document.getElementById('rateSelectionModal')).not.toBeNull();
    expect(document.querySelector('.build-note')?.textContent).toContain(
      '3.5.0-final',
    );
  });

  it('ships every local script, stylesheet, manifest, and icon it references', () => {
    const document = new JSDOM(html).window.document;
    const references = [
      ...Array.from(
        document.querySelectorAll<HTMLScriptElement>('script[src]'),
      ).map(({ src }) => src),
      ...Array.from(
        document.querySelectorAll<HTMLLinkElement>('link[href]'),
      ).map(({ href }) => href),
    ].filter(
      (reference) =>
        reference.startsWith('./') || reference.startsWith('/src/'),
    );

    expect(references.length).toBeGreaterThan(0);
    for (const reference of references) {
      const path = reference.startsWith('./')
        ? reference.slice(2)
        : reference.slice(1);
      expect(existsSync(new URL(path, projectRoot))).toBe(true);
    }
  });

  it('contains every element accessed through typed DOM helpers at startup', () => {
    const document = new JSDOM(html).window.document;
    const ids = uiSources.flatMap((source) =>
      Array.from(
        source.matchAll(
          /(?:requiredElement|this\.element|this\.form)\('([^']+)'/g,
        ),
      ).flatMap((match) => (match[1] ? [match[1]] : [])),
    );

    expect(new Set(ids).size).toBeGreaterThanOrEqual(30);
    for (const id of new Set(ids)) {
      expect(document.getElementById(id)).not.toBeNull();
    }
  });
});
