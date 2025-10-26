/**
 * IndexedDB Manager for Varify Genome Data Storage
 *
 * Stores large genome files (FASTA, VCF, BAM) in browser's IndexedDB for persistent access.
 * No HTTP server required after initial upload.
 */

class IndexedDBManager {
    constructor(dbName = 'varify-genome-data', version = 1) {
        this.dbName = dbName;
        this.version = version;
        this.db = null;
        this.storeName = 'files';
    }

    /**
     * Initialize the IndexedDB database
     */
    async init() {
        return new Promise((resolve, reject) => {
            // Add timeout to detect stuck initialization
            const timeout = setTimeout(() => {
                reject(new Error('IndexedDB initialization timed out after 10 seconds. This may happen when opening files directly (file:// protocol). Try opening via HTTP server or check browser settings.'));
            }, 10000);

            console.log('Opening IndexedDB...');
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                clearTimeout(timeout);
                console.error('IndexedDB error:', request.error);
                reject(new Error(`Failed to open IndexedDB: ${request.error}`));
            };

            request.onblocked = () => {
                console.warn('IndexedDB open request is blocked - close other tabs using this database');
            };

            request.onsuccess = () => {
                clearTimeout(timeout);
                this.db = request.result;
                console.log(`IndexedDB "${this.dbName}" opened successfully`);
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                console.log('Upgrading IndexedDB schema...');
                const db = event.target.result;

                // Create object store if it doesn't exist
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const objectStore = db.createObjectStore(this.storeName, { keyPath: 'name' });
                    objectStore.createIndex('uploaded', 'uploaded', { unique: false });
                    console.log(`Created object store "${this.storeName}"`);
                }
            };
        });
    }

    /**
     * Store a file in IndexedDB
     * @param {string} name - File name
     * @param {File|Blob|ArrayBuffer} data - File data
     * @param {Object} metadata - Additional metadata
     */
    async storeFile(name, data, metadata = {}) {
        if (!this.db) await this.init();

        // Convert to ArrayBuffer if needed
        let arrayBuffer;
        if (data instanceof ArrayBuffer) {
            arrayBuffer = data;
        } else if (data instanceof Blob || data instanceof File) {
            arrayBuffer = await data.arrayBuffer();
        } else {
            throw new Error('Data must be File, Blob, or ArrayBuffer');
        }

        const fileObject = {
            name: name,
            data: arrayBuffer,
            size: arrayBuffer.byteLength,
            uploaded: new Date().toISOString(),
            ...metadata
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.put(fileObject);

            request.onsuccess = () => {
                console.log(`Stored file "${name}" (${this.formatBytes(arrayBuffer.byteLength)})`);
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
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.get(name);

            request.onsuccess = () => {
                if (request.result) {
                    console.log(`Retrieved file "${name}" (${this.formatBytes(request.result.size)})`);

                    // Ensure we return an ArrayBuffer
                    const data = request.result.data;
                    if (data instanceof ArrayBuffer) {
                        resolve(data);
                    } else if (data && data.buffer instanceof ArrayBuffer) {
                        // Handle typed arrays (Uint8Array, etc.)
                        resolve(data.buffer);
                    } else {
                        console.error(`Unexpected data type for "${name}":`, typeof data, data);
                        reject(new Error(`File "${name}" data is not an ArrayBuffer (got ${typeof data})`));
                    }
                } else {
                    console.warn(`File "${name}" not found in IndexedDB`);
                    resolve(null);
                }
            };

            request.onerror = () => reject(new Error(`Failed to retrieve file "${name}": ${request.error}`));
        });
    }

    /**
     * Check if a file exists in IndexedDB
     * @param {string} name - File name
     * @returns {Promise<boolean>}
     */
    async hasFile(name) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.get(name);

            request.onsuccess = () => resolve(!!request.result);
            request.onerror = () => reject(new Error(`Failed to check file "${name}": ${request.error}`));
        });
    }

    /**
     * List all files in IndexedDB
     * @returns {Promise<Array>}
     */
    async listFiles() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const objectStore = transaction.objectStore(this.storeName);
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
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.get(name);

            request.onsuccess = () => {
                if (request.result) {
                    const { data, ...metadata } = request.result;
                    resolve(metadata);
                } else {
                    resolve(null);
                }
            };

            request.onerror = () => reject(new Error(`Failed to get file info "${name}": ${request.error}`));
        });
    }

    /**
     * Delete a file from IndexedDB
     * @param {string} name - File name
     */
    async deleteFile(name) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.delete(name);

            request.onsuccess = () => {
                console.log(`Deleted file "${name}"`);
                resolve();
            };

            request.onerror = () => reject(new Error(`Failed to delete file "${name}": ${request.error}`));
        });
    }

    /**
     * Clear all files from IndexedDB
     */
    async clearAll() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.clear();

            request.onsuccess = () => {
                console.log('Cleared all files from IndexedDB');
                resolve();
            };

            request.onerror = () => reject(new Error(`Failed to clear IndexedDB: ${request.error}`));
        });
    }

    /**
     * Completely delete the IndexedDB database
     * This removes all data and the database itself
     */
    async deleteDatabase() {
        return new Promise((resolve, reject) => {
            // Close existing connection if open
            if (this.db) {
                this.db.close();
                this.db = null;
                console.log('Closed IndexedDB connection');
            }

            const request = indexedDB.deleteDatabase(this.dbName);

            request.onsuccess = () => {
                console.log(`IndexedDB database "${this.dbName}" deleted successfully`);
                resolve();
            };

            request.onerror = () => {
                reject(new Error(`Failed to delete IndexedDB: ${request.error}`));
            };

            request.onblocked = () => {
                console.warn('Database deletion blocked - close all tabs using this database');
            };
        });
    }

    /**
     * Get total storage usage
     * @returns {Promise<number>} - Total bytes stored
     */
    async getStorageSize() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.getAll();

            request.onsuccess = () => {
                const total = request.result.reduce((sum, file) => sum + (file.size || 0), 0);
                resolve(total);
            };

            request.onerror = () => reject(new Error(`Failed to calculate storage size: ${request.error}`));
        });
    }

    /**
     * Store report version metadata
     * @param {string} version - Report version ID
     */
    async storeVersion(version) {
        if (!this.db) await this.init();

        const versionObject = {
            name: '__report_version__',
            data: new ArrayBuffer(0), // Empty data
            version: version,
            uploaded: new Date().toISOString()
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);
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
     * @returns {Promise<string|null>}
     */
    async getStoredVersion() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.get('__report_version__');

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

    /**
     * Format bytes to human-readable string
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * Close the database connection
     */
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
            console.log('IndexedDB connection closed');
        }
    }
}

// Create global instance
const genomeDBManager = new IndexedDBManager();
