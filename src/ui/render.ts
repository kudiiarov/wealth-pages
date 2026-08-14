import type { PortfolioService } from '../application/portfolio-service';
import type { DiagnosticEntry } from '../application/ports';
import type {
  Account,
  Asset,
  Language,
  Position,
  Snapshot,
  SnapshotPosition,
} from '../domain/models';
import { validColor } from '../domain/normalize';
import {
  accountTotal,
  assetQuantity,
  assetTotal,
  portfolioTotal,
  positionValue,
} from '../domain/portfolio';
import {
  flowAdjustedPnl,
  selectPnlSeries,
  type PnlPoint,
  type PnlResult,
} from '../domain/pnl';
import {
  convertUsdToDisplay,
  formatDate,
  formatMoney,
  formatNumber,
  formatRelativeTime,
  formatTime,
  inputDecimal,
  locale,
} from '../i18n/format';
import {
  isMessageKey,
  translate,
  type MessageArguments,
  type MessageKey,
} from '../i18n/messages';
import { drawHistoryChart, type HistoryDatum } from './chart';
import { all, escapeHtml, requiredElement } from './dom';
import { formControl } from './forms';
import { allocationRows } from './portfolio-view-model';
import { buildPositionGroups } from './position-groups';

const palette = [
  '#17181b',
  '#5667ff',
  '#9b63e8',
  '#21c26b',
  '#f5a341',
  '#33bfc6',
  '#ee5264',
  '#7a8395',
];

export interface UiState {
  historyScope: string;
  expandedAccounts: Set<string>;
  expandedAssets: Set<string>;
  allocationExpanded: boolean;
  accountsSectionExpanded: boolean;
  assetsSectionExpanded: boolean;
  collapsedPositionGroups: Set<string>;
}

interface HistoryItem {
  snapshot: Snapshot;
  value: number;
  record?: SnapshotPosition;
}

export class WorthRenderer {
  readonly ui: UiState = {
    historyScope: 'portfolio',
    expandedAccounts: new Set(),
    expandedAssets: new Set(),
    allocationExpanded: false,
    accountsSectionExpanded: false,
    assetsSectionExpanded: false,
    collapsedPositionGroups: new Set(),
  };

  constructor(
    readonly service: PortfolioService,
    private readonly documentRef: Document = document,
  ) {}

  get language(): Language {
    return this.service.settings.language;
  }

  renderAll(): void {
    this.syncDisplayCurrency();
    this.applyTheme();
    this.applyLanguage();
    this.renderCurrencyButton();
    this.renderPnlSummary();
    this.renderAllocation();
    this.renderAccounts();
    this.renderAssets();
    this.renderPositions();
    this.refreshHistoryScope();
    this.renderHistory();
    this.refreshPositionForm();
  }

  renderQuickUpdate(): void {
    const container = this.element('quickUpdateFields');
    if (!this.service.data.assets.length) {
      container.innerHTML = `<div class="empty-state">${this.t('emptyAssets')}</div>`;
      return;
    }
    container.innerHTML = this.service.data.assets
      .map((asset) => {
        const positions = this.service.data.positions.filter(
          ({ assetId }) => assetId === asset.id,
        );
        const rows = positions.length
          ? positions
              .map((position) => {
                const account = this.accountBy(position.accountId);
                return `<label class="quick-position-row"><span class="quick-position-account"><span class="quick-account-icon ${this.iconLengthClass(this.accountIcon(account))}" style="background:${this.accountColor(account)}">${escapeHtml(this.accountIcon(account))}</span><span><strong>${escapeHtml(account?.name || this.t('account'))}</strong><small>${escapeHtml(this.t('qtyCode', asset.code))}</small></span></span><input type="text" inputmode="decimal" autocomplete="off" data-position-qty="${position.id}" value="${inputDecimal(position.quantity, this.language)}" aria-label="${escapeHtml(this.t('qtyAccount', asset.code, account?.name || this.t('account')))}"></label>`;
              })
              .join('')
          : `<div class="quick-no-positions">${this.t('noPositions')}</div>`;
        return `<section class="quick-asset-card"><div class="quick-asset-head"><span class="quick-asset-icon ${this.iconLengthClass(this.assetIcon(asset))}" style="background:${this.assetColor(asset)}">${escapeHtml(this.assetIcon(asset))}</span><div class="quick-asset-meta"><strong>${escapeHtml(asset.name)}</strong><small>${escapeHtml(asset.code)} · ${this.money(this.assetTotal(asset.id))}</small></div></div><label class="quick-price-row"><span><strong>${this.t('unitPriceLabel')}</strong><small>${this.t('basePrice')}</small></span><div class="quick-price-entry"><input type="text" inputmode="decimal" autocomplete="off" data-asset-price="${asset.id}" value="${inputDecimal(asset.price, this.language)}" aria-label="${escapeHtml(this.t('priceUsd', asset.code))}"><select data-asset-price-currency="${asset.id}" class="price-currency-select">${this.currencySelectOptions('USD')}</select></div></label><div class="quick-positions-block"><div class="quick-block-title">${this.t('balances')}</div>${rows}</div></section>`;
      })
      .join('');
  }

