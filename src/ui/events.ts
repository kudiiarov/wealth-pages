import type { PortfolioService } from '../application/portfolio-service';
import type {
  Account,
  Asset,
  AutomationInterval,
  Position,
} from '../domain/models';
import {
  convertPriceCurrencyToUsd,
  convertUsdToPriceCurrency,
  inputDecimal,
  parseDecimal,
} from '../i18n/format';
import { all, closestElement, escapeHtml, requiredElement } from './dom';
import {
  formControl,
  readAccountForm,
  readAssetEditForm,
  readAssetForm,
  readPositionForm,
} from './forms';
import type { WorthRenderer } from './render';

interface ActionItem {
  label: string;
  danger?: boolean;
  run(): Promise<void> | void;
}

export class WorthController {
  private pendingActions: ActionItem[] = [];
  private toastTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly service: PortfolioService,
    private readonly renderer: WorthRenderer,
    private readonly documentRef: Document = document,
    private readonly windowRef: Window = window,
  ) {}

  bind(): void {
    this.documentRef.addEventListener('click', (event) => {
      void this.handleClick(event).catch((error: unknown) =>
        this.reportError(error),
      );
    });
    this.bindDirectActions();
    this.bindForms();
    this.windowRef.addEventListener(
      'resize',
      () => {
        if (this.element('historyView').classList.contains('active')) {
          this.renderer.redrawChart();
        }
      },
      { passive: true },
    );
  }

  private async handleClick(event: MouseEvent): Promise<void> {
    const currency = closestElement<HTMLElement>(
      event.target,
      '[data-currency-code]',
    );
    if (currency?.dataset.currencyCode) {
      this.service.saveSettings({
        displayCurrency: currency.dataset.currencyCode,
      });
      this.closeDialog('currencyModal');
      this.renderer.renderAll();
      return;
    }
    const theme = closestElement<HTMLElement>(
      event.target,
      '[data-theme-choice]',
    );
    if (theme?.dataset.themeChoice) {
      this.service.saveSettings({
        theme: theme.dataset.themeChoice === 'dark' ? 'dark' : 'light',
      });
      this.renderer.renderAll();
      return;
    }
    const language = closestElement<HTMLElement>(
      event.target,
      '[data-lang-choice]',
    );
    if (language?.dataset.langChoice) {
      this.service.saveSettings({
        language: language.dataset.langChoice === 'en' ? 'en' : 'ru',
      });
      this.renderer.renderAll();
      return;
    }
    const grouping = closestElement<HTMLElement>(
      event.target,
      '[data-grouping]',
    );
    if (
      grouping?.dataset.grouping === 'accounts' ||
      grouping?.dataset.grouping === 'assets'
    ) {
      this.service.saveSettings({
        positionGrouping: grouping.dataset.grouping,
      });
      this.renderer.ui.collapsedPositionGroups.clear();
      this.renderer.renderAll();
      return;
    }
    const positionGroup = closestElement<HTMLElement>(
      event.target,
      '[data-position-group]',
    );
    if (positionGroup?.dataset.positionGroup) {
      this.toggleSet(
        this.renderer.ui.collapsedPositionGroups,
        positionGroup.dataset.positionGroup,
      );
      this.renderer.renderAll();
      return;
    }
    const accountToggle = closestElement<HTMLElement>(
      event.target,
      '[data-account-toggle]',
    );
    if (
      accountToggle?.dataset.accountToggle &&
      !closestElement(event.target, '[data-account-menu]')
    ) {
      this.toggleSet(
        this.renderer.ui.expandedAccounts,
        accountToggle.dataset.accountToggle,
      );
      this.renderer.renderAll();
      return;
    }
    const assetToggle = closestElement<HTMLElement>(
      event.target,
      '[data-asset-toggle]',
    );
    if (
      assetToggle?.dataset.assetToggle &&
      !closestElement(event.target, '[data-asset-menu]')
    ) {
      this.toggleSet(
        this.renderer.ui.expandedAssets,
        assetToggle.dataset.assetToggle,
      );
      this.renderer.renderAll();
      return;
    }
    const opener = closestElement<HTMLElement>(event.target, '[data-open]');
    if (opener?.dataset.open) {
      this.openDialog(opener.dataset.open);
      return;
    }
    const closer = closestElement<HTMLElement>(event.target, '[data-close]');
    if (closer?.dataset.close) {
      this.closeDialog(closer.dataset.close);
      return;
    }
    const navigation = closestElement<HTMLElement>(event.target, '[data-nav]');
    if (navigation?.dataset.nav) {
      this.navigate(navigation.dataset.nav);
      return;
    }
    const accountMenu = closestElement<HTMLElement>(
      event.target,
      '[data-account-menu]',
    );
    if (accountMenu?.dataset.accountMenu) {
      this.showAccountMenu(accountMenu.dataset.accountMenu);
      return;
    }
    const assetMenu = closestElement<HTMLElement>(
      event.target,
      '[data-asset-menu]',
    );
    if (assetMenu?.dataset.assetMenu) {
      this.showAssetMenu(assetMenu.dataset.assetMenu);
      return;
    }
    const positionMenu = closestElement<HTMLElement>(
      event.target,
      '[data-position-menu]',
    );
    if (positionMenu?.dataset.positionMenu) {
      this.showPositionMenu(positionMenu.dataset.positionMenu);
      return;
    }
    const snapshotMenu = closestElement<HTMLElement>(
      event.target,
      '[data-snapshot-menu]',
    );
    if (snapshotMenu?.dataset.snapshotMenu) {
      this.showSnapshotMenu(snapshotMenu.dataset.snapshotMenu);
      return;
    }
    const action = closestElement<HTMLElement>(
      event.target,
      '[data-action-index]',
    );
    if (action?.dataset.actionIndex) {
      const pending = this.pendingActions[Number(action.dataset.actionIndex)];
      this.closeDialog('actionMenuModal');
      await pending?.run();
    }
  }

  private bindDirectActions(): void {
    const priceForm = this.form('priceForm');
    formControl(priceForm, 'priceCurrency').addEventListener(
      'change',
      (event) => {
        const select = event.currentTarget;
        if (!(select instanceof HTMLSelectElement)) return;
        const previous = priceForm.dataset.priceCurrency || 'USD';
        const current = parseDecimal(formControl(priceForm, 'price').value);
        const usd = convertPriceCurrencyToUsd(
          current,
          previous,
          this.service.data.assets,
        );
        if (Number.isFinite(usd)) {
          const converted = convertUsdToPriceCurrency(
            usd,
            select.value,
            this.service.data.assets,
          );
          if (Number.isFinite(converted)) {
            formControl(priceForm, 'price').value = inputDecimal(
              converted,
              this.renderer.language,
            );
          }
        }
        priceForm.dataset.priceCurrency = select.value;
      },
    );

    this.element('pnlPeriodToggle').addEventListener('click', () => {
      this.service.saveSettings({
        pnlPeriod: this.service.settings.pnlPeriod === 'last' ? 'all' : 'last',
      });
      this.renderer.renderAll();
    });
    requiredElement(
      'autoPriceRefresh',
      HTMLInputElement,
      this.documentRef,
    ).addEventListener('change', (event) => {
      const input = event.currentTarget;
      if (input instanceof HTMLInputElement) {
        this.service.saveSettings({ autoPriceRefresh: input.checked });
        this.renderer.renderAll();
      }
    });
    requiredElement(
      'priceRefreshIntervalHours',
      HTMLSelectElement,
      this.documentRef,
    ).addEventListener('change', (event) => {
      const input = event.currentTarget;
      if (input instanceof HTMLSelectElement)
        this.service.saveSettings({
          priceRefreshIntervalHours: Number(input.value) as AutomationInterval,
        });
    });
    requiredElement(
      'autoSnapshot',
      HTMLInputElement,
      this.documentRef,
    ).addEventListener('change', (event) => {
      const input = event.currentTarget;
      if (input instanceof HTMLInputElement) {
        this.service.saveSettings({ autoSnapshot: input.checked });
        this.renderer.renderAll();
      }
    });
    requiredElement(
      'snapshotIntervalHours',
      HTMLSelectElement,
      this.documentRef,
    ).addEventListener('change', (event) => {
      const input = event.currentTarget;
      if (input instanceof HTMLSelectElement)
        this.service.saveSettings({
          snapshotIntervalHours: Number(input.value) as AutomationInterval,
        });
    });
    requiredElement(
      'historyScope',
      HTMLSelectElement,
      this.documentRef,
    ).addEventListener('change', (event) => {
      const select = event.currentTarget;
      if (select instanceof HTMLSelectElement) {
        this.renderer.ui.historyScope = select.value;
        this.renderer.renderAll();
      }
    });
    this.element('saveSnapshotBtnHistory').addEventListener(
      'click',
      () => void this.saveSnapshot(),
    );
    this.element('allocationToggle').addEventListener('click', () => {
      this.renderer.ui.allocationExpanded =
        !this.renderer.ui.allocationExpanded;
      this.renderer.renderAll();
    });
    this.element('accountsSectionToggle').addEventListener('click', () => {
      this.renderer.ui.accountsSectionExpanded =
        !this.renderer.ui.accountsSectionExpanded;
      this.renderer.renderAll();
    });
    this.element('assetsSectionToggle').addEventListener('click', () => {
      this.renderer.ui.assetsSectionExpanded =
        !this.renderer.ui.assetsSectionExpanded;
      this.renderer.renderAll();
    });
    this.element('displayCurrencyBtn').addEventListener('click', () => {
      this.renderer.renderCurrencyOptions();
      this.openDialog('currencyModal');
    });
    this.element('settingsShortcut').addEventListener('click', () =>
      this.navigate('settingsView'),
    );
    this.element('refreshPricesBtn').addEventListener(
      'click',
      () => void this.refreshPrices(),
    );
    this.element('diagnosticsBtn').addEventListener('click', () => {
      this.renderer.renderDiagnostics();
      this.openDialog('diagnosticsModal');
    });
    this.element('copyDiagnosticsBtn').addEventListener(
      'click',
      () => void this.copyDiagnostics(),
    );
    this.element('clearDiagnosticsBtn').addEventListener('click', () => {
      this.service.clearDiagnostics();
      this.renderer.renderDiagnostics();
      this.toast(this.renderer.t('logCleared'));
    });
    this.element('exportBtn').addEventListener('click', () => {
      this.service.exportBackup();
      this.toast(this.renderer.t('backupCreated'));
    });
    requiredElement(
      'importInput',
      HTMLInputElement,
      this.documentRef,
    ).addEventListener('change', (event) => void this.importFile(event));
    this.element('resetBtn').addEventListener('click', () => void this.reset());
  }

  private bindForms(): void {
    this.form('accountForm').addEventListener(
      'submit',
      (event) => void this.submitAccount(event),
    );
    this.form('accountEditForm').addEventListener(
      'submit',
      (event) => void this.submitAccountEdit(event),
    );
    this.form('assetForm').addEventListener(
      'submit',
      (event) => void this.submitAsset(event),
    );
    this.form('assetEditForm').addEventListener(
      'submit',
      (event) => void this.submitAssetEdit(event),
    );
    this.form('positionForm').addEventListener(
      'submit',
      (event) => void this.submitPosition(event),
    );
    this.form('priceForm').addEventListener(
      'submit',
      (event) => void this.submitPrice(event),
    );
    this.form('quickUpdateForm').addEventListener(
      'submit',
      (event) => void this.submitQuickUpdate(event),
    );
  }

  private async submitAccount(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;
    const input = readAccountForm(form);
    if (!input) return;
    await this.service.createAccount(input);
    form.reset();
    formControl(form, 'color').value = '#17181b';
    this.closeDialog('accountModal');
    this.renderer.renderAll();
    this.toast(this.renderer.t('accountCreated'));
  }

  private async submitAccountEdit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;
    const input = readAccountForm(form);
    const id = formControl(form, 'accountId').value;
    if (!input || !id) return;
    await this.service.updateAccount(id, input);
    this.closeDialog('accountEditModal');
    this.renderer.renderAll();
    this.toast(this.renderer.t('accountUpdated'));
  }

  private async submitAsset(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;
    const input = readAssetForm(form);
    if (!input) return;
    try {
      await this.service.createAsset(input);
    } catch (error) {
      if (error instanceof Error && error.message === 'Duplicate asset code') {
        this.windowRef.alert(this.renderer.t('duplicateCode'));
        return;
      }
      throw error;
    }
    form.reset();
    formControl(form, 'color').value = '#5667ff';
    this.closeDialog('assetModal');
    this.renderer.renderAll();
    this.toast(this.renderer.t('assetCreated'));
  }

  private async submitAssetEdit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;
    const id = formControl(form, 'assetId').value;
    const current = this.renderer.assetBy(id);
    const input = readAssetEditForm(form, Number(current?.price));
    if (!current || !input) return;
    try {
      await this.service.updateAsset(id, input);
    } catch (error) {
      if (error instanceof Error && error.message === 'Duplicate asset code') {
        this.windowRef.alert(this.renderer.t('duplicateCode'));
        return;
      }
      throw error;
    }
    this.closeDialog('assetEditModal');
    this.renderer.renderAll();
    this.toast(this.renderer.t('assetUpdated'));
  }

  private async submitPosition(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;
    const input = readPositionForm(form);
    if (!input) return;
    await this.service.savePosition(input);
    this.closeDialog('positionModal');
    this.resetPositionForm();
    this.renderer.renderAll();
    this.toast(this.renderer.t('positionSaved'));
  }

  private async submitPrice(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;
    const assetId = formControl(form, 'assetId').value;
    const currency = formControl(form, 'priceCurrency').value || 'USD';
    const entered = parseDecimal(formControl(form, 'price').value);
    const usdPrice = convertPriceCurrencyToUsd(
      entered,
      currency,
      this.service.data.assets,
    );
    if (!Number.isFinite(usdPrice) || usdPrice < 0) return;
    await this.service.updateAssetPrice(assetId, usdPrice, currency);
    this.closeDialog('priceModal');
    this.renderer.renderAll();
    this.toast(this.renderer.t('priceUpdated'));
  }

  private async submitQuickUpdate(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;
    const button = form.querySelector<HTMLButtonElement>('.sheet-primary');
    if (button) button.disabled = true;
    try {
      for (const input of all<HTMLInputElement>('[data-asset-price]', form)) {
        const assetId = input.dataset.assetPrice;
        if (!assetId) continue;
        const currency =
          form.querySelector<HTMLSelectElement>(
            `[data-asset-price-currency="${CSS.escape(assetId)}"]`,
          )?.value || 'USD';
        const price = convertPriceCurrencyToUsd(
          parseDecimal(input.value),
          currency,
          this.service.data.assets,
        );
        if (Number.isFinite(price) && price >= 0) {
          await this.service.updateAssetPrice(assetId, price, currency);
        }
      }
      for (const input of all<HTMLInputElement>('[data-position-qty]', form)) {
        const positionId = input.dataset.positionQty;
        const position = this.service.data.positions.find(
          ({ id }) => id === positionId,
        );
        const quantity = parseDecimal(input.value);
        if (position && Number.isFinite(quantity)) {
          await this.service.savePosition({
            id: position.id,
            accountId: position.accountId,
            assetId: position.assetId,
            quantity,
            comment: position.comment,
          });
        }
      }
      this.closeDialog('quickUpdateModal');
      this.renderer.renderAll();
      this.toast(this.renderer.t('changesSaved'));
    } finally {
      if (button) button.disabled = false;
    }
  }

  private showAccountMenu(id: string): void {
    const account = this.renderer.accountBy(id);
    if (!account) return;
    this.showActionMenu(account.name, [
      {
        label: this.renderer.t('configureAccount'),
        run: () => this.openAccountEdit(account),
      },
      {
        label: this.renderer.t('deleteAccount'),
        danger: true,
        run: async () => {
          if (
            !this.windowRef.confirm(
              this.renderer.t('confirmDeleteAccount', account.name),
            )
          ) {
            return;
          }
          await this.service.deleteAccount(account.id);
          this.renderer.renderAll();
          this.toast(this.renderer.t('accountDeleted'));
        },
      },
    ]);
  }

  private showAssetMenu(id: string): void {
    const asset = this.renderer.assetBy(id);
    if (!asset) return;
    this.showActionMenu(`${asset.name} · ${asset.code}`, [
      {
        label: this.renderer.t('refreshAssetPrice'),
        run: () => this.refreshPrices(asset.id),
      },
      {
        label: this.renderer.t('configureAsset'),
        run: () => this.openAssetEdit(asset),
      },
      {
        label: this.renderer.t('changePrice'),
        run: () => this.openPriceEdit(asset),
      },
      {
        label: this.renderer.t('deleteAsset'),
        danger: true,
        run: async () => {
          if (
            !this.windowRef.confirm(
              this.renderer.t('confirmDeleteAsset', asset.name, asset.code),
            )
          ) {
            return;
          }
          await this.service.deleteAsset(asset.id);
          this.renderer.renderAll();
          this.toast(this.renderer.t('assetDeleted'));
        },
      },
    ]);
  }

  private showPositionMenu(id: string): void {
    const position = this.service.data.positions.find(
      (candidate) => candidate.id === id,
    );
    if (!position) return;
    const asset = this.renderer.assetBy(position.assetId);
    this.showActionMenu(asset?.name || this.renderer.t('position'), [
      {
        label: this.renderer.t('showPositionHistory'),
        run: () => {
          this.renderer.ui.historyScope = `position:${position.id}`;
          this.navigate('historyView');
          this.renderer.renderAll();
        },
      },
      {
        label: this.renderer.t('editPosition'),
        run: () => this.openPositionEdit(position),
      },
      {
        label: this.renderer.t('deletePosition'),
        danger: true,
        run: async () => {
          if (!this.windowRef.confirm(this.renderer.t('confirmDeletePosition')))
            return;
          await this.service.deletePosition(position.id);
          this.renderer.renderAll();
          this.toast(this.renderer.t('positionDeleted'));
        },
      },
    ]);
  }

  private showSnapshotMenu(id: string): void {
    this.showActionMenu(this.renderer.t('snapshot'), [
      {
        label: this.renderer.t('deleteSnapshot'),
        danger: true,
        run: async () => {
          if (!this.windowRef.confirm(this.renderer.t('confirmDeleteSnapshot')))
            return;
          await this.service.deleteSnapshot(id);
          this.renderer.renderAll();
          this.toast(this.renderer.t('snapshotDeleted'));
        },
      },
    ]);
  }

  private openAccountEdit(account: Account): void {
    const form = this.form('accountEditForm');
    formControl(form, 'accountId').value = account.id;
    formControl(form, 'name').value = account.name;
    formControl(form, 'type').value = this.accountTypeValue(account.type);
    formControl(form, 'icon').value = account.icon;
    formControl(form, 'color').value = account.color;
    this.openDialog('accountEditModal');
  }

  private openAssetEdit(asset: Asset): void {
    const form = this.form('assetEditForm');
    formControl(form, 'assetId').value = asset.id;
    formControl(form, 'name').value = asset.name;
    formControl(form, 'code').value = asset.code;
    formControl(form, 'icon').value = asset.icon;
    formControl(form, 'color').value = asset.color;
    formControl(form, 'autoUpdateSource').value = asset.autoUpdateSource;
    this.openDialog('assetEditModal');
  }

  private openPriceEdit(asset: Asset): void {
    const form = this.form('priceForm');
    formControl(form, 'assetId').value = asset.id;
    formControl(form, 'priceCurrency').innerHTML =
      this.renderer.currencySelectOptions('USD');
    form.dataset.priceCurrency = 'USD';
    formControl(form, 'price').value = inputDecimal(
      asset.price,
      this.renderer.language,
    );
    this.element('priceAssetTitle').textContent =
      `${asset.name} · ${asset.code}`;
    this.openDialog('priceModal');
  }

  private openPositionEdit(position: Position): void {
    this.openDialog('positionModal');
    const form = this.form('positionForm');
    form.dataset.editId = position.id;
    formControl(form, 'accountId').value = position.accountId;
    formControl(form, 'assetId').value = position.assetId;
    formControl(form, 'quantity').value = inputDecimal(
      position.quantity,
      this.renderer.language,
    );
    formControl(form, 'comment').value = position.comment;
    this.element('positionModeLabel').textContent = this.renderer.t('editing');
  }

  private showActionMenu(title: string, actions: ActionItem[]): void {
    this.pendingActions = actions;
    this.element('actionMenuTitle').textContent = title;
    this.element('actionMenuItems').innerHTML = actions
      .map(
        (action, index) =>
          `<button type="button" class="action-item ${action.danger ? 'danger' : ''}" data-action-index="${index}">${escapeHtml(action.label)}</button>`,
      )
      .join('');
    this.openDialog('actionMenuModal');
  }

  private async saveSnapshot(): Promise<void> {
    await this.service.saveSnapshot();
    this.renderer.renderAll();
    this.toast(this.renderer.t('snapshotSaved'));
  }

  private async refreshPrices(assetId?: string): Promise<void> {
    const button = assetId ? null : this.element('refreshPricesBtn');
    if (button) {
      button.setAttribute('aria-busy', 'true');
      button.classList.add('loading');
    }
    try {
      const result = await this.service.refreshPrices(assetId);
      this.renderer.renderAll();
      this.toast(
        result.updated > 0
          ? assetId
            ? this.renderer.t('priceUpdatedAuto')
            : this.renderer.t('pricesUpdated', result.updated)
          : assetId
            ? this.renderer.t('sourceUnavailable')
            : this.renderer.t('noAutoPrices'),
      );
    } catch (error) {
      console.error(error);
      this.toast(this.renderer.t('priceUpdateFailed'));
    } finally {
      if (button) {
        button.removeAttribute('aria-busy');
        button.classList.remove('loading');
      }
    }
  }

  private async importFile(event: Event): Promise<void> {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement)) return;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const json = await file.text();
      if (!this.windowRef.confirm(this.renderer.t('confirmImport'))) return;
      await this.service.importBackup(json);
      this.renderer.renderAll();
      this.toast(this.renderer.t('dataRestored'));
    } catch (error) {
      console.error(error);
      const detail =
        error instanceof Error ? error.message : this.renderer.t('unsupported');
      this.windowRef.alert(`${this.renderer.t('importFailed')}: ${detail}`);
    } finally {
      input.value = '';
    }
  }

  private async copyDiagnostics(): Promise<void> {
    const text = this.renderer.diagnosticsText();
    if (!text || !this.windowRef.navigator.clipboard) return;
    await this.windowRef.navigator.clipboard.writeText(text);
    this.toast(this.renderer.t('logCopied'));
  }

  private async reset(): Promise<void> {
    if (!this.windowRef.confirm(this.renderer.t('confirmDeleteAll'))) return;
    await this.service.reset();
    this.renderer.renderAll();
    this.toast(this.renderer.t('allDeleted'));
  }

  private openDialog(id: string): void {
    if (id === 'positionModal') this.resetPositionForm();
    const dialog = requiredElement(id, HTMLDialogElement, this.documentRef);
    if (!dialog.open) dialog.showModal();
  }

  private closeDialog(id: string): void {
    const dialog = requiredElement(id, HTMLDialogElement, this.documentRef);
    if (dialog.open) dialog.close();
  }

  private resetPositionForm(): void {
    const form = this.form('positionForm');
    form.reset();
    delete form.dataset.editId;
    this.element('positionModeLabel').textContent = this.renderer.t('newPos');
    this.renderer.refreshPositionForm();
  }

  private navigate(id: string): void {
    all<HTMLElement>('.view', this.documentRef).forEach((view) =>
      view.classList.toggle('active', view.id === id),
    );
    all<HTMLElement>('.tab', this.documentRef).forEach((tab) =>
      tab.classList.toggle('active', tab.dataset.nav === id),
    );
    this.windowRef.scrollTo({ top: 0, behavior: 'auto' });
    if (id === 'historyView')
      requestAnimationFrame(() => this.renderer.redrawChart());
  }

  private toast(message: string): void {
    const toast = this.element('toast');
    toast.textContent = message;
    toast.classList.add('show');
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
  }

  private reportError(error: unknown): void {
    console.error(error);
    this.windowRef.alert(
      error instanceof Error ? error.message : this.renderer.t('unsupported'),
    );
  }

  private accountTypeValue(type: string): string {
    const value = type.toLowerCase();
    if (value.includes('банк') || value === 'bank') return 'bank';
    if (value.includes('бирж') || value === 'exchange') return 'exchange';
    if (value.includes('долг') || value === 'debt') return 'debt';
    if (value.includes('крипто') || value === 'crypto wallet')
      return 'cryptoWallet';
    if (value.includes('налич') || value === 'cash') return 'cash';
    return 'other';
  }

  private toggleSet(values: Set<string>, id: string): void {
    if (values.has(id)) values.delete(id);
    else values.add(id);
  }

  private form(id: string): HTMLFormElement {
    return requiredElement(id, HTMLFormElement, this.documentRef);
  }

  private element(id: string): HTMLElement {
    return requiredElement(id, HTMLElement, this.documentRef);
  }
}
