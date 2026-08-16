import type { PortfolioService } from '../application/portfolio-service';
import type { DiagnosticEntry } from '../application/ports';
import type {
  Account,
  Asset,
  Language,
  RatePair,
  Snapshot,
  SnapshotPosition,
} from '../domain/models';
import { validColor } from '../domain/normalize';
import { assetTotal, portfolioTotal } from '../domain/portfolio';
import {
  flowAdjustedPnl,
  normalizePnlPointInQuote,
  normalizePnlSeriesInQuote,
  pnlPointTotal,
  selectOverviewPnlSeries,
  selectPnlSeries,
  selectPnlSeriesSince,
  summarizePositionFlows,
  type PnlPoint,
  type PnlResult,
} from '../domain/pnl';
import {
  formatDate,
  formatDisplayExactMoney,
  formatDisplayMoney,
  formatMoney,
  formatNumber,
  formatPrice,
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
  assetPriceHistoryInQuote,
  assetOverviewRows,
  categoryAllocationRows,
  compactAccountAllocation,
  compactAssetAllocation,
  inferAssetProfile,
  normalizeRatePairs,
  pairPriceChangePct,
  portfolioDrivers,
  portfolioTags,
  priceFreshness,
  ratePairRows,
  type PortfolioFilter,
} from './portfolio-view-model';
import type { AppRoute } from './routes';
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
  homePeriod: '1d' | '1w' | '1m' | '1y' | 'all';
  detailPeriod: '1d' | '1w' | '1m' | '1y' | 'all';
  overviewPeriod: '24h' | 'all';
  portfolioFilter: PortfolioFilter;
  assetQuery: string;
  accountQuery: string;
}

interface HistoryItem {
  snapshot: Snapshot;
  value: number;
}

type ChartKind = 'home' | 'history' | 'detail';

export class WorthRenderer {
  private homeChartGeometry: ChartGeometry | undefined;
  private historyChartGeometry: ChartGeometry | undefined;
  private detailChartGeometry: ChartGeometry | undefined;
  private homeChartSelection: number | undefined;
  private historyChartSelection: number | undefined;
  private detailChartSelection: number | undefined;
  private detailRoute:
    Extract<AppRoute, { kind: 'asset' | 'account' }> | undefined;
  readonly ui: UiState = {
    homePeriod: 'all',
    detailPeriod: 'all',
    overviewPeriod: '24h',
    portfolioFilter: { kind: 'all' },
    assetQuery: '',
    accountQuery: '',
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
    this.renderAssetsView();
    this.renderAccountsView();
    this.renderHistory();
    if (this.detailRoute) this.renderEntityDetail(this.detailRoute);
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
    const items = this.currencyChoices();
    this.element('currencyOptions').innerHTML = items
      .map(
        (asset) =>
          `<button type="button" class="currency-option ${this.service.settings.displayCurrency === asset.code ? 'selected' : ''}" data-currency-code="${escapeHtml(asset.code)}"><span class="currency-option-icon ${this.iconLengthClass(asset.icon || '$')}" style="background:${asset.color || '#17181b'}">${escapeHtml(asset.icon || '$')}</span><span><strong>${escapeHtml(asset.name)}</strong><small>${escapeHtml(asset.code)}${asset.code === 'USD' ? ` · ${this.t('baseLabel')}` : ` · ${formatPrice(Number(asset.price), 'en')} / ${this.t('unitLabel')}`}</small></span><b>${this.service.settings.displayCurrency === asset.code ? '✓' : ''}</b></button>`,
      )
      .join('');
  }

  redrawChart(): void {
    const history = this.historyChartData();
    this.historyChartGeometry = drawHistoryChart(
      requiredElement('historyChart', HTMLCanvasElement, this.documentRef),
      this.element('historyEmpty'),
      this.element('chartDates'),
      this.element('historyBalanceChange'),
      history,
      {
        displayValue: (value) => value,
        displayUnit: () => this.displayAsset()?.icon || '$',
        money: (value) => this.displayPnlMoney(value),
        language: this.language,
      },
      this.historyChartSelection,
    );
    const points = this.historyPnlPoints();
    const pnl = flowAdjustedPnl(points, () => true);
    const totalFlow = history.reduce(
      (total, point) => total + (point.flow?.total ?? 0),
      0,
    );
    this.element('historyPnlChange').textContent = pnl
      ? `${pnl.pnl > 0 ? '+' : pnl.pnl < 0 ? '−' : ''}${this.displayPnlMoney(Math.abs(pnl.pnl))}`
      : '—';
    this.element('historyFlowChange').textContent =
      history.length > 1
        ? `${totalFlow > 0 ? '+' : totalFlow < 0 ? '−' : ''}${this.displayFlowMoney(Math.abs(totalFlow))}`
        : '—';
  }

  redrawDetailChart(): void {
    if (this.detailRoute?.kind !== 'asset') {
      this.detailChartGeometry = undefined;
      return;
    }
    this.detailChartGeometry = drawHistoryChart(
      requiredElement('entityDetailChart', HTMLCanvasElement, this.documentRef),
      this.element('entityDetailEmpty'),
      this.element('entityDetailChartDates'),
      this.element('entityDetailChange'),
      this.detailSeries(),
      {
        displayValue: (value) => value,
        displayUnit: () => this.displayAsset()?.icon || '$',
        money: (value) => this.formatDisplayPrice(value),
        language: this.language,
        minimal: true,
      },
      this.detailChartSelection,
    );
  }

