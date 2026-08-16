import type { Language } from '../domain/models';
import type { PositionFlowSummary } from '../domain/pnl';
import { formatShortDate, locale } from '../i18n/format';

export interface HistoryDatum {
  createdAt: number;
  value: number;
  flow?: PositionFlowSummary;
}

export interface ChartFormatters {
  displayValue(value: number): number;
  displayUnit(): string;
  money(value: number): string;
  language: Language;
  minimal?: boolean;
}

export interface ChartPoint {
  x: number;
  y: number;
}

export interface ChartGeometry {
  points: readonly ChartPoint[];
  data: readonly HistoryDatum[];
}

export function traceAngularChartLine(
  context: CanvasRenderingContext2D,
  points: readonly ChartPoint[],
): void {
  const first = points[0];
  if (!first) return;
  context.moveTo(first.x, first.y);
  points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
}

export function nearestChartPointIndex(
  points: readonly ChartPoint[],
  x: number,
): number | undefined {
  if (!points.length) return undefined;
  let nearest = 0;
  let distance = Math.abs(points[0]!.x - x);
  for (let index = 1; index < points.length; index += 1) {
    const candidate = Math.abs(points[index]!.x - x);
    if (candidate < distance) {
      nearest = index;
      distance = candidate;
    }
  }
  return nearest;
}

function drawInspection(
  context: CanvasRenderingContext2D,
  point: ChartPoint | undefined,
  height: number,
  color: string,
): void {
  if (!point) return;
  context.save();
  context.setLineDash([3, 4]);
  context.strokeStyle = 'rgba(146,152,161,.65)';
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(point.x, 4);
  context.lineTo(point.x, height - 4);
  context.stroke();
  context.setLineDash([]);
  context.beginPath();
  context.arc(point.x, point.y, 5.5, 0, Math.PI * 2);
  context.fillStyle = color;
  context.fill();
  context.lineWidth = 2;
  context.strokeStyle = '#f7f7f8';
  context.stroke();
  context.restore();
}

