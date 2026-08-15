import { describe, expect, it } from 'vitest';

import { formatAppRoute, parseAppRoute } from '../../src/ui/routes';

describe('application hash routes', () => {
  it('parses collection and entity routes', () => {
    expect(parseAppRoute('#/home')).toEqual({ kind: 'home' });
    expect(parseAppRoute('#/assets')).toEqual({ kind: 'assets' });
    expect(parseAppRoute('#/assets/btc')).toEqual({
      kind: 'asset',
      id: 'btc',
    });
    expect(parseAppRoute('#/accounts/vault%201')).toEqual({
      kind: 'account',
      id: 'vault 1',
    });
    expect(parseAppRoute('#/history')).toEqual({ kind: 'history' });
    expect(parseAppRoute('#/settings')).toEqual({ kind: 'settings' });
  });

  it('falls back home for unknown or malformed hashes', () => {
    expect(parseAppRoute('')).toEqual({ kind: 'home' });
    expect(parseAppRoute('#/unknown')).toEqual({ kind: 'home' });
    expect(parseAppRoute('#/assets/%E0%A4%A')).toEqual({ kind: 'home' });
  });

  it('formats routes with safely encoded entity identifiers', () => {
    expect(formatAppRoute({ kind: 'history' })).toBe('#/history');
    expect(formatAppRoute({ kind: 'asset', id: 'tether gold' })).toBe(
      '#/assets/tether%20gold',
    );
    expect(formatAppRoute({ kind: 'account', id: 'bank/primary' })).toBe(
      '#/accounts/bank%2Fprimary',
    );
  });
});
