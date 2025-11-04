/**
 * Database Manager
 *
 * Handles IndexedDB database initialization, schema management, and connection lifecycle.
 * Responsible for creating stores, managing upgrades, and database operations.
 */

import { LoggerService } from "../../utils/LoggerService.js";

const logger = new LoggerService("DatabaseManager");

export class DatabaseManager {
  constructor(dbName = "varify-genome-data", version = 3, reportHash = null) {
    this.dbName = reportHash ? `${dbName}-${reportHash}` : dbName;
    this.version = version;
    this.db = null;
    this.storeName = "files";
    this.variantStores = {
      bcf: "bcf_variants",
      survivor: "survivor_variants",
    };
  }

  /**
   * Initialize the IndexedDB database
   * @returns {Promise<IDBDatabase>}
   */
  async init() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new Error(
            "IndexedDB initialization timed out after 10 seconds. This may happen when opening files directly (file:// protocol). Try opening via HTTP server or check browser settings."
          )
        );
      }, 10000);

      logger.info("Opening IndexedDB...");
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        clearTimeout(timeout);
        logger.error("IndexedDB error:", request.error);
        reject(new Error(`Failed to open IndexedDB: ${request.error}`));
      };

      request.onblocked = () => {
        logger.warn("IndexedDB open request is blocked - close other tabs using this database");
      };

      request.onsuccess = () => {
        clearTimeout(timeout);
        this.db = request.result;
        logger.info(`IndexedDB "${this.dbName}" opened successfully`);
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const oldVersion = event.oldVersion;

        logger.info(`Upgrading IndexedDB from version ${oldVersion} to ${this.version}...`);

        if (!db.objectStoreNames.contains(this.storeName)) {
          const objectStore = db.createObjectStore(this.storeName, {
            keyPath: "name",
          });
          objectStore.createIndex("uploaded", "uploaded", { unique: false });
          logger.debug(`Created object store "${this.storeName}"`);
        }

        if (oldVersion < 2) {
          this.createVariantStore(db, "bcf_variants");
          this.createVariantStore(db, "survivor_variants");
        }

        if (oldVersion < 3) {
          if (db.objectStoreNames.contains("bcf_variants")) {
            db.deleteObjectStore("bcf_variants");
            logger.debug("Deleted old bcf_variants store");
          }
          if (db.objectStoreNames.contains("survivor_variants")) {
            db.deleteObjectStore("survivor_variants");
            logger.debug("Deleted old survivor_variants store");
          }

          this.createVariantStore(db, "bcf_variants");
          this.createVariantStore(db, "survivor_variants");
        }
      };
    });
  }

  /**
   * Create a variant object store with indexes
   * @param {IDBDatabase} db - Database instance
   * @param {string} storeName - Store name
   */
  createVariantStore(db, storeName) {
    const store = db.createObjectStore(storeName, {
      keyPath: "_dbId",
      autoIncrement: true,
    });

    store.createIndex("CHROM", "CHROM", { unique: false });
    store.createIndex("POS", "POS", { unique: false });
    store.createIndex("SVTYPE", "SVTYPE", { unique: false });
    store.createIndex("FILTER", "FILTER", { unique: false });
    store.createIndex("PRIMARY_CALLER", "PRIMARY_CALLER", { unique: false });

    store.createIndex("GQ", "_computed.GQ", { unique: false });
    store.createIndex("SR_MIN", "_computed.SR_MIN", { unique: false });
    store.createIndex("SR_MAX", "_computed.SR_MAX", { unique: false });
    store.createIndex("DR", "_computed.DR", { unique: false });
    store.createIndex("PR", "_computed.PR", { unique: false });
    store.createIndex("DP", "_computed.DP", { unique: false });

    logger.debug(`Created variant store "${storeName}" with indexes`);
  }

  /**
   * Completely delete the IndexedDB database
   * This removes all data and the database itself
   * @returns {Promise<void>}
   */
  async deleteDatabase() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close();
        this.db = null;
        logger.debug("Closed IndexedDB connection");
      }

      const request = indexedDB.deleteDatabase(this.dbName);

      request.onsuccess = () => {
        logger.info(`IndexedDB database "${this.dbName}" deleted successfully`);
        resolve();
      };

      request.onerror = () => {
        reject(new Error(`Failed to delete IndexedDB: ${request.error}`));
      };

      request.onblocked = () => {
        logger.warn("Database deletion blocked - close all tabs using this database");
      };
    });
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      logger.debug("IndexedDB connection closed");
    }
  }

  /**
   * Get database instance (initialize if needed)
   * @returns {Promise<IDBDatabase>}
   */
  async getDB() {
    if (!this.db) {
      await this.init();
    }
    return this.db;
  }

  /**
   * Get store name for file storage
   * @returns {string}
   */
  getStoreName() {
    return this.storeName;
  }

  /**
   * Get variant store name by prefix
   * @param {string} prefix - 'bcf' or 'survivor'
   * @returns {string}
   */
  getVariantStoreName(prefix) {
    const storeName = this.variantStores[prefix];
    if (!storeName) {
      throw new Error(`Unknown variant prefix: ${prefix}`);
    }
    return storeName;
  }
}
