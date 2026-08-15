export type AppRoute =
  | { kind: 'home' }
  | { kind: 'assets' }
  | { kind: 'asset'; id: string }
  | { kind: 'accounts' }
  | { kind: 'account'; id: string }
  | { kind: 'history' }
  | { kind: 'settings' };

function decodeId(value: string | undefined): string | undefined {
  if (!value) return;
  try {
    const decoded = decodeURIComponent(value);
    return decoded || undefined;
  } catch {
    return;
  }
}

export function parseAppRoute(hash: string): AppRoute {
  const parts = hash.replace(/^#\/?/, '').split('/');
  if (parts.length === 1) {
    if (parts[0] === 'assets') return { kind: 'assets' };
    if (parts[0] === 'accounts') return { kind: 'accounts' };
    if (parts[0] === 'history') return { kind: 'history' };
    if (parts[0] === 'settings') return { kind: 'settings' };
    return { kind: 'home' };
  }
  if (parts.length === 2) {
    const id = decodeId(parts[1]);
    if (!id) return { kind: 'home' };
    if (parts[0] === 'assets') return { kind: 'asset', id };
    if (parts[0] === 'accounts') return { kind: 'account', id };
  }
  return { kind: 'home' };
}

export function formatAppRoute(route: AppRoute): string {
  if (route.kind === 'asset') return `#/assets/${encodeURIComponent(route.id)}`;
  if (route.kind === 'account')
    return `#/accounts/${encodeURIComponent(route.id)}`;
  return `#/${route.kind}`;
}
