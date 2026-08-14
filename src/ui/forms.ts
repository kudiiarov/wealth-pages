import type {
  AccountInput,
  AssetInput,
  PositionInput,
} from '../application/portfolio-service';
import type { AutoUpdateSource } from '../domain/models';
import { cleanCode } from '../domain/normalize';
import { parseDecimal } from '../i18n/format';

function control(
  form: HTMLFormElement,
  name: string,
): HTMLInputElement | HTMLSelectElement {
  const element = form.elements.namedItem(name);
  if (!(
    element instanceof HTMLInputElement || element instanceof HTMLSelectElement
  )) {
    throw new Error(`Missing form control: ${name}`);
  }
  return element;
}

function value(form: HTMLFormElement, name: string): string {
  return control(form, name).value;
}

function optionalValue(form: HTMLFormElement, name: string): string {
  const element = form.elements.namedItem(name);
  return element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement
    ? element.value
    : '';
}

function taxonomy(form: HTMLFormElement): {
  category: string;
  tags: string[];
} {
  const selectedCategory = optionalValue(form, 'category');
  const category = (
    selectedCategory === '__custom__'
      ? optionalValue(form, 'customCategory')
      : selectedCategory
  ).trim();
  const selectedTags = Array.from(
    form.querySelectorAll<HTMLInputElement>('input[name="tags"]:checked'),
    ({ value: tag }) => tag,
  );
  const customTags = optionalValue(form, 'customTags')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
  const tags = Array.from(
    [...selectedTags, ...customTags]
      .reduce<Map<string, string>>((unique, tag) => {
        const key = tag.toLocaleLowerCase();
        if (!unique.has(key)) unique.set(key, tag);
        return unique;
      }, new Map())
      .values(),
  );
  return { category, tags };
}

function autoUpdateSource(value: string): AutoUpdateSource {
  if (value === 'coingecko' || value === 'frankfurter') return value;
  return 'none';
}

export function readAccountForm(form: HTMLFormElement): AccountInput | null {
  const name = value(form, 'name').trim();
  if (!name) return null;
  return {
    name,
    type: value(form, 'type'),
    icon: value(form, 'icon').trim(),
    color: value(form, 'color'),
  };
}

export function readAssetForm(form: HTMLFormElement): AssetInput | null {
  const name = value(form, 'name').trim();
  const code = cleanCode(value(form, 'code'));
  const price = parseDecimal(value(form, 'price'));
  const metadata = taxonomy(form);
  if (
    !name ||
    !code ||
    !metadata.category ||
    !Number.isFinite(price) ||
    price < 0
  )
    return null;
  return {
    name,
    code,
    icon: value(form, 'icon').trim(),
    color: value(form, 'color'),
    price,
    autoUpdateSource: autoUpdateSource(value(form, 'autoUpdateSource')),
    ...metadata,
  };
}

export function readAssetEditForm(
  form: HTMLFormElement,
  currentPrice: number,
): AssetInput | null {
  const name = value(form, 'name').trim();
  const code = cleanCode(value(form, 'code'));
  const metadata = taxonomy(form);
  if (
    !name ||
    !code ||
    !metadata.category ||
    !Number.isFinite(currentPrice) ||
    currentPrice < 0
  ) {
    return null;
  }
  return {
    name,
    code,
    icon: value(form, 'icon').trim(),
    color: value(form, 'color'),
    price: currentPrice,
    autoUpdateSource: autoUpdateSource(value(form, 'autoUpdateSource')),
    ...metadata,
  };
}

export function readPositionForm(form: HTMLFormElement): PositionInput | null {
  const quantity = parseDecimal(value(form, 'quantity'));
  if (!Number.isFinite(quantity)) return null;
  const input = {
    accountId: value(form, 'accountId'),
    assetId: value(form, 'assetId'),
    quantity,
    comment: value(form, 'comment').trim(),
  };
  return form.dataset.editId ? { ...input, id: form.dataset.editId } : input;
}

export function formControl(
  form: HTMLFormElement,
  name: string,
): HTMLInputElement | HTMLSelectElement {
  return control(form, name);
}
