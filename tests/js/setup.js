/**
 * Vitest Setup - Test Environment Configuration
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import "fake-indexeddb/auto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ==================== PATH HELPERS ====================

/**
 * Get path to project root directory.
 * @returns {string} Absolute path to project root
 */
export function getProjectRoot() {
  return resolve(__dirname, "../..");
}

/**
 * Get path to tests/fixtures/ directory containing test data files.
 * @returns {string} Absolute path to test fixtures
 */
export function getTestFixturesDir() {
  return resolve(getProjectRoot(), "tests/fixtures");
}

// ==================== REAL DATA LOADERS ====================

/**
 * Load real VCF file as text string.
 *
 * @param {string} filename - Filename in data/ directory (e.g., 'bcftools_concat.vcf')
 * @returns {string} VCF file contents as text
 * @throws {Error} If file not found
 *
 * @example
 * const vcfText = loadRealVcf('bcftools_concat.vcf');
 * const parser = new VCFParser();
 * const variants = await parser.parseVCF(vcfText, 100);
 */
export function loadRealVcf(filename) {
  const path = resolve(getTestFixturesDir(), filename);
  try {
    return readFileSync(path, "utf-8");
  } catch (error) {
    throw new Error(`Failed to load VCF file: ${path} - ${error.message}`);
  }
}

/**
 * Load real VCF file as Buffer (for binary operations).
 *
 * @param {string} filename - Filename in data/ directory
 * @returns {Buffer} VCF file contents as Buffer
 * @throws {Error} If file not found
 *
 * @example
 * const vcfBuffer = loadRealVcfBuffer('bcftools_concat.vcf');
 * const arrayBuffer = vcfBuffer.buffer.slice(
 *   vcfBuffer.byteOffset,
 *   vcfBuffer.byteOffset + vcfBuffer.byteLength
 * );
 */
export function loadRealVcfBuffer(filename) {
  const path = resolve(getTestFixturesDir(), filename);
  try {
    return readFileSync(path);
  } catch (error) {
    throw new Error(`Failed to load VCF buffer: ${path} - ${error.message}`);
  }
}

/**
 * Load real VCF file as ArrayBuffer (for VCF parser tests).
 *
 * @param {string} filename - Filename in data/ directory
 * @returns {ArrayBuffer} VCF file contents as ArrayBuffer
 *
 * @example
 * const vcfArrayBuffer = loadRealVcfArrayBuffer('bcftools_concat.vcf');
 * const parser = new VCFParser();
 * const variants = await parser.parseVCF(vcfArrayBuffer, 100);
 */
