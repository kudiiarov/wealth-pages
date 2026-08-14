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
import { assetTotal, portfolioTotal } from '../domain/portfolio';
import {
  flowAdjustedPnl,
  selectPnlSeriesSince,
  type PnlPoint,
  type PnlResult,
} from '../domain/pnl';
import {
  convertUsdToDisplay,
  formatDate,
  formatExactMoney,
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
import {
  drawHistoryChart,
  nearestChartPointIndex,
  type ChartGeometry,
  type HistoryDatum,
} from './chart';
import { all, escapeHtml, requiredElement } from './dom';
import { formControl } from './forms';
import {
  accountOverviewRows,
  assetMatchesPortfolioFilter,
  assetOverviewRows,
  categoryAllocationRows,
  inferAssetProfile,
  portfolioDrivers,
  portfolioExposures,
  portfolioTags,
  priceFreshness,
  type PortfolioFilter,
} from './portfolio-view-model';
import { drawPortfolioSparkline } from './chart';

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
  homePeriod: '1d' | '1w' | '1m' | '1y' | 'all';
  portfolioMode: 'assets' | 'accounts';
  portfolioFilter: PortfolioFilter;
  portfolioQuery: string;
  expandedPortfolioRows: Set<string>;
}

interface HistoryItem {
  snapshot: Snapshot;
  value: number;
  record?: SnapshotPosition;
}

export class WorthRenderer {
  private homeChartGeometry: ChartGeometry | undefined;
  private historyChartGeometry: ChartGeometry | undefined;
  private homeChartSelection: number | undefined;
  private historyChartSelection: number | undefined;
  readonly ui: UiState = {
    historyScope: 'portfolio',
    homePeriod: 'all',
    portfolioMode: 'assets',
    portfolioFilter: { kind: 'all' },
    portfolioQuery: '',
    expandedPortfolioRows: new Set(),
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
    this.renderPrivacyToggle();
    this.renderHomeDashboard();
    this.renderPortfolioExplorer();
    this.refreshHistoryScope();
    this.renderHistory();
    this.refreshPositionForm();
    this.refreshAssetTaxonomyForms();
  }

  prepareAssetTaxonomyForm(form: HTMLFormElement, asset?: Asset): void {
    const container = form.querySelector<HTMLElement>('[data-asset-taxonomy]');
    if (!container) return;
    const defaultCategories = [
      'cash-currencies',
      'crypto',
      'precious-metals',
      'other',
    ];
    const categories = Array.from(
      new Set([
        ...defaultCategories,
        ...this.service.data.assets.flatMap((item) =>
          item.category ? [item.category] : [],
        ),
      ]),
    );
    const selectedCategory = asset?.category ?? '';
    const selectedTags = new Set(asset?.tags ?? []);
    const tags = Array.from(
      new Set([
        'crypto',
        'currency',
        'gold',
        'stablecoin',
        ...portfolioTags(this.service.data),
      ]),
    );
    container.innerHTML = `<label class="field"><span>${escapeHtml(this.t('category'))}</span><select name="category" required><option value="">${escapeHtml(this.t('chooseCategory'))}</option>${categories.map((category) => `<option value="value:${escapeHtml(category)}" ${category === selectedCategory ? 'selected' : ''}>${escapeHtml(this.categoryLabel(category))}</option>`).join('')}<option value="new">${escapeHtml(this.t('newCategory'))}</option></select></label><label class="field custom-category-field hidden"><span>${escapeHtml(this.t('categoryName'))}</span><input autocomplete="off" maxlength="40" name="customCategory" placeholder="${escapeHtml(this.t('categoryExample'))}"></label><fieldset class="taxonomy-tags"><legend>${escapeHtml(this.t('tags'))}</legend><p>${escapeHtml(this.t('tagsHint'))}</p><div class="taxonomy-tag-list">${tags.map((tag) => `<label class="taxonomy-tag"><input type="checkbox" name="tags" value="${escapeHtml(tag)}" ${selectedTags.has(tag) ? 'checked' : ''}><span>${escapeHtml(this.tagLabel(tag))}</span></label>`).join('')}</div><label class="field"><span>${escapeHtml(this.t('customTags'))}</span><input autocomplete="off" maxlength="120" name="customTags" placeholder="${escapeHtml(this.t('tagsExample'))}"></label></fieldset>`;
  }

