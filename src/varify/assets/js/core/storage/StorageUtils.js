/**
 * Storage Utility Functions
 *
 * Utility functions for storage operations like formatting bytes,
 * calculating storage size, and managing version metadata.
 */

export class StorageUtils {
  /**
   * Format bytes to human-readable string
   * @param {number} bytes - Number of bytes
   * @returns {string} Formatted string (e.g., "1.5 MB")
   */
  static formatBytes(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  }

  /**
   * Calculate total storage size for files in a store
   * @param {IDBDatabase} db - IndexedDB database
   * @param {string} storeName - Store name
   * @returns {Promise<number>} Total size in bytes
   */
  static async getStorageSize(db, storeName) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], "readonly");
      const objectStore = transaction.objectStore(storeName);
      const request = objectStore.getAll();

      request.onsuccess = () => {
        const total = request.result.reduce((sum, file) => sum + (file.size || 0), 0);
        resolve(total);
      };

      request.onerror = () =>
        reject(new Error(`Failed to calculate storage size: ${request.error}`));
    });
  }

  /**
   * Store report version metadata
   * @param {IDBDatabase} db - IndexedDB database
   * @param {string} storeName - Store name
   * @param {string} version - Report version ID
   * @returns {Promise<void>}
   */
  static async storeVersion(db, storeName, version) {
    const versionObject = {
      name: "__report_version__",
      data: new ArrayBuffer(0),
      version: version,
      uploaded: new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], "readwrite");
      const objectStore = transaction.objectStore(storeName);
      const request = objectStore.put(versionObject);

      request.onsuccess = () => {
        console.log(`Stored report version: ${version}`);
        resolve();
      };

      request.onerror = () => reject(new Error(`Failed to store version: ${request.error}`));
    });
  }

  /**
   * Get stored report version
   * @param {IDBDatabase} db - IndexedDB database
   * @param {string} storeName - Store name
   * @returns {Promise<string|null>} Version string or null
   */
  static async getStoredVersion(db, storeName) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], "readonly");
      const objectStore = transaction.objectStore(storeName);
      const request = objectStore.get("__report_version__");

      request.onsuccess = () => {
        if (request.result && request.result.version) {
          resolve(request.result.version);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => reject(new Error(`Failed to get stored version: ${request.error}`));
    });
  }
}
