/**
 * Tests for StatisticsUtils
 */

import { describe, it, expect } from "vitest";
import {
  quantile,
  quantiles,
  gaussianKDE,
  histogram,
  countBy,
  groupBy,
  boxplotStats,
  sum,
  mean,
} from "../../../src/varify/assets/js/utils/StatisticsUtils.js";

describe("StatisticsUtils - Quantile Calculation", () => {
  it("calculates median (50th percentile)", () => {
    const data = [1, 2, 3, 4, 5];

    const result = quantile(data, 0.5);

    expect(result).toBe(3);
  });

  it("calculates 25th percentile (Q1)", () => {
    const data = [1, 2, 3, 4, 5];

    const result = quantile(data, 0.25);

    expect(result).toBe(2);
  });

  it("calculates 75th percentile (Q3)", () => {
    const data = [1, 2, 3, 4, 5];

    const result = quantile(data, 0.75);

    expect(result).toBe(4);
  });

  it("interpolates between values", () => {
    const data = [1, 2, 3, 4];

    const result = quantile(data, 0.5);

    expect(result).toBe(2.5);
  });

  it("handles unsorted data", () => {
    const data = [5, 2, 4, 1, 3];

    const result = quantile(data, 0.5);

    expect(result).toBe(3);
  });

  it("handles single value", () => {
    const data = [42];

    const result = quantile(data, 0.5);

    expect(result).toBe(42);
  });

  it("calculates multiple quantiles at once", () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    const result = quantiles(data, [0.25, 0.5, 0.75]);

    expect(result).toHaveLength(3);
    expect(result[0]).toBeCloseTo(3.25, 1);
    expect(result[1]).toBeCloseTo(5.5, 1);
    expect(result[2]).toBeCloseTo(7.75, 1);
  });
});

describe("StatisticsUtils - Gaussian KDE", () => {
  it("calculates KDE for simple dataset", () => {
    const data = [1, 2, 3, 4, 5];

    const result = gaussianKDE(data);

    expect(result.x).toHaveLength(1000);
    expect(result.y).toHaveLength(1000);
    expect(result.x[0]).toBeLessThan(1); // Extended range
    expect(result.x[result.x.length - 1]).toBeGreaterThan(5);
  });

  it("returns empty arrays for empty dataset", () => {
    const data = [];

    const result = gaussianKDE(data);

    expect(result.x).toEqual([]);
    expect(result.y).toEqual([]);
  });

  it("respects numPoints parameter", () => {
    const data = [1, 2, 3];

    const result = gaussianKDE(data, null, 100);

    expect(result.x).toHaveLength(100);
    expect(result.y).toHaveLength(100);
  });

  it("respects custom bandwidth", () => {
    const data = [1, 2, 3, 4, 5];

    const result1 = gaussianKDE(data, 0.1, 100);
    const result2 = gaussianKDE(data, 1.0, 100);

    // Different bandwidths should produce different results
    expect(result1.y).not.toEqual(result2.y);
  });

  it("handles zero bandwidth gracefully", () => {
    const data = [1, 1, 1]; // All same value -> zero std dev -> zero bandwidth

    const result = gaussianKDE(data);

    expect(result.x).toHaveLength(1000);
    expect(result.y).toHaveLength(1000);
  });
});

describe("StatisticsUtils - Histogram", () => {
  it("creates histogram bins", () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    const result = histogram(data, 5);

    expect(result.bins).toHaveLength(5);
    expect(result.binEdges).toHaveLength(6);
    expect(result.binLabels).toHaveLength(5);
    expect(sum(result.bins)).toBe(10);
  });

  it("normalizes to percentages", () => {
    const data = [1, 2, 3, 4, 5];

    const result = histogram(data, 5, "percent");

    expect(sum(result.percentages)).toBeCloseTo(100, 1);
  });

  it("normalizes to probabilities", () => {
    const data = [1, 2, 3, 4, 5];

    const result = histogram(data, 5, "probability");

    expect(sum(result.percentages)).toBeCloseTo(1, 5);
  });

  it("returns empty result for empty data", () => {
    const data = [];

    const result = histogram(data, 5);

    expect(result.bins).toEqual([]);
    expect(result.counts).toEqual([]);
  });

  it("handles single bin", () => {
    const data = [1, 2, 3, 4, 5];

    const result = histogram(data, 1);

    expect(result.bins).toHaveLength(1);
    expect(result.bins[0]).toBe(5);
  });

  it("provides chart-compatible data format", () => {
    const data = [1, 2, 3, 4, 5];

    const result = histogram(data, 2);

    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data[0]).toHaveLength(2); // [x, y] format
  });
});

