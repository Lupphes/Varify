/**
 * Tests for GenotypeParser
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { GenotypeParser } from "../../../../src/varify/assets/js/core/parsers/GenotypeParser.js";

// Mock console.warn
global.console.warn = vi.fn();

describe("GenotypeParser - Genotype Parsing", () => {
  beforeEach(() => {
    global.console.warn.mockClear();
  });

  it("parses genotypes for single sample", () => {
    const fields = [
      "chr1",
      "1000",
      ".",
      "A",
      "T",
      "30",
      "PASS",
      "SVTYPE=SNP",
      "GT:GQ:DP",
      "0/1:20:30",
    ];
    const samples = ["Sample1"];

    const genotypes = GenotypeParser.parseGenotypes(fields, samples);

    expect(genotypes).toEqual({
      Sample1: {
        GT: "0/1",
        GQ: "20",
        DP: "30",
      },
    });
  });

  it("parses genotypes for multiple samples", () => {
    const fields = [
      "chr1",
      "1000",
      ".",
      "A",
      "T",
      "30",
      "PASS",
      "SVTYPE=SNP",
      "GT:GQ:DP",
      "0/1:20:30", // Sample1
      "1/1:40:50", // Sample2
      "0/0:60:70", // Sample3
    ];
    const samples = ["Sample1", "Sample2", "Sample3"];

    const genotypes = GenotypeParser.parseGenotypes(fields, samples);

    expect(genotypes).toEqual({
      Sample1: { GT: "0/1", GQ: "20", DP: "30" },
      Sample2: { GT: "1/1", GQ: "40", DP: "50" },
      Sample3: { GT: "0/0", GQ: "60", DP: "70" },
    });
  });

  it("handles missing genotype values", () => {
    const fields = [
      "chr1",
      "1000",
      ".",
      "A",
      "T",
      "30",
      "PASS",
      "SVTYPE=SNP",
      "GT:GQ:DP",
      "0/1:.:.", // Missing GQ and DP
    ];
    const samples = ["Sample1"];

    const genotypes = GenotypeParser.parseGenotypes(fields, samples);

    expect(genotypes).toEqual({
      Sample1: {
        GT: "0/1",
        GQ: ".",
        DP: ".",
      },
    });
  });

  it("handles partial genotype values", () => {
    const fields = [
      "chr1",
      "1000",
      ".",
      "A",
      "T",
      "30",
      "PASS",
      "SVTYPE=SNP",
      "GT:GQ:DP:AD",
      "0/1:20", // Missing DP and AD
    ];
    const samples = ["Sample1"];

    const genotypes = GenotypeParser.parseGenotypes(fields, samples);

    expect(genotypes.Sample1.GT).toBe("0/1");
    expect(genotypes.Sample1.GQ).toBe("20");
    expect(genotypes.Sample1.DP).toBe(".");
    expect(genotypes.Sample1.AD).toBe(".");
  });

  it("returns null when no samples", () => {
    const fields = ["chr1", "1000", ".", "A", "T", "30", "PASS", "SVTYPE=SNP"];
    const samples = [];

    const genotypes = GenotypeParser.parseGenotypes(fields, samples);

    expect(genotypes).toBeNull();
  });

  it("returns null when fields too short", () => {
    const fields = ["chr1", "1000", ".", "A", "T", "30", "PASS", "SVTYPE=SNP"];
    const samples = ["Sample1"];

    const genotypes = GenotypeParser.parseGenotypes(fields, samples);

    expect(genotypes).toBeNull();
  });

  it("handles URL-encoded genotype values", () => {
    const fields = [
      "chr1",
      "1000",
      ".",
      "A",
      "T",
      "30",
      "PASS",
      "SVTYPE=SNP",
      "GT:SVTYPE",
      "0/1:DEL%2CDEL", // URL-encoded comma
    ];
    const samples = ["Sample1"];

    const genotypes = GenotypeParser.parseGenotypes(fields, samples);

    expect(genotypes).toEqual({
      Sample1: {
        GT: "0/1",
        SVTYPE: "DEL,DEL", // Decoded
      },
    });
  });

  it("handles complex URL-encoded values", () => {
    const fields = [
      "chr1",
      "1000",
      ".",
      "A",
      "T",
      "30",
      "PASS",
      "SVTYPE=SNP",
      "GT:AD",
      "0/1:10%2C20", // URL-encoded "10,20"
    ];
    const samples = ["Sample1"];

    const genotypes = GenotypeParser.parseGenotypes(fields, samples);

    expect(genotypes.Sample1.AD).toBe("10,20");
  });

  it("handles failed URL decoding gracefully", () => {
    const fields = [
      "chr1",
      "1000",
      ".",
      "A",
      "T",
      "30",
      "PASS",
      "SVTYPE=SNP",
      "GT:CUSTOM",
      "0/1:%ZZ", // Invalid URL encoding
    ];
    const samples = ["Sample1"];

    const genotypes = GenotypeParser.parseGenotypes(fields, samples);

    // Should keep original value and warn
    expect(genotypes.Sample1.CUSTOM).toBe("%ZZ");
    expect(console.warn).toHaveBeenCalled();
  });
});

describe("GenotypeParser - FORMAT Field Parsing", () => {
  it("parses simple FORMAT field", () => {
    const formatStr = "GT:GQ:DP";

    const format = GenotypeParser.parseFORMAT(formatStr);

    expect(format).toEqual(["GT", "GQ", "DP"]);
  });

  it("parses FORMAT with many fields", () => {
    const formatStr = "GT:GQ:DP:AD:PL:AF";

    const format = GenotypeParser.parseFORMAT(formatStr);

    expect(format).toEqual(["GT", "GQ", "DP", "AD", "PL", "AF"]);
  });

  it("parses FORMAT with single field", () => {
    const formatStr = "GT";

    const format = GenotypeParser.parseFORMAT(formatStr);

    expect(format).toEqual(["GT"]);
  });

  it("handles empty FORMAT string", () => {
    const formatStr = "";

    const format = GenotypeParser.parseFORMAT(formatStr);

    expect(format).toEqual([""]);
  });
});

describe("GenotypeParser - Sample Genotype Parsing", () => {
  beforeEach(() => {
    global.console.warn.mockClear();
  });

  it("parses sample genotype", () => {
    const sampleStr = "0/1:20:30";
    const format = ["GT", "GQ", "DP"];

    const genotype = GenotypeParser.parseSampleGenotype(sampleStr, format);

    expect(genotype).toEqual({
      GT: "0/1",
      GQ: "20",
      DP: "30",
    });
  });

  it("handles missing values", () => {
    const sampleStr = "0/1:.:.";
    const format = ["GT", "GQ", "DP"];

    const genotype = GenotypeParser.parseSampleGenotype(sampleStr, format);

    expect(genotype).toEqual({
      GT: "0/1",
      GQ: ".",
      DP: ".",
    });
  });

  it("handles partial values", () => {
    const sampleStr = "0/1:20";
    const format = ["GT", "GQ", "DP", "AD"];

    const genotype = GenotypeParser.parseSampleGenotype(sampleStr, format);

    expect(genotype.GT).toBe("0/1");
    expect(genotype.GQ).toBe("20");
    expect(genotype.DP).toBe(".");
    expect(genotype.AD).toBe(".");
  });

  it("handles URL-encoded values", () => {
    const sampleStr = "0/1:DEL%2CDEL";
    const format = ["GT", "SVTYPE"];

    const genotype = GenotypeParser.parseSampleGenotype(sampleStr, format);

    expect(genotype).toEqual({
      GT: "0/1",
      SVTYPE: "DEL,DEL",
    });
  });

  it("handles multiple URL-encoded fields", () => {
    const sampleStr = "0/1:10%2C20:DEL%2CDUP";
    const format = ["GT", "AD", "SVTYPE"];

    const genotype = GenotypeParser.parseSampleGenotype(sampleStr, format);

    expect(genotype).toEqual({
      GT: "0/1",
      AD: "10,20",
      SVTYPE: "DEL,DUP",
    });
  });

  it("handles failed URL decoding", () => {
    const sampleStr = "0/1:%ZZ";
    const format = ["GT", "CUSTOM"];

    const genotype = GenotypeParser.parseSampleGenotype(sampleStr, format);

    expect(genotype.CUSTOM).toBe("%ZZ");
    expect(console.warn).toHaveBeenCalled();
  });

  it("handles homozygous reference", () => {
    const sampleStr = "0/0:60:70";
    const format = ["GT", "GQ", "DP"];

    const genotype = GenotypeParser.parseSampleGenotype(sampleStr, format);

    expect(genotype.GT).toBe("0/0");
  });

  it("handles homozygous alternate", () => {
    const sampleStr = "1/1:40:50";
    const format = ["GT", "GQ", "DP"];

    const genotype = GenotypeParser.parseSampleGenotype(sampleStr, format);

    expect(genotype.GT).toBe("1/1");
  });

  it("handles phased genotypes", () => {
    const sampleStr = "0|1:20:30";
    const format = ["GT", "GQ", "DP"];

    const genotype = GenotypeParser.parseSampleGenotype(sampleStr, format);

    expect(genotype.GT).toBe("0|1");
  });

  it("handles no-call genotypes", () => {
    const sampleStr = "./.:.:.";
    const format = ["GT", "GQ", "DP"];

    const genotype = GenotypeParser.parseSampleGenotype(sampleStr, format);

    expect(genotype.GT).toBe("./.");
  });
});

describe("GenotypeParser - Integration Tests", () => {
  it("parses complete variant with genotypes", () => {
    const fields = [
      "chr1",
      "1000",
      "rs123",
      "A",
      "T",
      "30",
      "PASS",
      "SVTYPE=SNP;AF=0.5",
      "GT:GQ:DP:AD",
      "0/1:20:30:10,20",
      "1/1:40:50:0,50",
      "0/0:60:70:70,0",
    ];
    const samples = ["Sample1", "Sample2", "Sample3"];

    const genotypes = GenotypeParser.parseGenotypes(fields, samples);

    expect(genotypes.Sample1).toEqual({
      GT: "0/1",
      GQ: "20",
      DP: "30",
      AD: "10,20",
    });
    expect(genotypes.Sample2).toEqual({
      GT: "1/1",
      GQ: "40",
      DP: "50",
      AD: "0,50",
    });
    expect(genotypes.Sample3).toEqual({
      GT: "0/0",
      GQ: "60",
      DP: "70",
      AD: "70,0",
    });
  });

  it("handles real-world SV genotypes", () => {
    const fields = [
      "chr1",
      "1000",
      ".",
      "N",
      "<DEL>",
      ".",
      "PASS",
      "SVTYPE=DEL;SVLEN=-500;END=1500",
      "GT:SVTYPE:CIPOS",
      "0/1:DEL%2CDEL:0%2C100",
    ];
    const samples = ["Sample1"];

    const genotypes = GenotypeParser.parseGenotypes(fields, samples);

    expect(genotypes.Sample1).toEqual({
      GT: "0/1",
      SVTYPE: "DEL,DEL",
      CIPOS: "0,100",
    });
  });

  it("handles variants without genotypes", () => {
    const fields = ["chr1", "1000", ".", "A", "T", "30", "PASS", "SVTYPE=SNP"];
    const samples = [];

    const genotypes = GenotypeParser.parseGenotypes(fields, samples);

    expect(genotypes).toBeNull();
  });

  it("handles mixed quality genotypes", () => {
    const fields = [
      "chr1",
      "1000",
      ".",
      "A",
      "T",
      "30",
      "PASS",
      "SVTYPE=SNP",
      "GT:GQ:DP",
      "0/1:.:.", // Low quality
      "1/1:40:50", // High quality
      "./.:.:.", // No call
    ];
    const samples = ["Sample1", "Sample2", "Sample3"];

    const genotypes = GenotypeParser.parseGenotypes(fields, samples);

    expect(genotypes.Sample1.GT).toBe("0/1");
    expect(genotypes.Sample2.GT).toBe("1/1");
    expect(genotypes.Sample3.GT).toBe("./.");
  });
});
