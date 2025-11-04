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
   * @param {Function} onProgress - Optional progress callback (chunkIndex, totalChunks, bytesProcessed, totalBytes)
   * @returns {Promise<string>} File name
   */
  async storeFile(name, data, metadata = {}, onProgress = null) {
    const CHUNK_SIZE = 64 * 1024 * 1024; // 64MB chunks
    const LARGE_FILE_THRESHOLD = 100 * 1024 * 1024; // 100MB threshold for chunking

    const db = await this.dbManager.getDB();
    const storeName = this.dbManager.getStoreName();

    let fileSize;
    let isLargeFile;

    if (data instanceof ArrayBuffer) {
      fileSize = data.byteLength;
      isLargeFile = fileSize > LARGE_FILE_THRESHOLD;
    } else if (data instanceof Blob || data instanceof File) {
      fileSize = data.size;
      isLargeFile = fileSize > LARGE_FILE_THRESHOLD;
    } else {
      throw new Error("Data must be File, Blob, or ArrayBuffer");
    }

    if (!isLargeFile) {
      let arrayBuffer;
      if (data instanceof ArrayBuffer) {
        arrayBuffer = data;
      } else {
        arrayBuffer = await data.arrayBuffer();
      }

      const fileObject = {
        name: name,
        data: arrayBuffer,
        size: arrayBuffer.byteLength,
        uploaded: new Date().toISOString(),
        chunked: false,
        ...metadata,
      };

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], "readwrite");
        const objectStore = transaction.objectStore(storeName);
        const request = objectStore.put(fileObject);

        request.onsuccess = () => {
          logger.debug(
            `Stored file "${name}" (${StorageUtils.formatBytes(arrayBuffer.byteLength)})`
          );
          if (onProgress) onProgress(1, 1, arrayBuffer.byteLength, arrayBuffer.byteLength);
          resolve(name);
        };

        request.onerror = () =>
          reject(new Error(`Failed to store file "${name}": ${request.error}`));
      });
    }

    logger.debug(`Storing large file "${name}" in chunks (${StorageUtils.formatBytes(fileSize)})`);

    const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);
    let bytesProcessed = 0;

    await this.deleteFile(name).catch(() => {});

    const metadataObject = {
      name: name,
      size: fileSize,
      uploaded: new Date().toISOString(),
      chunked: true,
      totalChunks: totalChunks,
      chunkSize: CHUNK_SIZE,
      ...metadata,
    };

    await new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], "readwrite");
      const objectStore = transaction.objectStore(storeName);
      const request = objectStore.put(metadataObject);

      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(new Error(`Failed to store metadata for "${name}": ${request.error}`));
    });

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, fileSize);

      let chunkData;
      if (data instanceof ArrayBuffer) {
        chunkData = data.slice(start, end);
      } else if (data instanceof Blob || data instanceof File) {
        const chunkBlob = data.slice(start, end);
        chunkData = await chunkBlob.arrayBuffer();
      }

      const chunkObject = {
        name: `${name}__chunk_${chunkIndex}`,
        data: chunkData,
        size: chunkData.byteLength,
        uploaded: new Date().toISOString(),
        isChunk: true,
        parentFile: name,
        chunkIndex: chunkIndex,
      };

      await new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], "readwrite");
        const objectStore = transaction.objectStore(storeName);
        const request = objectStore.put(chunkObject);

        request.onsuccess = () => resolve();
        request.onerror = () =>
          reject(new Error(`Failed to store chunk ${chunkIndex} for "${name}": ${request.error}`));
      });

      bytesProcessed += chunkData.byteLength;
      logger.debug(
        `Stored chunk ${chunkIndex + 1}/${totalChunks} for "${name}" (${StorageUtils.formatBytes(chunkData.byteLength)})`
      );

      if (onProgress) {
        onProgress(chunkIndex + 1, totalChunks, bytesProcessed, fileSize);
      }
    }

    logger.debug(
      `Completed chunked storage of "${name}" (${totalChunks} chunks, ${StorageUtils.formatBytes(fileSize)})`
    );
    return name;
  }

  /**
   * Retrieve a file from IndexedDB
   * @param {string} name - File name
   * @param {Object} options - Retrieval options
   * @param {boolean} options.asBlob - Return as Blob instead of ArrayBuffer for chunked files (default: true for large files)
   * @returns {Promise<ArrayBuffer|Blob|null>}
   */
  async getFile(name, options = {}) {
    const db = await this.dbManager.getDB();
    const storeName = this.dbManager.getStoreName();

    const mainEntry = await new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], "readonly");
      const objectStore = transaction.objectStore(storeName);
      const request = objectStore.get(name);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(new Error(`Failed to retrieve file "${name}": ${request.error}`));
    });

    if (!mainEntry) {
      logger.warn(`File "${name}" not found in IndexedDB`);
      return null;
    }

    if (!mainEntry.chunked) {
      logger.debug(`Retrieved file "${name}" (${StorageUtils.formatBytes(mainEntry.size)})`);

      const data = mainEntry.data;
      if (data instanceof ArrayBuffer) {
        return data;
      } else if (data && data.buffer instanceof ArrayBuffer) {
        return data.buffer;
      } else {
        logger.error(`Unexpected data type for "${name}":`, typeof data, data);
        throw new Error(`File "${name}" data is not an ArrayBuffer (got ${typeof data})`);
      }
    }

    logger.debug(
      `Reassembling chunked file "${name}" (${mainEntry.totalChunks} chunks, ${StorageUtils.formatBytes(mainEntry.size)})`
    );

    // Determine if we should use Blob-based retrieval
    // For files >100MB, use Blob to avoid ArrayBuffer allocation limits
    const LARGE_FILE_THRESHOLD = 100 * 1024 * 1024; // 100MB
    const useBlob = options.asBlob !== false && mainEntry.size > LARGE_FILE_THRESHOLD;

    const chunks = [];
    for (let chunkIndex = 0; chunkIndex < mainEntry.totalChunks; chunkIndex++) {
      const chunkName = `${name}__chunk_${chunkIndex}`;
      const chunkEntry = await new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], "readonly");
        const objectStore = transaction.objectStore(storeName);
        const request = objectStore.get(chunkName);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () =>
          reject(
            new Error(`Failed to retrieve chunk ${chunkIndex} for "${name}": ${request.error}`)
          );
      });

      if (!chunkEntry || !chunkEntry.data) {
        throw new Error(`Missing chunk ${chunkIndex} for file "${name}"`);
      }

      chunks.push(chunkEntry.data);
    }

    // Use Blob for large files to avoid 2GB ArrayBuffer limit
    if (useBlob) {
      logger.debug(`Using Blob-based retrieval for large file "${name}"`);
      const blobs = chunks.map((chunk) => new Blob([chunk]));
      const blob = new Blob(blobs);
      logger.debug(`Reassembled file "${name}" as Blob (${StorageUtils.formatBytes(blob.size)})`);
      return blob;
    }

    // Fallback to ArrayBuffer for smaller files (backwards compatibility)
    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const reassembled = new Uint8Array(totalSize);
    let offset = 0;

    for (const chunk of chunks) {
      reassembled.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }

    logger.debug(`Reassembled file "${name}" (${StorageUtils.formatBytes(totalSize)})`);
    return reassembled.buffer;
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

    const mainEntry = await new Promise((resolve) => {
      const transaction = db.transaction([storeName], "readonly");
      const objectStore = transaction.objectStore(storeName);
      const request = objectStore.get(name);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null); // Don't fail if file doesn't exist
    });

    await new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], "readwrite");
      const objectStore = transaction.objectStore(storeName);
      const request = objectStore.delete(name);

      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(new Error(`Failed to delete file "${name}": ${request.error}`));
    });

    if (mainEntry && mainEntry.chunked && mainEntry.totalChunks) {
      logger.debug(`Deleting ${mainEntry.totalChunks} chunks for "${name}"`);
      for (let chunkIndex = 0; chunkIndex < mainEntry.totalChunks; chunkIndex++) {
        const chunkName = `${name}__chunk_${chunkIndex}`;
        await new Promise((resolve) => {
          const transaction = db.transaction([storeName], "readwrite");
          const objectStore = transaction.objectStore(storeName);
          const request = objectStore.delete(chunkName);

          request.onsuccess = () => resolve();
          request.onerror = () => resolve(); // Don't fail if chunk doesn't exist
        });
      }
    }

    logger.debug(
      `Deleted file "${name}"${mainEntry && mainEntry.chunked ? " and all chunks" : ""}`
    );
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
