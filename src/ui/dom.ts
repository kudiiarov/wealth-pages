export function requiredElement<
  Constructor extends new (...args: never[]) => HTMLElement,
>(
  id: string,
  expected: Constructor,
  root: Document = document,
): InstanceType<Constructor> {
  const element = root.getElementById(id);
  if (!element) throw new Error(`Missing required element: ${id}`);
  if (!(element instanceof expected)) {
    throw new Error(`Element ${id} is not an ${expected.name}`);
  }
  return element as InstanceType<Constructor>;
}

export function all<ElementType extends Element = HTMLElement>(
  selector: string,
  root: ParentNode = document,
): ElementType[] {
  return Array.from(root.querySelectorAll<ElementType>(selector));
}

export function escapeHtml(value: unknown = ''): string {
  const text =
    typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  return text.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
    };
    return entities[character] ?? character;
  });
}

export function closestElement<ElementType extends Element = HTMLElement>(
  target: EventTarget | null,
  selector: string,
): ElementType | null {
  return target instanceof Element
    ? target.closest<ElementType>(selector)
    : null;
}
