import { existsSync, readFileSync } from 'node:fs';

import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

const projectRoot = new URL('../../', import.meta.url);
const html = readFileSync(new URL('index.html', projectRoot), 'utf8');
const styles = readFileSync(new URL('src/styles/app.css', projectRoot), 'utf8');
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
    expect(document.getElementById('priceTrust')).toBeNull();
    expect(document.getElementById('priceTrustText')).toBeNull();
    expect(document.getElementById('rateSelectionModal')).not.toBeNull();
    expect(document.querySelector('.build-note')?.textContent).toContain(
      '3.8.1-final',
    );
  });

  it('uses interval selectors without automation toggles', () => {
    const document = new JSDOM(html).window.document;
    const prices = document.querySelector<HTMLSelectElement>(
      '#priceRefreshIntervalMinutes',
    );
    const snapshots = document.querySelector<HTMLSelectElement>(
      '#snapshotIntervalMinutes',
    );

    expect(Array.from(prices?.options ?? [], ({ value }) => value)).toEqual([
      '0',
      '5',
      '15',
      '30',
      '60',
    ]);
    expect(Array.from(snapshots?.options ?? [], ({ value }) => value)).toEqual([
      '0',
      '30',
      '60',
    ]);
    expect(document.getElementById('autoPriceRefresh')).toBeNull();
    expect(document.getElementById('autoSnapshot')).toBeNull();
  });

  it('places overview metrics and one period action in both portfolio tabs', () => {
    const document = new JSDOM(html).window.document;

    expect(
      document.querySelectorAll('[data-overview-period-toggle]'),
    ).toHaveLength(2);
    expect(document.querySelectorAll('[data-overview-period]')).toHaveLength(0);
    expect(
      Array.from(
        document.querySelectorAll<HTMLElement>('[data-overview-period-toggle]'),
        ({ textContent }) => textContent?.trim(),
      ),
    ).toEqual(['24h', '24h']);
    expect(document.getElementById('assetAllocationCount')).not.toBeNull();
    expect(document.getElementById('assetAllocationTotal')).not.toBeNull();
    expect(document.getElementById('accountAllocationCount')).not.toBeNull();
    expect(document.getElementById('accountAllocationTotal')).not.toBeNull();
    expect(document.getElementById('assetSummary')).toBeNull();
    expect(document.getElementById('accountPortfolioValue')).toBeNull();
    expect(document.getElementById('assetFreshness')).toBeNull();
  });

  it('keeps cash movement in the history summary without a chart legend', () => {
    const document = new JSDOM(html).window.document;
    expect(document.querySelector('#historyBalanceChange')).not.toBeNull();
    expect(document.querySelector('#historyPnlChange')).not.toBeNull();
    expect(document.querySelector('#historyFlowChange')).not.toBeNull();
    expect(document.querySelector('[data-history-flow-legend]')).toBeNull();
  });

  it('uses svg artwork inside circular detail action buttons', () => {
    const document = new JSDOM(html).window.document;

    for (const id of ['entityDetailAdd', 'entityDetailMenu']) {
      const button = document.getElementById(id);
      expect(button?.classList.contains('ui-icon-button')).toBe(true);
      expect(button?.querySelector('svg')).not.toBeNull();
    }
  });

  it('defines shared UI primitives and a dedicated history row layout', () => {
    const renderSource = uiSources.find((source) =>
      source.includes('class WorthRenderer'),
    );

    expect(styles).toContain('--ui-control-height');
    expect(styles).toContain('.ui-list-row');
    expect(styles).toContain('.ui-freshness');
    expect(styles).toContain('.history-row');
    expect(renderSource).toContain(
      'list-card ui-list-row ui-surface history-row',
    );
    expect(renderSource).toContain('ui-icon-button menu-button');
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
