import { describe, expect, it, vi } from 'vitest';

import {
  flowChartPoints,
  nearestChartPointIndex,
  traceAngularChartLine,
} from '../../src/ui/chart';

describe('chart inspection', () => {
  it('selects the nearest rendered point and clamps outside the plot', () => {
    const points = [
      { x: 20, y: 80 },
      { x: 120, y: 40 },
      { x: 220, y: 60 },
    ];

    expect(nearestChartPointIndex(points, -50)).toBe(0);
    expect(nearestChartPointIndex(points, 89)).toBe(1);
    expect(nearestChartPointIndex(points, 400)).toBe(2);
  });

  it('returns no selection when the chart has no rendered points', () => {
    expect(nearestChartPointIndex([], 100)).toBeUndefined();
  });
});

describe('minimal asset chart path', () => {
  it('connects every price point with straight segments', () => {
    const context = {
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
    };

    traceAngularChartLine(context as unknown as CanvasRenderingContext2D, [
      { x: 10, y: 80 },
      { x: 50, y: 40 },
      { x: 90, y: 60 },
    ]);

    expect(context.moveTo).toHaveBeenCalledWith(10, 80);
    expect(context.lineTo.mock.calls).toEqual([
      [50, 40],
      [90, 60],
    ]);
    expect(context.quadraticCurveTo).not.toHaveBeenCalled();
  });
});

describe('history cash-flow line', () => {
  it('uses an independent zero-centered scale for interval movements', () => {
    expect(flowChartPoints([0, -100, 50], [10, 50, 90], 20, 100)).toEqual([
      { x: 10, y: 70 },
      { x: 50, y: 120 },
      { x: 90, y: 45 },
    ]);
  });
});
