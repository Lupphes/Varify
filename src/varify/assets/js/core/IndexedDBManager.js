/**
 * IndexedDB Manager (Facade)
 *
 * Main entry point for IndexedDB operations.
 * Maintains backward compatibility while delegating to specialized modules.
 *
 * This is a facade pattern that coordinates:
 * - DatabaseManager: DB initialization and schema
 * - FileStorage: File CRUD operations
 * - VariantStorage: Variant storage operations
 * - VariantQuery: Variant querying with filters/sorting
 * - StorageUtils: Utility functions
 */

import { DatabaseManager } from "./storage/DatabaseManager.js";
import { FileStorage } from "./storage/FileStorage.js";
import { VariantStorage } from "./storage/VariantStorage.js";
import { VariantQuery } from "./query/VariantQuery.js";
import { StorageUtils } from "./storage/StorageUtils.js";

class IndexedDBManager {
  constructor(dbName = "varify-genome-data", version = 3) {
    this.dbManager = new DatabaseManager(dbName, version);
    this.fileStorage = new FileStorage(this.dbManager);
    this.variantStorage = new VariantStorage(this.dbManager);
    this.variantQuery = new VariantQuery(this.dbManager);

    this.dbName = dbName;
    this.version = version;
  }

  async init() {
    const db = await this.dbManager.init();
    this.db = db;
    return db;
  }

  close() {
    this.dbManager.close();
    this.db = null;
  }

  async deleteDatabase() {
    await this.dbManager.deleteDatabase();
    this.db = null;
  }

  async storeFile(name, data, metadata = {}) {
    return this.fileStorage.storeFile(name, data, metadata);
  }

  async getFile(name) {
    return this.fileStorage.getFile(name);
  }

  async hasFile(name) {
    return this.fileStorage.hasFile(name);
  }

  async listFiles() {
    return this.fileStorage.listFiles();
  }

  async getFileInfo(name) {
    return this.fileStorage.getFileInfo(name);
  }

  async deleteFile(name) {
    return this.fileStorage.deleteFile(name);
  }

  async clearAll() {
    return this.fileStorage.clearAll();
  }

  async getStorageSize() {
    return this.fileStorage.getStorageSize();
  }

  formatBytes(bytes) {
    return StorageUtils.formatBytes(bytes);
  }

  async storeVersion(version) {
    return this.fileStorage.storeVersion(version);
  }

  async getStoredVersion() {
    return this.fileStorage.getStoredVersion();
  }

  async storeVariants(prefix, variants) {
    return this.variantStorage.storeVariants(prefix, variants);
  }

  async hasVariants(prefix) {
    return this.variantStorage.hasVariants(prefix);
  }

  async clearVariants(prefix) {
    return this.variantStorage.clearVariants(prefix);
  }

  async queryVariants(prefix, filters = {}, options = {}) {
    return this.variantQuery.queryVariants(prefix, filters, options);
  }

  async getVariantCount(prefix, filters = {}) {
    return this.variantQuery.getVariantCount(prefix, filters);
  }

  get storeName() {
    return this.dbManager.getStoreName();
  }

  get variantStores() {
    return this.dbManager.variantStores;
  }
}

export { IndexedDBManager };
