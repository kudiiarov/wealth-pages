// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { escapeHtml, requiredElement } from '../../src/ui/dom';

describe('typed DOM helpers', () => {
  it('returns required elements and reports missing or mistyped elements', () => {
    document.body.innerHTML = '<button id="save">Save</button>';

    expect(requiredElement('save', HTMLButtonElement)).toBeInstanceOf(
      HTMLButtonElement,
    );
    expect(() => requiredElement('missing', HTMLElement)).toThrow(
      'Missing required element: missing',
    );
    expect(() => requiredElement('save', HTMLInputElement)).toThrow(
      'Element save is not an HTMLInputElement',
    );
  });

  it('escapes every character that can break interpolated HTML', () => {
    expect(escapeHtml(`<script a='"'>&`)).toBe(
      '&lt;script a=&#39;&quot;&#39;&gt;&amp;',
    );
  });
});
