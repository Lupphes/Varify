/**
 * Variant Filter
 *
 * Handles variant filtering logic including:
 * - Index selection for optimization
 * - KeyRange building
 * - Filter matching (primary and multi-caller modes)
 */

import { isMissing, parseNumericValue } from "../../utils/DataValidation.js";

export class VariantFilter {
  /**
   * Check if object store has an index
   * @param {IDBObjectStore} objectStore
   * @param {string} indexName
   * @returns {boolean}
   */
  static hasIndex(objectStore, indexName) {
    return objectStore.indexNames.contains(indexName);
  }

  /**
   * Select best index for query optimization
   * @param {Object} filters - Filter object
   * @returns {string|null} Index name or null
   */
  static selectBestIndex(filters) {
    const indexPriority = [
      "CHROM_POS",
      "CHROM",
      "SVTYPE",
      "PRIMARY_CALLER",
      "GQ",
      "SR_MIN",
      "FILTER",
    ];

    for (const indexName of indexPriority) {
      if (indexName === "CHROM_POS" && filters.CHROM && filters.POS) {
        return indexName;
      }
      if (filters[indexName] !== undefined) {
        const filterValue = filters[indexName];

        if (typeof filterValue === "object" && filterValue.values !== undefined) {
          continue;
        }

        return indexName;
      }
    }

    return null;
  }

  /**
   * Build IDBKeyRange for index
   * @param {Object} filters - Filter object
   * @param {string} indexName - Index name
   * @returns {IDBKeyRange|null}
   */
  static buildKeyRange(filters, indexName) {
    if (indexName === "CHROM_POS") {
      const chrom = filters.CHROM;
      return IDBKeyRange.bound([chrom, 0], [chrom, Number.MAX_SAFE_INTEGER]);
    }

    const value = filters[indexName];

    if (typeof value === "object" && value.values !== undefined) {
      return null;
    }

    if (typeof value === "object" && value.min !== undefined) {
      if (value.max !== undefined) {
        return IDBKeyRange.bound(value.min, value.max);
      }
      return IDBKeyRange.lowerBound(value.min);
    }

    if (typeof value === "object" && value.max !== undefined) {
      return IDBKeyRange.upperBound(value.max);
    }

    return IDBKeyRange.only(value);
  }

  /**
   * Check if variant matches all filters
   * @param {Object} variant - Variant object
   * @param {Object} filters - Filter object
   * @param {boolean} multiCallerMode - Multi-caller filtering mode
   * @returns {boolean}
   */
  static matchesFilters(variant, filters, multiCallerMode = false) {
    for (const [field, filter] of Object.entries(filters)) {
      const value = variant[field];

      // For SURVIVOR multi-caller mode, check if ANY caller matches
      // Special handling for certain fields:
      // - SVTYPE maps to TY field in each caller
      // - FORMAT fields (GQ, DP, etc.) check in _allCallers directly
      // - INFO fields (NUM_CALLERS, CHROM, POS) use variant-level filtering
      if (multiCallerMode && variant._allCallers && variant._allCallers.length > 0) {
        // Special case: SVTYPE should check TY field in each caller
        if (field === "SVTYPE") {
          const anyCallerMatches = this.checkMultiCallerFilter(
            variant._allCallers,
            "TY", // Map SVTYPE to TY in per-caller data
            filter
          );
          if (!anyCallerMatches) {
            return false;
          }
          continue;
        }

        const isFormatField = variant._allCallers.some((caller) => field in caller);

        if (isFormatField) {
          const anyCallerMatches = this.checkMultiCallerFilter(variant._allCallers, field, filter);
          if (!anyCallerMatches) {
            return false;
          }
          continue;
        }
        // If not a FORMAT field, fall through to standard filtering
      }

      // Standard filtering (INFO fields or PRIMARY caller when not multi-caller mode)
      if (typeof filter === "object" && filter.values !== undefined) {
        if (!filter.values.includes(value)) {
          return false;
        }
        continue;
      }

      if (typeof filter === "object" && (filter.min !== undefined || filter.max !== undefined)) {
        if (isMissing(value)) {
          return false;
        }

        const numValue = parseNumericValue(value);
        if (numValue === null) {
          return false;
        }

        if (filter.min !== undefined && numValue < filter.min) {
          return false;
        }
        if (filter.max !== undefined && numValue > filter.max) {
          return false;
        }

        continue;
      }

      if (typeof filter === "string" && typeof value === "string") {
        if (!value.toLowerCase().includes(filter.toLowerCase())) {
          return false;
        }
        continue;
      }

      if (value !== filter) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if ANY caller matches the filter criteria
   * @param {Array} allCallers - Array of caller objects with FORMAT fields
   * @param {string} field - Field name to check
   * @param {*} filter - Filter criteria (value, range, or categorical)
   * @returns {boolean} - True if ANY caller matches
   */
  static checkMultiCallerFilter(allCallers, field, filter) {
    for (const caller of allCallers) {
      const value = caller[field];

      if (typeof filter === "object" && filter.values !== undefined) {
        if (filter.values.includes(value)) {
          return true;
        }
        continue;
      }

      if (typeof filter === "object" && (filter.min !== undefined || filter.max !== undefined)) {
        if (isMissing(value)) {
          continue;
        }

        const numValue = parseNumericValue(value);
        if (numValue === null) {
          continue;
        }

        let matches = true;
        if (filter.min !== undefined && numValue < filter.min) {
          matches = false;
        }
        if (filter.max !== undefined && numValue > filter.max) {
          matches = false;
        }

        if (matches) {
          return true;
        }
        continue;
      }

      if (typeof filter === "string" && typeof value === "string") {
        if (value.toLowerCase().includes(filter.toLowerCase())) {
          return true;
        }
        continue;
      }

      if (value === filter) {
        return true;
      }
    }

    return false;
  }
}