export function loadRealVcfArrayBuffer(filename) {
  const buffer = loadRealVcfBuffer(filename);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

/**
 * Load test fixture VCF from tests/fixtures/.
 *
 * @param {string} filename - Filename in tests/fixtures/
 * @returns {string} VCF file contents as text
 */
export function loadTestFixture(filename) {
  const path = resolve(getTestFixturesDir(), filename);
  try {
    return readFileSync(path, "utf-8");
  } catch (error) {
    throw new Error(`Failed to load test fixture: ${path} - ${error.message}`);
  }
}

/**
 * Get list of available real VCF files in data/ directory.
 *
 * @returns {Object} Object with VCF file paths
 */
export function getRealVcfFiles() {
  return {
    bcfMerge: "bcftools_concat.vcf",
    bcfMergeGz: "bcftools_concat.vcf.gz",
    survivorMerge: "survivor_merge_survivor_merge_filtered.vcf",
    delly: "re-yeast_sample-illumina-false-delly.vcf",
    referenceFasta: "GCF_000146045.fna",
    referenceFai: "GCF_000146045.fna.fai",
  };
}

// ==================== TEST HELPERS ====================

/**
 * Create a minimal VCF header for testing.
 *
 * @param {Object} options - Header options
 * @param {string[]} options.samples - Sample names
 * @param {string[]} options.contigs - Contig names
 * @returns {string} VCF header text
 */
export function createMinimalVcfHeader({ samples = ["sample1"], contigs = ["NC_001133.9"] } = {}) {
  const contigLines = contigs.map((c) => `##contig=<ID=${c}>`).join("\n");
  const sampleCols = samples.join("\t");

  return `##fileformat=VCFv4.2
##fileDate=20250101
${contigLines}
##INFO=<ID=SVTYPE,Number=1,Type=String,Description="Type of structural variant">
##INFO=<ID=SVLEN,Number=1,Type=Integer,Description="Length of structural variant">
##INFO=<ID=END,Number=1,Type=Integer,Description="End position">
##FORMAT=<ID=GT,Number=1,Type=String,Description="Genotype">
#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\t${sampleCols}
`;
}

/**
 * Create a minimal VCF variant line.
 *
 * @param {Object} options - Variant options
 * @param {string} options.chrom - Chromosome
 * @param {number} options.pos - Position
 * @param {string} options.svtype - SV type
 * @param {number} options.svlen - SV length
 * @returns {string} VCF variant line
 */
export function createVcfVariantLine({
  chrom = "NC_001133.9",
  pos = 1000,
  id = ".",
  svtype = "DEL",
  svlen = -500,
  end = null,
} = {}) {
  const endPos = end || pos + Math.abs(svlen);
  const info = `SVTYPE=${svtype};SVLEN=${svlen};END=${endPos}`;
  return `${chrom}\t${pos}\t${id}\tN\t<${svtype}>\t.\tPASS\t${info}\tGT\t0/1\n`;
}

/**
 * Create a complete minimal VCF file.
 *
 * @param {number} numVariants - Number of variants to create
 * @returns {string} Complete VCF file text
 */
export function createMinimalVcf(numVariants = 10) {
  const header = createMinimalVcfHeader();
  let variants = "";

  for (let i = 0; i < numVariants; i++) {
    variants += createVcfVariantLine({
      pos: 1000 + i * 1000,
      id: `variant_${i}`,
      svlen: -500 - i * 10,
    });
  }

  return header + variants;
}

// ==================== INDEXEDDB HELPERS ====================

/**
 * Clear all IndexedDB databases (for test cleanup).
 *
 * @returns {Promise<void>}
 */
export async function clearAllIndexedDB() {
  if (typeof indexedDB !== "undefined") {
    const databases = await indexedDB.databases();
    for (const db of databases) {
      if (db.name) {
        indexedDB.deleteDatabase(db.name);
      }
    }
  }
}

/**
 * Create a test IndexedDBManager instance.
 *
 * @param {string} name - Database name (default: random name)
 * @param {number} version - Database version
 * @returns {Promise<IndexedDBManager>} Initialized database manager
 *
 * @example
 * const db = await createTestDB('test-db');
 * await db.storeFile('test.vcf', arrayBuffer);
 * // ... use db ...
 * await cleanupTestDB(db);
 */
export async function createTestDB(name = null, version = 3) {
  const { IndexedDBManager } = await import("../../src/varify/assets/js/core/IndexedDBManager.js");

  const dbName = name || `test-db-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const db = new IndexedDBManager(dbName, version);
  await db.init();
  return db;
}

/**
 * Clean up test database by deleting it.
 *
 * @param {IndexedDBManager} db - Database manager instance
 * @returns {Promise<void>}
 */
export async function cleanupTestDB(db) {
  if (db) {
    await db.deleteDatabase();
  }
}

/**
 * Wait for IndexedDB operation to complete.
 *
 * @param {IDBRequest} request - IndexedDB request
 * @returns {Promise<any>} Promise that resolves with result
 */
export function waitForIndexedDB(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Open IndexedDB database and return connection.
 *
 * @param {string} dbName - Database name
 * @param {number} version - Database version
 * @param {Function} onUpgradeNeeded - Upgrade callback
 * @returns {Promise<IDBDatabase>} Database connection
 */
export function openTestDatabase(dbName, version = 1, onUpgradeNeeded = null) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, version);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);

    if (onUpgradeNeeded) {
      request.onupgradeneeded = (event) => {
        onUpgradeNeeded(event.target.result, event);
      };
    }
  });
}

// ==================== MOCK VARIANT HELPERS ====================

/**
 * Create a mock variant object (bcf/simple format).
 *
 * @param {Object} overrides - Fields to override
 * @returns {Object} Mock variant
 *
 * @example
 * const variant = createMockVariant({ pos: 5000, info: { SVTYPE: 'INS' } });
 */
export function createMockVariant(overrides = {}) {
  return {
    chr: "NC_001133.9",
    pos: 1000,
    id: "var_1000",
    ref: "N",
    alt: "<DEL>",
    qual: 100,
    filter: "PASS",
    info: {
      SVTYPE: "DEL",
      SVLEN: -500,
      END: 1500,
    },
    locus: "NC_001133.9:1000-1500",
    _computed: {
      SVLEN_num: -500,
      abs_SVLEN: 500,
      QUAL: 100,
    },
    ...overrides,
  };
}

/**
 * Create a SURVIVOR multi-caller variant with genotypes.
 *
 * @param {Object} overrides - Fields to override
 * @returns {Object} SURVIVOR variant
 *
 * @example
 * const variant = createSurvivorVariant({
 *   info: { SUPP_VEC: '11000', SUPP_CALLERS: 'delly,dysgu' }
 * });
 */
export function createSurvivorVariant(overrides = {}) {
  return {
    chr: "NC_001133.9",
    pos: 2000,
    id: "survivor_var",
    ref: "N",
    alt: "<DEL>",
    qual: 150,
    filter: "PASS",
    info: {
      SVTYPE: "DEL",
      SVLEN: -1000,
      END: 3000,
      SUPP_VEC: "01100000000000",
      SUPP_CALLERS: "delly,dysgu",
      PRIMARY_CALLER: "delly",
    },
    genotypes: {
      sample1: { GT: "0/0", GQ: "0", DR: "10", ID: "var1" },
      sample2: { GT: "0/1", GQ: "30", DR: "15", ID: "delly_DEL_1" },
      sample3: { GT: "1/1", GQ: "40", DR: "20", ID: "dysgu_DEL_1" },
    },
    locus: "NC_001133.9:2000-3000",
    _computed: {
      SVLEN_num: -1000,
      abs_SVLEN: 1000,
      GQ: 30,
      DR: 15,
      QUAL: 150,
    },
    ...overrides,
  };
}

/**
 * Create an array of mock variants for bulk testing.
 *
 * @param {number} count - Number of variants to create
 * @param {string} type - 'simple' or 'survivor'
 * @returns {Array} Array of mock variants
 */
export function createMockVariants(count = 10, type = "simple") {
  const variants = [];
  for (let i = 0; i < count; i++) {
    const base = type === "survivor" ? createSurvivorVariant() : createMockVariant();
    variants.push({
      ...base,
      pos: 1000 + i * 1000,
      id: `var_${i}`,
      locus: `NC_001133.9:${1000 + i * 1000}-${1500 + i * 1000}`,
    });
  }
  return variants;
}

// ==================== AG-GRID HELPERS ====================

/**
 * Mock AG-Grid API for testing.
 * Returns a minimal API object that tracks method calls.
 */
export class MockGridApi {
  constructor() {
    this.calls = {
      setRowData: [],
      refreshCells: [],
      sizeColumnsToFit: [],
      exportDataAsCsv: [],
      showLoadingOverlay: [],
      hideOverlay: [],
    };
    this._rowData = [];
  }

  setRowData(data) {
    this.calls.setRowData.push(data);
    this._rowData = data;
  }

  getDisplayedRowCount() {
    return this._rowData.length;
  }

  refreshCells() {
    this.calls.refreshCells.push(arguments);
  }

  sizeColumnsToFit() {
    this.calls.sizeColumnsToFit.push(arguments);
  }

  exportDataAsCsv(params) {
    this.calls.exportDataAsCsv.push(params);
    return "mock,csv,data\n1,2,3";
  }

  showLoadingOverlay() {
    this.calls.showLoadingOverlay.push(arguments);
  }

  hideOverlay() {
    this.calls.hideOverlay.push(arguments);
  }

  wasMethodCalled(methodName) {
    return this.calls[methodName]?.length > 0;
  }

  getCallCount(methodName) {
    return this.calls[methodName]?.length || 0;
  }
}

beforeEach(async () => {
  await clearAllIndexedDB();
});
