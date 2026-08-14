import type { Language } from '../domain/models';
import { formatShortDate, locale } from '../i18n/format';

export interface HistoryDatum {
  createdAt: number;
  value: number;
}

export interface ChartFormatters {
  displayValue(value: number): number;
  displayUnit(): string;
  money(value: number): string;
  language: Language;
}

export function drawHistoryChart(
  canvas: HTMLCanvasElement,
  empty: HTMLElement,
  dateRow: HTMLElement,
  change: HTMLElement,
  data: readonly HistoryDatum[],
  formatting: ChartFormatters,
): void {
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
  const height = 270;
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
  const padding = {
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

  for (let index = 0; index < 4; index += 1) {
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
  const gradient = context.createLinearGradient(
    0,
    padding.top,
    0,
    height - padding.bottom,
  );
  gradient.addColorStop(
    0,
    difference >= 0 ? 'rgba(33,194,107,.18)' : 'rgba(238,82,100,.16)',
  );
  gradient.addColorStop(1, 'rgba(0,0,0,0)');

  context.beginPath();
  points.forEach((point, index) =>
    index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y),
  );
  const lastPoint = points.at(-1);
  const firstPoint = points[0];
  if (!lastPoint || !firstPoint) return;
  context.lineTo(lastPoint.x, height - padding.bottom);
  context.lineTo(firstPoint.x, height - padding.bottom);
  context.closePath();
  context.fillStyle = gradient;
  context.fill();

  context.beginPath();
  points.forEach((point, index) =>
    index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y),
  );
  context.strokeStyle = lineColor;
  context.lineWidth = 2.5;
  context.lineJoin = 'round';
  context.lineCap = 'round';
  context.stroke();

  points.forEach((point, index) => {
    context.beginPath();
    context.arc(point.x, point.y, 3.2, 0, Math.PI * 2);
    context.fillStyle = lineColor;
    context.fill();
    if (
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
}
