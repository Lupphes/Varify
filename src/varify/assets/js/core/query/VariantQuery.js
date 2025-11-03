/**
 * Variant Query
 *
 * Handles variant querying with filtering, sorting, and pagination.
 * Optimizes queries using IndexedDB indexes when possible.
 */

import { VariantFilter } from "./VariantFilter.js";

export class VariantQuery {
  constructor(databaseManager) {
    this.dbManager = databaseManager;
  }

  /**
   * Query variants with filters and sorting
   * @param {string} prefix - 'bcf' or 'survivor'
   * @param {Object} filters - { CHROM: 'chr1', GQ: { min: 10, max: 50 }, ... }
   * @param {Object} options - { offset: 0, limit: 100, sort: { field: 'POS', direction: 'asc' }, multiCallerMode: false }
   * @returns {Promise<Array>}
   */
  async queryVariants(prefix, filters = {}, options = {}) {
    const db = await this.dbManager.getDB();
    const storeName = this.dbManager.getVariantStoreName(prefix);
    const { offset = 0, limit = 100, sort = null, multiCallerMode = false } = options;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], "readonly");
      const objectStore = transaction.objectStore(storeName);

      let indexName = VariantFilter.selectBestIndex(filters);

      if (multiCallerMode && indexName) {
        const index = objectStore.index(indexName);
        const indexPath = index.keyPath;
        const isFormatField = typeof indexPath === "string" && indexPath.startsWith("_computed.");

        if (isFormatField) {
          console.log(
            `Multi-caller mode: Disabling FORMAT field index "${indexName}" (keyPath: ${indexPath}) for full scan`
          );
          indexName = null;
        }
      }

      // Can't use sort index if the sort field has a multi-select filter
      const sortFieldHasMultiSelect =
        sort &&
        filters[sort.field] &&
        typeof filters[sort.field] === "object" &&
        filters[sort.field].values !== undefined;
      const canUseSortIndex =
        sort &&
        sort.field &&
        VariantFilter.hasIndex(objectStore, sort.field) &&
        !sortFieldHasMultiSelect;
      const useSortIndex = canUseSortIndex && (!indexName || indexName === sort.field);

      let cursorDirection = "next";
      if (useSortIndex && sort.direction === "desc") {
        cursorDirection = "prev";
      }

      let source;
      if (useSortIndex) {
        const sortIndex = objectStore.index(sort.field);
        const keyRange = filters[sort.field]
          ? VariantFilter.buildKeyRange(filters, sort.field)
          : null;
        source = sortIndex.openCursor(keyRange, cursorDirection);
        console.log(
          `Using index "${sort.field}" with cursor direction "${cursorDirection}" for fast sorting`
        );
      } else if (indexName) {
        const index = objectStore.index(indexName);
        const keyRange = VariantFilter.buildKeyRange(filters, indexName);
        source = index.openCursor(keyRange, cursorDirection);
      } else {
        source = objectStore.openCursor(null, cursorDirection);
      }

      const allMatches = [];
      const needsInMemorySort = sort && !useSortIndex;

      source.onsuccess = (event) => {
        const cursor = event.target.result;

        if (!cursor) {
          let results = allMatches;

          if (needsInMemorySort) {
            console.log(`Sorting ${results.length} variants in memory by ${sort.field}`);
            results.sort((a, b) => {
              const aVal = a[sort.field];
              const bVal = b[sort.field];

              if (aVal == null && bVal == null) return 0;
              if (aVal == null) return 1;
              if (bVal == null) return -1;

              if (typeof aVal === "number" && typeof bVal === "number") {
                return sort.direction === "asc" ? aVal - bVal : bVal - aVal;
              }

              const aStr = String(aVal);
              const bStr = String(bVal);
              const cmp = aStr.localeCompare(bStr);
              return sort.direction === "asc" ? cmp : -cmp;
            });
          }

          const paginatedResults = results.slice(offset, offset + limit);
          resolve(paginatedResults);
          return;
        }

        if (VariantFilter.matchesFilters(cursor.value, filters, multiCallerMode)) {
          allMatches.push(cursor.value);
        }

        cursor.continue();
      };

      source.onerror = () => {
        reject(new Error(`Query failed: ${source.error}`));
      };
    });
  }

  /**
   * Get count of variants matching filters
   * @param {string} prefix - 'bcf' or 'survivor'
   * @param {Object} filters - Filter object
   * @returns {Promise<number>}
   */
  async getVariantCount(prefix, filters = {}) {
    const db = await this.dbManager.getDB();
    const storeName = this.dbManager.getVariantStoreName(prefix);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], "readonly");
      const objectStore = transaction.objectStore(storeName);

      if (Object.keys(filters).length === 0) {
        const request = objectStore.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(new Error(`Count failed: ${request.error}`));
        return;
      }

      const source = objectStore.openCursor();
      let count = 0;

      source.onsuccess = (event) => {
        const cursor = event.target.result;

        if (!cursor) {
          resolve(count);
          return;
        }

        if (VariantFilter.matchesFilters(cursor.value, filters)) {
          count++;
        }

        cursor.continue();
      };

      source.onerror = () => reject(new Error(`Count failed: ${source.error}`));
    });
  }
}
