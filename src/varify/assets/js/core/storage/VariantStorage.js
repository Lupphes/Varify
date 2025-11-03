/**
 * Variant Storage
 *
 * Handles storing and clearing variants in IndexedDB.
 * Coordinates flattening and batch storage operations.
 */

import { VariantFlattener } from "./VariantFlattener.js";
import { LoggerService } from "../../utils/LoggerService.js";

const logger = new LoggerService("VariantStorage");

export class VariantStorage {
  constructor(databaseManager) {
    this.dbManager = databaseManager;
  }

  /**
   * Store variants in IndexedDB
   * @param {string} prefix - 'bcf' or 'survivor'
   * @param {Array} variants - Array of variant objects
   * @returns {Promise<void>}
   */
  async storeVariants(prefix, variants) {
    const db = await this.dbManager.getDB();
    const storeName = this.dbManager.getVariantStoreName(prefix);

    logger.debug(`Storing ${variants.length} variants in ${storeName}...`);
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], "readwrite");
      const objectStore = transaction.objectStore(storeName);

      let completed = 0;

      for (const variant of variants) {
        const flattened = VariantFlattener.flattenVariantForStorage(variant);
        const request = objectStore.add(flattened);

        request.onsuccess = () => {
          completed++;
          if (completed % 100 === 0) {
            logger.debug(`Stored ${completed}/${variants.length} variants...`);
          }
        };

        request.onerror = () => {
          logger.error(`Failed to store variant:`, request.error);
        };
      }

      transaction.oncomplete = () => {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        logger.debug(`Stored ${variants.length} variants in ${duration}s`);
        resolve();
      };

      transaction.onerror = () => {
        reject(new Error(`Transaction failed: ${transaction.error}`));
      };
    });
  }

  /**
   * Get variant count for a prefix
   * @param {string} prefix - 'bcf' or 'survivor'
   * @returns {Promise<number>}
   */
  async getVariantCount(prefix) {
    const db = await this.dbManager.getDB();
    const storeName = this.dbManager.getVariantStoreName(prefix);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], "readonly");
      const objectStore = transaction.objectStore(storeName);
      const request = objectStore.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`Failed to count variants: ${request.error}`));
    });
  }

  /**
   * Check if variants exist for a prefix
   * @param {string} prefix - 'bcf' or 'survivor'
   * @returns {Promise<boolean>}
   */
  async hasVariants(prefix) {
    const db = await this.dbManager.getDB();
    const storeName = this.dbManager.getVariantStoreName(prefix);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], "readonly");
      const objectStore = transaction.objectStore(storeName);
      const request = objectStore.openCursor();

      request.onsuccess = (event) => {
        resolve(!!event.target.result);
      };

      request.onerror = () => reject(new Error(`Failed to check variants: ${request.error}`));
    });
  }

  /**
   * Clear all variants for a prefix
   * @param {string} prefix - 'bcf' or 'survivor'
   * @returns {Promise<void>}
   */
  async clearVariants(prefix) {
    const db = await this.dbManager.getDB();
    const storeName = this.dbManager.getVariantStoreName(prefix);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], "readwrite");
      const objectStore = transaction.objectStore(storeName);
      const request = objectStore.clear();

      request.onsuccess = () => {
        logger.debug(`Cleared all variants from ${storeName}`);
        resolve();
      };

      request.onerror = () => reject(new Error(`Failed to clear variants: ${request.error}`));
    });
  }
}
