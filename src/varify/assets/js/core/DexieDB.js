import Dexie from 'dexie';

export class DexieVariantDB extends Dexie {
  constructor(dbName = 'varify-genome-data', reportHash = null) {
    const fullDbName = reportHash ? `${dbName}-${reportHash}` : dbName;
    super(fullDbName);

    this.version(3).stores({
      files: 'name, size, type, timestamp',
      metadata: 'key',
      bcf_variants: 'locus, CHROM, POS, SVTYPE, QUAL, FILTER, *GQ, *DP',
      survivor_variants: 'locus, CHROM, POS, SVTYPE, QUAL, FILTER, *GQ, *DP'
    });

    this.files = this.table('files');
    this.metadata = this.table('metadata');
    this.bcfVariants = this.table('bcf_variants');
    this.survivorVariants = this.table('survivor_variants');
  }

  getVariantTable(prefix) {
    return prefix === 'bcf' ? this.bcfVariants : this.survivorVariants;
  }

  async getFile(name) {
    return await this.files.get(name);
  }

  async storeFile(name, data, metadata = {}) {
    const fileData = {
      name,
      data,
      size: data.byteLength || data.size,
      type: metadata.type || 'application/octet-stream',
      timestamp: Date.now(),
      ...metadata
    };
    await this.files.put(fileData);
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
    await this.files.delete(name);
  }

  async clearAllFiles() {
    await this.files.clear();
  }

  async deleteDatabase() {
    await this.delete();
  }
}
