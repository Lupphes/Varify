import { VariantFilter } from "./query/VariantFilter.js";
import { VariantFlattener } from "./storage/VariantFlattener.js";
import { LoggerService } from "../utils/LoggerService.js";

const logger = new LoggerService("DexieVariantQuery");

export class DexieVariantQuery {
  constructor(dexieDB) {
    this.db = dexieDB;
  }

  async queryVariants(prefix, filters = {}, options = {}) {
    const { offset = 0, limit = 100, sort = null, multiCallerMode = false } = options;
    const table = this.db.getVariantTable(prefix);

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

    const hasFilters = Object.keys(filters).length > 0;

    if (hasFilters || multiCallerMode) {
      collection = collection.filter(variant => {
        return VariantFilter.matchesFilters(variant, filters, multiCallerMode);
      });
    }

    const results = await collection.offset(offset).limit(limit).toArray();
    return results;
  }

  async getVariantCount(prefix, filters = {}, options = {}) {
    const { multiCallerMode = false } = options;
    const table = this.db.getVariantTable(prefix);

    if (Object.keys(filters).length === 0 && !multiCallerMode) {
      return await table.count();
    }

    const count = await table.filter(variant => {
      return VariantFilter.matchesFilters(variant, filters, multiCallerMode);
    }).count();

    return count;
  }

  async storeVariants(prefix, variants) {
    const table = this.db.getVariantTable(prefix);

    logger.debug(`Dexie: Storing ${variants.length} variants in ${prefix}...`);
    const startTime = Date.now();

    const flattened = variants.map(v => VariantFlattener.flattenVariantForStorage(v));

    const BATCH_SIZE = 1000;
    for (let i = 0; i < flattened.length; i += BATCH_SIZE) {
      const batch = flattened.slice(i, i + BATCH_SIZE);
      await table.bulkPut(batch);

      if ((i + BATCH_SIZE) % 10000 === 0) {
        logger.debug(`Dexie: Stored ${Math.min(i + BATCH_SIZE, flattened.length)}/${flattened.length} variants...`);
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