describe("StatisticsUtils - CountBy", () => {
  it("counts primitive values", () => {
    const data = ["a", "b", "a", "c", "b", "a"];

    const result = countBy(data);

    expect(result).toEqual({ a: 3, b: 2, c: 1 });
  });

  it("counts by object key", () => {
    const data = [{ type: "DEL" }, { type: "INS" }, { type: "DEL" }, { type: "DEL" }];

    const result = countBy(data, "type");

    expect(result).toEqual({ DEL: 3, INS: 1 });
  });

  it("counts by custom function", () => {
    const data = [1, 2, 3, 4, 5, 6];

    const result = countBy(data, (x) => (x % 2 === 0 ? "even" : "odd"));

    expect(result).toEqual({ odd: 3, even: 3 });
  });

  it("skips null and undefined values", () => {
    const data = ["a", null, "b", undefined, "a"];

    const result = countBy(data);

    expect(result).toEqual({ a: 2, b: 1 });
  });

  it("handles empty array", () => {
    const data = [];

    const result = countBy(data);

    expect(result).toEqual({});
  });
});

describe("StatisticsUtils - GroupBy", () => {
  it("groups by object key", () => {
    const data = [
      { type: "DEL", value: 1 },
      { type: "INS", value: 2 },
      { type: "DEL", value: 3 },
    ];

    const result = groupBy(data, "type");

    expect(result.DEL).toHaveLength(2);
    expect(result.INS).toHaveLength(1);
    expect(result.DEL[0].value).toBe(1);
    expect(result.DEL[1].value).toBe(3);
  });

  it("groups by custom function", () => {
    const data = [1, 2, 3, 4, 5, 6];

    const result = groupBy(data, (x) => (x % 2 === 0 ? "even" : "odd"));

    expect(result.odd).toEqual([1, 3, 5]);
    expect(result.even).toEqual([2, 4, 6]);
  });

  it("skips null and undefined values", () => {
    const data = [{ type: "DEL" }, { type: null }, { type: "INS" }];

    const result = groupBy(data, "type");

    expect(result.DEL).toHaveLength(1);
    expect(result.INS).toHaveLength(1);
    expect(result.null).toBeUndefined();
  });

  it("handles empty array", () => {
    const data = [];

    const result = groupBy(data, "type");

    expect(result).toEqual({});
  });
});

describe("StatisticsUtils - Boxplot Statistics", () => {
  it("calculates boxplot stats", () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    const [min, q1, median, q3, max] = boxplotStats(data);

    expect(min).toBe(1);
    expect(q1).toBeCloseTo(3.25, 1);
    expect(median).toBeCloseTo(5.5, 1);
    expect(q3).toBeCloseTo(7.75, 1);
    expect(max).toBe(10);
  });

  it("handles small dataset", () => {
    const data = [1, 2, 3];

    const [min, q1, median, q3, max] = boxplotStats(data);

    expect(min).toBe(1);
    expect(median).toBe(2);
    expect(max).toBe(3);
  });

  it("handles single value", () => {
    const data = [42];

    const [min, q1, median, q3, max] = boxplotStats(data);

    expect(min).toBe(42);
    expect(q1).toBe(42);
    expect(median).toBe(42);
    expect(q3).toBe(42);
    expect(max).toBe(42);
  });

  it("returns zeros for empty dataset", () => {
    const data = [];

    const [min, q1, median, q3, max] = boxplotStats(data);

    expect(min).toBe(0);
    expect(q1).toBe(0);
    expect(median).toBe(0);
    expect(q3).toBe(0);
    expect(max).toBe(0);
  });
});

describe("StatisticsUtils - Sum and Mean", () => {
  it("calculates sum", () => {
    const data = [1, 2, 3, 4, 5];

    const result = sum(data);

    expect(result).toBe(15);
  });

  it("calculates mean", () => {
    const data = [1, 2, 3, 4, 5];

    const result = mean(data);

    expect(result).toBe(3);
  });

  it("handles negative numbers", () => {
    const data = [-5, -3, 0, 3, 5];

    expect(sum(data)).toBe(0);
    expect(mean(data)).toBe(0);
  });

  it("handles floating point numbers", () => {
    const data = [1.5, 2.5, 3.5];

    expect(sum(data)).toBeCloseTo(7.5);
    expect(mean(data)).toBeCloseTo(2.5);
  });
});

describe("StatisticsUtils - Edge Cases", () => {
  it("handles very large numbers", () => {
    const data = [1e10, 2e10, 3e10];

    const result = mean(data);

    expect(result).toBeCloseTo(2e10);
  });

  it("handles very small numbers", () => {
    const data = [1e-10, 2e-10, 3e-10];

    const result = mean(data);

    expect(result).toBeCloseTo(2e-10);
  });

  it("histogram handles identical values", () => {
    const data = [5, 5, 5, 5, 5];

    const result = histogram(data, 5);

    expect(sum(result.bins)).toBe(5);
  });
});