export function drawPortfolioSparkline(
  canvas: HTMLCanvasElement,
  data: readonly HistoryDatum[],
  selectedIndex?: number,
): ChartGeometry | undefined {
  const rectangle = canvas.getBoundingClientRect();
  if (rectangle.width < 20) return;
  const context = canvas.getContext('2d');
  if (!context) return;
  const scale = Math.min(window.devicePixelRatio || 1, 3);
  const width = rectangle.width;
  const height = 104;
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  context.setTransform(scale, 0, 0, scale, 0, 0);
  context.clearRect(0, 0, width, height);
  if (data.length < 2) return;

  const values = data.map(({ value }) => value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const padding = 5;
  const flat = high === low;
  const range = high - low || Math.max(Math.abs(high) * 0.02, 1);
  const points = values.map((value, index) => ({
    x: padding + (index * (width - padding * 2)) / (values.length - 1),
    y: flat
      ? height / 2
      : padding + ((high - value) / range) * (height - padding * 2),
  }));
  const positive = values.at(-1)! >= values[0]!;
  const color = positive ? '#9cda68' : '#ee5264';
  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(
    0,
    positive ? 'rgba(156,218,104,.2)' : 'rgba(238,82,100,.18)',
  );
  gradient.addColorStop(1, 'rgba(13,15,18,0)');
  const first = points[0]!;
  const last = points.at(-1)!;
  context.beginPath();
  traceAngularChartLine(context, points);
  context.lineTo(last.x, height);
  context.lineTo(first.x, height);
  context.closePath();
  context.fillStyle = gradient;
  context.fill();
  context.beginPath();
  traceAngularChartLine(context, points);
  context.strokeStyle = color;
  context.lineWidth = 2.25;
  context.lineJoin = 'miter';
  context.lineCap = 'butt';
  context.stroke();

  context.beginPath();
  context.arc(last.x, last.y, 3.5, 0, Math.PI * 2);
  context.fillStyle = color;
  context.fill();
  drawInspection(context, points[selectedIndex ?? -1], height, color);
  return { points, data };
}

export function drawHistoryChart(
  canvas: HTMLCanvasElement,
  empty: HTMLElement,
  dateRow: HTMLElement,
  change: HTMLElement,
  data: readonly HistoryDatum[],
  formatting: ChartFormatters,
  selectedIndex?: number,
): ChartGeometry | undefined {
  const firstDate = dateRow.children.item(0);
  const lastDate = dateRow.children.item(1);
  if (data.length < 2) {
    empty.classList.remove('hidden');
    if (firstDate) firstDate.textContent = '';
    if (lastDate) lastDate.textContent = '';
    change.textContent = '—';
    return;
  }

  empty.classList.add('hidden');
  const rectangle = canvas.getBoundingClientRect();
  if (rectangle.width < 20) return;
  const context = canvas.getContext('2d');
  if (!context) return;

  const deviceScale = Math.min(window.devicePixelRatio || 1, 3);
  const width = rectangle.width;
  const height = formatting.minimal ? Math.max(220, rectangle.height) : 270;
  canvas.width = Math.round(width * deviceScale);
  canvas.height = Math.round(height * deviceScale);
  context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
  context.clearRect(0, 0, width, height);

  const values = data.map(({ value }) => formatting.displayValue(value));
  const rawValues = data.map(({ value }) => value);
  const minimumValue = Math.min(...values);
  const maximumValue = Math.max(...values);
  const extra =
    (maximumValue - minimumValue) * 0.12 ||
    Math.max(Math.abs(maximumValue) * 0.08, 1);
  const minimum = minimumValue - extra;
  const maximum = maximumValue + extra;
  const range = maximum - minimum || 1;

  const compact = (value: number): string => {
    const absolute = Math.abs(value);
    const sign = value < 0 ? '−' : '';
    const unit = formatting.displayUnit();
    if (absolute >= 1e9)
      return `${sign}${(absolute / 1e9).toFixed(absolute >= 1e10 ? 0 : 1)}B ${unit}`;
    if (absolute >= 1e6)
      return `${sign}${(absolute / 1e6).toFixed(absolute >= 1e7 ? 0 : 1)}M ${unit}`;
    if (absolute >= 1e3)
      return `${sign}${(absolute / 1e3).toFixed(absolute >= 1e4 ? 0 : 1)}K ${unit}`;
    return `${new Intl.NumberFormat(locale(formatting.language), { maximumFractionDigits: absolute < 10 ? 2 : 0 }).format(value)} ${unit}`;
  };

  context.font = '10px -apple-system,BlinkMacSystemFont,sans-serif';
  const yLabels = [0, 1, 2, 3].map((index) =>
    compact(maximum - (index / 3) * range),
  );
  const maximumLabelWidth = Math.max(
    ...yLabels.map((label) => context.measureText(label).width),
  );
  const padding = formatting.minimal
    ? { left: 8, right: 8, top: 18, bottom: 18 }
    : {
        left: Math.min(
          Math.max(42, maximumLabelWidth + 10),
          Math.max(54, width * 0.3),
        ),
        right: 8,
        top: 22,
        bottom: 30,
      };
  const plotWidth = Math.max(20, width - padding.left - padding.right);
  const plotHeight = height - padding.top - padding.bottom;
  const styles = getComputedStyle(document.documentElement);
  const grid = styles.getPropertyValue('--line').trim() || '#e7e8eb';
  const muted = styles.getPropertyValue('--muted').trim() || '#777';
  const ink = styles.getPropertyValue('--ink').trim() || '#111';
  context.textBaseline = 'middle';

  for (let index = 0; index < (formatting.minimal ? 0 : 4); index += 1) {
    const y = padding.top + (index / 3) * plotHeight;
    context.strokeStyle = grid;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(padding.left, y);
    context.lineTo(width - padding.right, y);
    context.stroke();
    context.fillStyle = muted;
    context.textAlign = 'right';
    context.fillText(yLabels[index] ?? '', padding.left - 6, y);
  }

  const points = values.map((value, index) => ({
    x: padding.left + (index * plotWidth) / (values.length - 1),
    y: padding.top + ((maximum - value) / range) * plotHeight,
  }));
  const firstRaw = rawValues[0] ?? 0;
  const lastRaw = rawValues.at(-1) ?? 0;
  const difference = lastRaw - firstRaw;
  const percentage = firstRaw ? (difference / Math.abs(firstRaw)) * 100 : 0;
  const lineColor = difference >= 0 ? '#21c26b' : '#ee5264';
  canvas
    .closest<HTMLElement>('.chart-surface')
    ?.style.setProperty('--history-balance-color', lineColor);
  const gradient = context.createLinearGradient(
    0,
    padding.top,
    0,
    height - padding.bottom,
  );
  gradient.addColorStop(
    0,
    formatting.minimal
      ? difference >= 0
        ? 'rgba(33,194,107,.08)'
        : 'rgba(238,82,100,.07)'
      : difference >= 0
        ? 'rgba(33,194,107,.18)'
        : 'rgba(238,82,100,.16)',
  );
  gradient.addColorStop(1, 'rgba(0,0,0,0)');

  const lastPoint = points.at(-1);
  const firstPoint = points[0];
  if (!lastPoint || !firstPoint) return;
  const traceLine = (): void => {
    traceAngularChartLine(context, points);
  };
  context.beginPath();
  traceLine();
  context.lineTo(lastPoint.x, height - padding.bottom);
  context.lineTo(firstPoint.x, height - padding.bottom);
  context.closePath();
  context.fillStyle = gradient;
  context.fill();

  context.beginPath();
  traceLine();
  context.strokeStyle = lineColor;
  context.lineWidth = 2.5;
  context.lineJoin = 'miter';
  context.lineCap = 'butt';
  context.stroke();

  points.forEach((point, index) => {
    if (formatting.minimal && index !== points.length - 1) return;
    context.beginPath();
    context.arc(point.x, point.y, 3.2, 0, Math.PI * 2);
    context.fillStyle = lineColor;
    context.fill();
    if (
      !formatting.minimal &&
      (data.length <= 6 || index === 0 || index === points.length - 1) &&
      width > 350
    ) {
      context.fillStyle = ink;
      context.textAlign =
        index === 0 ? 'left' : index === points.length - 1 ? 'right' : 'center';
      context.textBaseline = 'bottom';
      context.font = '10px -apple-system,BlinkMacSystemFont,sans-serif';
      context.fillText(
        compact(values[index] ?? 0),
        point.x,
        Math.max(13, point.y - 7),
      );
    }
  });

  const sign = difference >= 0 ? '+' : '−';
  change.textContent = `${sign}${formatting.money(Math.abs(difference))} · ${sign}${Math.abs(percentage).toFixed(1)}%`;
  change.style.color = difference >= 0 ? 'var(--green)' : 'var(--red)';
  if (firstDate)
    firstDate.textContent = formatShortDate(
      data[0]!.createdAt,
      formatting.language,
    );
  if (lastDate)
    lastDate.textContent = formatShortDate(
      data.at(-1)!.createdAt,
      formatting.language,
    );
  drawInspection(context, points[selectedIndex ?? -1], height, lineColor);
  return { points, data };
}
