/**
 * Tests for MetadataService
 */

import { describe, it, expect, beforeEach } from "vitest";
import { MetadataService } from "../../../src/varify/assets/js/services/MetadataService.js";

describe("MetadataService - Field Analysis", () => {
  let service;

  beforeEach(() => {
    service = new MetadataService();
  });

  it("detects numeric field", () => {
    const values = [10, 20, 30, 40, 50];

    const stats = service.analyzeField("GQ", values);

    expect(stats.type).toBe("numeric");
    expect(stats.min).toBe(10);
    expect(stats.max).toBe(50);
    expect(stats.uniqueValues.size).toBe(5);
  });

  it("detects categorical field", () => {
    const values = ["delly", "dysgu", "manta", "delly", "dysgu"];

    const stats = service.analyzeField("CALLER", values);

    expect(stats.type).toBe("categorical");
    expect(stats.uniqueValues.size).toBe(3);
  });

  it("detects boolean field", () => {
    // Boolean detection: <=2 unique values AND not numeric
    // "0" and "1" are detected as numeric, so we use non-numeric strings
    const values = ["true", "false", "true", "false", "true"];

    const stats = service.analyzeField("IMPRECISE", values);

    expect(stats.type).toBe("boolean");
    expect(stats.uniqueValues.size).toBe(2);
  });

  it("detects string field (many unique values)", () => {
    const values = Array.from({ length: 100 }, (_, i) => `value_${i}`);

    const stats = service.analyzeField("ID", values);

    expect(stats.type).toBe("string");
    expect(stats.uniqueValues.size).toBe(100);
  });

  it("handles null values", () => {
    const values = [10, null, 20, undefined, 30, "", ".", 40];

    const stats = service.analyzeField("GQ", values);

    expect(stats.type).toBe("numeric");
    expect(stats.hasNull).toBe(true);
    expect(stats.min).toBe(10);
    expect(stats.max).toBe(40);
  });

  it("handles NaN strings", () => {
    const values = [10, "NaN", 20, "nan", 30];

    const stats = service.analyzeField("QUAL", values);

    expect(stats.type).toBe("numeric");
    expect(stats.hasNull).toBe(true);
  });

  it("detects comma-separated values", () => {
    const values = ["10,20", "15,25", "20,30"];

    const stats = service.analyzeField("AD", values);

    expect(stats.hasMultiple).toBe(true);
  });

  it("calculates min/max for comma-separated numeric values", () => {
    const values = ["10,20,30", "5,15,25", "20,30,40"];

    const stats = service.analyzeField("AD", values);

    expect(stats.min).toBe(5);
    expect(stats.max).toBe(40);
    expect(stats.hasMultiple).toBe(true);
  });

  it("handles mixed numeric and non-numeric values", () => {
    const values = [10, 20, "abc", 30, "def"];

    const stats = service.analyzeField("MIXED", values);

    // Mixed values with <50 unique = categorical
    expect(stats.type).toBe("categorical");
  });

  it("handles empty array", () => {
    const values = [];

    const stats = service.analyzeField("EMPTY", values);

    // Empty array: 0 unique values, no numeric, <=2 unique -> boolean per line 86-88
    expect(stats.type).toBe("boolean");
    expect(stats.uniqueValues.size).toBe(0);
    expect(stats.hasNull).toBe(false);
  });
});

describe("MetadataService - Field Metadata Building", () => {
  let service;

  beforeEach(() => {
    service = new MetadataService();
  });

  it("builds metadata for variant collection", () => {
    const variants = [
      {
        chr: "chr1",
        pos: 1000,
        id: "rs1",
        ref: "A",
        alt: "T",
        qual: 30,
        filter: "PASS",
        info: { SVTYPE: "SNP", AF: 0.5 },
        genotypes: { Sample1: { GQ: "20", DP: "30" } },
      },
      {
        chr: "chr1",
        pos: 2000,
        id: "rs2",
        ref: "G",
        alt: "C",
        qual: 40,
        filter: "PASS",
        info: { SVTYPE: "SNP", AF: 0.3 },
        genotypes: { Sample1: { GQ: "25", DP: "35" } },
      },
    ];

    const metadata = service.buildFieldMetadata(variants);

    expect(metadata.CHROM).toBeDefined();
    expect(metadata.POS).toBeDefined();
    expect(metadata.QUAL).toBeDefined();
    expect(metadata.SVTYPE).toBeDefined();
    expect(metadata.AF).toBeDefined();
  });

  it("returns empty object for empty variant array", () => {
    const metadata = service.buildFieldMetadata([]);

    expect(metadata).toEqual({});
  });

  it("returns empty object for null variants", () => {
    const metadata = service.buildFieldMetadata(null);

    expect(metadata).toEqual({});
  });

  it("analyzes standard VCF columns", () => {
    const variants = [
      {
        chr: "chr1",
        pos: 1000,
        id: "rs1",
        ref: "A",
        alt: "T",
        qual: 30,
        filter: "PASS",
        info: {},
      },
    ];

    const metadata = service.buildFieldMetadata(variants);

    // Single variant: CHROM has 1 unique value (<=2) -> boolean
    expect(metadata.CHROM.type).toBe("boolean");
    expect(metadata.POS.type).toBe("numeric");
    expect(metadata.QUAL.type).toBe("numeric");
    // Single variant: FILTER has 1 unique value (<=2) -> boolean
    expect(metadata.FILTER.type).toBe("boolean");
  });

  it("analyzes INFO fields", () => {
    const variants = [
      {
        chr: "chr1",
        pos: 1000,
        id: ".",
        ref: "N",
        alt: "<DEL>",
        qual: null,
        filter: "PASS",
        info: { SVTYPE: "DEL", SVLEN: -500, END: 1500 },
      },
      {
        chr: "chr1",
        pos: 2000,
        id: ".",
        ref: "N",
        alt: "<DEL>",
        qual: null,
        filter: "PASS",
        info: { SVTYPE: "DEL", SVLEN: -1000, END: 3000 },
      },
    ];

    const metadata = service.buildFieldMetadata(variants);

    // SVTYPE: 1 unique value ("DEL") -> boolean (<=2 unique)
    expect(metadata.SVTYPE.type).toBe("boolean");
    expect(metadata.SVLEN.type).toBe("numeric");
    expect(metadata.SVLEN.min).toBe(-1000);
    expect(metadata.SVLEN.max).toBe(-500);
    expect(metadata.END.type).toBe("numeric");
  });

  it("collects all unique INFO keys", () => {
    const variants = [
      { chr: "chr1", pos: 1000, info: { SVTYPE: "DEL", SVLEN: -500 } },
      { chr: "chr1", pos: 2000, info: { SVTYPE: "INS", END: 2500 } },
    ];

    const metadata = service.buildFieldMetadata(variants);

    expect(metadata.SVTYPE).toBeDefined();
    expect(metadata.SVLEN).toBeDefined();
    expect(metadata.END).toBeDefined();
  });
});

