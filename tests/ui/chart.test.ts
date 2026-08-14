import { describe, expect, it } from 'vitest';

import { nearestChartPointIndex } from '../../src/ui/chart';

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
