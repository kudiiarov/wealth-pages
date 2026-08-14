import { existsSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { build } from 'vite';
import { beforeAll, describe, expect, it } from 'vitest';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const dist = fileURLToPath(new URL('../../dist/', import.meta.url));

beforeAll(async () => {
  rmSync(dist, { recursive: true, force: true });
  process.env.GITHUB_ACTIONS = 'true';
  await build({
    configFile: fileURLToPath(new URL('../../vite.config.ts', import.meta.url)),
    logLevel: 'silent',
  });
  delete process.env.GITHUB_ACTIONS;
}, 30_000);

describe('GitHub Pages PWA build', () => {
  it('emits repository-subpath asset URLs', () => {
    const html = readFileSync(`${dist}/index.html`, 'utf8');
    expect(html).toContain('/wealth-pages/assets/');
    expect(html).not.toContain('/src/main.ts');
  });

  it('emits a base-aware install manifest and icons', () => {
    const manifest = JSON.parse(
      readFileSync(`${dist}/manifest.webmanifest`, 'utf8'),
    ) as Record<string, unknown>;

    expect(manifest.start_url).toBe('/wealth-pages/');
    expect(manifest.scope).toBe('/wealth-pages/');
    expect(existsSync(`${dist}/icon.svg`)).toBe(true);
    expect(existsSync(`${dist}/icon-512.png`)).toBe(true);
  });

  it('emits an offline service worker that precaches the application shell', () => {
    expect(existsSync(`${dist}/sw.js`)).toBe(true);
    const worker = readFileSync(`${dist}/sw.js`, 'utf8');
    expect(worker).toContain('index.html');
    expect(worker).toContain('cleanupOutdatedCaches');
  });

  it('does not depend on files outside the build directory', () => {
    expect(existsSync(`${projectRoot}/dist/index.html`)).toBe(true);
  });
});