  renderDiagnostics(): void {
    const entries = this.service.getDiagnostics();
    const container = this.element('diagnosticsList');
    container.innerHTML = entries.length
      ? entries.map((entry) => this.diagnosticEntryHtml(entry)).join('')
      : `<div class="empty-state">${this.t('noDiagnosticEvents')}</div>`;
  }

  diagnosticsText(): string {
    return this.service
      .getDiagnostics()
      .map((entry) => this.diagnosticEntryText(entry))
      .join('\n');
  }

  renderCurrencyOptions(): void {
    const items = [
      {
        code: 'USD',
        name: this.t('displayName'),
        icon: '$',
        color: '#17181b',
        price: 1,
      },
      ...this.service.data.assets.filter(({ price }) => Number(price) > 0),
    ];
    this.element('currencyOptions').innerHTML = items
      .map(
        (asset) =>
          `<button type="button" class="currency-option ${this.service.settings.displayCurrency === asset.code ? 'selected' : ''}" data-currency-code="${escapeHtml(asset.code)}"><span class="currency-option-icon ${this.iconLengthClass(asset.icon || '$')}" style="background:${asset.color || '#17181b'}">${escapeHtml(asset.icon || '$')}</span><span><strong>${escapeHtml(asset.name)}</strong><small>${escapeHtml(asset.code)}${asset.code === 'USD' ? ` · ${this.t('baseLabel')}` : ` · ${formatMoney(Number(asset.price), 'en')} / ${this.t('unitLabel')}`}</small></span><b>${this.service.settings.displayCurrency === asset.code ? '✓' : ''}</b></button>`,
      )
      .join('');
  }

  redrawChart(): void {
    drawHistoryChart(
      requiredElement('historyChart', HTMLCanvasElement, this.documentRef),
      this.element('historyEmpty'),
      this.element('chartDates'),
      this.element('historyChange'),
      this.historyData().map(({ snapshot, value }) => ({
        createdAt: snapshot.createdAt,
        value,
      })),
      {
        displayValue: (value) =>
          convertUsdToDisplay(value, this.displayAsset()),
        displayUnit: () => this.displayAsset()?.icon || '$',
        money: (value) => this.money(value),
        language: this.language,
      },
    );
  }

  refreshPositionForm(): void {
    const form = requiredElement(
      'positionForm',
      HTMLFormElement,
      this.documentRef,
    );
    formControl(form, 'accountId').innerHTML = this.service.data.accounts
      .map(
        (account) =>
          `<option value="${account.id}">${escapeHtml(account.name)}</option>`,
      )
      .join('');
    formControl(form, 'assetId').innerHTML = this.service.data.assets
      .map(
        (asset) =>
          `<option value="${asset.id}">${escapeHtml(asset.name)} · ${escapeHtml(asset.code)}</option>`,
      )
      .join('');
    const disabled =
      !this.service.data.accounts.length || !this.service.data.assets.length;
    this.element('positionPrerequisite').classList.toggle('hidden', !disabled);
    const submit = form.querySelector<HTMLButtonElement>('.sheet-primary');
    if (submit) submit.disabled = disabled;
  }

  currencySelectOptions(selected = 'USD'): string {
    const choices = [
      { code: 'USD', icon: '$' },
      ...this.service.data.assets
        .filter(({ price }) => Number(price) > 0)
        .map((asset) => ({ code: asset.code, icon: this.assetIcon(asset) })),
    ];
    return choices
      .map(
        ({ code, icon }) =>
          `<option value="${escapeHtml(code)}" ${code === selected ? 'selected' : ''}>${escapeHtml(icon)} ${escapeHtml(code)}</option>`,
      )
      .join('');
  }

