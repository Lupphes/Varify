/**
 * File Storage
 *
 * Handles file CRUD operations in IndexedDB.
 * Stores and retrieves genome files (FASTA, VCF, BAM, etc.).
 */

import { StorageUtils } from "./StorageUtils.js";
import { LoggerService } from "../../utils/LoggerService.js";

const logger = new LoggerService("FileStorage");

export class FileStorage {
  constructor(databaseManager) {
    this.dbManager = databaseManager;
  }

  /**
   * Store a file in IndexedDB
   * @param {string} name - File name
   * @param {File|Blob|ArrayBuffer} data - File data
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<string>} File name
   */
  async storeFile(name, data, metadata = {}) {
    const db = await this.dbManager.getDB();
    const storeName = this.dbManager.getStoreName();

    let arrayBuffer;
    if (data instanceof ArrayBuffer) {
      arrayBuffer = data;
    } else if (data instanceof Blob || data instanceof File) {
      arrayBuffer = await data.arrayBuffer();
    } else {
      throw new Error("Data must be File, Blob, or ArrayBuffer");
    }

    const fileObject = {
      name: name,
      data: arrayBuffer,
      size: arrayBuffer.byteLength,
      uploaded: new Date().toISOString(),
      ...metadata,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], "readwrite");
      const objectStore = transaction.objectStore(storeName);
      const request = objectStore.put(fileObject);

      request.onsuccess = () => {
        logger.debug(`Stored file "${name}" (${StorageUtils.formatBytes(arrayBuffer.byteLength)})`);
        resolve(name);
      };

      request.onerror = () => reject(new Error(`Failed to store file "${name}": ${request.error}`));
    });
  }

  /**
   * Retrieve a file from IndexedDB
   * @param {string} name - File name
   * @returns {Promise<ArrayBuffer|null>}
   */
  async getFile(name) {
    const db = await this.dbManager.getDB();
    const storeName = this.dbManager.getStoreName();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], "readonly");
      const objectStore = transaction.objectStore(storeName);
      const request = objectStore.get(name);

      request.onsuccess = () => {
        if (request.result) {
          logger.debug(
            `Retrieved file "${name}" (${StorageUtils.formatBytes(request.result.size)})`
          );

          const data = request.result.data;
          if (data instanceof ArrayBuffer) {
            resolve(data);
          } else if (data && data.buffer instanceof ArrayBuffer) {
            resolve(data.buffer);
          } else {
            logger.error(`Unexpected data type for "${name}":`, typeof data, data);
            reject(new Error(`File "${name}" data is not an ArrayBuffer (got ${typeof data})`));
          }
        } else {
          logger.warn(`File "${name}" not found in IndexedDB`);
          resolve(null);
        }
      };

      request.onerror = () =>
        reject(new Error(`Failed to retrieve file "${name}": ${request.error}`));
    });
  }

  /**
   * Check if a file exists in IndexedDB
   * @param {string} name - File name
   * @returns {Promise<boolean>}
   */
  async hasFile(name) {
    const db = await this.dbManager.getDB();
    const storeName = this.dbManager.getStoreName();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], "readonly");
      const objectStore = transaction.objectStore(storeName);
      const request = objectStore.get(name);

      request.onsuccess = () => resolve(!!request.result);
      request.onerror = () => reject(new Error(`Failed to check file "${name}": ${request.error}`));
    });
  }

  /**
   * List all files in IndexedDB
   * @returns {Promise<Array<string>>}
   */
  async listFiles() {
    const db = await this.dbManager.getDB();
    const storeName = this.dbManager.getStoreName();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], "readonly");
      const objectStore = transaction.objectStore(storeName);
      const request = objectStore.getAllKeys();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`Failed to list files: ${request.error}`));
    });
  }

  /**
   * Get file metadata without loading the entire file
   * @param {string} name - File name
   * @returns {Promise<Object|null>}
   */
  async getFileInfo(name) {
    const db = await this.dbManager.getDB();
    const storeName = this.dbManager.getStoreName();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], "readonly");
      const objectStore = transaction.objectStore(storeName);
      const request = objectStore.get(name);

      request.onsuccess = () => {
        if (request.result) {
          const { data, ...metadata } = request.result;
          resolve(metadata);
        } else {
          resolve(null);
        }
      };

      request.onerror = () =>
        reject(new Error(`Failed to get file info "${name}": ${request.error}`));
    });
  }

  /**
   * Delete a file from IndexedDB
   * @param {string} name - File name
   * @returns {Promise<void>}
   */
  async deleteFile(name) {
    const db = await this.dbManager.getDB();
    const storeName = this.dbManager.getStoreName();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], "readwrite");
      const objectStore = transaction.objectStore(storeName);
      const request = objectStore.delete(name);

      request.onsuccess = () => {
        logger.debug(`Deleted file "${name}"`);
        resolve();
      };

      request.onerror = () =>
        reject(new Error(`Failed to delete file "${name}": ${request.error}`));
    });
  }

  /**
   * Clear all files from IndexedDB
   * @returns {Promise<void>}
   */
  async clearAll() {
    const db = await this.dbManager.getDB();
    const storeName = this.dbManager.getStoreName();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], "readwrite");
      const objectStore = transaction.objectStore(storeName);
      const request = objectStore.clear();

      request.onsuccess = () => {
        logger.debug("Cleared all files from IndexedDB");
        resolve();
      };

      request.onerror = () => reject(new Error(`Failed to clear IndexedDB: ${request.error}`));
    });
  }

  /**
   * Get total storage usage
   * @returns {Promise<number>} - Total bytes stored
   */
  async getStorageSize() {
    const db = await this.dbManager.getDB();
    const storeName = this.dbManager.getStoreName();
    return StorageUtils.getStorageSize(db, storeName);
  }

  /**
   * Store report version metadata
   * @param {string} version - Report version ID
   * @returns {Promise<void>}
   */
  async storeVersion(version) {
    const db = await this.dbManager.getDB();
    const storeName = this.dbManager.getStoreName();
    return StorageUtils.storeVersion(db, storeName, version);
  }

  /**
   * Get stored report version
   * @returns {Promise<string|null>}
   */
  async getStoredVersion() {
    const db = await this.dbManager.getDB();
    const storeName = this.dbManager.getStoreName();
    return StorageUtils.getStoredVersion(db, storeName);
  }
}