  private refreshAssetTaxonomyForms(): void {
    this.prepareAssetTaxonomyForm(
      requiredElement('assetForm', HTMLFormElement, this.documentRef),
    );
    this.prepareAssetTaxonomyForm(
      requiredElement('assetEditForm', HTMLFormElement, this.documentRef),
    );
  }

  redrawHomeChart(): void {
    const series = this.homeSeries();
    const canvas = requiredElement(
      'homeChart',
      HTMLCanvasElement,
      this.documentRef,
    );
    canvas.classList.toggle('empty', series.length < 2);
    this.homeChartGeometry = drawPortfolioSparkline(
      canvas,
      series,
      this.homeChartSelection,
    );
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
    this.historyChartGeometry = drawHistoryChart(
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
      this.historyChartSelection,
    );
  }

  inspectChart(kind: 'home' | 'history', clientX: number): void {
    const canvas = requiredElement(
      kind === 'home' ? 'homeChart' : 'historyChart',
      HTMLCanvasElement,
      this.documentRef,
    );
    const geometry =
      kind === 'home' ? this.homeChartGeometry : this.historyChartGeometry;
    if (!geometry) return;
    const index = nearestChartPointIndex(
      geometry.points,
      clientX - canvas.getBoundingClientRect().left,
    );
    if (index === undefined) return;
    this.showChartPoint(kind, index);
  }

  moveChartInspection(kind: 'home' | 'history', delta: -1 | 1): void {
    const geometry =
      kind === 'home' ? this.homeChartGeometry : this.historyChartGeometry;
    if (!geometry?.points.length) return;
    const current =
      kind === 'home' ? this.homeChartSelection : this.historyChartSelection;
    this.showChartPoint(
      kind,
      Math.min(
        Math.max((current ?? geometry.points.length - 1) + delta, 0),
        geometry.points.length - 1,
      ),
    );
  }

  selectLastChartPoint(kind: 'home' | 'history'): void {
    const geometry =
      kind === 'home' ? this.homeChartGeometry : this.historyChartGeometry;
    if (!geometry?.points.length) return;
    this.showChartPoint(kind, geometry.points.length - 1);
  }

  private showChartPoint(kind: 'home' | 'history', index: number): void {
    const canvas = requiredElement(
      kind === 'home' ? 'homeChart' : 'historyChart',
      HTMLCanvasElement,
      this.documentRef,
    );
    if (kind === 'home') {
      this.homeChartSelection = index;
      this.redrawHomeChart();
    } else {
      this.historyChartSelection = index;
      this.redrawChart();
    }
    const currentGeometry =
      kind === 'home' ? this.homeChartGeometry : this.historyChartGeometry;
    const datum = currentGeometry?.data[index];
    const point = currentGeometry?.points[index];
    if (!datum || !point) return;
    const tooltip = this.element(
      kind === 'home' ? 'homeChartTooltip' : 'historyChartTooltip',
    );
    const exactValue = this.service.settings.balancesHidden
      ? '••••'
      : formatExactMoney(datum.value, this.language, this.displayAsset());
    tooltip.innerHTML = `<strong>${escapeHtml(exactValue)}</strong><small>${escapeHtml(formatDate(datum.createdAt, this.language))} · ${escapeHtml(formatTime(datum.createdAt, this.language))}</small>`;
    tooltip.style.left = `${Math.min(Math.max(point.x, 58), Math.max(58, canvas.clientWidth - 58))}px`;
    tooltip.classList.remove('hidden');
  }

  clearChartInspection(kind: 'home' | 'history'): void {
    if (kind === 'home') {
      this.homeChartSelection = undefined;
      this.redrawHomeChart();
    } else {
      this.historyChartSelection = undefined;
      this.redrawChart();
    }
    this.element(
      kind === 'home' ? 'homeChartTooltip' : 'historyChartTooltip',
    ).classList.add('hidden');
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
    if (this.service.settings.balancesHidden) return '••••';
    return formatMoney(value, this.language, this.displayAsset());
  }