  inspectChart(kind: ChartKind, clientX: number): void {
    const canvas = requiredElement(
      this.chartElementId(kind),
      HTMLCanvasElement,
      this.documentRef,
    );
    const geometry = this.chartGeometry(kind);
    if (!geometry) return;
    const index = nearestChartPointIndex(
      geometry.points,
      clientX - canvas.getBoundingClientRect().left,
    );
    if (index === undefined) return;
    this.showChartPoint(kind, index);
  }

  moveChartInspection(kind: ChartKind, delta: -1 | 1): void {
    const geometry = this.chartGeometry(kind);
    if (!geometry?.points.length) return;
    const current = this.chartSelection(kind);
    this.showChartPoint(
      kind,
      Math.min(
        Math.max((current ?? geometry.points.length - 1) + delta, 0),
        geometry.points.length - 1,
      ),
    );
  }

  selectLastChartPoint(kind: ChartKind): void {
    const geometry = this.chartGeometry(kind);
    if (!geometry?.points.length) return;
    this.showChartPoint(kind, geometry.points.length - 1);
  }

  private showChartPoint(kind: ChartKind, index: number): void {
    const canvas = requiredElement(
      this.chartElementId(kind),
      HTMLCanvasElement,
      this.documentRef,
    );
    if (kind === 'home') {
      this.homeChartSelection = index;
      this.redrawHomeChart();
    } else if (kind === 'history') {
      this.historyChartSelection = index;
      this.redrawChart();
    } else {
      this.detailChartSelection = index;
      this.redrawDetailChart();
    }
    const currentGeometry = this.chartGeometry(kind);
    const datum = currentGeometry?.data[index];
    const point = currentGeometry?.points[index];
    if (!datum || !point) return;
    const tooltip = this.element(this.chartTooltipId(kind));
    const exactValue = this.service.settings.balancesHidden
      ? '••••'
      : kind === 'detail'
        ? this.formatDisplayPrice(datum.value)
        : formatDisplayExactMoney(
            datum.value,
            this.language,
            this.displayAsset(),
          );
    const flowMarkup =
      kind === 'history' && datum.flow?.changes.length
        ? datum.flow.changes
            .map((change) => {
              const quantitySign = change.quantityDelta > 0 ? '+' : '−';
              const valueSign = change.valueDelta > 0 ? '+' : '−';
              return `<small class="chart-flow-change">${escapeHtml(change.accountName)} • ${quantitySign}${escapeHtml(formatNumber(Math.abs(change.quantityDelta), this.language))}${escapeHtml(change.assetCode)} • ${valueSign}${escapeHtml(this.displayFlowMoney(Math.abs(change.valueDelta)))}</small>`;
            })
            .join('')
        : '';
    tooltip.innerHTML = `<strong>${escapeHtml(exactValue)}</strong><small>${escapeHtml(formatDate(datum.createdAt, this.language))} · ${escapeHtml(formatTime(datum.createdAt, this.language))}</small>${flowMarkup}`;
    tooltip.style.left = `${Math.min(Math.max(point.x, 58), Math.max(58, canvas.clientWidth - 58))}px`;
    tooltip.classList.remove('hidden');
  }

  clearChartInspection(kind: ChartKind): void {
    if (kind === 'home') {
      this.homeChartSelection = undefined;
      this.redrawHomeChart();
    } else if (kind === 'history') {
      this.historyChartSelection = undefined;
      this.redrawChart();
    } else {
      this.detailChartSelection = undefined;
      this.redrawDetailChart();
    }
    this.element(this.chartTooltipId(kind)).classList.add('hidden');
  }

  private chartElementId(kind: ChartKind): string {
    if (kind === 'home') return 'homeChart';
    if (kind === 'history') return 'historyChart';
    return 'entityDetailChart';
  }

  private chartTooltipId(kind: ChartKind): string {
    if (kind === 'home') return 'homeChartTooltip';
    if (kind === 'history') return 'historyChartTooltip';
    return 'entityDetailChartTooltip';
  }

  private chartGeometry(kind: ChartKind): ChartGeometry | undefined {
    if (kind === 'home') return this.homeChartGeometry;
    if (kind === 'history') return this.historyChartGeometry;
    return this.detailChartGeometry;
  }

  private chartSelection(kind: ChartKind): number | undefined {
    if (kind === 'home') return this.homeChartSelection;
    if (kind === 'history') return this.historyChartSelection;
    return this.detailChartSelection;
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
    const choices = this.currencyChoices();
    return choices
      .map(
        ({ code, icon }) =>
          `<option value="${escapeHtml(code)}" ${code === selected ? 'selected' : ''}>${escapeHtml(icon)} ${escapeHtml(code)}</option>`,
      )
      .join('');
  }

