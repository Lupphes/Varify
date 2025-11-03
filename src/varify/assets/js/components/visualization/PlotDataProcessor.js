/**
 * Plot Data Processor
 *
 * Replicates Python plots.py data transformation logic for JavaScript.
 * Handles:
 * - Caller extraction and counting
 * - Percentile filtering
 * - KDE calculations
 * - Caller combinations
 * - Cross-tabulations
 */

import { quantiles, countBy, groupBy, gaussianKDE } from "../../utils/StatisticsUtils.js";
import { isMissing, isNumeric } from "../../utils/DataValidation.js";
import { PLOT_DEFAULTS } from "../../config/plots.js";

export class PlotDataProcessor {
  /**
   * Extract callers from variants (mimics extract_callers from Python)
   * Explodes SUPP_CALLERS column into individual records
   *
   * @param {Array} variants - Array of variant objects
   * @param {string} field - Field containing callers (default: SUPP_CALLERS)
   * @returns {Array} - Array of {variant, caller} pairs
   */
  static extractCallers(variants, field = "SUPP_CALLERS") {
    const exploded = [];

    for (const variant of variants) {
      const callersString = variant[field];

      if (!callersString) continue;

      const callers = String(callersString)
        .split(",")
        .map((c) => c.trim())
        .filter((c) => c.length > 0);

      for (const caller of callers) {
        exploded.push({
          ...variant,
          Caller: caller,
        });
      }
    }

    return exploded;
  }

  /**
   * Extract callers with duplicates (mimics extract_callers_with_duplicates)
   * Used for caller combination analysis
   *
   * @param {string} callersString - Comma-separated caller string
   * @returns {Array} - Array of caller names (with duplicates)
   */
  static extractCallersWithDuplicates(callersString) {
    if (!callersString) return [];

    const callers = String(callersString)
      .split(",")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    return callers;
  }

  /**
   * Filter variants by percentile range
   * Mimics Python's quantile filtering (e.g., 5th-95th percentile)
   *
   * @param {Array} variants - Array of variants
   * @param {string} field - Field to filter on (e.g., 'SVLEN', 'QUAL')
   * @param {number} lower - Lower percentile (0-1)
   * @param {number} upper - Upper percentile (0-1)
   * @returns {Array} - Filtered variants
   */
  static filterPercentile(
    variants,
    field,
    lower = PLOT_DEFAULTS.percentile.lower,
    upper = PLOT_DEFAULTS.percentile.upper
  ) {
    const values = variants.map((v) => v[field]).filter((val) => isNumeric(val));

    if (values.length === 0) return [];

    const [lowerBound, upperBound] = quantiles(values, [lower, upper]);

    return variants.filter((v) => {
      const val = v[field];
      return isNumeric(val) && val >= lowerBound && val <= upperBound;
    });
  }

  /**
   * Compute KDE (Kernel Density Estimation)
   *
   * @param {number[]} data - Data points
   * @param {number} numPoints - Number of evaluation points
   * @returns {{x: number[], y: number[]}} - KDE curve
   */
  static computeKDE(data, numPoints = 1000) {
    return gaussianKDE(data, null, numPoints);
  }

  /**
   * Compute caller combinations
   * Count SVs by number of supporting callers and which callers
   *
   * @param {Array} variants - Array of variants
   * @returns {Object} - { numCallers: { caller: count } }
   *   e.g., { 1: {delly: 50, manta: 30}, 2: {delly: 20, manta: 20} }
   */
  static computeCallerCombinations(variants) {
    const variantsWithCallers = variants.map((v) => ({
      ...v,
      caller_list_raw: this.extractCallersWithDuplicates(v.SUPP_CALLERS || ""),
    }));

    variantsWithCallers.forEach((v) => {
      v.num_callers = v.caller_list_raw.length;
    });

    const allCallers = new Set();
    variantsWithCallers.forEach((v) => {
      v.caller_list_raw.forEach((caller) => allCallers.add(caller));
    });

    const callersList = Array.from(allCallers).sort();

    variantsWithCallers.forEach((v) => {
      callersList.forEach((caller) => {
        v[`caller_${caller}`] = v.caller_list_raw.includes(caller) ? 1 : 0;
      });
    });

    const grouped = groupBy(variantsWithCallers, "num_callers");

    const counts = {};

    for (const [numCallers, variants] of Object.entries(grouped)) {
      counts[numCallers] = {};

      for (const caller of callersList) {
        const colName = `caller_${caller}`;
        const count = variants.reduce((sum, v) => sum + (v[colName] || 0), 0);
        counts[numCallers][caller] = count;
      }
    }

    return counts;
  }

  /**
   * Create cross-tabulation (2D contingency table)
   * Mimics pandas crosstab
   *
   * @param {Array} variants - Array of variants
   * @param {string} rowKey - Field for rows (e.g., 'Caller')
   * @param {string} colKey - Field for columns (e.g., 'SVTYPE')
   * @returns {Object} - {rows: [...], cols: [...], values: [[...]]}
   */
  static crosstab(variants, rowKey, colKey) {
    const rowValues = [...new Set(variants.map((v) => v[rowKey]))].filter(
      (v) => v !== null && v !== undefined
    );
    const colValues = [...new Set(variants.map((v) => v[colKey]))].filter(
      (v) => v !== null && v !== undefined
    );

    rowValues.sort();
    colValues.sort();

    const values = Array.from({ length: rowValues.length }, () => Array(colValues.length).fill(0));

    for (const variant of variants) {
      const rowVal = variant[rowKey];
      const colVal = variant[colKey];

      if (rowVal === null || rowVal === undefined || colVal === null || colVal === undefined)
        continue;

      const rowIdx = rowValues.indexOf(rowVal);
      const colIdx = colValues.indexOf(colVal);

      if (rowIdx >= 0 && colIdx >= 0) {
        values[rowIdx][colIdx]++;
      }
    }

    return {
      rows: rowValues,
      cols: colValues,
      values: values,
    };
  }

  /**
   * Filter variants (remove null/undefined values for a field)
   * @param {Array} variants - Array of variants
   * @param {string} field - Field to check
   * @returns {Array} - Filtered variants
   */
  static filterNA(variants, field) {
    return variants.filter((v) => !isMissing(v[field]));
  }

  /**
   * Sort variants by field
   * @param {Array} variants - Array of variants
   * @param {string} field - Field to sort by
   * @param {boolean} ascending - Sort order
   * @returns {Array} - Sorted variants
   */
  static sortBy(variants, field, ascending = true) {
    const sorted = [...variants].sort((a, b) => {
      const valA = a[field];
      const valB = b[field];

      if (valA === valB) return 0;
      if (isMissing(valA)) return 1;
      if (isMissing(valB)) return -1;

      if (typeof valA === "string") {
        return ascending ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      return ascending ? valA - valB : valB - valA;
    });

    return sorted;
  }

  /**
   * Create histogram-style frequency counts
   * @param {Array} variants - Array of variants
   * @param {string} field - Field to count
   * @returns {Object} - {value: count} sorted by count descending
   */
  static valueCounts(variants, field) {
    const counts = countBy(variants, field);

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    return Object.fromEntries(sorted);
  }
}