  private renderPrivacyToggle(): void {
    const button = this.element('privacyToggle');
    const hidden = this.service.settings.balancesHidden;
    const label = this.t(hidden ? 'showBalances' : 'hideBalances');
    button.setAttribute('aria-pressed', String(hidden));
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
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
    for (const select of [priceInterval, snapshotInterval]) {
      for (const option of select.options) {
        option.textContent = this.t('hoursLabel', Number(option.value));
      }
    }
    const currencyButton = this.element('displayCurrencyBtn');
    currencyButton.setAttribute('aria-label', this.t('displayCurrencyAria'));
    currencyButton.setAttribute('title', this.t('displayCurrencyTitle'));
    this.element('homePeriods').setAttribute(
      'aria-label',
      this.t('performancePeriod'),
    );
    this.element('homeChart').setAttribute(
      'aria-label',
      `${this.t('portfolioTrend')}. ${this.t('chartInspectionHelp')}`,
    );
    this.element('historyChart').setAttribute(
      'aria-label',
      `${this.t('history')}. ${this.t('chartInspectionHelp')}`,
    );
    this.element('portfolioAdd').setAttribute(
      'aria-label',
      this.t('addPortfolioItem'),
    );
    this.element('portfolioSegment').setAttribute(
      'aria-label',
      this.t('portfolioViewMode'),
    );
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

  private renderHomeDashboard(): void {
    all<HTMLElement>('[data-home-period]', this.documentRef).forEach(
      (button) => {
        const active = button.dataset.homePeriod === this.ui.homePeriod;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      },
    );
    const result = this.homePnl(() => true);
    this.element('homeTitle').textContent = this.money(
      portfolioTotal(this.service.data),
    );
    const moneyElement = this.element('pnlMoney');
    const percentElement = this.element('pnlPercent');
    const sign =
      result?.pnl && result.pnl > 0
        ? '+'
        : result?.pnl && result.pnl < 0
          ? '−'
          : '';
    const style =
      result?.pnl && result.pnl > 0
        ? 'pnl-positive'
        : result?.pnl && result.pnl < 0
          ? 'pnl-negative'
          : '';
    moneyElement.textContent = result
      ? this.service.settings.balancesHidden
        ? this.money(Math.abs(result.pnl))
        : `${sign}${this.money(Math.abs(result.pnl))}`
      : '—';
    percentElement.textContent = result
      ? `${sign}${Math.abs(result.pct || 0).toFixed(2)}%`
      : '—';
    moneyElement.className = `pnl-money ${style}`;
    percentElement.className = `pnl-percent ${style}`;

    const drivers = portfolioDrivers(
      this.service.data,
      this.homePnlSeries(),
    ).slice(0, 3);
    this.element('portfolioDrivers').innerHTML = drivers.length
      ? drivers
          .map(({ assetId, code, value }) => {
            const asset = this.assetBy(assetId);
            const direction = value > 0 ? 'positive' : 'negative';
            const valueSign = value > 0 ? '+' : value < 0 ? '−' : '';
            return `<button class="driver-row" data-nav="positionsView" data-driver-filter="${escapeHtml(code)}" type="button"><span class="driver-icon ${this.iconLengthClass(this.assetIcon(asset))}" style="background:${this.assetColor(asset)}">${escapeHtml(this.assetIcon(asset))}</span><strong>${escapeHtml(code)}</strong><b class="${direction}">${valueSign}${this.money(Math.abs(value))}</b><i aria-hidden="true">${value >= 0 ? '↗' : '↘'}</i></button>`;
          })
          .join('')
      : `<div class="empty-state compact-empty">${this.t('pnlNoBaseline')}</div>`;

    const categories = categoryAllocationRows(this.service.data);
    this.element('categoryAllocationBar').innerHTML = categories
      .map(
        ({ category, percentage }) =>
          `<span class="allocation-segment" style="width:${percentage}%;background:${this.categoryColor(category)}"></span>`,
      )
      .join('');
    this.element('categoryAllocationList').innerHTML = categories.length
      ? categories
          .map(
            ({ category, percentage }) =>
              `<button class="category-row" data-nav="positionsView" data-category-filter="${escapeHtml(category)}" type="button"><span style="background:${this.categoryColor(category)}"></span><strong>${escapeHtml(this.categoryLabel(category))}</strong><b>${percentage.toFixed(0)}%</b></button>`,
          )
          .join('')
      : `<div class="empty-state compact-empty">${this.t('emptyAllocation')}</div>`;

    const exposures = portfolioExposures(this.service.data).slice(0, 6);
    this.element('exposureList').innerHTML = exposures.length
      ? exposures
          .map(
            ({ tag, percentage }) =>
              `<button class="exposure-chip" data-nav="positionsView" data-exposure-filter="${escapeHtml(tag)}" type="button"><span>${escapeHtml(this.tagLabel(tag))}</span><b>${percentage.toFixed(0)}%</b></button>`,
          )
          .join('')
      : `<span class="muted-inline">${this.t('noExposures')}</span>`;

    const freshness = priceFreshness(
      this.service.data,
      Date.now(),
      this.service.settings.priceRefreshIntervalHours * 60 * 60 * 1000,
    );
    const trust = this.element('priceTrust');
    trust.classList.toggle(
      'warning',
      freshness.tracked > 0 && freshness.current < freshness.tracked,
    );
    this.element('priceTrustText').textContent =
      freshness.tracked > 0 && freshness.current < freshness.tracked
        ? this.t('pricesCurrent', freshness.current, freshness.tracked)
        : freshness.latestUpdateAt
          ? this.t(
              'pricesUpdatedAgo',
              formatRelativeTime(
                freshness.latestUpdateAt,
                Date.now(),
                this.language,
              ),
            )
          : this.t('pricesNotTracked');
    this.redrawHomeChart();
  }

  renderPortfolioExplorer(): void {
    const filters = this.element('portfolioFilters');
    const tags = portfolioTags(this.service.data);
    filters.innerHTML = `<button data-portfolio-filter="all" type="button">${escapeHtml(this.t('all'))}</button>${tags.map((tag) => `<button data-portfolio-filter="tag:${escapeHtml(tag)}" type="button">${escapeHtml(this.tagLabel(tag))}</button>`).join('')}`;
    all<HTMLElement>('[data-portfolio-mode]', this.documentRef).forEach(
      (button) => {
        const active = button.dataset.portfolioMode === this.ui.portfolioMode;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      },
    );
    all<HTMLElement>('[data-portfolio-filter]', this.documentRef).forEach(
      (button) => {
        const key = button.dataset.portfolioFilter;
        const active =
          (key === 'all' && this.ui.portfolioFilter.kind === 'all') ||
          (key?.startsWith('tag:') === true &&
            this.ui.portfolioFilter.kind === 'tag' &&
            key.slice(4).toLocaleLowerCase() ===
              this.ui.portfolioFilter.value.toLocaleLowerCase());
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      },
    );
    filters.classList.toggle('hidden', this.ui.portfolioMode === 'accounts');
    const search = requiredElement(
      'portfolioSearch',
      HTMLInputElement,
      this.documentRef,
    );
    search.placeholder = this.t(
      this.ui.portfolioMode === 'assets' ? 'searchAssets' : 'searchAccounts',
    );
    const list = this.element('positionsList');
    const query = this.ui.portfolioQuery
      .trim()
      .toLocaleLowerCase(locale(this.language));
    const freshness = priceFreshness(
      this.service.data,
      Date.now(),
      this.service.settings.priceRefreshIntervalHours * 60 * 60 * 1000,
    );
    this.element('portfolioFreshness').textContent =
      freshness.tracked > 0 && freshness.current < freshness.tracked
        ? this.t('pricesCurrent', freshness.current, freshness.tracked)
        : freshness.latestUpdateAt
          ? this.t(
              'updatedAgo',
              formatRelativeTime(
                freshness.latestUpdateAt,
                Date.now(),
                this.language,
              ),
            )
          : this.t('pricesNotTracked');

    if (this.ui.portfolioMode === 'accounts') {
      const rows = accountOverviewRows(this.service.data).filter(
        ({ account }) =>
          !query ||
          account.name.toLocaleLowerCase(locale(this.language)).includes(query),
      );
      this.element('portfolioSummary').textContent =
        `${rows.length} ${this.t('accounts').toLocaleLowerCase(locale(this.language))} · ${this.money(portfolioTotal(this.service.data))}`;
      list.innerHTML = rows.length
        ? rows
            .map(({ account, value }) => {
              const positions = this.service.data.positions.filter(
                ({ accountId }) => accountId === account.id,
              );
              const expanded = this.ui.expandedPortfolioRows.has(
                `account:${account.id}`,
              );
              const pnl = this.homePnl(
                (position) => position.accountId === account.id,
              );
              const details = positions
                .map((position) => {
                  const asset = this.assetBy(position.assetId);
                  return `<button class="portfolio-position-row" data-position-menu="${position.id}" type="button"><span class="portfolio-position-icon ${this.iconLengthClass(this.assetIcon(asset))}" style="background:${this.assetColor(asset)}">${escapeHtml(this.assetIcon(asset))}</span><span><strong>${escapeHtml(asset?.name || this.t('asset'))}</strong><small>${formatNumber(position.quantity, this.language)} ${escapeHtml(asset?.code || '')}</small></span><i>›</i></button>`;
                })
                .join('');
              return `<section class="portfolio-explorer-group ${expanded ? 'expanded' : ''}"><button class="portfolio-row" data-portfolio-expand="account:${account.id}" aria-expanded="${String(expanded)}" type="button"><span class="portfolio-row-icon ${this.iconLengthClass(this.accountIcon(account))}" style="background:${this.accountColor(account)}">${escapeHtml(this.accountIcon(account))}</span><span class="portfolio-row-main"><strong>${escapeHtml(account.name)}</strong><small>${escapeHtml(this.accountTypeLabel(account.type))} · ${positions.length} ${this.t('positionsShort')}</small></span><span class="portfolio-row-value"><strong>${this.money(value)}</strong><small class="${this.pnlClass(pnl)}">${this.pnlPercent(pnl)}</small></span><i>⌄</i></button><div class="portfolio-position-list ${expanded ? '' : 'hidden'}">${details || `<div class="account-empty">${this.t('emptyAccount')}</div>`}<button class="portfolio-manage" data-account-menu="${account.id}" type="button">${this.t('manageAccount')}</button></div></section>`;
            })
            .join('')
        : `<div class="empty-state">${this.t('emptyAccounts')}</div>`;
      return;
    }

    const rows = assetOverviewRows(this.service.data).filter(({ asset }) => {
      const matchesQuery =
        !query ||
        asset.name.toLocaleLowerCase(locale(this.language)).includes(query) ||
        asset.code.toLocaleLowerCase(locale(this.language)).includes(query);
      return (
        matchesQuery &&
        assetMatchesPortfolioFilter(asset, this.ui.portfolioFilter)
      );
    });
    this.element('portfolioSummary').textContent =
      `${rows.length} ${this.t('assets').toLocaleLowerCase(locale(this.language))} · ${this.money(portfolioTotal(this.service.data))}`;
    const gross = assetOverviewRows(this.service.data).reduce(
      (sum, { value }) => sum + Math.abs(value),
      0,
    );
    list.innerHTML = rows.length
      ? rows
          .map(({ asset, value }) => {
            const positions = this.service.data.positions.filter(
              ({ assetId }) => assetId === asset.id,
            );
            const expanded = this.ui.expandedPortfolioRows.has(
              `asset:${asset.id}`,
            );
            const pnl = this.homePnl(
              (position) => position.assetId === asset.id,
            );
            const allocation = gross ? (Math.abs(value) / gross) * 100 : 0;
            const stale = freshness.staleAssetIds.includes(asset.id);
            const details = positions
              .map((position) => {
                const account = this.accountBy(position.accountId);
                return `<button class="portfolio-position-row" data-position-menu="${position.id}" type="button"><span class="portfolio-position-icon ${this.iconLengthClass(this.accountIcon(account))}" style="background:${this.accountColor(account)}">${escapeHtml(this.accountIcon(account))}</span><span><strong>${escapeHtml(account?.name || this.t('deletedAccount'))}</strong><small>${formatNumber(position.quantity, this.language)} ${escapeHtml(asset.code)}</small></span><i>›</i></button>`;
              })
              .join('');
            return `<section class="portfolio-explorer-group ${expanded ? 'expanded' : ''} ${stale ? 'stale-price' : ''}"><button class="portfolio-row" data-portfolio-expand="asset:${asset.id}" aria-expanded="${String(expanded)}" type="button"><span class="portfolio-row-icon ${this.iconLengthClass(this.assetIcon(asset))}" style="background:${this.assetColor(asset)}">${escapeHtml(this.assetIcon(asset))}</span><span class="portfolio-row-main"><strong>${escapeHtml(asset.name)} <em>${escapeHtml(asset.code)}</em></strong><small>${escapeHtml(this.categoryLabel(inferAssetProfile(asset).category))}${stale ? `<b class="stale-label">${this.t('stalePrice')}</b>` : ''}</small></span><span class="portfolio-row-value"><strong>${this.money(value)}</strong><small>${allocation.toFixed(1)}% <b class="${this.pnlClass(pnl)}">${this.pnlPercent(pnl)}</b></small></span><i>⌄</i></button><div class="portfolio-position-list ${expanded ? '' : 'hidden'}">${details || `<div class="account-empty">${this.t('emptyAsset')}</div>`}<button class="portfolio-manage" data-asset-menu="${asset.id}" type="button">${this.t('manageAsset')}</button></div></section>`;
          })
          .join('')
      : `<div class="empty-state">${this.t('emptyAssets')}</div>`;
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

  private homePeriodStart(): number | undefined {
    const durations = {
      '1d': 24 * 60 * 60 * 1000,
      '1w': 7 * 24 * 60 * 60 * 1000,
      '1m': 30 * 24 * 60 * 60 * 1000,
      '1y': 365 * 24 * 60 * 60 * 1000,
    } as const;
    return this.ui.homePeriod === 'all'
      ? undefined
      : Date.now() - durations[this.ui.homePeriod];
  }

  private homeReferencePoint(): PnlPoint | undefined {
    const series = this.homePnlSeries();
    return series.length > 1 ? series[0] : undefined;
  }

  private homeReferenceSnapshot(): Snapshot | undefined {
    const point = this.homeReferencePoint();
    return point
      ? this.service.data.snapshots.find(
          ({ createdAt }) => createdAt === point.createdAt,
        )
      : undefined;
  }

  private homePnl(
    include: (position: SnapshotPosition) => boolean,
  ): PnlResult | null {
    return flowAdjustedPnl(this.homePnlSeries(), include);
  }

  private homePnlSeries(): PnlPoint[] {
    return selectPnlSeriesSince(
      this.compatibleSnapshots(),
      this.currentPnlPoint(),
      this.homePeriodStart(),
    );
  }

  private homeSeries(): HistoryDatum[] {
    const start = this.homePeriodStart();
    const snapshots = this.service.data.snapshots.filter(
      ({ createdAt }) => start === undefined || createdAt >= start,
    );
    const reference = this.homeReferenceSnapshot();
    const series =
      reference && !snapshots.some(({ id }) => id === reference.id)
        ? [reference, ...snapshots]
        : snapshots;
    return [
      ...series.map(({ createdAt, total }) => ({ createdAt, value: total })),
      { createdAt: Date.now(), value: portfolioTotal(this.service.data) },
    ];
  }

  private categoryLabel(category: string): string {
    if (category === 'crypto') return this.t('crypto');
    if (category === 'cash-currencies') return this.t('cashCurrencies');
    if (category === 'precious-metals') return this.t('preciousMetals');
    if (category === 'other') return this.t('other');
    return category;
  }

  private categoryColor(category: string): string {
    const fixed: Record<string, string> = {
      crypto: '#9cda68',
      'cash-currencies': '#299bc6',
      'precious-metals': '#f4ad29',
      other: '#9298a1',
    };
    if (fixed[category]) return fixed[category];
    const custom = ['#33bfc6', '#9b79d1', '#d58255', '#6aa679', '#7a8395'];
    const hash = Array.from(category).reduce(
      (value, character) => value + character.codePointAt(0)!,
      0,
    );
    return custom[hash % custom.length]!;
  }

  private tagLabel(tag: string): string {
    if (tag === 'crypto') return this.t('crypto');
    if (tag === 'currency') return this.t('currency');
    if (tag === 'gold') return this.t('gold');
    if (tag === 'stablecoin') return this.t('stablecoins');
    return tag;
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