  private currencyChoices(): Array<{
    code: string;
    name: string;
    icon: string;
    color: string;
    price: number;
  }> {
    const persistedUsd = this.service.data.assets.find(
      ({ code }) => code === 'USD',
    );
    const choices = [
      {
        code: 'USD',
        name: persistedUsd?.name || this.t('displayName'),
        icon: persistedUsd ? this.assetIcon(persistedUsd) : '$',
        color: persistedUsd?.color || '#17181b',
        price: 1,
      },
    ];
    const seen = new Set(['USD']);
    for (const asset of this.service.data.assets) {
      if (seen.has(asset.code) || !(Number(asset.price) > 0)) continue;
      seen.add(asset.code);
      choices.push({
        code: asset.code,
        name: asset.name,
        icon: this.assetIcon(asset),
        color: asset.color,
        price: Number(asset.price),
      });
    }
    return choices;
  }

  money(value: number): string {
    if (this.service.settings.balancesHidden) return '••••';
    return formatMoney(value, this.language, this.displayAsset());
  }

  private displayPnlMoney(value: number): string {
    return this.service.settings.balancesHidden
      ? '••••'
      : formatDisplayMoney(value, this.language, this.displayAsset());
  }

  private displayFlowMoney(value: number): string {
    const displayAsset = this.displayAsset();
    if (!displayAsset) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(value);
    }
    const formatted = new Intl.NumberFormat(locale(this.language), {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4,
    }).format(value);
    return `${formatted} ${displayAsset.icon || displayAsset.code}`;
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
    for (const element of all<HTMLElement>(
      '[data-i18n-aria]',
      this.documentRef,
    )) {
      const key = element.dataset.i18nAria;
      if (key && isMessageKey(key))
        element.setAttribute('aria-label', translate(this.language, key));
    }
    for (const element of all<HTMLElement>(
      '[data-i18n-title]',
      this.documentRef,
    )) {
      const key = element.dataset.i18nTitle;
      if (key && isMessageKey(key))
        element.setAttribute('title', translate(this.language, key));
    }
    this.documentRef.title = this.t('appTitle');
    this.element('entityDetailMenu').setAttribute(
      'aria-label',
      this.t('actions'),
    );
    all<HTMLElement>('[data-lang-choice]', this.documentRef).forEach((button) =>
      button.classList.toggle(
        'active',
        button.dataset.langChoice === this.language,
      ),
    );
    const priceInterval = requiredElement(
      'priceRefreshIntervalMinutes',
      HTMLSelectElement,
      this.documentRef,
    );
    priceInterval.value = String(
      this.service.settings.priceRefreshIntervalMinutes,
    );
    const snapshotInterval = requiredElement(
      'snapshotIntervalMinutes',
      HTMLSelectElement,
      this.documentRef,
    );
    snapshotInterval.value = String(
      this.service.settings.snapshotIntervalMinutes,
    );
    for (const select of [priceInterval, snapshotInterval]) {
      for (const option of select.options) {
        option.textContent =
          option.value === '0'
            ? this.t('autoNone')
            : this.t('minutesLabel', Number(option.value));
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
    this.element('entityDetailChart').setAttribute(
      'aria-label',
      `${this.t('valueHistory')}. ${this.t('chartInspectionHelp')}`,
    );
    this.element('assetAdd').setAttribute('aria-label', this.t('createAsset'));
    this.element('accountAdd').setAttribute(
      'aria-label',
      this.t('createAccount'),
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
        ? this.displayPnlMoney(Math.abs(result.pnl))
        : `${sign}${this.displayPnlMoney(Math.abs(result.pnl))}`
      : '—';
    percentElement.textContent = result
      ? `${sign}${Math.abs(result.pct || 0).toFixed(2)}%`
      : '—';
    moneyElement.className = `pnl-money ${style}`;
    percentElement.className = `pnl-percent ${style}`;

    const driverPoints = this.homeChartPnlSeries();
    const drivers = portfolioDrivers(this.service.data, driverPoints);
    const renderDrivers = (positive: boolean): string => {
      const rows = drivers
        .filter(({ value }) => (positive ? value > 0 : value < 0))
        .slice(0, 2);
      if (!rows.length) {
        const key =
          driverPoints.length < 2
            ? 'driversNeedHistory'
            : positive
              ? 'noGainers'
              : 'noLosers';
        return `<div class="empty-state compact-empty">${this.t(key)}</div>`;
      }
      return rows
        .flatMap((driver) => {
          const asset = this.service.data.assets.find(
            ({ id }) => id === driver.assetId,
          );
          if (!asset) return [];
          const value = this.service.settings.balancesHidden
            ? '••••'
            : `${positive ? '+' : '−'}${this.displayPnlMoney(Math.abs(driver.value))}`;
          return [
            `<button class="driver-row" data-driver-asset="${escapeHtml(asset.id)}" type="button"><span class="driver-icon ui-icon-tile ${this.iconLengthClass(this.assetIcon(asset))}" style="background:${this.assetColor(asset)}">${escapeHtml(this.assetIcon(asset))}</span><span class="driver-identity"><strong>${escapeHtml(asset.name)}</strong></span><b class="driver-value ${positive ? 'positive' : 'negative'}">${value}</b><i aria-hidden="true">›</i></button>`,
          ];
        })
        .join('');
    };
    this.element('portfolioGainers').innerHTML = renderDrivers(true);
    this.element('portfolioLosers').innerHTML = renderDrivers(false);

    const legacyPairs = this.service.settings.selectedRateAssetIds.map(
      (sourceAssetId) => ({
        sourceAssetId,
        quoteAssetId: this.service.settings.displayCurrency,
      }),
    );
    const rates = ratePairRows(
      this.service.data,
      normalizeRatePairs(
        this.service.data,
        this.service.settings.ratePairs.length
          ? this.service.settings.ratePairs
          : legacyPairs,
        this.service.settings.displayCurrency,
      ),
    );
    this.element('portfolioRates').innerHTML = rates.length
      ? rates
          .map(({ source, quote, value }) => {
            const change = pairPriceChangePct(
              driverPoints,
              source.id,
              quote.id,
            );
            const changeClass =
              change === null || change === 0
                ? ''
                : change > 0
                  ? 'pnl-positive'
                  : 'pnl-negative';
            const price = this.service.settings.balancesHidden
              ? '••••'
              : value === undefined
                ? '—'
                : formatPrice(
                    Number(source.price) || 0,
                    this.language,
                    quote.code === 'USD' ? undefined : quote,
                  );
            return `<button class="rate-row ui-list-row" data-rate-asset="${escapeHtml(source.id)}" type="button"><span class="driver-icon ui-icon-tile compact ${this.iconLengthClass(this.assetIcon(source))}" style="background:${this.assetColor(source)}">${escapeHtml(this.assetIcon(source))}</span><span class="rate-identity"><strong>${escapeHtml(source.name)}</strong>${this.assetFreshnessMarkup(source, 'rate-status')}</span><span class="rate-value"><strong>${price}</strong><small class="rate-change ${changeClass}">${this.signedPercent(change)}</small></span><i aria-hidden="true">›</i></button>`;
          })
          .join('')
      : `<div class="empty-state compact-empty">${this.t('emptyAssets')}</div>`;

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
              `<button class="category-row" data-nav="assetsView" data-category-filter="${escapeHtml(category)}" type="button"><span style="background:${this.categoryColor(category)}"></span><strong>${escapeHtml(this.categoryLabel(category))}</strong><b>${percentage.toFixed(0)}%</b></button>`,
          )
          .join('')
      : `<div class="empty-state compact-empty">${this.t('emptyAllocation')}</div>`;

    this.redrawHomeChart();
  }

  renderAssetsView(): void {
    const list = this.element('assetsList');
    const freshness = priceFreshness(
      this.service.data,
      Date.now(),
      (this.service.settings.priceRefreshIntervalMinutes || 60) * 60 * 1000,
    );
    const rows = assetOverviewRows(this.service.data);
    this.renderCompactAllocation(
      'assetAllocationBar',
      'assetAllocationList',
      compactAssetAllocation(this.service.data),
    );
    this.element('assetAllocationCount').textContent = this.t(
      'assetsCount',
      rows.length,
    );
    this.element('assetAllocationTotal').textContent = this.money(
      portfolioTotal(this.service.data),
    );
    this.renderOverviewPeriodControls();
    list.innerHTML = rows.length
      ? rows
          .map(({ asset, value }) => {
            const pnl = this.overviewPnl(
              (position) => position.assetId === asset.id,
            );
            const stale = freshness.staleAssetIds.includes(asset.id);
            return `<button class="portfolio-row portfolio-flat-row ui-list-row ui-surface ${stale ? 'stale-price' : ''}" data-asset-open="${escapeHtml(asset.id)}" type="button"><span class="portfolio-row-icon ui-icon-tile ${this.iconLengthClass(this.assetIcon(asset))}" style="background:${this.assetColor(asset)}">${escapeHtml(this.assetIcon(asset))}</span><span class="portfolio-row-main"><strong>${escapeHtml(asset.name)}</strong><small>${escapeHtml(this.categoryLabel(inferAssetProfile(asset).category))}${stale ? `<b class="stale-label">${this.t('stalePrice')}</b>` : ''}</small></span><span class="portfolio-row-value"><strong>${this.money(value)}</strong><small class="${this.pnlClass(pnl)}">${this.pnlSummary(pnl)}</small></span><i>›</i></button>`;
          })
          .join('')
      : `<div class="empty-state">${this.t('emptyAssets')}</div>`;
  }

  renderAccountsView(): void {
    const rows = accountOverviewRows(this.service.data);
    this.renderCompactAllocation(
      'accountAllocationBar',
      'accountAllocationList',
      compactAccountAllocation(this.service.data),
    );
    this.element('accountAllocationTotal').textContent = this.money(
      portfolioTotal(this.service.data),
    );
    this.element('accountAllocationCount').textContent = this.t(
      'accountsCount',
      rows.length,
    );
    this.element('accountsList').innerHTML = rows.length
      ? rows
          .map(({ account, value }) => {
            const pnl = this.overviewPnl(
              (position) => position.accountId === account.id,
            );
            return `<button class="portfolio-row portfolio-flat-row ui-list-row ui-surface" data-account-open="${escapeHtml(account.id)}" type="button"><span class="portfolio-row-icon ui-icon-tile ${this.iconLengthClass(this.accountIcon(account))}" style="background:${this.accountColor(account)}">${escapeHtml(this.accountIcon(account))}</span><span class="portfolio-row-main"><strong>${escapeHtml(account.name)}</strong><small>${escapeHtml(this.accountTypeLabel(account.type))}</small></span><span class="portfolio-row-value"><strong>${this.money(value)}</strong><small class="${this.pnlClass(pnl)}">${this.pnlSummary(pnl)}</small></span><i>›</i></button>`;
          })
          .join('')
      : `<div class="empty-state">${this.t('emptyAccounts')}</div>`;
  }

  private renderOverviewPeriodControls(): void {
    const label = this.t(
      this.ui.overviewPeriod === '24h' ? 'period24h' : 'periodAllTime',
    );
    all<HTMLElement>('[data-overview-period-toggle]', this.documentRef).forEach(
      (button) => {
        button.textContent = label;
        button.setAttribute(
          'aria-label',
          `${this.t('overviewPnlPeriodAria')}: ${label}`,
        );
      },
    );
  }

  private renderCompactAllocation(
    barId: string,
    listId: string,
    rows: ReturnType<typeof compactAssetAllocation>,
  ): void {
    const color = (row: (typeof rows)[number]): string =>
      row.kind === 'other' ? '#8e939e' : row.color;
    this.element(barId).innerHTML = rows
      .map(
        (row) =>
          `<span class="allocation-segment" style="width:${row.percentage}%;background:${color(row)}"></span>`,
      )
      .join('');
    this.element(listId).innerHTML = rows.length
      ? rows
          .map(
            (row) =>
              `<div class="compact-allocation-key"><span style="background:${color(row)}"></span><strong>${escapeHtml(row.kind === 'other' ? (listId === 'accountAllocationList' ? this.t('remainingAccounts', row.count) : this.t('other')) : row.name)}</strong><b>${row.percentage.toFixed(1)}%</b></div>`,
          )
          .join('')
      : `<div class="empty-state compact-empty">${this.t('emptyAllocation')}</div>`;
  }

  renderRateSelection(pairs: readonly RatePair[]): void {
    const options = (selectedId: string) =>
      this.service.data.assets
        .map(
          (asset) =>
            `<option value="${escapeHtml(asset.id)}" ${asset.id === selectedId ? 'selected' : ''}>${escapeHtml(asset.name)}</option>`,
        )
        .join('');
    this.element('rateSelectionList').innerHTML = pairs
      .map((pair, index) => {
        const source = this.assetBy(pair.sourceAssetId);
        return `<div class="rate-pair-row" data-rate-pair-index="${index}"><span class="portfolio-row-icon ${this.iconLengthClass(this.assetIcon(source))}" style="background:${this.assetColor(source)}">${escapeHtml(this.assetIcon(source))}</span><label><span>${this.t('sourceAsset')}</span><select name="rateSource">${options(pair.sourceAssetId)}</select></label><i aria-hidden="true">→</i><label><span>${this.t('quoteAsset')}</span><select name="rateQuote">${options(pair.quoteAssetId)}</select></label><button data-rate-pair-remove="${index}" aria-label="${escapeHtml(this.t('removeRate'))}" type="button">×</button></div>`;
      })
      .join('');
    const add = this.documentRef.querySelector<HTMLButtonElement>(
      '[data-rate-pair-add]',
    );
    if (add) add.disabled = pairs.length >= 3;
    this.element('rateSelectionError').classList.add('hidden');
  }

  renderEntityDetail(
    route: Extract<AppRoute, { kind: 'asset' | 'account' }>,
  ): boolean {
    this.detailRoute = route;
    this.detailChartSelection = undefined;
    const heading = this.element('entityDetailTitle');
    const hero = this.element('entityDetailHero');
    const metadata = this.element('entityDetailMetadata');
    const holding = this.element('entityHoldingSummary');
    const related = this.element('entityRelatedList');
    const menu = this.element('entityDetailMenu');
    const add = this.element('entityDetailAdd');
    const chartSection = this.element('entityDetailChartSection');
    const detailPeriodLabels =
      this.language === 'ru'
        ? { '1d': '1Д', '1w': '1Н', '1m': '1М', '1y': '1Г', all: 'ВСЕ' }
        : { '1d': '1D', '1w': '1W', '1m': '1M', '1y': '1Y', all: 'ALL' };
    all<HTMLElement>('[data-detail-period]', this.documentRef).forEach(
      (button) => {
        const period = button.dataset
          .detailPeriod as keyof typeof detailPeriodLabels;
        button.textContent = detailPeriodLabels[period];
        const active = period === this.ui.detailPeriod;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      },
    );
    if (route.kind === 'asset') {
      const asset = this.assetBy(route.id);
      if (!asset) return false;
      hero.classList.remove('account-detail-hero');
      const quantity = this.service.data.positions
        .filter(({ assetId }) => assetId === asset.id)
        .reduce((sum, position) => sum + Number(position.quantity || 0), 0);
      const pnl = this.allTimePnl((position) => position.assetId === asset.id);
      const value = this.assetTotal(asset.id);
      const total = portfolioTotal(this.service.data);
      const share = total ? (Math.abs(value) / Math.abs(total)) * 100 : 0;
      const pnlSign =
        pnl?.pnl && pnl.pnl > 0 ? '+' : pnl?.pnl && pnl.pnl < 0 ? '−' : '';
      const currentPrice = this.currentPriceInDisplay(asset);
      const priceSeries = this.detailSeries();
      const referencePrice = priceSeries[0]?.value;
      const priceDifference =
        referencePrice === undefined
          ? undefined
          : currentPrice - referencePrice;
      const pricePercentage =
        referencePrice && priceDifference !== undefined
          ? (priceDifference / Math.abs(referencePrice)) * 100
          : undefined;
      const priceSign =
        priceDifference === undefined || priceDifference === 0
          ? ''
          : priceDifference > 0
            ? '+'
            : '−';
      heading.textContent = asset.name;
      hero.innerHTML = `<span class="detail-icon ui-icon-tile hero ${this.iconLengthClass(this.assetIcon(asset))}" style="background:${this.assetColor(asset)}">${escapeHtml(this.assetIcon(asset))}</span><div class="detail-hero-main"><h1 id="entityDetailTitle" tabindex="-1">${escapeHtml(asset.name)}</h1><strong>${this.formatDisplayPrice(currentPrice)}</strong><div class="detail-price-change ${priceDifference === undefined ? '' : priceDifference >= 0 ? 'pnl-positive' : 'pnl-negative'}" id="entityDetailPriceChange">${priceDifference === undefined ? '—' : `${priceSign}${this.formatDisplayPrice(Math.abs(priceDifference))} · ${priceSign}${Math.abs(pricePercentage ?? 0).toFixed(1)}%`}</div></div><span class="detail-price-status" id="entityDetailFreshness">${this.assetFreshnessMarkup(asset)}</span>`;
      chartSection.classList.remove('hidden');
      chartSection.querySelector<HTMLElement>('.chart-stat span')!.textContent =
        this.t('assetPriceHistory');
      metadata.classList.remove('hidden');
      metadata.classList.remove('account-detail-metadata');
      holding.classList.remove('hidden');
      holding.innerHTML = `<div class="holding-summary-head"><strong>${this.money(value)}</strong><small>${formatNumber(quantity, this.language)} ${escapeHtml(asset.code)} · ${share.toFixed(1)}% ${this.t('ofPortfolio')}</small><span class="${this.pnlClass(pnl)}">${pnl ? `${pnlSign}${this.displayPnlMoney(Math.abs(pnl.pnl))}` : '—'}<small>${this.pnlPercent(pnl)} · ${this.t('pnlVsFirst').toLocaleLowerCase(locale(this.language))}</small></span></div>`;
      const positions = this.service.data.positions.filter(
        ({ assetId }) => assetId === asset.id,
      );
      this.element('entityRelatedTitle').textContent = this.t('yourPortfolio');
      related.innerHTML = positions.length
        ? positions
            .map((position) => {
              const account = this.accountBy(position.accountId);
              const positionPnl = this.allTimePnl(
                (snapshotPosition) =>
                  snapshotPosition.positionId === position.id,
              );
              const positionSign =
                positionPnl?.pnl && positionPnl.pnl > 0
                  ? '+'
                  : positionPnl?.pnl && positionPnl.pnl < 0
                    ? '−'
                    : '';
              return `<button class="related-row related-row-valued" data-position-open="${escapeHtml(position.id)}" type="button"><span class="portfolio-position-icon ${this.iconLengthClass(this.accountIcon(account))}" style="background:${this.accountColor(account)}">${escapeHtml(this.accountIcon(account))}</span><span><strong>${escapeHtml(account?.name || this.t('deletedAccount'))}</strong><small>${formatNumber(position.quantity, this.language)} ${escapeHtml(asset.code)}</small></span><b>${this.money(Number(position.quantity) * Number(asset.price))}<small class="${this.pnlClass(positionPnl)}">${positionPnl ? `${positionSign}${this.displayPnlMoney(Math.abs(positionPnl.pnl))}` : '—'}</small></b><i>›</i></button>`;
            })
            .join('')
        : `<div class="empty-state compact-empty">${this.t('emptyAsset')}</div>`;
      menu.dataset.assetMenu = asset.id;
      delete menu.dataset.accountMenu;
      add.dataset.detailAddPosition = `asset:${asset.id}`;
      add.setAttribute('aria-label', this.t('addPosition'));
    } else {
      const account = this.accountBy(route.id);
      if (!account) return false;
      hero.classList.add('account-detail-hero');
      const positions = this.service.data.positions.filter(
        ({ accountId }) => accountId === account.id,
      );
      const pnl = this.allTimePnl(
        (position) => position.accountId === account.id,
      );
      const value =
        accountOverviewRows(this.service.data).find(
          ({ account: candidate }) => candidate.id === account.id,
        )?.value ?? 0;
      hero.innerHTML = `<span class="detail-icon ui-icon-tile hero ${this.iconLengthClass(this.accountIcon(account))}" style="background:${this.accountColor(account)}">${escapeHtml(this.accountIcon(account))}</span><div class="detail-hero-main"><h1 id="entityDetailTitle" tabindex="-1">${escapeHtml(account.name)}</h1><strong>${this.money(value)}</strong><small class="${this.pnlClass(pnl)}">${this.pnlSummary(pnl)} · ${this.t('pnlVsFirst').toLocaleLowerCase(locale(this.language))}</small></div>`;
      chartSection.classList.add('hidden');
      metadata.classList.remove('hidden');
      metadata.classList.add('account-detail-metadata');
      holding.classList.add('hidden');
      holding.innerHTML = '';
      this.element('entityRelatedTitle').textContent = this.t('relatedAssets');
      related.innerHTML = positions.length
        ? positions
            .map((position) => {
              const asset = this.assetBy(position.assetId);
              const positionPnl = this.allTimePnl(
                (snapshotPosition) =>
                  snapshotPosition.positionId === position.id,
              );
              return `<button class="related-row related-row-valued" data-position-open="${escapeHtml(position.id)}" type="button"><span class="portfolio-position-icon ${this.iconLengthClass(this.assetIcon(asset))}" style="background:${this.assetColor(asset)}">${escapeHtml(this.assetIcon(asset))}</span><span><strong>${escapeHtml(asset?.name || this.t('asset'))}</strong><small>${formatNumber(position.quantity, this.language)} ${escapeHtml(asset?.code || '')}</small></span><b>${this.money(Number(position.quantity) * Number(asset?.price || 0))}<small class="${this.pnlClass(positionPnl)}">${this.pnlSummary(positionPnl)}</small></b><i>›</i></button>`;
            })
            .join('')
        : `<div class="empty-state compact-empty">${this.t('emptyAccount')}</div>`;
      menu.dataset.accountMenu = account.id;
      delete menu.dataset.assetMenu;
      add.dataset.detailAddPosition = `account:${account.id}`;
      add.setAttribute('aria-label', this.t('addPosition'));
    }
    requestAnimationFrame(() => this.redrawDetailChart());
    return true;
  }

  private renderHistory(): void {
    const data = this.historyData();
    this.element('historyRangeLabel').textContent = this.t('allHistory');
    const list = this.element('historyList');
    if (!data.length) {
      list.innerHTML = `<div class="empty-state">${this.t('portfolioHistoryEmpty')}</div>`;
    } else {
      list.innerHTML = [...data]
        .reverse()
        .map((item) => {
          const index = data.findIndex(
            ({ snapshot }) => snapshot.id === item.snapshot.id,
          );
          const previous = data[index - 1];
          const difference = previous ? item.value - previous.value : null;
          return `<div class="list-card ui-list-row ui-surface history-row"><div class="list-main"><strong>${formatDate(item.snapshot.createdAt, this.language)}</strong><small>${formatTime(item.snapshot.createdAt, this.language)}${difference === null ? ` · ${this.t('firstSnapshot')}` : ` · ${difference >= 0 ? '+' : '−'}${this.displayPnlMoney(Math.abs(difference))}`}</small></div><div class="list-value"><strong>${this.displayPnlMoney(item.value)}</strong></div><button class="ui-icon-button menu-button" data-snapshot-menu="${item.snapshot.id}" aria-label="${this.t('actions')}">···</button></div>`;
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

  private currentPriceInDisplay(asset: Asset): number {
    const quote = this.displayAsset();
    const sourcePrice = Number(asset.price) || 0;
    if (!quote) return sourcePrice;
    const quotePrice = Number(quote.price);
    return quotePrice > 0 ? sourcePrice / quotePrice : sourcePrice;
  }

  private formatDisplayPrice(value: number): string {
    const quote = this.displayAsset();
    return formatPrice(
      value * (Number(quote?.price) || 1),
      this.language,
      quote,
    );
  }

  private assetTotal(id: string): number {
    return assetTotal(id, this.service.data);
  }

  private historyData(): HistoryItem[] {
    const points = this.normalizedSnapshotPoints();
    const pointsByCreatedAt = new Map(
      points.map((point) => [point.createdAt, point]),
    );
    return this.service.data.snapshots.flatMap((snapshot) => {
      const point = pointsByCreatedAt.get(snapshot.createdAt);
      return point
        ? [
            {
              snapshot,
              value: pnlPointTotal(point),
            },
          ]
        : [];
    });
  }

  private historyPnlPoints(): PnlPoint[] {
    const current = this.normalizedCurrentPnlPoint();
    return current
      ? selectPnlSeries(this.normalizedSnapshotPoints(), current, 'all')
      : [];
  }

  private historyChartData(): HistoryDatum[] {
    const points = this.historyPnlPoints();
    return points.map((point, index) => {
      const previous = points[index - 1];
      const flow = previous
        ? summarizePositionFlows(previous, point)
        : undefined;
      return {
        createdAt: point.createdAt,
        value: pnlPointTotal(point),
        ...(flow ? { flow } : {}),
      };
    });
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

  private homePnl(
    include: (position: SnapshotPosition) => boolean,
  ): PnlResult | null {
    return flowAdjustedPnl(this.homeChartPnlSeries(), include);
  }

  private overviewPnl(
    include: (position: SnapshotPosition) => boolean,
  ): PnlResult | null {
    return flowAdjustedPnl(this.overviewPnlSeries(), include);
  }

  private allTimePnl(
    include: (position: SnapshotPosition) => boolean,
  ): PnlResult | null {
    return flowAdjustedPnl(this.allTimePnlSeries(), include);
  }

  private homeChartPnlSeries(): PnlPoint[] {
    const current = this.normalizedCurrentPnlPoint();
    if (!current) return [];
    if (this.ui.homePeriod === '1d') {
      return selectOverviewPnlSeries(
        this.normalizedSnapshotPoints(),
        current,
        '24h',
        current.createdAt,
      );
    }
    return selectPnlSeriesSince(
      this.normalizedSnapshotPoints(),
      current,
      this.homePeriodStart(),
    );
  }

  private allTimePnlSeries(): PnlPoint[] {
    const current = this.normalizedCurrentPnlPoint();
    return current
      ? selectPnlSeries(this.normalizedSnapshotPoints(), current, 'all')
      : [];
  }

  private homeSeries(): HistoryDatum[] {
    return this.homeChartPnlSeries().map((point) => ({
      createdAt: point.createdAt,
      value: pnlPointTotal(point),
    }));
  }

  private detailSeries(): HistoryDatum[] {
    if (this.detailRoute?.kind !== 'asset') return [];
    const start = this.detailPeriodStart();
    const historical = assetPriceHistoryInQuote(
      this.detailRoute.id,
      this.displayAsset()?.id,
      this.service.data,
    ).filter(({ createdAt }) => start === undefined || createdAt >= start);
    if (historical.length < 2) return [];
    return historical;
  }

  private detailPeriodStart(): number | undefined {
    const durations = {
      '1d': 24 * 60 * 60 * 1000,
      '1w': 7 * 24 * 60 * 60 * 1000,
      '1m': 30 * 24 * 60 * 60 * 1000,
      '1y': 365 * 24 * 60 * 60 * 1000,
    } as const;
    return this.ui.detailPeriod === 'all'
      ? undefined
      : Date.now() - durations[this.ui.detailPeriod];
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

  private assetPriceStatusClass(asset: Asset): 'current' | 'stale' | 'manual' {
    if (asset.autoUpdateSource === 'none') return 'manual';
    const maximumAge =
      (this.service.settings.priceRefreshIntervalMinutes || 60) * 60 * 1000;
    return typeof asset.priceUpdatedAt === 'number' &&
      Date.now() - asset.priceUpdatedAt <= maximumAge
      ? 'current'
      : 'stale';
  }

  private assetFreshnessMarkup(asset: Asset, className = ''): string {
    const state = this.assetPriceStatusClass(asset);
    if (state === 'manual') {
      return `<span class="ui-freshness manual ${className}"><small>${escapeHtml(this.t('autoSourceNone'))}</small></span>`;
    }
    const relative = asset.priceUpdatedAt
      ? formatRelativeTime(asset.priceUpdatedAt, Date.now(), this.language)
      : this.t('neverAutoUpdated');
    const label =
      state === 'stale' ? `${this.t('stalePrice')} · ${relative}` : relative;
    return `<span class="ui-freshness ${state} ${className}"><span class="freshness-dot" aria-hidden="true"></span><small>${escapeHtml(label)}</small></span>`;
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
        const price = Number(asset?.price);
        const quantity = Number(position.quantity);
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
        price: Number(asset.price),
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
                price: Number(asset.price),
              })),
            },
          ]
        : [],
    );
  }

  private normalizedSnapshotPoints(): PnlPoint[] {
    return normalizePnlSeriesInQuote(
      this.compatibleSnapshots(),
      this.displayAsset()?.id,
      this.service.data.priceHistory,
    );
  }

  private normalizedCurrentPnlPoint(): PnlPoint | null {
    return normalizePnlPointInQuote(
      this.currentPnlPoint(),
      this.displayAsset()?.id,
      this.service.data.priceHistory,
    );
  }

  private overviewPnlSeries(): PnlPoint[] {
    const current = this.normalizedCurrentPnlPoint();
    if (!current) return [];
    const now = current.createdAt;
    return selectOverviewPnlSeries(
      this.normalizedSnapshotPoints(),
      current,
      this.ui.overviewPeriod,
      now,
    );
  }

  private pnlPercent(result: PnlResult | null): string {
    if (!result || result.pct === null) return '—';
    const sign = result.pct > 0 ? '+' : result.pct < 0 ? '−' : '';
    return `${sign}${Math.abs(result.pct).toFixed(1)}%`;
  }

  private signedPercent(value: number | null): string {
    if (value === null || !Number.isFinite(value)) return '—';
    const sign = value > 0 ? '+' : value < 0 ? '−' : '';
    return `${sign}${this.unsignedPercent(Math.abs(value))}`;
  }

  private unsignedPercent(value: number): string {
    return `${new Intl.NumberFormat(locale(this.language), {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(value)}%`;
  }

  private pnlSummary(result: PnlResult | null): string {
    if (!result) return '—';
    const sign = result.pnl > 0 ? '+' : result.pnl < 0 ? '−' : '';
    const amount = this.service.settings.balancesHidden
      ? '••••'
      : `${sign}${this.displayPnlMoney(Math.abs(result.pnl))}`;
    return `${amount} · ${this.pnlPercent(result)}`;
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
