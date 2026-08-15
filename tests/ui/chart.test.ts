import { describe, expect, it } from 'vitest';

import {
  nearestChartPointIndex,
  smoothChartSegments,
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
  it('builds midpoint control segments for a smooth price line', () => {
    expect(
      smoothChartSegments([
        { x: 10, y: 80 },
        { x: 50, y: 40 },
        { x: 90, y: 60 },
      ]),
    ).toEqual([
      { controlX: 30, controlY: 80, endX: 30, endY: 60 },
      { controlX: 30, controlY: 40, endX: 50, endY: 40 },
      { controlX: 70, controlY: 40, endX: 70, endY: 50 },
      { controlX: 70, controlY: 60, endX: 90, endY: 60 },
    ]);
  });
});
