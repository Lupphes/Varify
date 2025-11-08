import { VariantFilter } from "./query/VariantFilter.js";
import { VariantFlattener } from "./storage/VariantFlattener.js";
import { LoggerService } from "../utils/LoggerService.js";

const logger = new LoggerService("DexieVariantQuery");

export class DexieVariantQuery {
  constructor(dexieDB) {
    this.db = dexieDB;
    this.activeQueries = new Map();
  }

  cancelQuery(queryId) {
    const queryController = this.activeQueries.get(queryId);
    if (queryController) {
      queryController.cancelled = true;
      this.activeQueries.delete(queryId);
      logger.debug(`Cancelled query: ${queryId}`);
    }
  }

  cancelQueriesByPrefix(prefix) {
    let cancelledCount = 0;
    this.activeQueries.forEach((controller, queryId) => {
      if (queryId.startsWith(prefix)) {
        controller.cancelled = true;
        this.activeQueries.delete(queryId);
        logger.debug(`Cancelled query: ${queryId}`);
        cancelledCount++;
      }
    });
    if (cancelledCount > 0) {
      logger.debug(`Cancelled ${cancelledCount} queries with prefix: ${prefix}`);
    }
  }

  cancelAllQueries() {
    this.activeQueries.forEach((controller, queryId) => {
      controller.cancelled = true;
      logger.debug(`Cancelled query: ${queryId}`);
    });
    this.activeQueries.clear();
  }

