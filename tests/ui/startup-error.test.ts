// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';

import { renderStartupError } from '../../src/ui/startup-error';

describe('startup failure UI', () => {
  it('shows a localized recoverable error with a retry action', () => {
    const retry = vi.fn();

    renderStartupError(document.body, 'en', retry);

    expect(document.body.textContent).toContain(
      'Could not open the local database',
    );
    const button = document.querySelector('button');
    expect(button?.textContent).toBe('Try again');
    button?.click();
    expect(retry).toHaveBeenCalledOnce();
  });
});
