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

    let usedIndexForFilter = false;
    if (hasFilters && !sort) {
      const bestIndex = VariantFilter.selectBestIndex(filters);
      if (bestIndex) {
        const indexExists = table.schema.indexes.some(idx => idx.name === bestIndex);
        if (indexExists) {
          const keyRange = VariantFilter.buildKeyRange(filters, bestIndex);
          if (keyRange) {
            try {
              collection = table.where(bestIndex).between(
                keyRange.lower,
                keyRange.upper,
                !keyRange.lowerOpen,
                !keyRange.upperOpen
              );
              usedIndexForFilter = true;
              logger.debug(`Using index ${bestIndex} for query optimization`);
            } catch (e) {
              collection = table.toCollection();
            }
          }
        }
      }
    }

    if (!usedIndexForFilter) {
      if (sort && sort.field) {
        const indexExists = table.schema.indexes.some(idx => idx.name === sort.field);

        if (indexExists) {
          collection = table.orderBy(sort.field);
          if (sort.direction === 'desc') {
            collection = collection.reverse();
          }
        } else {
          collection = table.toCollection();
        }
      } else {
        collection = table.toCollection();
      }
    }

    if (hasFilters || multiCallerMode) {
      const queryController = queryId ? this.activeQueries.get(queryId) : null;

      collection = collection.filter(variant => {
        if (queryController && queryController.cancelled) {
          throw new Error('Query cancelled');
        }
        return VariantFilter.matchesFilters(variant, filters, multiCallerMode);
      });
    }

    try {
      let results;

      if (sort && sort.field && !usedIndexForFilter) {
        const indexExists = table.schema.indexes.some(idx => idx.name === sort.field);

        if (!indexExists) {
          results = await collection.sortBy(sort.field);
          if (sort.direction === 'desc') {
            results.reverse();
          }
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

  async getVariantCount(prefix, filters = {}, options = {}) {
    const { multiCallerMode = false, queryId = null } = options;

    if (queryId) {
      const controller = { cancelled: false };
      this.activeQueries.set(queryId, controller);
    }

    const table = this.db.getVariantTable(prefix);

    if (Object.keys(filters).length === 0 && !multiCallerMode) {
      const count = await table.count();
      if (queryId) {
        this.activeQueries.delete(queryId);
      }
      return count;
    }

    try {
      const queryController = queryId ? this.activeQueries.get(queryId) : null;

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
}