  async queryVariants(prefix, filters = {}, options = {}) {
    const { offset = 0, limit = 100, sort = null, multiCallerMode = false, queryId = null } = options;

    if (queryId) {
      const controller = { cancelled: false };
      this.activeQueries.set(queryId, controller);
    }

    const table = this.db.getVariantTable(prefix);
    const hasFilters = Object.keys(filters).length > 0;
    let collection;

    const queryController = queryId ? this.activeQueries.get(queryId) : null;

    try {
      // Strategy 1: Use anyOf() for categorical filters with indexes (FASTEST)
      if (hasFilters && !multiCallerMode) {
        const singleCategoricalFilter = this.detectSingleCategoricalFilter(filters);
        if (singleCategoricalFilter) {
          const { field, values } = singleCategoricalFilter;
          const indexExists = table.schema.indexes.some(idx => idx.name === field);

          if (indexExists && values.length > 0) {
            logger.debug(`Using anyOf() index query on ${field} with ${values.length} values`);

            let collection = table.where(field).anyOf(values);

            // Use and() for indexed equality filters, then filter() for complex ones
            const remainingFilters = { ...filters };
            delete remainingFilters[field];

            const indexedEqualityFilters = this.extractIndexedEqualityFilters(table, remainingFilters);

            // Apply indexed filters using and() - these are evaluated in IndexedDB
            for (const [filterField, filterValue] of Object.entries(indexedEqualityFilters)) {
              collection = collection.and(variant => variant[filterField] === filterValue);
              delete remainingFilters[filterField];
              logger.debug(`Applied indexed equality filter: ${filterField}`);
            }

            // Apply remaining complex filters in JavaScript only
            if (Object.keys(remainingFilters).length > 0) {
              collection = collection.and(variant => {
                if (queryController && queryController.cancelled) throw new Error('Query cancelled');
                return VariantFilter.matchesFilters(variant, remainingFilters, multiCallerMode);
              });
            }

            // Handle sorting
            if (sort && sort.field) {
              let results = await collection.toArray();
              results.sort((a, b) => {
                const aVal = a[sort.field];
                const bVal = b[sort.field];
                if (aVal < bVal) return sort.direction === 'desc' ? 1 : -1;
                if (aVal > bVal) return sort.direction === 'desc' ? -1 : 1;
                return 0;
              });
              return results.slice(offset, offset + limit);
            }

            return await collection.offset(offset).limit(limit).toArray();
          }
        }
      }

      // Strategy 2: Use between() for numeric range filters with indexes
      if (hasFilters && !multiCallerMode && !sort) {
        const bestIndex = VariantFilter.selectBestIndex(filters);
        if (bestIndex && bestIndex !== 'CHROM_POS') {
          const indexExists = table.schema.indexes.some(idx => idx.name === bestIndex);
          if (indexExists) {
            const keyRange = VariantFilter.buildKeyRange(filters, bestIndex);
            if (keyRange) {
              logger.debug(`Using index ${bestIndex} for range query`);

              let collection = table.where(bestIndex).between(
                keyRange.lower,
                keyRange.upper,
                !keyRange.lowerOpen,
                !keyRange.upperOpen
              );

              const remainingFilters = { ...filters };
              delete remainingFilters[bestIndex];

              const indexedEqualityFilters = this.extractIndexedEqualityFilters(table, remainingFilters);

              for (const [filterField, filterValue] of Object.entries(indexedEqualityFilters)) {
                collection = collection.and(variant => variant[filterField] === filterValue);
                delete remainingFilters[filterField];
                logger.debug(`Applied indexed equality filter: ${filterField}`);
              }

              if (Object.keys(remainingFilters).length > 0) {
                collection = collection.and(variant => {
                  if (queryController && queryController.cancelled) throw new Error('Query cancelled');
                  return VariantFilter.matchesFilters(variant, remainingFilters, multiCallerMode);
                });
              }

              return await collection.offset(offset).limit(limit).toArray();
            }
          }
        }
      }

      // Strategy 3: Fallback to full scan (slowest)
      logger.debug('Using full table scan');
      let collection = table.toCollection();

      if (sort && sort.field) {
        const indexExists = table.schema.indexes.some(idx => idx.name === sort.field);
        if (indexExists) {
          collection = table.orderBy(sort.field);
          if (sort.direction === 'desc') {
            collection = collection.reverse();
          }
        }
      }

      if (hasFilters || multiCallerMode) {
        // Try to apply indexed equality filters first with and()
        const indexedEqualityFilters = this.extractIndexedEqualityFilters(table, filters);
        const appliedFilters = { ...filters };

        for (const [filterField, filterValue] of Object.entries(indexedEqualityFilters)) {
          collection = collection.and(variant => variant[filterField] === filterValue);
          delete appliedFilters[filterField];
          logger.debug(`Applied indexed equality filter: ${filterField}`);
        }

        // Apply remaining filters
        if (Object.keys(appliedFilters).length > 0 || multiCallerMode) {
          collection = collection.and(variant => {
            if (queryController && queryController.cancelled) throw new Error('Query cancelled');
            return VariantFilter.matchesFilters(variant, appliedFilters, multiCallerMode);
          });
        }
      }

      let results;
      if (sort && sort.field) {
        const indexExists = table.schema.indexes.some(idx => idx.name === sort.field);
        if (!indexExists) {
          results = await collection.toArray();
          results.sort((a, b) => {
            const aVal = a[sort.field];
            const bVal = b[sort.field];
            if (aVal < bVal) return sort.direction === 'desc' ? 1 : -1;
            if (aVal > bVal) return sort.direction === 'desc' ? -1 : 1;
            return 0;
          });
          results = results.slice(offset, offset + limit);
        } else {
          results = await collection.offset(offset).limit(limit).toArray();
        }
      } else {
        results = await collection.offset(offset).limit(limit).toArray();
      }

      if (queryId) {
        this.activeQueries.delete(queryId);
      }

      return results;
    } catch (error) {
      if (queryId) {
        this.activeQueries.delete(queryId);
      }

      if (error.message === 'Query cancelled') {
        logger.debug(`Query ${queryId} was cancelled`);
        return [];
      }
      throw error;
    }
  }

  detectSingleCategoricalFilter(filters) {
    const categoricalFields = ['SVTYPE', 'CHROM', 'FILTER', 'PRIMARY_CALLER', 'SUPP_CALLERS'];

    for (const field of categoricalFields) {
      if (filters[field] && typeof filters[field] === 'object' && filters[field].values) {
        return { field, values: filters[field].values };
      }
    }

    return null;
  }

  extractIndexedEqualityFilters(table, filters) {
    const indexedFilters = {};
    const availableIndexes = Array.from(table.schema.indexes).map(idx => idx.name);

    for (const [field, filter] of Object.entries(filters)) {
      // Only handle simple equality filters that have indexes
      if (availableIndexes.includes(field)) {
        // Check if it's a simple equality (not range, not array)
        if (typeof filter === 'string' || typeof filter === 'number') {
          indexedFilters[field] = filter;
        }
      }
    }

    return indexedFilters;
  }