  money(value: number): string {
    return formatMoney(value, this.language, this.displayAsset());
  }

  accountBy(id: string): Account | undefined {
    return this.service.data.accounts.find((account) => account.id === id);
  }

  assetBy(id: string): Asset | undefined {
    return this.service.data.assets.find((asset) => asset.id === id);
  }

  accountIcon(account?: Account): string {
    if (account?.icon) return account.icon;
    return this.accountGlyph(account?.type);
  }

  assetIcon(asset?: Asset): string {
    return asset?.icon || asset?.code || '•';
  }

  accountColor(account?: Account): string {
    return account && validColor(account.color)
      ? account.color
      : this.colorFor(account?.id || 'account');
  }

  assetColor(asset?: Asset): string {
    return asset && validColor(asset.color)
      ? asset.color
      : this.colorFor(asset?.id || 'asset');
  }

  iconLengthClass(icon: string): string {
    return `icon-len-${Math.max(1, Math.min(5, Array.from(icon).length || 1))}`;
  }

  t<Key extends MessageKey>(key: Key, ...args: MessageArguments<Key>): string {
    return translate(this.language, key, ...args);
  }

  private element(id: string): HTMLElement {
    return requiredElement(id, HTMLElement, this.documentRef);
  }

  private diagnosticEntryText(entry: DiagnosticEntry): string {
    const timestamp = new Date(entry.createdAt).toISOString();
    const context = entry.context
      ? Object.entries(entry.context)
          .map(([key, value]) => `${key}=${String(value)}`)
          .join(' · ')
      : '';
    return [
      timestamp,
      entry.level.toUpperCase(),
      `${entry.scope}.${entry.event}`,
      entry.message,
      context,
    ]
      .filter(Boolean)
      .join(' | ');
  }

  private diagnosticEntryHtml(entry: DiagnosticEntry): string {
    const text = this.diagnosticEntryText(entry);
    const [headline = '', ...details] = text.split(' | ');
    return `<article class="diagnostic-entry diagnostic-${entry.level}"><time>${escapeHtml(headline)}</time><strong>${escapeHtml(`${entry.scope}.${entry.event}`)}</strong>${entry.message ? `<p>${escapeHtml(entry.message)}</p>` : ''}${
      entry.context
        ? `<code>${escapeHtml(
            Object.entries(entry.context)
              .map(([key, value]) => `${key}=${String(value)}`)
              .join(' · '),
          )}</code>`
        : ''
    }<span class="sr-only">${escapeHtml(details.join(' | '))}</span></article>`;
  }

  private applyLanguage(): void {
    this.documentRef.documentElement.lang = this.language;
    for (const element of all<HTMLElement>('[data-i18n]', this.documentRef)) {
      const key = element.dataset.i18n;
      if (key && isMessageKey(key))
        element.textContent = translate(this.language, key);
    }
    for (const element of all<HTMLElement>(
      '[data-i18n-html]',
      this.documentRef,
    )) {
      const key = element.dataset.i18nHtml;
      if (key && isMessageKey(key))
        element.innerHTML = translate(this.language, key);
    }
    for (const element of all<HTMLInputElement>(
      '[data-i18n-placeholder]',
      this.documentRef,
    )) {
      const key = element.dataset.i18nPlaceholder;
      if (key && isMessageKey(key))
        element.placeholder = translate(this.language, key);
    }
    this.documentRef.title = this.t('appTitle');
    all<HTMLElement>('[data-lang-choice]', this.documentRef).forEach((button) =>
      button.classList.toggle(
        'active',
        button.dataset.langChoice === this.language,
      ),
    );
    const autoRefresh = requiredElement(
      'autoPriceRefresh',
      HTMLInputElement,
      this.documentRef,
    );
    autoRefresh.checked = this.service.settings.autoPriceRefresh;
    const priceInterval = requiredElement(
      'priceRefreshIntervalHours',
      HTMLSelectElement,
      this.documentRef,
    );
    priceInterval.value = String(
      this.service.settings.priceRefreshIntervalHours,
    );
    priceInterval.disabled = !this.service.settings.autoPriceRefresh;
    const autoSnapshot = requiredElement(
      'autoSnapshot',
      HTMLInputElement,
      this.documentRef,
    );
    autoSnapshot.checked = this.service.settings.autoSnapshot;
    const snapshotInterval = requiredElement(
      'snapshotIntervalHours',
      HTMLSelectElement,
      this.documentRef,
    );
    snapshotInterval.value = String(
      this.service.settings.snapshotIntervalHours,
    );
    snapshotInterval.disabled = !this.service.settings.autoSnapshot;
    const currencyButton = this.element('displayCurrencyBtn');
    currencyButton.setAttribute('aria-label', this.t('displayCurrencyAria'));
    currencyButton.setAttribute('title', this.t('displayCurrencyTitle'));
  }

