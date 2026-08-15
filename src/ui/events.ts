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
import { formatAppRoute, parseAppRoute, type AppRoute } from './routes';

interface ActionItem {
  label: string;
  danger?: boolean;
  run(): Promise<void> | void;
}

export class WorthController {
  private pendingActions: ActionItem[] = [];
  private toastTimer: ReturnType<typeof setTimeout> | undefined;
  private rateSelectionOrder: string[] = [];
  private readonly detailReturnRoutes: AppRoute[] = [];

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
    this.bindChartInspection();
    this.windowRef.addEventListener('hashchange', () => this.applyHashRoute());
    if (!this.windowRef.location.hash) {
      this.windowRef.history.replaceState(
        null,
        '',
        formatAppRoute({ kind: 'home' }),
      );
    }
    queueMicrotask(() => this.applyHashRoute());
    this.windowRef.addEventListener(
      'resize',
      () => {
        if (this.element('historyView').classList.contains('active')) {
          this.renderer.redrawChart();
        }
        if (this.element('homeView').classList.contains('active')) {
          this.renderer.redrawHomeChart();
        }
        if (this.element('entityDetailView').classList.contains('active')) {
          this.renderer.redrawDetailChart();
        }
      },
      { passive: true },
    );
  }

  private bindChartInspection(): void {
    for (const [id, kind] of [
      ['homeChart', 'home'],
      ['historyChart', 'history'],
      ['entityDetailChart', 'detail'],
    ] as const) {
      const canvas = requiredElement(id, HTMLCanvasElement, this.documentRef);
      const inspect = (event: PointerEvent): void => {
        if (event.pointerType !== 'mouse' && event.buttons === 0) return;
        this.renderer.inspectChart(kind, event.clientX);
      };
      canvas.addEventListener('pointerdown', (event) => {
        canvas.setPointerCapture(event.pointerId);
        inspect(event);
      });
      canvas.addEventListener('pointermove', inspect);
      canvas.addEventListener('pointerup', (event) => {
        if (canvas.hasPointerCapture(event.pointerId)) {
          canvas.releasePointerCapture(event.pointerId);
        }
        this.renderer.clearChartInspection(kind);
      });
      canvas.addEventListener('pointercancel', () =>
        this.renderer.clearChartInspection(kind),
      );
      canvas.addEventListener('pointerleave', (event) => {
        if (event.pointerType === 'mouse') {
          this.renderer.clearChartInspection(kind);
        }
      });
      canvas.addEventListener('focus', () =>
        this.renderer.selectLastChartPoint(kind),
      );
      canvas.addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        this.renderer.moveChartInspection(
          kind,
          event.key === 'ArrowLeft' ? -1 : 1,
        );
      });
      canvas.addEventListener('blur', () =>
        this.renderer.clearChartInspection(kind),
      );
    }
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
    const homePeriod = closestElement<HTMLElement>(
      event.target,
      '[data-home-period]',
    );
    if (
      homePeriod?.dataset.homePeriod === '1d' ||
      homePeriod?.dataset.homePeriod === '1w' ||
      homePeriod?.dataset.homePeriod === '1m' ||
      homePeriod?.dataset.homePeriod === '1y' ||
      homePeriod?.dataset.homePeriod === 'all'
    ) {
      this.renderer.ui.homePeriod = homePeriod.dataset.homePeriod;
      this.renderer.renderAll();
      return;
    }
    const portfolioFilter = closestElement<HTMLElement>(
      event.target,
      '[data-portfolio-filter]',
    );
    if (portfolioFilter?.dataset.portfolioFilter) {
      const key = portfolioFilter.dataset.portfolioFilter;
      this.renderer.ui.portfolioFilter = key.startsWith('tag:')
        ? { kind: 'tag', value: key.slice(4) }
        : { kind: 'all' };
      this.renderer.renderAssetsView();
      return;
    }
    const categoryFilter = closestElement<HTMLElement>(
      event.target,
      '[data-category-filter]',
    );
    if (categoryFilter?.dataset.categoryFilter) {
      this.renderer.ui.assetQuery = '';
      requiredElement('assetSearch', HTMLInputElement, this.documentRef).value =
        '';
      this.renderer.ui.portfolioFilter = {
        kind: 'category',
        value: categoryFilter.dataset.categoryFilter,
      };
      this.navigate('assetsView');
    }
    const exposureFilter = closestElement<HTMLElement>(
      event.target,
      '[data-exposure-filter]',
    );
    if (exposureFilter?.dataset.exposureFilter) {
      this.renderer.ui.assetQuery = '';
      requiredElement('assetSearch', HTMLInputElement, this.documentRef).value =
        '';
      this.renderer.ui.portfolioFilter = {
        kind: 'tag',
        value: exposureFilter.dataset.exposureFilter,
      };
      this.navigate('assetsView');
    }
    const rateAsset = closestElement<HTMLElement>(
      event.target,
      '[data-rate-asset]',
    );
    if (rateAsset?.dataset.rateAsset) {
      this.openEntity(
        { kind: 'asset', id: rateAsset.dataset.rateAsset },
        { kind: 'home' },
      );
      return;
    }
    const assetOpen = closestElement<HTMLElement>(
      event.target,
      '[data-asset-open]',
    );
    if (assetOpen?.dataset.assetOpen) {
      this.openEntity(
        { kind: 'asset', id: assetOpen.dataset.assetOpen },
        parseAppRoute(this.windowRef.location.hash).kind === 'account'
          ? parseAppRoute(this.windowRef.location.hash)
          : { kind: 'assets' },
      );
      return;
    }
    const accountOpen = closestElement<HTMLElement>(
      event.target,
      '[data-account-open]',
    );
    if (accountOpen?.dataset.accountOpen) {
      this.openEntity(
        { kind: 'account', id: accountOpen.dataset.accountOpen },
        parseAppRoute(this.windowRef.location.hash).kind === 'asset'
          ? parseAppRoute(this.windowRef.location.hash)
          : { kind: 'accounts' },
      );
      return;
    }
    if (closestElement<HTMLElement>(event.target, '[data-detail-back]')) {
      const current = parseAppRoute(this.windowRef.location.hash);
      this.goToRoute(
        this.detailReturnRoutes.pop() ??
          (current.kind === 'account'
            ? { kind: 'accounts' }
            : { kind: 'assets' }),
      );
      return;
    }
    const detailPosition = closestElement<HTMLElement>(
      event.target,
      '[data-detail-add-position]',
    );
    if (detailPosition?.dataset.detailAddPosition) {
      const [kind, id] = detailPosition.dataset.detailAddPosition.split(':');
      this.openDialog('positionModal');
      const form = this.form('positionForm');
      if (kind === 'asset') formControl(form, 'assetId').value = id ?? '';
      if (kind === 'account') formControl(form, 'accountId').value = id ?? '';
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

    this.element('privacyToggle').addEventListener('click', () => {
      this.service.saveSettings({
        balancesHidden: !this.service.settings.balancesHidden,
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
    this.element('saveSnapshotBtnHistory').addEventListener(
      'click',
      () => void this.saveSnapshot(),
    );
    requiredElement(
      'assetSearch',
      HTMLInputElement,
      this.documentRef,
    ).addEventListener('input', (event) => {
      const input = event.currentTarget;
      if (!(input instanceof HTMLInputElement)) return;
      this.renderer.ui.assetQuery = input.value;
      this.renderer.renderAssetsView();
    });
    requiredElement(
      'accountSearch',
      HTMLInputElement,
      this.documentRef,
    ).addEventListener('input', (event) => {
      const input = event.currentTarget;
      if (!(input instanceof HTMLInputElement)) return;
      this.renderer.ui.accountQuery = input.value;
      this.renderer.renderAccountsView();
    });
    this.element('assetAdd').addEventListener('click', () =>
      this.openDialog('assetModal'),
    );
    this.element('accountAdd').addEventListener('click', () =>
      this.openDialog('accountModal'),
    );
    this.element('configureRatesBtn').addEventListener('click', () => {
      this.renderer.renderRateSelection();
      this.rateSelectionOrder = Array.from(
        this.form('rateSelectionForm').querySelectorAll<HTMLInputElement>(
          '[name="rateAsset"]:checked',
        ),
        ({ value }) => value,
      );
      this.openDialog('rateSelectionModal');
    });
    this.form('rateSelectionForm').addEventListener('change', (event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || input.name !== 'rateAsset')
        return;
      if (input.checked) {
        if (this.rateSelectionOrder.length >= 3) {
          input.checked = false;
          this.showRateSelectionError(this.renderer.t('rateLimit'));
          return;
        }
        this.rateSelectionOrder.push(input.value);
      } else {
        this.rateSelectionOrder = this.rateSelectionOrder.filter(
          (id) => id !== input.value,
        );
      }
      this.element('rateSelectionError').classList.add('hidden');
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
    for (const id of ['assetForm', 'assetEditForm']) {
      this.form(id).addEventListener('change', (event) => {
        const target = event.target;
        if (target instanceof HTMLSelectElement && target.name === 'category') {
          this.toggleCustomCategory(target.form);
        }
      });
    }
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
    this.form('rateSelectionForm').addEventListener('submit', (event) => {
      event.preventDefault();
      if (!this.rateSelectionOrder.length) {
        this.showRateSelectionError(this.renderer.t('rateRequired'));
        return;
      }
      this.service.saveSettings({
        selectedRateAssetIds: this.rateSelectionOrder.slice(0, 3),
      });
      this.closeDialog('rateSelectionModal');
      this.renderer.renderAll();
    });
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
          this.applyHashRoute();
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
          this.applyHashRoute();
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
    this.renderer.prepareAssetTaxonomyForm(form, asset);
    formControl(form, 'assetId').value = asset.id;
    formControl(form, 'name').value = asset.name;
    formControl(form, 'code').value = asset.code;
    formControl(form, 'icon').value = asset.icon;
    formControl(form, 'color').value = asset.color;
    formControl(form, 'autoUpdateSource').value = asset.autoUpdateSource;
    this.toggleCustomCategory(form);
    this.openDialog('assetEditModal');
  }

  private toggleCustomCategory(form: HTMLFormElement | null): void {
    if (!form) return;
    const select = formControl(form, 'category');
    const field = form.querySelector<HTMLElement>('.custom-category-field');
    const input = formControl(form, 'customCategory');
    const custom = select.value === 'new' || select.value === '__custom__';
    field?.classList.toggle('hidden', !custom);
    input.toggleAttribute('required', custom);
    if (custom) input.focus();
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
      this.applyHashRoute();
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
    this.applyHashRoute();
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
    const routes: Record<string, AppRoute> = {
      homeView: { kind: 'home' },
      assetsView: { kind: 'assets' },
      accountsView: { kind: 'accounts' },
      historyView: { kind: 'history' },
      settingsView: { kind: 'settings' },
    };
    const route = routes[id];
    if (route) this.goToRoute(route);
  }

  private openEntity(
    route: Extract<AppRoute, { kind: 'asset' | 'account' }>,
    returnRoute: AppRoute,
  ): void {
    this.detailReturnRoutes.push(returnRoute);
    this.goToRoute(route);
  }

  private goToRoute(route: AppRoute): void {
    const hash = formatAppRoute(route);
    if (this.windowRef.location.hash === hash) {
      this.applyHashRoute();
    } else {
      this.windowRef.location.hash = hash;
    }
  }

  private applyHashRoute(): void {
    const route = parseAppRoute(this.windowRef.location.hash);
    let viewId: string;
    if (route.kind === 'asset' || route.kind === 'account') {
      if (!this.renderer.renderEntityDetail(route)) {
        const fallback: AppRoute =
          route.kind === 'asset' ? { kind: 'assets' } : { kind: 'accounts' };
        this.windowRef.history.replaceState(null, '', formatAppRoute(fallback));
        this.applyHashRoute();
        return;
      }
      viewId = 'entityDetailView';
    } else {
      viewId = `${route.kind}View`;
    }
    all<HTMLElement>('.view', this.documentRef).forEach((view) =>
      view.classList.toggle('active', view.id === viewId),
    );
    const detail = route.kind === 'asset' || route.kind === 'account';
    this.documentRef
      .querySelector<HTMLElement>('.tab-bar')
      ?.classList.toggle('hidden', detail);
    this.documentRef
      .querySelector<HTMLElement>('.app-header')
      ?.classList.toggle('hidden', detail);
    all<HTMLElement>('.tab', this.documentRef).forEach((tab) =>
      tab.classList.toggle('active', tab.dataset.nav === viewId),
    );
    this.windowRef.scrollTo({ top: 0, behavior: 'auto' });
    if (route.kind === 'history') this.renderer.redrawChart();
    if (route.kind === 'home') this.renderer.redrawHomeChart();
    if (detail) {
      this.renderer.redrawDetailChart();
      this.element('entityDetailTitle').focus();
    }
  }

  private showRateSelectionError(message: string): void {
    const error = this.element('rateSelectionError');
    error.textContent = message;
    error.classList.remove('hidden');
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

  private form(id: string): HTMLFormElement {
    return requiredElement(id, HTMLFormElement, this.documentRef);
  }

  private element(id: string): HTMLElement {
    return requiredElement(id, HTMLElement, this.documentRef);
  }
}