  async getVariantCount(prefix, filters = {}, options = {}) {
    const { multiCallerMode = false, queryId = null } = options;

    if (queryId) {
      const controller = { cancelled: false };
      this.activeQueries.set(queryId, controller);
    }

    const table = this.db.getVariantTable(prefix);
    const hasFilters = Object.keys(filters).length > 0;

    if (!hasFilters && !multiCallerMode) {
      const count = await table.count();
      if (queryId) {
        this.activeQueries.delete(queryId);
      }
      return count;
    }

    try {
      const queryController = queryId ? this.activeQueries.get(queryId) : null;

      // Use same index optimization strategy as queryVariants
      if (hasFilters && !multiCallerMode) {
        const singleCategoricalFilter = this.detectSingleCategoricalFilter(filters);
        if (singleCategoricalFilter) {
          const { field, values } = singleCategoricalFilter;
          const indexExists = table.schema.indexes.some(idx => idx.name === field);

          if (indexExists && values.length > 0) {
            logger.debug(`Using anyOf() index for count on ${field}`);

            let collection = table.where(field).anyOf(values);

            const remainingFilters = { ...filters };
            delete remainingFilters[field];

            const indexedEqualityFilters = this.extractIndexedEqualityFilters(table, remainingFilters);

            for (const [filterField, filterValue] of Object.entries(indexedEqualityFilters)) {
              collection = collection.and(variant => variant[filterField] === filterValue);
              delete remainingFilters[filterField];
            }

            if (Object.keys(remainingFilters).length > 0) {
              collection = collection.and(variant => {
                if (queryController && queryController.cancelled) throw new Error('Query cancelled');
                return VariantFilter.matchesFilters(variant, remainingFilters, multiCallerMode);
              });
            }

            const count = await collection.count();
            if (queryId) {
              this.activeQueries.delete(queryId);
            }
            return count;
          }
        }
      }

      // Fallback to full scan
      const count = await table.filter(variant => {
        if (queryController && queryController.cancelled) {
          throw new Error('Query cancelled');
        }
        return VariantFilter.matchesFilters(variant, filters, multiCallerMode);
      }).count();

      if (queryId) {
        this.activeQueries.delete(queryId);
      }

      return count;
    } catch (error) {
      if (queryId) {
        this.activeQueries.delete(queryId);
      }

      if (error.message === 'Query cancelled') {
        logger.debug(`Count query ${queryId} was cancelled`);
        return 0;
      }
      throw error;
    }
  }

  async storeVariants(prefix, variants, onProgress = null) {
    const table = this.db.getVariantTable(prefix);

    logger.debug(`Dexie: Storing ${variants.length} variants in ${prefix}...`);
    const startTime = Date.now();

    const flattened = variants.map(v => VariantFlattener.flattenVariantForStorage(v));

    const BATCH_SIZE = 1000;
    for (let i = 0; i < flattened.length; i += BATCH_SIZE) {
      const batch = flattened.slice(i, i + BATCH_SIZE);
      await table.bulkPut(batch);

      const stored = Math.min(i + BATCH_SIZE, flattened.length);
      if (onProgress) {
        onProgress(stored, flattened.length);
      }

      if ((i + BATCH_SIZE) % 10000 === 0) {
        logger.debug(`Dexie: Stored ${stored}/${flattened.length} variants...`);
      }
    }

    const elapsed = Date.now() - startTime;
    logger.info(`Dexie: Stored ${variants.length} variants in ${elapsed}ms (${Math.round(variants.length / (elapsed / 1000))} variants/sec)`);
  }

  async clearVariants(prefix) {
    const table = this.db.getVariantTable(prefix);
    await table.clear();
  }

  async hasVariants(prefix) {
    const table = this.db.getVariantTable(prefix);
    const count = await table.count();
    return count > 0;
  }

  async getAllVariants(prefix) {
    const table = this.db.getVariantTable(prefix);
    const variants = await table.toArray();

    // Also retrieve header if it exists
    const headerRecord = await this.db.metadata.get(`${prefix}_header`);
    const header = headerRecord ? headerRecord.value : null;

    return { variants, header };
  }

  async storeHeader(prefix, header) {
    await this.db.metadata.put({ key: `${prefix}_header`, value: header });
  }

  async getHeader(prefix) {
    const record = await this.db.metadata.get(`${prefix}_header`);
    return record ? record.value : null;
  }
}