  private applyTheme(): void {
    this.documentRef.documentElement.dataset.theme =
      this.service.settings.theme;
    this.documentRef.documentElement.style.colorScheme =
      this.service.settings.theme;
    all<HTMLElement>('[data-theme-choice]', this.documentRef).forEach(
      (button) =>
        button.classList.toggle(
          'active',
          button.dataset.themeChoice === this.service.settings.theme,
        ),
    );
  }

  private renderPnlSummary(): void {
    const result = this.pnl(() => true);
    const compatible = this.compatibleSnapshots();
    const reference =
      this.service.settings.pnlPeriod === 'last'
        ? compatible.at(-1)
        : compatible[0];
    this.element('homeTitle').textContent = this.money(
      portfolioTotal(this.service.data),
    );
    const moneyElement = this.element('pnlMoney');
    const percentElement = this.element('pnlPercent');
    const dateButton = this.element('pnlPeriodToggle');
    const caption = this.element('pnlModeCaption');
    if (!result || !reference) {
      moneyElement.textContent = '—';
      percentElement.textContent = '—';
      dateButton.textContent = '—';
      caption.textContent = this.t('pnlNoBaseline');
      moneyElement.className = 'pnl-money';
      percentElement.className = 'pnl-percent';
      return;
    }
    const sign = result.pnl > 0 ? '+' : result.pnl < 0 ? '−' : '';
    const style =
      result.pnl > 0 ? 'pnl-positive' : result.pnl < 0 ? 'pnl-negative' : '';
    moneyElement.textContent = `${sign}${this.money(Math.abs(result.pnl))}`;
    percentElement.textContent = `${sign}${Math.abs(result.pct || 0).toFixed(2)}%`;
    dateButton.textContent = new Intl.DateTimeFormat(locale(this.language), {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    }).format(new Date(reference.createdAt));
    caption.textContent =
      this.service.settings.pnlPeriod === 'last'
        ? this.t('pnlVsLast')
        : this.t('pnlVsFirst');
    moneyElement.className = `pnl-money ${style}`;
    percentElement.className = `pnl-percent ${style}`;
  }

  private renderAllocation(): void {
    const rows = allocationRows(this.service.data);
    const gross = rows.reduce((total, { value }) => total + Math.abs(value), 0);
    this.element('assetsCount').textContent = this.t(
      'assetsCount',
      rows.length,
    );
    if (!rows.length || gross === 0) {
      this.element('allocationBar').innerHTML = '';
      this.element('allocationList').innerHTML =
        `<div class="empty-state">${this.t('emptyAllocation')}</div>`;
      return;
    }
    this.element('allocationBar').innerHTML = rows
      .map(
        ({ asset, value }) =>
          `<span class="allocation-segment" style="width:${(Math.abs(value) / gross) * 100}%;background:${this.assetColor(asset)}"></span>`,
      )
      .join('');
    this.element('allocationList').innerHTML = rows
      .slice(0, this.ui.allocationExpanded ? undefined : 3)
      .map(({ asset, value, quantity }) => {
        const pnl = this.pnl((position) => position.assetId === asset.id);
        return `<div class="allocation-row"><span class="asset-badge ${this.iconLengthClass(this.assetIcon(asset))}" style="background:${this.assetColor(asset)}">${escapeHtml(this.assetIcon(asset))}</span><div class="allocation-meta"><strong>${escapeHtml(asset.name)}</strong><small>${escapeHtml(asset.code)} · ${formatNumber(quantity, this.language)} · ${((Math.abs(value) / gross) * 100).toFixed(1)}%</small></div><div class="allocation-value"><strong>${this.money(value)}</strong><small>${this.money(asset.price)} / ${this.t('unitShort')}</small><small class="pnl-inline ${this.pnlClass(pnl)}">${this.pnlPercent(pnl)}</small></div></div>`;
      })
      .join('');
    const toggle = this.element('allocationToggle');
    toggle.classList.toggle('hidden', rows.length <= 3);
    toggle.textContent = this.ui.allocationExpanded
      ? this.t('showLess')
      : this.t('showMore', rows.length - 3);
    toggle.setAttribute('aria-expanded', String(this.ui.allocationExpanded));
  }

