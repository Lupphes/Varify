/**
 * Tests for IndexedDBManager
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestDB,
  cleanupTestDB,
  createMockVariant,
  createSurvivorVariant,
  createMockVariants,
} from "../setup.js";
import { VariantFlattener } from "../../../src/varify/assets/js/core/storage/VariantFlattener.js";
import { VariantFilter } from "../../../src/varify/assets/js/core/query/VariantFilter.js";

describe("IndexedDBManager - Database Initialization", () => {
  let db;

  afterEach(async () => {
    await cleanupTestDB(db);
  });

  it("initializes database with correct version", async () => {
    db = await createTestDB("test-init", 3);
    expect(db.dexieDB).toBeDefined();
    expect(db.version).toBe(3);
  });

  it("creates files object store", async () => {
    db = await createTestDB();
    expect(db.dexieDB.files).toBeDefined();
  });

  it("creates variant object stores (bcf and survivor)", async () => {
    db = await createTestDB();
    expect(db.dexieDB.bcfVariants).toBeDefined();
    expect(db.dexieDB.survivorVariants).toBeDefined();
  });

  it("closes database connection", async () => {
    db = await createTestDB();
    db.close();
    expect(db.dexieDB.isOpen()).toBe(false);
  });

  it("deletes database completely", async () => {
    db = await createTestDB("test-delete");
    const dbName = db.dbName;
    await db.deleteDatabase();

    const databases = await indexedDB.databases();
    const exists = databases.some((d) => d.name === dbName);
    expect(exists).toBe(false);
  });
});

describe("IndexedDBManager - File Storage", () => {
  let db;

  beforeEach(async () => {
    db = await createTestDB();
  });

  afterEach(async () => {
    await cleanupTestDB(db);
  });

  it("stores file from ArrayBuffer", async () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]).buffer;
    await db.storeFile("test.bin", data);

    expect(await db.hasFile("test.bin")).toBe(true);
  });

  it("stores file from Blob", async () => {
    const blob = new Blob(["Hello, World!"], { type: "text/plain" });
    await db.storeFile("test.txt", blob);

    expect(await db.hasFile("test.txt")).toBe(true);
  });

  it("stores file with metadata", async () => {
    const data = new Uint8Array([1, 2, 3]).buffer;
    await db.storeFile("test.vcf", data, { type: "VCF", source: "test" });

    const info = await db.getFileInfo("test.vcf");
    expect(info.type).toBe("VCF");
    expect(info.source).toBe("test");
    expect(info.isChunked).toBe(false);
  });

  it("retrieves stored file", async () => {
    const original = new Uint8Array([10, 20, 30, 40]).buffer;
    await db.storeFile("data.bin", original);

    const retrieved = await db.getFile("data.bin");
    const retrievedArray = new Uint8Array(retrieved);

    expect(retrievedArray).toEqual(new Uint8Array([10, 20, 30, 40]));
  });

  it("returns null for non-existent file", async () => {
    const result = await db.getFile("nonexistent.vcf");
    expect(result).toBeNull();
  });

  it("checks if file exists", async () => {
    const data = new Uint8Array([1, 2, 3]).buffer;
    await db.storeFile("exists.txt", data);

    expect(await db.hasFile("exists.txt")).toBe(true);
    expect(await db.hasFile("not-exists.txt")).toBe(false);
  });

  it("lists all stored files", async () => {
    await db.storeFile("file1.txt", new ArrayBuffer(10));
    await db.storeFile("file2.txt", new ArrayBuffer(20));
    await db.storeFile("file3.txt", new ArrayBuffer(30));

    const files = await db.listFiles();
    expect(files).toHaveLength(3);
    expect(files).toContain("file1.txt");
    expect(files).toContain("file2.txt");
    expect(files).toContain("file3.txt");
  });

  it("gets file metadata without loading data", async () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]).buffer;
    await db.storeFile("metadata-test.vcf", data, { caller: "delly" });

    const info = await db.getFileInfo("metadata-test.vcf");

    expect(info.name).toBe("metadata-test.vcf");
    expect(info.size).toBe(5);
    expect(info.caller).toBe("delly");
    expect(info.timestamp).toBeDefined();
    expect(info.data).toBeUndefined();
  });

  it("deletes single file", async () => {
    await db.storeFile("to-delete.txt", new ArrayBuffer(10));
    expect(await db.hasFile("to-delete.txt")).toBe(true);

    await db.deleteFile("to-delete.txt");
    expect(await db.hasFile("to-delete.txt")).toBe(false);
  });

  it("clears all files", async () => {
    await db.storeFile("file1.txt", new ArrayBuffer(10));
    await db.storeFile("file2.txt", new ArrayBuffer(20));

    await db.clearAll();

    const files = await db.listFiles();
    expect(files).toHaveLength(0);
  });

  it("calculates total storage size", async () => {
    await db.storeFile("small.txt", new ArrayBuffer(100));
    await db.storeFile("medium.txt", new ArrayBuffer(500));
    await db.storeFile("large.txt", new ArrayBuffer(1000));

    const totalSize = await db.getStorageSize();
    expect(totalSize).toBeGreaterThan(0);
  });

  it("formats bytes to human-readable string", () => {
    expect(db.formatBytes(0)).toBe("0 Bytes");
    expect(db.formatBytes(1024)).toBe("1 KB");
    expect(db.formatBytes(1536)).toBe("1.5 KB");
    expect(db.formatBytes(1048576)).toBe("1 MB");
    expect(db.formatBytes(1073741824)).toBe("1 GB");
  });
});

describe("IndexedDBManager - Version Management", () => {
  let db;

  beforeEach(async () => {
    db = await createTestDB();
  });

  afterEach(async () => {
    await cleanupTestDB(db);
  });

  it("stores report version", async () => {
    await db.storeVersion("v1.2.3");
    const version = await db.getStoredVersion();
    expect(version).toBe("v1.2.3");
  });

  it("returns null for no stored version", async () => {
    const version = await db.getStoredVersion();
    expect(version).toBeNull();
  });

  it("updates version when stored again", async () => {
    await db.storeVersion("v1.0.0");
    await db.storeVersion("v2.0.0");

    const version = await db.getStoredVersion();
    expect(version).toBe("v2.0.0");
  });
});

describe("IndexedDBManager - Variant Storage", () => {
  let db;

  beforeEach(async () => {
    db = await createTestDB();
  });

  afterEach(async () => {
    await cleanupTestDB(db);
  });

  it("stores simple variants in bcf store", async () => {
    const variants = createMockVariants(5, "simple");
    await db.storeVariants("bcf", variants);

    const hasVariants = await db.hasVariants("bcf");
    expect(hasVariants).toBe(true);
  });

  it("stores SURVIVOR variants in survivor store", async () => {
    const variants = createMockVariants(3, "survivor");
    await db.storeVariants("survivor", variants);

    const count = await db.getVariantCount("survivor");
    expect(count).toBe(3);
  });

  it("flattens variant structure for storage", () => {
    const variant = createMockVariant({
      chr: "chr1",
      pos: 5000,
      info: { SVTYPE: "DEL", SVLEN: -1000, END: 6000 },
      _computed: { SVLEN_num: -1000, abs_SVLEN: 1000 },
    });

    const flattened = VariantFlattener.flattenVariantForStorage(variant);

    expect(flattened.CHROM).toBe("chr1");
    expect(flattened.POS).toBe(5000);

    expect(flattened.SVTYPE).toBe("DEL");
    expect(flattened.SVLEN).toBe(-1000);
    expect(flattened.END).toBe(6000);

    expect(flattened.SVLEN_num).toBe(-1000);
    expect(flattened.abs_SVLEN).toBe(1000);

    expect(flattened._variant).toBeDefined();
  });

  it("preserves SUPP_VEC as string", () => {
    const variant = createSurvivorVariant({
      info: { SUPP_VEC: "01100000000000" },
    });

    const flattened = VariantFlattener.flattenVariantForStorage(variant);

    expect(typeof flattened.SUPP_VEC).toBe("string");
    expect(flattened.SUPP_VEC).toBe("01100000000000");
  });

  it("selects primary caller from SUPP_CALLERS", () => {
    const variant = createSurvivorVariant({
      id: "delly_DEL_1",
      info: {
        SUPP_VEC: "01100000000000",
        SUPP_CALLERS: "delly,dysgu",
        PRIMARY_CALLER: "delly",
      },
    });

    const flattened = VariantFlattener.flattenVariantForStorage(variant);

    expect(flattened.GQ).toBe(30);
    expect(flattened._primaryCallerName).toBe("delly");
  });

  it("stores all callers data for SURVIVOR variants", () => {
    const variant = createSurvivorVariant({
      info: {
        SUPP_VEC: "01100000000000",
        SUPP_CALLERS: "delly,dysgu",
      },
      genotypes: {
        sample1: { GT: "0/0", GQ: "0", DR: "10" },
        sample2: { GT: "0/1", GQ: "30", DR: "15", ID: "delly_DEL_1" },
        sample3: { GT: "1/1", GQ: "40", DR: "20", ID: "dysgu_DEL_1" },
      },
    });

    const flattened = VariantFlattener.flattenVariantForStorage(variant);

    expect(flattened._allCallers).toBeDefined();
    expect(flattened._allCallers).toHaveLength(2);
    expect(flattened._allCallers[0].caller).toBe("delly");
    expect(flattened._allCallers[1].caller).toBe("dysgu");
  });

  it("detects conflicts across callers", () => {
    const variant = createSurvivorVariant({
      id: "delly_DEL_1",
      info: {
        SVTYPE: "DEL",
        SVLEN: -1000,
        END: 3000,
        SUPP_VEC: "1100000000000",
        SUPP_CALLERS: "delly,dysgu",
      },
      genotypes: {
        sample1: { GT: "0/1", GQ: "30", DR: "15", ID: "delly_DEL_1" },
        sample2: { GT: "1/1", GQ: "40", DR: "25", ID: "dysgu_DEL_1" },
        sample3: { GT: "0/0", GQ: "0", DR: "0" },
      },
    });

    const flattened = VariantFlattener.flattenVariantForStorage(variant);

    expect(flattened._allCallers).toBeDefined();
    expect(flattened._allCallers.length).toBe(2);
  });

  it("clears variants for prefix", async () => {
    const variants = createMockVariants(5, "simple");
    await db.storeVariants("bcf", variants);

    await db.clearVariants("bcf");

    const count = await db.getVariantCount("bcf");
    expect(count).toBe(0);
  });
});

describe("IndexedDBManager - Query Operations", () => {
  let db;

  beforeEach(async () => {
    db = await createTestDB();

    const variants = [
      createMockVariant({
        chr: "chr1",
        pos: 1000,
        info: { SVTYPE: "DEL", SVLEN: -500 },
        filter: "PASS",
        _computed: { SVLEN_num: -500, abs_SVLEN: 500, GQ: 30 },
      }),
      createMockVariant({
        chr: "chr1",
        pos: 2000,
        info: { SVTYPE: "INS", SVLEN: 300 },
        filter: "PASS",
        _computed: { SVLEN_num: 300, abs_SVLEN: 300, GQ: 40 },
      }),
      createMockVariant({
        chr: "chr2",
        pos: 3000,
        info: { SVTYPE: "DEL", SVLEN: -1000 },
        filter: "LowQual",
        _computed: { SVLEN_num: -1000, abs_SVLEN: 1000, GQ: 10 },
      }),
      createMockVariant({
        chr: "chr2",
        pos: 4000,
        info: { SVTYPE: "DUP", SVLEN: 800 },
        filter: "PASS",
        _computed: { SVLEN_num: 800, abs_SVLEN: 800, GQ: 50 },
      }),
    ];

    await db.storeVariants("bcf", variants);
  });

  afterEach(async () => {
    await cleanupTestDB(db);
  });

  it("queries all variants without filters", async () => {
    const results = await db.queryVariants("bcf", {}, { limit: 100 });
    expect(results.length).toBeGreaterThanOrEqual(4);
  });

  it("filters by exact match (CHROM)", async () => {
    const results = await db.queryVariants("bcf", { CHROM: "chr1" }, { limit: 100 });
    expect(results.length).toBe(2);
    expect(results.every((v) => v.CHROM === "chr1")).toBe(true);
  });

  it("filters by categorical multi-select", async () => {
    const results = await db.queryVariants(
      "bcf",
      {
        SVTYPE: { values: ["DEL", "INS"] },
      },
      { limit: 100 }
    );

    expect(results.length).toBe(3);
    expect(results.every((v) => v.SVTYPE === "DEL" || v.SVTYPE === "INS")).toBe(true);
  });

  it("filters by numeric range (min only)", async () => {
    const results = await db.queryVariants(
      "bcf",
      {
        abs_SVLEN: { min: 500 },
      },
      { limit: 100 }
    );

    expect(results.length).toBe(3);
    expect(results.every((v) => v.abs_SVLEN >= 500)).toBe(true);
  });

  it("filters by numeric range (max only)", async () => {
    const results = await db.queryVariants(
      "bcf",
      {
        abs_SVLEN: { max: 500 },
      },
      { limit: 100 }
    );

    expect(results.length).toBe(2);
    expect(results.every((v) => v.abs_SVLEN <= 500)).toBe(true);
  });

  it("filters by numeric range (min and max)", async () => {
    const results = await db.queryVariants(
      "bcf",
      {
        abs_SVLEN: { min: 300, max: 800 },
      },
      { limit: 100 }
    );

    expect(results.length).toBe(3);
    expect(results.every((v) => v.abs_SVLEN >= 300 && v.abs_SVLEN <= 800)).toBe(true);
  });

  it("combines multiple filters (AND logic)", async () => {
    const results = await db.queryVariants(
      "bcf",
      {
        CHROM: "chr1",
        SVTYPE: "DEL",
      },
      { limit: 100 }
    );

    expect(results.length).toBe(1);
    expect(results[0].CHROM).toBe("chr1");
    expect(results[0].SVTYPE).toBe("DEL");
  });

  it("applies pagination with offset and limit", async () => {
    const page1 = await db.queryVariants("bcf", {}, { offset: 0, limit: 2 });
    const page2 = await db.queryVariants("bcf", {}, { offset: 2, limit: 2 });

    expect(page1.length).toBe(2);
    expect(page2.length).toBe(2);
    expect(page1[0].POS).not.toBe(page2[0].POS);
  });

  it("sorts by field ascending", async () => {
    const results = await db.queryVariants(
      "bcf",
      {},
      {
        limit: 100,
        sort: { field: "POS", direction: "asc" },
      }
    );

    expect(results[0].POS).toBe(1000);
    expect(results[1].POS).toBe(2000);
    expect(results[2].POS).toBe(3000);
    expect(results[3].POS).toBe(4000);
  });

  it("sorts by field descending", async () => {
    const results = await db.queryVariants(
      "bcf",
      {},
      {
        limit: 100,
        sort: { field: "POS", direction: "desc" },
      }
    );

    expect(results[0].POS).toBe(4000);
    expect(results[1].POS).toBe(3000);
    expect(results[2].POS).toBe(2000);
    expect(results[3].POS).toBe(1000);
  });

  it("gets variant count without filters", async () => {
    const count = await db.getVariantCount("bcf");
    expect(count).toBeGreaterThanOrEqual(4);
  });

  it("gets variant count with filters", async () => {
    const count = await db.getVariantCount("bcf", { SVTYPE: "DEL" });
    expect(count).toBeGreaterThanOrEqual(2);
  });

  it("checks if variants exist", async () => {
    expect(await db.hasVariants("bcf")).toBe(true);
    expect(await db.hasVariants("survivor")).toBe(false);
  });
});

describe("IndexedDBManager - Filter Matching", () => {
  let db;

  beforeEach(async () => {
    db = await createTestDB();
  });

  afterEach(async () => {
    await cleanupTestDB(db);
  });

  it("matches exact value filter", () => {
    const variant = { CHROM: "chr1", SVTYPE: "DEL" };

    expect(VariantFilter.matchesFilters(variant, { CHROM: "chr1" })).toBe(true);
    expect(VariantFilter.matchesFilters(variant, { CHROM: "chr2" })).toBe(false);
  });

  it("matches categorical multi-select filter", () => {
    const variant = { SVTYPE: "DEL" };

    expect(
      VariantFilter.matchesFilters(variant, {
        SVTYPE: { values: ["DEL", "INS"] },
      })
    ).toBe(true);
    expect(
      VariantFilter.matchesFilters(variant, {
        SVTYPE: { values: ["INS", "DUP"] },
      })
    ).toBe(false);
  });

  it("matches numeric range filter", () => {
    const variant = { GQ: 30 };

    expect(VariantFilter.matchesFilters(variant, { GQ: { min: 20, max: 40 } })).toBe(true);
    expect(VariantFilter.matchesFilters(variant, { GQ: { min: 40 } })).toBe(false);
    expect(VariantFilter.matchesFilters(variant, { GQ: { max: 20 } })).toBe(false);
  });

  it("excludes missing data from numeric filters", () => {
    const variant1 = { GQ: null };
    const variant2 = { GQ: "." };
    const variant3 = { GQ: "" };

    expect(VariantFilter.matchesFilters(variant1, { GQ: { min: 0 } })).toBe(false);
    expect(VariantFilter.matchesFilters(variant2, { GQ: { min: 0 } })).toBe(false);
    expect(VariantFilter.matchesFilters(variant3, { GQ: { min: 0 } })).toBe(false);
  });

  it("matches multiple filters with AND logic", () => {
    const variant = { CHROM: "chr1", SVTYPE: "DEL", GQ: 30 };

    expect(
      VariantFilter.matchesFilters(variant, {
        CHROM: "chr1",
        SVTYPE: "DEL",
        GQ: { min: 20 },
      })
    ).toBe(true);

    expect(
      VariantFilter.matchesFilters(variant, {
        CHROM: "chr1",
        SVTYPE: "INS",
      })
    ).toBe(false);
  });
});

describe("IndexedDBManager - Multi-Caller Filtering", () => {
  let db;

  beforeEach(async () => {
    db = await createTestDB();
  });

  afterEach(async () => {
    await cleanupTestDB(db);
  });

  it("checks if ANY caller matches filter", () => {
    const allCallers = [
      { caller: "delly", GQ: 10, DR: 15 },
      { caller: "dysgu", GQ: 40, DR: 20 },
    ];

    expect(VariantFilter.checkMultiCallerFilter(allCallers, "GQ", { min: 30 })).toBe(true);

    expect(VariantFilter.checkMultiCallerFilter(allCallers, "GQ", { min: 50 })).toBe(false);
  });

  it("multi-caller mode filters variants", async () => {
    const variant = createSurvivorVariant({
      id: "delly_DEL_1",
      info: {
        SVTYPE: "DEL",
        SVLEN: -1000,
        END: 3000,
        SUPP_VEC: "1100000000000",
        SUPP_CALLERS: "delly,dysgu",
        PRIMARY_CALLER: "delly",
      },
      genotypes: {
        sample1: { GT: "0/1", GQ: "10", DR: "15", ID: "delly_DEL_1" },
        sample2: { GT: "1/1", GQ: "40", DR: "20", ID: "dysgu_DEL_1" },
        sample3: { GT: "0/0", GQ: "0", DR: "0" },
      },
    });

    await db.storeVariants("survivor", [variant]);

    const storedVariants = await db.queryVariants("survivor", {}, { limit: 10 });
    expect(storedVariants.length).toBe(1);

    const stored = storedVariants[0];
    expect(stored._allCallers).toBeDefined();
    expect(stored._allCallers.length).toBe(2);

    expect(stored._allCallers[0].GQ).toBe(10);
    expect(stored._allCallers[1].GQ).toBe(40);

    const results1 = await db.queryVariants(
      "survivor",
      {
        GQ: { min: 30 },
      },
      { limit: 100, multiCallerMode: false }
    );
    expect(results1.length).toBe(0);

    const results2 = await db.queryVariants(
      "survivor",
      {
        GQ: { min: 30 },
      },
      { limit: 100, multiCallerMode: true }
    );

    expect(results2.length).toBe(1);
  });
});

describe("IndexedDBManager - Index Selection", () => {
  let db;

  beforeEach(async () => {
    db = await createTestDB();
  });

  afterEach(async () => {
    await cleanupTestDB(db);
  });

  it("selects CHROM_POS compound index when both present", () => {
    const index = VariantFilter.selectBestIndex({
      CHROM: "chr1",
      POS: { min: 1000 },
    });
    expect(index).toBe("CHROM_POS");
  });

  it("selects CHROM index when only CHROM present", () => {
    const index = VariantFilter.selectBestIndex({ CHROM: "chr1" });
    expect(index).toBe("CHROM");
  });

  it("selects SVTYPE index when present", () => {
    const index = VariantFilter.selectBestIndex({ SVTYPE: "DEL" });
    expect(index).toBe("SVTYPE");
  });

  it("returns null when no suitable index", () => {
    const index = VariantFilter.selectBestIndex({ UNKNOWN_FIELD: "value" });
    expect(index).toBeNull();
  });

  it("skips index for multi-select filters", () => {
    const index = VariantFilter.selectBestIndex({
      SVTYPE: { values: ["DEL", "INS"] },
    });
    expect(index).toBeNull();
  });

  it("builds KeyRange for exact match", () => {
    const range = VariantFilter.buildKeyRange({ CHROM: "chr1" }, "CHROM");

    expect(range.lower).toBe("chr1");
    expect(range.upper).toBe("chr1");
    expect(range.lowerOpen).toBe(false);
    expect(range.upperOpen).toBe(false);
  });

  it("builds KeyRange for numeric range (min and max)", () => {
    const range = VariantFilter.buildKeyRange({ GQ: { min: 10, max: 50 } }, "GQ");

    expect(range.lower).toBe(10);
    expect(range.upper).toBe(50);
  });

  it("builds KeyRange for compound index (CHROM_POS)", () => {
    const range = VariantFilter.buildKeyRange({ CHROM: "chr1", POS: { min: 1000 } }, "CHROM_POS");

    expect(range.lower).toEqual(["chr1", 0]);
    expect(range.upper).toEqual(["chr1", Number.MAX_SAFE_INTEGER]);
  });

  it("returns null KeyRange for multi-select", () => {
    const range = VariantFilter.buildKeyRange({ SVTYPE: { values: ["DEL", "INS"] } }, "SVTYPE");
    expect(range).toBeNull();
  });
});

describe("IndexedDBManager - Integration Tests with Real Data", () => {
  let db;

  beforeEach(async () => {
    db = await createTestDB();
  });

  afterEach(async () => {
    await cleanupTestDB(db);
  });

  it("stores and queries real BCF merged VCF data", async () => {
    const { loadRealVcfArrayBuffer, getRealVcfFiles } = await import("../setup.js");
    const { VCFParser } = await import("../../../src/varify/assets/js/core/VCFParser.js");

    const vcfFiles = getRealVcfFiles();
    const vcfArrayBuffer = loadRealVcfArrayBuffer(vcfFiles.bcfMerge);

    const parser = new VCFParser();
    const variants = await parser.parseVCF(vcfArrayBuffer, 50);

    expect(variants.length).toBeGreaterThan(0);

    await db.storeVariants("bcf", variants);

    const allResults = await db.queryVariants("bcf", {}, { limit: 100 });
    expect(allResults.length).toBeGreaterThanOrEqual(variants.length - 5);

    const delVariants = await db.queryVariants(
      "bcf",
      {
        SVTYPE: "DEL",
      },
      { limit: 100 }
    );

    expect(delVariants.length).toBeGreaterThan(0);
    expect(delVariants.every((v) => v.SVTYPE === "DEL")).toBe(true);
  });

  it("stores and queries real SURVIVOR merged VCF data", async () => {
    const { loadRealVcfArrayBuffer, getRealVcfFiles } = await import("../setup.js");
    const { VCFParser } = await import("../../../src/varify/assets/js/core/VCFParser.js");

    const vcfFiles = getRealVcfFiles();
    const vcfArrayBuffer = loadRealVcfArrayBuffer(vcfFiles.survivorMerge);

    const parser = new VCFParser();
    const variants = await parser.parseVCF(vcfArrayBuffer, 30);

    expect(variants.length).toBeGreaterThan(0);

    await db.storeVariants("survivor", variants);

    const results = await db.queryVariants("survivor", {}, { limit: 1 });
    expect(typeof results[0].SUPP_VEC).toBe("string");

    expect(results[0]._allCallers).toBeDefined();
    expect(results[0]._allCallers.length).toBeGreaterThan(0);
  });

  it("handles large dataset storage and retrieval", async () => {
    const { loadRealVcfArrayBuffer, getRealVcfFiles } = await import("../setup.js");
    const { VCFParser } = await import("../../../src/varify/assets/js/core/VCFParser.js");

    const vcfFiles = getRealVcfFiles();
    const vcfArrayBuffer = loadRealVcfArrayBuffer(vcfFiles.bcfMerge);

    const parser = new VCFParser();
    const variants = await parser.parseVCF(vcfArrayBuffer, 200);

    expect(variants.length).toBeGreaterThan(100);

    const startTime = Date.now();
    await db.storeVariants("bcf", variants);
    const storeDuration = Date.now() - startTime;

    console.log(`Stored ${variants.length} variants in ${storeDuration}ms`);

    const page1 = await db.queryVariants("bcf", {}, { offset: 0, limit: 50 });
    const page2 = await db.queryVariants("bcf", {}, { offset: 50, limit: 50 });

    expect(page1.length).toBe(50);
    expect(page2.length).toBe(50);
    expect(page1[0].locus).not.toBe(page2[0].locus);
  });

  it("queries real data with complex filters", async () => {
    const { loadRealVcfArrayBuffer, getRealVcfFiles } = await import("../setup.js");
    const { VCFParser } = await import("../../../src/varify/assets/js/core/VCFParser.js");

    const vcfFiles = getRealVcfFiles();
    const vcfArrayBuffer = loadRealVcfArrayBuffer(vcfFiles.bcfMerge);

    const parser = new VCFParser();
    const variants = await parser.parseVCF(vcfArrayBuffer, 100);
    await db.storeVariants("bcf", variants);

    const results = await db.queryVariants(
      "bcf",
      {
        SVTYPE: { values: ["DEL", "INS"] },
        FILTER: "PASS",
      },
      {
        limit: 50,
        sort: { field: "POS", direction: "asc" },
      }
    );

    expect(
      results.every((v) => (v.SVTYPE === "DEL" || v.SVTYPE === "INS") && v.FILTER === "PASS")
    ).toBe(true);

    for (let i = 1; i < results.length; i++) {
      expect(results[i].POS).toBeGreaterThanOrEqual(results[i - 1].POS);
    }
  });

  it("stores real genome files (FASTA, BAM)", async () => {
    const { loadRealVcfBuffer, getRealVcfFiles } = await import("../setup.js");

    const vcfFiles = getRealVcfFiles();

    const fastaBuffer = loadRealVcfBuffer(vcfFiles.referenceFasta);
    await db.storeFile(vcfFiles.referenceFasta, fastaBuffer.buffer, {
      type: "FASTA",
      organism: "S. cerevisiae",
    });

    const faiBuffer = loadRealVcfBuffer(vcfFiles.referenceFai);
    await db.storeFile(vcfFiles.referenceFai, faiBuffer.buffer, {
      type: "FAI",
    });

    expect(await db.hasFile(vcfFiles.referenceFasta)).toBe(true);
    expect(await db.hasFile(vcfFiles.referenceFai)).toBe(true);

    const fastaInfo = await db.getFileInfo(vcfFiles.referenceFasta);
    expect(fastaInfo.type).toBe("FASTA");
    expect(fastaInfo.organism).toBe("S. cerevisiae");
    expect(fastaInfo.isChunked).toBeDefined();

    const retrievedFasta = await db.getFile(vcfFiles.referenceFasta);
    expect(retrievedFasta.byteLength).toBe(fastaBuffer.byteLength);
  });

  it("measures query performance on real data", async () => {
    const { loadRealVcfArrayBuffer, getRealVcfFiles } = await import("../setup.js");
    const { VCFParser } = await import("../../../src/varify/assets/js/core/VCFParser.js");

    const vcfFiles = getRealVcfFiles();
    const vcfArrayBuffer = loadRealVcfArrayBuffer(vcfFiles.bcfMerge);

    const parser = new VCFParser();
    const variants = await parser.parseVCF(vcfArrayBuffer, 500);
    await db.storeVariants("bcf", variants);

    const indexedStart = Date.now();
    const indexedResults = await db.queryVariants(
      "bcf",
      {
        CHROM: variants[0].chr,
      },
      { limit: 100 }
    );
    const indexedDuration = Date.now() - indexedStart;

    const scanStart = Date.now();
    const scanResults = await db.queryVariants("bcf", {}, { limit: 100 });
    const scanDuration = Date.now() - scanStart;

    console.log(`Indexed query: ${indexedDuration}ms (${indexedResults.length} results)`);
    console.log(`Full scan: ${scanDuration}ms (${scanResults.length} results)`);

    expect(indexedResults.length).toBeGreaterThan(0);
    expect(scanResults.length).toBeGreaterThan(0);
  });
});
