/**
 * Tests for IGVIndexedDBLoaderx
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDB, cleanupTestDB, loadRealVcfBuffer, getRealVcfFiles } from "../setup.js";
import { IGVIndexedDBLoader } from "../../../src/varify/assets/js/core/IGVLoader.js";

describe("IGVIndexedDBLoader - File Loading", () => {
  let db;
  let loader;

  beforeEach(async () => {
    db = await createTestDB();
    loader = new IGVIndexedDBLoader(db);
  });

  afterEach(async () => {
    await cleanupTestDB(db);
  });

  it("loads file from IndexedDB", async () => {
    const testData = new Uint8Array([1, 2, 3, 4, 5]).buffer;
    await db.storeFile("test.vcf", testData);

    const file = await loader.loadFile("test.vcf");

    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe("test.vcf");
    expect(file.size).toBe(5);
  });

  it("loads fresh file each time (no caching to avoid stale references)", async () => {
    const testData = new Uint8Array([10, 20, 30]).buffer;
    await db.storeFile("cached.vcf", testData);

    const file1 = await loader.loadFile("cached.vcf");
    const file2 = await loader.loadFile("cached.vcf");

    expect(file1).not.toBe(file2);
    expect(file1.name).toBe(file2.name);
    expect(file1.size).toBe(file2.size);
  });

  it("throws error for missing file", async () => {
    await expect(async () => {
      await loader.loadFile("nonexistent.vcf");
    }).rejects.toThrow("File not found in IndexedDB: nonexistent.vcf");
  });

  it("creates File object with correct MIME type", async () => {
    const testData = new Uint8Array([1, 2, 3]).buffer;

    await db.storeFile("data.vcf", testData);
    await db.storeFile("data.fasta", testData);
    await db.storeFile("data.bam", testData);

    const vcfFile = await loader.loadFile("data.vcf");
    const fastaFile = await loader.loadFile("data.fasta");
    const bamFile = await loader.loadFile("data.bam");

    expect(vcfFile.type).toBe("text/plain");
    expect(fastaFile.type).toBe("text/plain");
    expect(bamFile.type).toBe("application/octet-stream");
  });

  it("clearCache is a no-op (no caching to avoid stale references)", async () => {
    const testData = new Uint8Array([1, 2, 3]).buffer;
    await db.storeFile("cached.vcf", testData);

    await loader.loadFile("cached.vcf");
    expect(loader.fileCache.size).toBe(0);

    loader.clearCache();
    expect(loader.fileCache.size).toBe(0);
  });
});

describe("IGVIndexedDBLoader - MIME Type Detection", () => {
  let loader;

  beforeEach(() => {
    loader = new IGVIndexedDBLoader(null);
  });

  it("detects FASTA MIME types", () => {
    expect(loader.getMimeType("genome.fna")).toBe("text/plain");
    expect(loader.getMimeType("genome.fa")).toBe("text/plain");
    expect(loader.getMimeType("genome.fasta")).toBe("text/plain");
    expect(loader.getMimeType("genome.fai")).toBe("text/plain");
  });

  it("detects VCF MIME type", () => {
    expect(loader.getMimeType("variants.vcf")).toBe("text/plain");
  });

  it("detects compressed file MIME type", () => {
    expect(loader.getMimeType("data.vcf.gz")).toBe("application/gzip");
  });

  it("detects BAM file MIME types", () => {
    expect(loader.getMimeType("alignments.bam")).toBe("application/octet-stream");
    expect(loader.getMimeType("alignments.bai")).toBe("application/octet-stream");
    expect(loader.getMimeType("alignments.tbi")).toBe("application/octet-stream");
  });

  it("returns default MIME type for unknown extensions", () => {
    expect(loader.getMimeType("unknown.xyz")).toBe("application/octet-stream");
  });

  it("handles case-insensitive extensions", () => {
    expect(loader.getMimeType("FILE.VCF")).toBe("text/plain");
    expect(loader.getMimeType("FILE.BAM")).toBe("application/octet-stream");
  });
});

describe("IGVIndexedDBLoader - Filename Extraction", () => {
  let loader;

  beforeEach(() => {
    loader = new IGVIndexedDBLoader(null);
  });

  it("extracts simple filename", () => {
    const filename = loader.extractFilename("genome.fna");
    expect(filename).toBe("genome.fna");
  });

  it("extracts filename from relative path", () => {
    const filename = loader.extractFilename("../data/genome.fna");
    expect(filename).toBe("genome.fna");
  });

  it("extracts filename from nested path", () => {
    const filename = loader.extractFilename("data/genomes/yeast/genome.fna");
    expect(filename).toBe("genome.fna");
  });

  it("extracts filename from file:// URL", () => {
    const filename = loader.extractFilename("file:///path/to/genome.fna");
    expect(filename).toBe("genome.fna");
  });

  it("returns null for blob: URLs", () => {
    const filename = loader.extractFilename("blob:http://localhost/abc123");
    expect(filename).toBeNull();
  });

  it("returns null for data: URLs", () => {
    const filename = loader.extractFilename("data:text/plain;base64,SGVsbG8=");
    expect(filename).toBeNull();
  });
});

describe("IGVIndexedDBLoader - Required Files Check", () => {
  let db;
  let loader;

  beforeEach(async () => {
    db = await createTestDB();
    loader = new IGVIndexedDBLoader(db);
  });

  afterEach(async () => {
    await cleanupTestDB(db);
  });

  it("returns empty array when all files exist", async () => {
    await db.storeFile("genome.fna", new ArrayBuffer(10));
    await db.storeFile("genome.fna.fai", new ArrayBuffer(10));
    await db.storeFile("variants.vcf", new ArrayBuffer(10));

    const missing = await loader.checkRequiredFiles([
      "genome.fna",
      "genome.fna.fai",
      "variants.vcf",
    ]);

    expect(missing).toEqual([]);
  });

  it("returns list of missing files", async () => {
    await db.storeFile("genome.fna", new ArrayBuffer(10));

    const missing = await loader.checkRequiredFiles([
      "genome.fna",
      "genome.fna.fai",
      "variants.vcf",
    ]);

    expect(missing).toEqual(["genome.fna.fai", "variants.vcf"]);
  });

  it("checks all files when none exist", async () => {
    const missing = await loader.checkRequiredFiles(["file1.txt", "file2.txt", "file3.txt"]);

    expect(missing).toHaveLength(3);
    expect(missing).toEqual(["file1.txt", "file2.txt", "file3.txt"]);
  });
});

describe("IGVIndexedDBLoader - Integration Tests with Real Data", () => {
  let db;
  let loader;

  beforeEach(async () => {
    db = await createTestDB();
    loader = new IGVIndexedDBLoader(db);
  });

  afterEach(async () => {
    await cleanupTestDB(db);
  });

  it("loads real FASTA reference file", async () => {
    const vcfFiles = getRealVcfFiles();
    const fastaBuffer = loadRealVcfBuffer(vcfFiles.referenceFasta);

    await db.storeFile(vcfFiles.referenceFasta, fastaBuffer.buffer);

    const file = await loader.loadFile(vcfFiles.referenceFasta);

    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe(vcfFiles.referenceFasta);
    expect(file.size).toBe(fastaBuffer.byteLength);
    expect(file.type).toBe("text/plain");

    const fileArrayBuffer = await file.arrayBuffer();
    expect(fileArrayBuffer.byteLength).toBe(fastaBuffer.byteLength);
  });

  it("loads real FASTA index file", async () => {
    const vcfFiles = getRealVcfFiles();
    const faiBuffer = loadRealVcfBuffer(vcfFiles.referenceFai);

    await db.storeFile(vcfFiles.referenceFai, faiBuffer.buffer);

    const file = await loader.loadFile(vcfFiles.referenceFai);

    expect(file.name).toBe(vcfFiles.referenceFai);
    expect(file.size).toBeGreaterThan(0);
  });

  it("loads real VCF file", async () => {
    const vcfFiles = getRealVcfFiles();
    const vcfBuffer = loadRealVcfBuffer(vcfFiles.bcfMerge);

    await db.storeFile(vcfFiles.bcfMerge, vcfBuffer.buffer);

    const file = await loader.loadFile(vcfFiles.bcfMerge);

    expect(file.name).toBe(vcfFiles.bcfMerge);
    expect(file.size).toBeGreaterThan(0);
    expect(file.type).toBe("text/plain");
  });

  it("checks required files for IGV browser setup", async () => {
    const vcfFiles = getRealVcfFiles();

    const fastaBuffer = loadRealVcfBuffer(vcfFiles.referenceFasta);
    await db.storeFile(vcfFiles.referenceFasta, fastaBuffer.buffer);

    const missing = await loader.checkRequiredFiles([
      vcfFiles.referenceFasta,
      vcfFiles.referenceFai,
      vcfFiles.bcfMerge,
    ]);

    expect(missing).toContain(vcfFiles.referenceFai);
    expect(missing).toContain(vcfFiles.bcfMerge);
    expect(missing).not.toContain(vcfFiles.referenceFasta);
  });

  it("loads real files fresh each time to avoid stale references", async () => {
    const vcfFiles = getRealVcfFiles();
    const fastaBuffer = loadRealVcfBuffer(vcfFiles.referenceFasta);
    await db.storeFile(vcfFiles.referenceFasta, fastaBuffer.buffer);

    const file1 = await loader.loadFile(vcfFiles.referenceFasta);
    const file2 = await loader.loadFile(vcfFiles.referenceFasta);

    expect(file1).not.toBe(file2);
    expect(file1.name).toBe(file2.name);
    expect(file1.size).toBe(file2.size);
    expect(file1.size).toBe(fastaBuffer.byteLength);
  });
});

describe("IGVIndexedDBLoader - createIGVConfig", () => {
  let db;
  let loader;

  beforeEach(async () => {
    db = await createTestDB();
    loader = new IGVIndexedDBLoader(db);
  });

  afterEach(async () => {
    await cleanupTestDB(db);
  });

  it("creates basic IGV config with reference genome", async () => {
    const fastaData = new Uint8Array([1, 2, 3]).buffer;
    const faiData = new Uint8Array([4, 5, 6]).buffer;

    await db.storeFile("genome.fna", fastaData);
    await db.storeFile("genome.fna.fai", faiData);

    const config = await loader.createIGVConfig({
      fastaFile: "genome.fna",
    });

    expect(config.reference).toBeDefined();
    expect(config.reference.id).toBe("genome");
    expect(config.reference.name).toBe("genome.fna");
    expect(config.reference.fastaURL).toBeInstanceOf(File);
    expect(config.reference.indexURL).toBeInstanceOf(File);
  });

  it("creates config with VCF tracks", async () => {
    const fastaData = new Uint8Array([1, 2, 3]).buffer;
    const faiData = new Uint8Array([4, 5, 6]).buffer;
    const vcfData = new Uint8Array([7, 8, 9]).buffer;

    await db.storeFile("genome.fna", fastaData);
    await db.storeFile("genome.fna.fai", faiData);
    await db.storeFile("variants.vcf", vcfData);

    const config = await loader.createIGVConfig({
      fastaFile: "genome.fna",
      vcfFiles: ["variants.vcf"],
    });

    expect(config.tracks).toHaveLength(1);
    expect(config.tracks[0].type).toBe("variant");
    expect(config.tracks[0].format).toBe("vcf");
    expect(config.tracks[0].name).toBe("variants.vcf");
    expect(config.tracks[0].displayMode).toBe("EXPANDED");
  });

  it("creates config with multiple VCF tracks", async () => {
    const fastaData = new Uint8Array([1, 2, 3]).buffer;
    const faiData = new Uint8Array([4, 5, 6]).buffer;
    const vcfData = new Uint8Array([7, 8, 9]).buffer;

    await db.storeFile("genome.fna", fastaData);
    await db.storeFile("genome.fna.fai", faiData);
    await db.storeFile("variants1.vcf", vcfData);
    await db.storeFile("variants2.vcf", vcfData);

    const config = await loader.createIGVConfig({
      fastaFile: "genome.fna",
      vcfFiles: ["variants1.vcf", "variants2.vcf"],
    });

    expect(config.tracks).toHaveLength(2);
    expect(config.tracks[0].name).toBe("variants1.vcf");
    expect(config.tracks[1].name).toBe("variants2.vcf");
  });

  it("creates config with compressed VCF and index", async () => {
    const fastaData = new Uint8Array([1, 2, 3]).buffer;
    const faiData = new Uint8Array([4, 5, 6]).buffer;
    const vcfGzData = new Uint8Array([7, 8, 9]).buffer;
    const tbiData = new Uint8Array([10, 11, 12]).buffer;

    await db.storeFile("genome.fna", fastaData);
    await db.storeFile("genome.fna.fai", faiData);
    await db.storeFile("variants.vcf.gz", vcfGzData);
    await db.storeFile("variants.vcf.gz.tbi", tbiData);

    const config = await loader.createIGVConfig({
      fastaFile: "genome.fna",
      vcfFiles: ["variants.vcf.gz"],
    });

    expect(config.tracks).toHaveLength(1);
    expect(config.tracks[0].format).toBe("vcf");
    expect(config.tracks[0].url).toBeInstanceOf(File);
    expect(config.tracks[0].indexURL).toBeInstanceOf(File);
  });

  it("creates config with BAM tracks", async () => {
    const fastaData = new Uint8Array([1, 2, 3]).buffer;
    const faiData = new Uint8Array([4, 5, 6]).buffer;
    const bamData = new Uint8Array([7, 8, 9]).buffer;
    const baiData = new Uint8Array([10, 11, 12]).buffer;

    await db.storeFile("genome.fna", fastaData);
    await db.storeFile("genome.fna.fai", faiData);
    await db.storeFile("alignments.bam", bamData);
    await db.storeFile("alignments.bam.bai", baiData);

    const config = await loader.createIGVConfig({
      fastaFile: "genome.fna",
      bamFiles: ["alignments.bam"],
    });

    expect(config.tracks).toHaveLength(1);
    expect(config.tracks[0].type).toBe("alignment");
    expect(config.tracks[0].format).toBe("bam");
    expect(config.tracks[0].name).toBe("alignments.bam");
    expect(config.tracks[0].displayMode).toBe("SQUISHED");
    expect(config.tracks[0].indexURL).toBeInstanceOf(File);
  });

  it("creates config with ROI features", async () => {
    const fastaData = new Uint8Array([1, 2, 3]).buffer;
    const faiData = new Uint8Array([4, 5, 6]).buffer;

    await db.storeFile("genome.fna", fastaData);
    await db.storeFile("genome.fna.fai", faiData);

    const roiFeatures = [
      { chr: "chr1", start: 1000, end: 2000 },
      { chr: "chr2", start: 3000, end: 4000 },
    ];

    const config = await loader.createIGVConfig({
      fastaFile: "genome.fna",
      roiFeatures: roiFeatures,
    });

    expect(config.roi).toHaveLength(1);
    expect(config.roi[0].name).toBe("Variant Regions");
    expect(config.roi[0].features).toEqual(roiFeatures);
    expect(config.roi[0].color).toBe("rgba(94, 255, 1, 0.25)");
  });

  it("creates config with initial locus", async () => {
    const fastaData = new Uint8Array([1, 2, 3]).buffer;
    const faiData = new Uint8Array([4, 5, 6]).buffer;

    await db.storeFile("genome.fna", fastaData);
    await db.storeFile("genome.fna.fai", faiData);

    const config = await loader.createIGVConfig({
      fastaFile: "genome.fna",
      locus: "chr1:1000-2000",
    });

    expect(config.locus).toBe("chr1:1000-2000");
  });

  it("throws error when reference FASTA is missing", async () => {
    await expect(async () => {
      await loader.createIGVConfig({
        fastaFile: "missing.fna",
      });
    }).rejects.toThrow("Missing files in IndexedDB");
  });

  it("throws error when FASTA index is missing", async () => {
    const fastaData = new Uint8Array([1, 2, 3]).buffer;
    await db.storeFile("genome.fna", fastaData);

    await expect(async () => {
      await loader.createIGVConfig({
        fastaFile: "genome.fna",
      });
    }).rejects.toThrow("Missing files in IndexedDB: genome.fna.fai");
  });

  it("throws error when VCF file is missing", async () => {
    const fastaData = new Uint8Array([1, 2, 3]).buffer;
    const faiData = new Uint8Array([4, 5, 6]).buffer;

    await db.storeFile("genome.fna", fastaData);
    await db.storeFile("genome.fna.fai", faiData);

    await expect(async () => {
      await loader.createIGVConfig({
        fastaFile: "genome.fna",
        vcfFiles: ["missing.vcf"],
      });
    }).rejects.toThrow("Missing files in IndexedDB: missing.vcf");
  });

  it("throws error when BAM file is missing", async () => {
    const fastaData = new Uint8Array([1, 2, 3]).buffer;
    const faiData = new Uint8Array([4, 5, 6]).buffer;

    await db.storeFile("genome.fna", fastaData);
    await db.storeFile("genome.fna.fai", faiData);

    await expect(async () => {
      await loader.createIGVConfig({
        fastaFile: "genome.fna",
        bamFiles: ["missing.bam"],
      });
    }).rejects.toThrow("Missing files in IndexedDB");
  });

  it("creates config with mixed tracks (VCF + BAM)", async () => {
    const fastaData = new Uint8Array([1, 2, 3]).buffer;
    const faiData = new Uint8Array([4, 5, 6]).buffer;
    const vcfData = new Uint8Array([7, 8, 9]).buffer;
    const bamData = new Uint8Array([10, 11, 12]).buffer;
    const baiData = new Uint8Array([13, 14, 15]).buffer;

    await db.storeFile("genome.fna", fastaData);
    await db.storeFile("genome.fna.fai", faiData);
    await db.storeFile("variants.vcf", vcfData);
    await db.storeFile("alignments.bam", bamData);
    await db.storeFile("alignments.bam.bai", baiData);

    const config = await loader.createIGVConfig({
      fastaFile: "genome.fna",
      vcfFiles: ["variants.vcf"],
      bamFiles: ["alignments.bam"],
    });

    expect(config.tracks).toHaveLength(2);
    expect(config.tracks[0].type).toBe("variant");
    expect(config.tracks[1].type).toBe("alignment");
  });

  it("creates config with ROI from VCF files (deprecated)", async () => {
    const fastaData = new Uint8Array([1, 2, 3]).buffer;
    const faiData = new Uint8Array([4, 5, 6]).buffer;
    const vcfData = new Uint8Array([7, 8, 9]).buffer;

    await db.storeFile("genome.fna", fastaData);
    await db.storeFile("genome.fna.fai", faiData);
    await db.storeFile("roi.vcf", vcfData);

    const config = await loader.createIGVConfig({
      fastaFile: "genome.fna",
      roiFiles: ["roi.vcf"],
    });

    expect(config.roi).toHaveLength(1);
    expect(config.roi[0].name).toBe("roi.vcf (ROI)");
    expect(config.roi[0].type).toBe("annotation");
    expect(config.roi[0].format).toBe("vcf");
  });

  it("handles empty config (reference only)", async () => {
    const fastaData = new Uint8Array([1, 2, 3]).buffer;
    const faiData = new Uint8Array([4, 5, 6]).buffer;

    await db.storeFile("genome.fna", fastaData);
    await db.storeFile("genome.fna.fai", faiData);

    const config = await loader.createIGVConfig({
      fastaFile: "genome.fna",
    });

    expect(config.reference).toBeDefined();
    expect(config.tracks).toEqual([]);
    expect(config.roi).toEqual([]);
  });

  it("extracts genome ID from FASTA filename", async () => {
    const fastaData = new Uint8Array([1, 2, 3]).buffer;
    const faiData = new Uint8Array([4, 5, 6]).buffer;

    await db.storeFile("GCF_000146045.fna", fastaData);
    await db.storeFile("GCF_000146045.fna.fai", faiData);

    const config = await loader.createIGVConfig({
      fastaFile: "GCF_000146045.fna",
    });

    expect(config.reference.id).toBe("GCF_000146045");
  });

  it("handles .fa and .fasta extensions", async () => {
    const fastaData = new Uint8Array([1, 2, 3]).buffer;
    const faiData = new Uint8Array([4, 5, 6]).buffer;

    await db.storeFile("genome.fa", fastaData);
    await db.storeFile("genome.fa.fai", faiData);

    const config1 = await loader.createIGVConfig({
      fastaFile: "genome.fa",
    });

    expect(config1.reference.id).toBe("genome");

    await db.storeFile("genome.fasta", fastaData);
    await db.storeFile("genome.fasta.fai", faiData);

    const config2 = await loader.createIGVConfig({
      fastaFile: "genome.fasta",
    });

    expect(config2.reference.id).toBe("genome");
  });
});