  private renderAccounts(): void {
    const list = this.element('accountsList');
    list.classList.toggle('hidden', !this.ui.accountsSectionExpanded);
    const toggle = this.element('accountsSectionToggle');
    toggle.setAttribute(
      'aria-expanded',
      String(this.ui.accountsSectionExpanded),
    );
    this.element('accountsSectionMeta').textContent =
      `${this.service.data.accounts.length} · ${this.money(portfolioTotal({ ...this.service.data, positions: this.service.data.positions }))}`;
    if (!this.service.data.accounts.length) {
      list.innerHTML = `<div class="empty-state">${this.t('emptyAccounts')}</div>`;
      return;
    }
    list.innerHTML = this.service.data.accounts
      .map((account) => {
        const open = this.ui.expandedAccounts.has(account.id);
        const positions = this.service.data.positions.filter(
          ({ accountId }) => accountId === account.id,
        );
        const details = positions.length
          ? positions
              .map((position) => {
                const asset = this.assetBy(position.assetId);
                const comment = position.comment
                  ? `<span class="account-position-comment">• ${escapeHtml(position.comment)}</span>`
                  : '';
                return `<div class="account-asset-row"><span class="mini-asset-icon ${this.iconLengthClass(this.assetIcon(asset))}" style="background:${this.assetColor(asset)}">${escapeHtml(this.assetIcon(asset))}</span><div><div class="account-position-title"><strong>${escapeHtml(asset?.code || asset?.name || this.t('asset'))}</strong>${comment}</div><small>${escapeHtml(asset?.name || '')} · ${formatNumber(position.quantity, this.language)} ${this.t('unitShort')}</small></div><b>${this.money(positionValue(position, this.service.data.assets))}</b></div>`;
              })
              .join('')
          : `<div class="account-empty">${this.t('emptyAccount')}</div>`;
        const pnl = this.pnl((position) => position.accountId === account.id);
        return `<div class="account-expand-card ${open ? 'expanded' : ''}"><div class="list-card account-toggle" data-account-toggle="${account.id}"><div class="list-icon ${this.iconLengthClass(this.accountIcon(account))}" style="background:${this.accountColor(account)};color:#fff">${escapeHtml(this.accountIcon(account))}</div><div class="list-main"><strong>${escapeHtml(account.name)}</strong><small>${escapeHtml(this.accountTypeLabel(account.type))} · ${positions.length} ${this.t('positionsShort')}</small></div><div class="list-value"><strong>${this.money(accountTotal(account.id, this.service.data))}</strong><small class="pnl-inline ${this.pnlClass(pnl)}">${this.pnlPercent(pnl)}</small></div><button class="menu-button" data-account-menu="${account.id}" aria-label="${this.t('actions')}">···</button></div><div class="account-assets ${open ? '' : 'hidden'}">${details}</div></div>`;
      })
      .join('');
  }

