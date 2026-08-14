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
  if (!name || !code || !Number.isFinite(price) || price < 0) return null;
  return {
    name,
    code,
    icon: value(form, 'icon').trim(),
    color: value(form, 'color'),
    price,
    autoUpdateSource: autoUpdateSource(value(form, 'autoUpdateSource')),
  };
}

export function readAssetEditForm(
  form: HTMLFormElement,
  currentPrice: number,
): AssetInput | null {
  const name = value(form, 'name').trim();
  const code = cleanCode(value(form, 'code'));
  if (!name || !code || !Number.isFinite(currentPrice) || currentPrice < 0) {
    return null;
  }
  return {
    name,
    code,
    icon: value(form, 'icon').trim(),
    color: value(form, 'color'),
    price: currentPrice,
    autoUpdateSource: autoUpdateSource(value(form, 'autoUpdateSource')),
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
