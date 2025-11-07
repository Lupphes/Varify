import Dexie from 'dexie';

export class DexieVariantDB extends Dexie {
  constructor(dbName = 'varify-genome-data', reportHash = null) {
    const fullDbName = reportHash ? `${dbName}-${reportHash}` : dbName;
    super(fullDbName);

    this.version(3).stores({
      files: 'name, size, type, timestamp',
      fileChunks: '[name+chunkIndex], name, chunkIndex',
      metadata: 'key',
      bcf_variants: 'locus, CHROM, POS, SVTYPE, QUAL, FILTER, *GQ, *DP',
      survivor_variants: 'locus, CHROM, POS, SVTYPE, QUAL, FILTER, *GQ, *DP'
    });

    this.version(4).stores({
      files: 'name, size, type, timestamp',
      fileChunks: '[name+chunkIndex], name, chunkIndex',
      metadata: 'key',
      bcf_variants: 'locus, CHROM, POS, ID, SVTYPE, SVLEN, QUAL, FILTER, REF, CIPOS, CIEND, *GQ, *DP',
      survivor_variants: 'locus, CHROM, POS, ID, SVTYPE, SVLEN, NUM_CALLERS, PRIMARY_CALLER, SUPP_CALLERS, QUAL, FILTER, REF, CIPOS, CIEND, *GQ, *DP'
    });

    this.files = this.table('files');
    this.fileChunks = this.table('fileChunks');
    this.metadata = this.table('metadata');
    this.bcfVariants = this.table('bcf_variants');
    this.survivorVariants = this.table('survivor_variants');
  }

  getVariantTable(prefix) {
    return prefix === 'bcf' ? this.bcfVariants : this.survivorVariants;
  }

  async getFile(name, returnAsBlob = false) {
    const fileInfo = await this.files.get(name);
    if (!fileInfo) return null;

    if (fileInfo.isChunked) {
      const chunks = await this.fileChunks
        .where('name')
        .equals(name)
        .sortBy('chunkIndex');

      if (returnAsBlob) {
        const blobParts = chunks.map(chunk => chunk.data);
        const blob = new Blob(blobParts, { type: fileInfo.type || 'application/octet-stream' });

        return {
          name: fileInfo.name,
          data: blob,
          size: fileInfo.size,
          type: fileInfo.type,
          timestamp: fileInfo.timestamp,
          isChunked: true
        };
      }

      const totalSize = chunks.reduce((sum, chunk) => sum + chunk.data.byteLength, 0);
      const merged = new Uint8Array(totalSize);
      let offset = 0;

      for (const chunk of chunks) {
        merged.set(new Uint8Array(chunk.data), offset);
        offset += chunk.data.byteLength;
      }

      return {
        name: fileInfo.name,
        data: merged.buffer,
        size: fileInfo.size,
        type: fileInfo.type,
        timestamp: fileInfo.timestamp,
        isChunked: true
      };
    }

    const data = returnAsBlob
      ? new Blob([fileInfo.data], { type: fileInfo.type || 'application/octet-stream' })
      : fileInfo.data;

    return {
      name: fileInfo.name,
      data,
      size: fileInfo.size,
      type: fileInfo.type,
      timestamp: fileInfo.timestamp,
      isChunked: false
    };
  }

  async storeFile(name, data, metadata = {}, onProgress = null) {
    const CHUNK_SIZE = 64 * 1024 * 1024;
    const size = data.byteLength || data.size;
    const isLargeFile = size > 100 * 1024 * 1024;

    if (!isLargeFile) {
      let dataToStore = data;
      if (data instanceof Blob || data instanceof File) {
        dataToStore = await data.arrayBuffer();
      }

      const fileData = {
        name,
        data: dataToStore,
        size,
        timestamp: Date.now(),
        isChunked: false,
        type: 'application/octet-stream',
        ...metadata
      };
      await this.files.put(fileData);
      return;
    }

    await this.fileChunks.where('name').equals(name).delete();

    const totalChunks = Math.ceil(size / CHUNK_SIZE);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, size);

      let chunkData;
      if (data instanceof Blob || data instanceof File) {
        const chunkBlob = data.slice(start, end);
        chunkData = await chunkBlob.arrayBuffer();
      } else {
        chunkData = data.slice(start, end);
      }

      await this.fileChunks.put({
        name,
        chunkIndex: i,
        data: chunkData
      });

      if (onProgress) {
        onProgress(i + 1, totalChunks, end, size);
      }
    }

    const fileInfo = {
      name,
      size,
      timestamp: Date.now(),
      isChunked: true,
      totalChunks,
      type: 'application/octet-stream',
      ...metadata
    };
    await this.files.put(fileInfo);
  }

  async hasFile(name) {
    const count = await this.files.where('name').equals(name).count();
    return count > 0;
  }

  async listFiles() {
    const files = await this.files.toArray();
    return files.map(f => f.name);
  }

  async deleteFile(name) {
    await this.fileChunks.where('name').equals(name).delete();
    await this.files.delete(name);
  }

  async clearAllFiles() {
    await this.fileChunks.clear();
    await this.files.clear();
  }

  async deleteDatabase() {
    const dbName = this.name;
    this.close();
    await Dexie.delete(dbName);
  }
}
