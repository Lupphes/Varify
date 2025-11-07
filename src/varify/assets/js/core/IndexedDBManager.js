/**
 * IndexedDB Manager
 *
 * Main entry point for all IndexedDB operations using Dexie.js.
 * Handles files, variants, and metadata storage with optimized performance.
 */

import Dexie from 'dexie';
import { StorageUtils } from "./storage/StorageUtils.js";
import { DexieVariantDB } from "./DexieDB.js";
import { DexieVariantQuery } from "./DexieVariantQuery.js";

class IndexedDBManager {
  constructor(dbName = "varify-genome-data", version = 3, reportHash = null) {
    this.dexieDB = new DexieVariantDB(dbName, reportHash);
    this.dexieQuery = new DexieVariantQuery(this.dexieDB);

    this.dbName = reportHash ? `${dbName}-${reportHash}` : dbName;
    this.version = version;
  }

  async init() {
    await this.dexieDB.open();
    return this.dexieDB;
  }

  close() {
    this.dexieDB.close();
  }

  async deleteDatabase() {
    await this.dexieDB.deleteDatabase();
  }

  async storeFile(name, data, metadata = {}, onProgress = null) {
    if (data instanceof ArrayBuffer) {
      return this.dexieDB.storeFile(name, data, metadata, onProgress);
    } else if (data instanceof Blob || data instanceof File) {
      return this.dexieDB.storeFile(name, data, metadata, onProgress);
    } else {
      throw new Error("Data must be File, Blob, or ArrayBuffer");
    }
  }

  async getFile(name, returnAsBlob = false) {
    const fileData = await this.dexieDB.getFile(name, returnAsBlob);
    return fileData ? fileData.data : null;
  }

  async hasFile(name) {
    return this.dexieDB.hasFile(name);
  }

  async listFiles() {
    return this.dexieDB.listFiles();
  }

  async getFileInfo(name) {
    const fileData = await this.dexieDB.files.get(name);
    if (!fileData) return null;

    const { data, ...fileInfo } = fileData;
    return fileInfo;
  }

  async deleteFile(name) {
    return this.dexieDB.deleteFile(name);
  }

  async clearAll() {
    return this.dexieDB.clearAllFiles();
  }

  async getStorageSize() {
    if (!navigator.storage || !navigator.storage.estimate) {
      // In test environments or browsers without storage API, calculate from files
      const files = await this.dexieDB.files.toArray();
      return files.reduce((sum, file) => sum + (file.size || 0), 0);
    }
    const estimate = await navigator.storage.estimate();
    return estimate?.usage || 0;
  }

  formatBytes(bytes) {
    return StorageUtils.formatBytes(bytes);
  }

  async storeVersion(version) {
    await this.dexieDB.metadata.put({ key: 'version', value: version });
  }

  async getStoredVersion() {
    const record = await this.dexieDB.metadata.get('version');
    return record ? record.value : null;
  }

  async storeVariants(prefix, variants, onProgress = null) {
    return this.dexieQuery.storeVariants(prefix, variants, onProgress);
  }

  async hasVariants(prefix) {
    return this.dexieQuery.hasVariants(prefix);
  }

  async variantsExist(prefix) {
    return this.dexieQuery.hasVariants(prefix);
  }

  async getAllVariants(prefix) {
    return this.dexieQuery.getAllVariants(prefix);
  }

  async storeHeader(prefix, header) {
    return this.dexieQuery.storeHeader(prefix, header);
  }

  async getHeader(prefix) {
    return this.dexieQuery.getHeader(prefix);
  }

  async clearVariants(prefix) {
    return this.dexieQuery.clearVariants(prefix);
  }

  async queryVariants(prefix, filters = {}, options = {}) {
    return this.dexieQuery.queryVariants(prefix, filters, options);
  }

  async getVariantCount(prefix, filters = {}, options = {}) {
    return this.dexieQuery.getVariantCount(prefix, filters, options);
  }

  cancelQuery(queryId) {
    return this.dexieQuery.cancelQuery(queryId);
  }

  cancelAllQueries() {
    return this.dexieQuery.cancelAllQueries();
  }

  async getAllVarifyDatabases() {
    const databases = await Dexie.getDatabaseNames();
    return databases.filter(name => name.startsWith('varify-genome-data'));
  }

  async getTotalStorageSize() {
    try {
      if (!navigator.storage || !navigator.storage.estimate) {
        return 0;
      }
      const estimate = await navigator.storage.estimate();
      return estimate?.usage || 0;
    } catch (error) {
      console.warn('Could not estimate storage size:', error);
      return 0;
    }
  }

  async deleteAllVarifyDatabases() {
    const databases = await this.getAllVarifyDatabases();
    for (const dbName of databases) {
      await Dexie.delete(dbName);
    }
  }

  get storeName() {
    return 'files';
  }

  get variantStores() {
    return ['bcf_variants', 'survivor_variants'];
  }
}

export { IndexedDBManager };