  private renderAssets(): void {
    const list = this.element('assetsList');
    list.classList.toggle('hidden', !this.ui.assetsSectionExpanded);
    const toggle = this.element('assetsSectionToggle');
    toggle.setAttribute('aria-expanded', String(this.ui.assetsSectionExpanded));
    this.element('assetsSectionMeta').textContent =
      `${this.service.data.assets.length} · ${this.money(portfolioTotal(this.service.data))}`;
    if (!this.service.data.assets.length) {
      list.innerHTML = `<div class="empty-state">${this.t('emptyAssets')}</div>`;
      return;
    }
    list.innerHTML = this.service.data.assets
      .map((asset) => {
        const open = this.ui.expandedAssets.has(asset.id);
        const positions = this.service.data.positions.filter(
          ({ assetId }) => assetId === asset.id,
        );
        const details = positions.length
          ? positions
              .map((position) => {
                const account = this.accountBy(position.accountId);
                const comment = position.comment
                  ? `<small class="asset-position-comment">• ${escapeHtml(position.comment)}</small>`
                  : '';
                return `<div class="account-asset-row"><span class="mini-asset-icon ${this.iconLengthClass(this.accountIcon(account))}" style="background:${this.accountColor(account)}">${escapeHtml(this.accountIcon(account))}</span><div><strong>${escapeHtml(account?.name || this.t('account'))}</strong><small>${formatNumber(position.quantity, this.language)} ${escapeHtml(asset.code)}</small>${comment}</div><b>${this.money(positionValue(position, this.service.data.assets))}</b></div>`;
              })
              .join('')
          : `<div class="account-empty">${this.t('emptyAsset')}</div>`;
        const pnl = this.pnl((position) => position.assetId === asset.id);
        const source =
          asset.autoUpdateSource === 'none'
            ? this.t('autoSourceNone')
            : `${this.t('autoSourceLabel')}: ${asset.autoUpdateSource === 'coingecko' ? this.t('autoSourceCoinGecko') : this.t('autoSourceFrankfurter')} · ${formatRelativeTime(asset.priceUpdatedAt, Date.now(), this.language)}`;
        return `<div class="account-expand-card ${open ? 'expanded' : ''}"><div class="list-card asset-toggle" data-asset-toggle="${asset.id}"><div class="list-icon ${this.iconLengthClass(this.assetIcon(asset))}" style="background:${this.assetColor(asset)};color:#fff">${escapeHtml(this.assetIcon(asset))}</div><div class="list-main"><strong>${escapeHtml(asset.name)}</strong><small>${escapeHtml(asset.code)} · ${formatNumber(assetQuantity(asset.id, this.service.data.positions), this.language)} ${this.t('unitShort')} · ${this.money(asset.price)} / ${this.t('unitShort')}<br><span class="asset-updated-time">${source}</span></small></div><div class="list-value"><strong>${this.money(this.assetTotal(asset.id))}</strong><small class="pnl-inline ${this.pnlClass(pnl)}">${this.pnlPercent(pnl)}</small></div><button class="menu-button" data-asset-menu="${asset.id}" aria-label="${this.t('actions')}">···</button></div><div class="account-assets ${open ? '' : 'hidden'}">${details}</div></div>`;
      })
      .join('');
  }