describe("MetadataService - Helper Methods", () => {
  let service;

  beforeEach(() => {
    service = new MetadataService();
  });

  it("getFieldType returns correct type", () => {
    const metadata = { type: "numeric", min: 0, max: 100 };

    expect(service.getFieldType(metadata)).toBe("numeric");
  });

  it("getFieldType returns string for null metadata", () => {
    expect(service.getFieldType(null)).toBe("string");
  });

  it("isNumericField returns true for numeric fields", () => {
    const metadata = { type: "numeric", min: 0, max: 100 };

    expect(service.isNumericField(metadata)).toBe(true);
  });

  it("isNumericField returns false for non-numeric fields", () => {
    const metadata = { type: "categorical" };

    expect(service.isNumericField(metadata)).toBe(false);
  });

  it("isCategoricalField returns true for categorical fields", () => {
    const metadata = { type: "categorical", uniqueValues: new Set(["A", "B"]) };

    expect(service.isCategoricalField(metadata)).toBe(true);
  });

  it("isBooleanField returns true for boolean fields", () => {
    const metadata = { type: "boolean", uniqueValues: new Set(["0", "1"]) };

    expect(service.isBooleanField(metadata)).toBe(true);
  });

  it("getUniqueValues returns array of unique values", () => {
    const metadata = {
      type: "categorical",
      uniqueValues: new Set(["delly", "dysgu", "manta"]),
    };

    const values = service.getUniqueValues(metadata);

    expect(values).toEqual(["delly", "dysgu", "manta"]);
  });

  it("getUniqueValues returns empty array for null metadata", () => {
    const values = service.getUniqueValues(null);

    expect(values).toEqual([]);
  });

  it("getNumericRange returns min/max for numeric fields", () => {
    const metadata = { type: "numeric", min: 10, max: 100 };

    const range = service.getNumericRange(metadata);

    expect(range).toEqual({ min: 10, max: 100 });
  });

  it("getNumericRange returns null for non-numeric fields", () => {
    const metadata = { type: "categorical" };

    const range = service.getNumericRange(metadata);

    expect(range).toBeNull();
  });
});

describe("MetadataService - buildFieldMetadata", () => {
  it("buildFieldMetadata instance method works", () => {
    const service = new MetadataService();
    const variants = [
      {
        chr: "chr1",
        pos: 1000,
        id: "rs1",
        ref: "A",
        alt: "T",
        qual: 30,
        filter: "PASS",
        info: { SVTYPE: "SNP" },
      },
    ];

    const metadata = service.buildFieldMetadata(variants);

    expect(metadata.CHROM).toBeDefined();
    expect(metadata.POS).toBeDefined();
    expect(metadata.SVTYPE).toBeDefined();
  });
});

describe("MetadataService - Edge Cases", () => {
  let service;

  beforeEach(() => {
    service = new MetadataService();
  });

  it("handles all null values", () => {
    const values = [null, null, null];

    const stats = service.analyzeField("FIELD", values);

    expect(stats.hasNull).toBe(true);
    expect(stats.uniqueValues.size).toBe(0);
  });

  it("handles single value", () => {
    const values = [42];

    const stats = service.analyzeField("FIELD", values);

    expect(stats.type).toBe("numeric");
    expect(stats.min).toBe(42);
    expect(stats.max).toBe(42);
  });

  it("handles negative numbers", () => {
    const values = [-100, -50, 0, 50, 100];

    const stats = service.analyzeField("SVLEN", values);

    expect(stats.type).toBe("numeric");
    expect(stats.min).toBe(-100);
    expect(stats.max).toBe(100);
  });

  it("handles floating point numbers", () => {
    const values = [0.1, 0.5, 0.9];

    const stats = service.analyzeField("AF", values);

    expect(stats.type).toBe("numeric");
    expect(stats.min).toBeCloseTo(0.1);
    expect(stats.max).toBeCloseTo(0.9);
  });

  it("detects categorical with exactly 50 unique values", () => {
    const values = Array.from({ length: 50 }, (_, i) => `value_${i}`);

    const stats = service.analyzeField("FIELD", values);

    expect(stats.type).toBe("categorical");
    expect(stats.uniqueValues.size).toBe(50);
  });

  it("detects string with 51 unique values", () => {
    const values = Array.from({ length: 51 }, (_, i) => `value_${i}`);

    const stats = service.analyzeField("FIELD", values);

    expect(stats.type).toBe("string");
    expect(stats.uniqueValues.size).toBe(51);
  });
});
