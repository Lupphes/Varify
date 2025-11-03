/**
 * Statistics Utilities for Plot Data Processing
 *
 * Provides statistical functions matching Python's numpy/scipy functionality:
 * - Percentile calculations
 * - Gaussian KDE (Kernel Density Estimation)
 * - Histogram binning
 * - Grouping and counting
 */

/**
 * Calculate quantile/percentile of a dataset
 * @param {number[]} data - Sorted or unsorted array of numbers
 * @param {number} percentile - Percentile to calculate (0-1)
 * @returns {number} - Value at the given percentile
 */
export function quantile(data, percentile) {
  const sorted = [...data].sort((a, b) => a - b);
  const index = percentile * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (upper >= sorted.length) return sorted[sorted.length - 1];
  if (lower < 0) return sorted[0];

  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Calculate multiple quantiles at once
 * @param {number[]} data - Array of numbers
 * @param {number[]} percentiles - Array of percentiles [0.05, 0.95]
 * @returns {number[]} - Array of quantile values
 */
export function quantiles(data, percentiles) {
  return percentiles.map((p) => quantile(data, p));
}

/**
 * Gaussian Kernel Density Estimation
 * Mimics scipy.stats.gaussian_kde
 *
 * @param {number[]} data - Data points
 * @param {number} bandwidth - Bandwidth parameter (null = Scott's rule)
 * @param {number} numPoints - Number of points to evaluate KDE
 * @returns {{x: number[], y: number[]}} - KDE curve points
 */
export function gaussianKDE(data, bandwidth = null, numPoints = 1000) {
  if (data.length === 0) {
    return { x: [], y: [] };
  }

  if (bandwidth === null) {
    const stdDev = standardDeviation(data);
    bandwidth = 1.06 * stdDev * Math.pow(data.length, -0.2);
  }

  if (bandwidth === 0 || !isFinite(bandwidth)) {
    bandwidth = 1.0;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min;

  // Extend range slightly for smooth tails
  const xMin = min - range * 0.1;
  const xMax = max + range * 0.1;
  const step = (xMax - xMin) / (numPoints - 1);

  const x = [];
  const y = [];

  for (let i = 0; i < numPoints; i++) {
    const xi = xMin + i * step;
    x.push(xi);

    let density = 0;
    for (const dataPoint of data) {
      const z = (xi - dataPoint) / bandwidth;
      density += gaussianKernel(z);
    }
    density /= data.length * bandwidth;

    y.push(density);
  }

  return { x, y };
}

/**
 * Gaussian kernel function
 */
function gaussianKernel(x) {
  return (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);
}

/**
 * Calculate standard deviation
 */
function standardDeviation(data) {
  const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
  const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
  return Math.sqrt(variance);
}

/**
 * Create histogram bins
 * @param {number[]} data - Data to bin
 * @param {number} numBins - Number of bins
 * @param {string} histnorm - Normalization ('percent', 'probability', null)
 * @returns {Object} - Histogram data
 */
export function histogram(data, numBins, histnorm = null) {
  if (data.length === 0) {
    return { bins: [], counts: [], binEdges: [], binLabels: [], percentages: [] };
  }

  const min = Math.min(...data);
  const max = Math.max(...data);

  if (min === max) {
    const bins = [data.length];
    const binEdges = [min - 0.5, min + 0.5];
    const percentage = histnorm === "percent" ? 100 : histnorm === "probability" ? 1 : data.length;
    const binLabels = [`${min.toFixed(0)}`];

    return {
      bins,
      counts: bins,
      binEdges,
      binLabels,
      percentages: [percentage],
      data: [[min, percentage]],
    };
  }

  const binWidth = (max - min) / numBins;

  const bins = Array(numBins).fill(0);
  const binEdges = Array.from({ length: numBins + 1 }, (_, i) => min + i * binWidth);

  for (const value of data) {
    let binIndex = Math.floor((value - min) / binWidth);
    if (binIndex >= numBins) binIndex = numBins - 1;
    if (binIndex < 0) binIndex = 0;
    bins[binIndex]++;
  }

  let values = bins;
  if (histnorm === "percent") {
    const total = data.length;
    values = bins.map((count) => (count / total) * 100);
  } else if (histnorm === "probability") {
    const total = data.length;
    values = bins.map((count) => count / total);
  }

  const binLabels = binEdges
    .slice(0, -1)
    .map((edge, i) => `${edge.toFixed(0)}-${binEdges[i + 1].toFixed(0)}`);

  const chartData = binEdges.slice(0, -1).map((edge, i) => [edge, values[i]]);

  return {
    bins,
    counts: bins,
    binEdges,
    binLabels,
    percentages: values,
    data: chartData, // [[x, y], ...] format for ECharts
  };
}

/**
 * Count occurrences of each unique value
 * Mimics pandas value_counts()
 *
 * @param {any[]} array - Array to count
 * @param {string} key - Optional key function or object key
 * @returns {Object} - {value: count}
 */
export function countBy(array, key = null) {
  const counts = {};

  for (const item of array) {
    const value = key ? (typeof key === "function" ? key(item) : item[key]) : item;

    if (value === null || value === undefined) continue;

    counts[value] = (counts[value] || 0) + 1;
  }

  return counts;
}

/**
 * Group array by key
 * @param {any[]} array - Array to group
 * @param {string|Function} key - Key to group by
 * @returns {Object} - {keyValue: [items]}
 */
export function groupBy(array, key) {
  const groups = {};

  for (const item of array) {
    const value = typeof key === "function" ? key(item) : item[key];

    if (value === null || value === undefined) continue;

    if (!groups[value]) {
      groups[value] = [];
    }
    groups[value].push(item);
  }

  return groups;
}

/**
 * Calculate boxplot statistics (min, Q1, median, Q3, max)
 * @param {number[]} data - Sorted array of numbers
 * @returns {number[]} - [min, Q1, median, Q3, max]
 */
export function boxplotStats(data) {
  if (data.length === 0) {
    return [0, 0, 0, 0, 0];
  }

  const sorted = [...data].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const q1 = quantile(sorted, 0.25);
  const median = quantile(sorted, 0.5);
  const q3 = quantile(sorted, 0.75);

  return [min, q1, median, q3, max];
}

/**
 * Sum array values
 */
export function sum(array) {
  return array.reduce((total, val) => total + val, 0);
}

/**
 * Calculate mean
 */
export function mean(array) {
  return sum(array) / array.length;
}

/**
 * Create histogram with logarithmic (custom) bins
 * Useful for heavily skewed distributions like SV sizes
 *
 * @param {number[]} data - Data to bin
 * @param {number[]} binEdges - Custom bin edges (e.g., [0, 100, 1000, 10000, Infinity])
 * @param {string} histnorm - Normalization ('percent', 'probability', null)
 * @returns {Object} - Histogram data with custom bins
 */
export function histogramLog(data, binEdges, histnorm = null) {
  if (data.length === 0 || binEdges.length < 2) {
    return { bins: [], counts: [], binEdges: [], binLabels: [], percentages: [] };
  }

  const numBins = binEdges.length - 1;
  const bins = Array(numBins).fill(0);

  for (const value of data) {
    const absValue = Math.abs(value);

    for (let i = 0; i < numBins; i++) {
      if (absValue >= binEdges[i] && absValue < binEdges[i + 1]) {
        bins[i]++;
        break;
      }
    }
  }

  let values = bins;
  if (histnorm === "percent") {
    const total = data.length;
    values = bins.map((count) => (count / total) * 100);
  } else if (histnorm === "probability") {
    const total = data.length;
    values = bins.map((count) => count / total);
  }

  const binLabels = binEdges.slice(0, -1).map((edge, i) => {
    const start = edge;
    const end = binEdges[i + 1];

    const formatNum = (num) => {
      if (!isFinite(num)) return "∞";
      if (num >= 1e6) return (num / 1e6).toFixed(0) + "M";
      if (num >= 1e3) return (num / 1e3).toFixed(0) + "K";
      return num.toString();
    };

    return `${formatNum(start)}-${formatNum(end)}`;
  });

  const chartData = binLabels.map((label, i) => [label, values[i]]);

  return {
    bins,
    counts: bins,
    binEdges,
    binLabels,
    percentages: values,
    data: chartData, // [[label, y], ...] format for ECharts
  };
}