  private renderPositions(): void {
    all<HTMLElement>('[data-grouping]', this.documentRef).forEach((button) => {
      const active =
        button.dataset.grouping === this.service.settings.positionGrouping;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    const list = this.element('positionsList');
    if (!this.service.data.positions.length) {
      list.innerHTML = `<div class="empty-state">${this.t('emptyPositions')}</div>`;
      return;
    }
    list.innerHTML = buildPositionGroups(
      this.service.data,
      this.service.settings.positionGrouping,
    )
      .map((group) => {
        const collapsed = this.ui.collapsedPositionGroups.has(group.id);
        const identity = group.account ?? group.asset;
        const icon = group.account
          ? this.accountIcon(group.account)
          : this.assetIcon(group.asset);
        const color = group.account
          ? this.accountColor(group.account)
          : this.assetColor(group.asset);
        const rows = group.positions
          .map((position) => {
            const asset = this.assetBy(position.assetId);
            const account = this.accountBy(position.accountId);
            const comment = position.comment
              ? `<span class="position-comment">• ${escapeHtml(position.comment)}</span>`
              : '';
            const pnl = this.pnl((record) => record.positionId === position.id);
            return `<div class="list-card"><div class="list-icon ${this.iconLengthClass(this.assetIcon(asset))}" style="background:${this.assetColor(asset)};color:#fff">${escapeHtml(this.assetIcon(asset))}</div><div class="list-main"><div class="position-title-line"><strong>${escapeHtml(asset?.code || asset?.name || this.t('asset'))}</strong>${comment}</div><small>${escapeHtml(account?.name || this.t('deletedAccount'))} · ${formatNumber(position.quantity, this.language)} ${this.t('unitShort')} · ${escapeHtml(asset?.name || '')}</small></div><div class="list-value"><strong>${this.money(positionValue(position, this.service.data.assets))}</strong><small>${asset ? this.money(asset.price) : '—'} / ${this.t('unitShort')}</small><small class="pnl-inline ${this.pnlClass(pnl)}">${this.pnlPercent(pnl)}</small></div><button class="menu-button" data-position-menu="${position.id}" aria-label="${this.t('actions')}">···</button></div>`;
          })
          .join('');
        return `<section class="position-group"><button class="position-group-head" data-position-group="${group.id}" aria-expanded="${String(!collapsed)}"><span class="list-icon ${this.iconLengthClass(icon)}" style="background:${color};color:#fff">${escapeHtml(icon)}</span><span><strong>${escapeHtml(identity?.name || '')}</strong><small>${group.positions.length} ${this.t('positionsShort')}</small></span><b>${this.money(group.total)}</b><i>⌄</i></button><div class="position-group-rows ${collapsed ? 'hidden' : ''}">${rows}</div></section>`;
      })
      .join('');
  }

  private refreshHistoryScope(): void {
    const select = requiredElement(
      'historyScope',
      HTMLSelectElement,
      this.documentRef,
    );
    const options = new Map<string, string>();
    for (const position of this.service.data.positions) {
      options.set(position.id, this.positionLabel(position));
    }
    for (const snapshot of this.service.data.snapshots) {
      for (const position of snapshot.positions ?? []) {
        if (!options.has(position.positionId)) {
          options.set(
            position.positionId,
            `${position.accountName || this.t('account')} · ${position.assetCode || this.t('asset')}${position.comment ? ` · ${position.comment}` : ''}`,
          );
        }
      }
    }
    select.innerHTML = `<option value="portfolio">${this.t('wholePortfolio')}</option>${[
      ...options,
    ]
      .sort((left, right) =>
        left[1].localeCompare(right[1], locale(this.language)),
      )
      .map(
        ([positionId, label]) =>
          `<option value="position:${positionId}">${escapeHtml(label)}</option>`,
      )
      .join('')}`;
    if (
      [...select.options].some(({ value }) => value === this.ui.historyScope)
    ) {
      select.value = this.ui.historyScope;
    } else {
      this.ui.historyScope = 'portfolio';
      select.value = 'portfolio';
    }
  }

  private renderHistory(): void {
    const data = this.historyData();
    const isPosition = this.ui.historyScope !== 'portfolio';
    this.element('historyRangeLabel').textContent = this.currentHistoryLabel();
    const list = this.element('historyList');
    if (!data.length) {
      list.innerHTML = `<div class="empty-state">${isPosition ? this.t('positionHistoryEmpty') : this.t('portfolioHistoryEmpty')}</div>`;
    } else {
      list.innerHTML = [...data]
        .reverse()
        .map((item) => {
          const index = data.findIndex(
            ({ snapshot }) => snapshot.id === item.snapshot.id,
          );
          const previous = data[index - 1];
          const difference = previous ? item.value - previous.value : null;
          return `<div class="list-card"><span class="history-dot"></span><div class="list-main"><strong>${formatDate(item.snapshot.createdAt, this.language)}</strong><small>${formatTime(item.snapshot.createdAt, this.language)}${difference === null ? ` · ${this.t('firstSnapshot')}` : ` · ${difference >= 0 ? '+' : '−'}${this.money(Math.abs(difference))}`}</small></div><div class="list-value"><strong>${this.money(item.value)}</strong></div><button class="menu-button" data-snapshot-menu="${item.snapshot.id}" aria-label="${this.t('actions')}">···</button></div>`;
        })
        .join('');
    }
    this.redrawChart();
  }

  private renderCurrencyButton(): void {
    const asset = this.displayAsset();
    this.element('displayCurrencyIcon').textContent = asset
      ? this.assetIcon(asset)
      : '$';
    this.element('displayCurrencyCode').textContent = asset?.code || 'USD';
  }

  private syncDisplayCurrency(): void {
    const code = this.service.settings.displayCurrency;
    if (
      code !== 'USD' &&
      !this.service.data.assets.some(
        (asset) => asset.code === code && Number(asset.price) > 0,
      )
    ) {
      this.service.saveSettings({ displayCurrency: 'USD' });
    }
  }

  private displayAsset(): Asset | undefined {
    const code = this.service.settings.displayCurrency;
    return code === 'USD'
      ? undefined
      : this.service.data.assets.find((asset) => asset.code === code);
  }

  private assetTotal(id: string): number {
    return assetTotal(id, this.service.data);
  }

  private positionLabel(position: Position): string {
    const asset = this.assetBy(position.assetId);
    const account = this.accountBy(position.accountId);
    return `${account?.name || this.t('account')} · ${asset?.code || this.t('asset')}${position.comment ? ` · ${position.comment}` : ''}`;
  }

  private historyData(): HistoryItem[] {
    if (this.ui.historyScope === 'portfolio') {
      return this.service.data.snapshots.map((snapshot) => ({
        snapshot,
        value: Number(snapshot.total) || 0,
      }));
    }
    const positionId = this.ui.historyScope.slice('position:'.length);
    return this.service.data.snapshots.flatMap((snapshot) => {
      const record = snapshot.positions?.find(
        (position) => position.positionId === positionId,
      );
      return record
        ? [{ snapshot, value: Number(record.value) || 0, record }]
        : [];
    });
  }

  private currentHistoryLabel(): string {
    if (this.ui.historyScope === 'portfolio') return this.t('wholePortfolio');
    const positionId = this.ui.historyScope.slice('position:'.length);
    const current = this.service.data.positions.find(
      (position) => position.id === positionId,
    );
    if (current) return this.positionLabel(current);
    for (const snapshot of this.service.data.snapshots) {
      const record = snapshot.positions?.find(
        (position) => position.positionId === positionId,
      );
      if (record) {
        return `${record.accountName || this.t('account')} · ${record.assetCode || this.t('asset')}${record.comment ? ` · ${record.comment}` : ''}`;
      }
    }
    return this.t('positionHistory');
  }

  private currentPnlPoint(): PnlPoint {
    return {
      createdAt: Date.now(),
      positions: this.service.data.positions.map((position) => {
        const asset = this.assetBy(position.assetId);
        const account = this.accountBy(position.accountId);
        const price = Number(asset?.price) || 0;
        const quantity = Number(position.quantity) || 0;
        return {
          positionId: position.id,
          accountId: position.accountId,
          accountName: account?.name || '',
          assetId: position.assetId,
          assetCode: asset?.code || '',
          assetName: asset?.name || '',
          comment: position.comment,
          quantity,
          price,
          value: quantity * price,
        };
      }),
      assets: this.service.data.assets.map((asset) => ({
        assetId: asset.id,
        price: Number(asset.price) || 0,
      })),
    };
  }

  private compatibleSnapshots(): PnlPoint[] {
    return this.service.data.snapshots.flatMap((snapshot) =>
      snapshot.positions
        ? [
            {
              createdAt: snapshot.createdAt,
              positions: snapshot.positions,
              assets: (snapshot.assets ?? []).map((asset) => ({
                assetId: asset.assetId,
                price: Number(asset.price) || 0,
              })),
            },
          ]
        : [],
    );
  }

  private pnl(
    include: (position: SnapshotPosition) => boolean,
  ): PnlResult | null {
    const points = selectPnlSeries(
      this.compatibleSnapshots(),
      this.currentPnlPoint(),
      this.service.settings.pnlPeriod,
    );
    return flowAdjustedPnl(points, include);
  }

  private pnlPercent(result: PnlResult | null): string {
    if (!result || result.pct === null) return '—';
    const sign = result.pct > 0 ? '+' : result.pct < 0 ? '−' : '';
    return `${sign}${Math.abs(result.pct).toFixed(1)}%`;
  }

  private pnlClass(result: PnlResult | null): string {
    return !result || result.pnl === 0
      ? ''
      : result.pnl > 0
        ? 'pnl-positive'
        : 'pnl-negative';
  }

  private accountTypeKey(value = ''): AccountTypeKey {
    const type = value.toLowerCase();
    if (type.includes('банк') || type === 'bank') return 'bank';
    if (type.includes('бирж') || type === 'exchange') return 'exchange';
    if (type.includes('долг') || type === 'debt') return 'debt';
    if (type.includes('крипто') || type === 'crypto wallet')
      return 'cryptoWallet';
    if (type.includes('налич') || type === 'cash') return 'cash';
    return 'other';
  }

  private accountTypeLabel(value: string): string {
    return this.t(this.accountTypeKey(value));
  }

  private accountGlyph(value = ''): string {
    const type = this.accountTypeKey(value);
    if (type === 'bank') return '▥';
    if (type === 'exchange') return '↗';
    if (type === 'debt') return '↔';
    if (type === 'cryptoWallet') return '◇';
    if (type === 'cash') return '$';
    return '•';
  }

  private colorFor(id: string): string {
    let seed = 0;
    for (const character of id)
      seed = (seed + character.charCodeAt(0)) % palette.length;
    return palette[seed] ?? palette[0]!;
  }
}

type AccountTypeKey =
  'cash' | 'bank' | 'exchange' | 'cryptoWallet' | 'debt' | 'other';

export type { HistoryDatum };
