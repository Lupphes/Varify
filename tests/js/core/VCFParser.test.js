/**
 * Tests for VCF Parser
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  loadRealVcf,
  loadRealVcfArrayBuffer,
  createMinimalVcf,
  createVcfVariantLine,
  getRealVcfFiles,
} from "../setup.js";

import { VCFParser } from "../../../src/varify/assets/js/core/VCFParser.js";
import { HeaderParser } from "../../../src/varify/assets/js/core/parsers/HeaderParser.js";
import { VariantParser } from "../../../src/varify/assets/js/core/parsers/VariantParser.js";

describe("VCFParser - Integration Tests with Real Data", () => {
  let parser;

  beforeEach(() => {
    parser = new VCFParser();
  });

  it("parses real BCF merged VCF file", async () => {
    const vcfFiles = getRealVcfFiles();
    const vcfArrayBuffer = loadRealVcfArrayBuffer(vcfFiles.bcfMerge);

    const variants = await parser.parseVCF(vcfArrayBuffer, 100);

    expect(variants).toBeDefined();
    expect(Array.isArray(variants)).toBe(true);
    expect(variants.length).toBeGreaterThan(0);

    const firstVariant = variants[0];
    expect(firstVariant).toHaveProperty("chr");
    expect(firstVariant).toHaveProperty("pos");
    expect(firstVariant).toHaveProperty("id");
    expect(firstVariant).toHaveProperty("ref");
    expect(firstVariant).toHaveProperty("alt");
    expect(firstVariant).toHaveProperty("info");
    expect(firstVariant).toHaveProperty("locus");
  });

  it("parses real SURVIVOR merged VCF file", async () => {
    const vcfFiles = getRealVcfFiles();
    const vcfArrayBuffer = loadRealVcfArrayBuffer(vcfFiles.survivorMerge);

    const variants = await parser.parseVCF(vcfArrayBuffer, 100);

    expect(variants.length).toBeGreaterThan(0);

    const hasSuppVec = variants.some((v) => v.info.SUPP_VEC !== undefined);
    expect(hasSuppVec).toBe(true);
  });

  it("parses real Delly VCF file", async () => {
    const vcfFiles = getRealVcfFiles();
    const vcfArrayBuffer = loadRealVcfArrayBuffer(vcfFiles.delly);

    const variants = await parser.parseVCF(vcfArrayBuffer, 100);

    expect(variants.length).toBeGreaterThan(0);

    const firstVariant = variants[0];
    expect(firstVariant.info).toBeDefined();
    expect(firstVariant.info.SVTYPE).toBeDefined();
  });

  it("respects maxVariants limit on real data", async () => {
    const vcfFiles = getRealVcfFiles();
    const vcfArrayBuffer = loadRealVcfArrayBuffer(vcfFiles.bcfMerge);

    const maxVariants = 10;
    const variants = await parser.parseVCF(vcfArrayBuffer, maxVariants);

    expect(variants.length).toBeLessThanOrEqual(maxVariants);
  });

  it("stores header metadata from real VCF", async () => {
    const vcfFiles = getRealVcfFiles();
    const vcfArrayBuffer = loadRealVcfArrayBuffer(vcfFiles.bcfMerge);

    await parser.parseVCF(vcfArrayBuffer, 10);

    expect(parser.header).toBeDefined();
    expect(parser.header.meta).toBeDefined();
    expect(Array.isArray(parser.header.meta)).toBe(true);
    expect(parser.header.meta.length).toBeGreaterThan(0);

    expect(parser.header.columns).toBeDefined();
    expect(parser.header.columns).toContain("#CHROM");
  });

  it("parses genotypes from real multi-sample VCF", async () => {
    const vcfFiles = getRealVcfFiles();
    const vcfArrayBuffer = loadRealVcfArrayBuffer(vcfFiles.survivorMerge);

    const variants = await parser.parseVCF(vcfArrayBuffer, 10);

    const hasGenotypes = variants.some((v) => v.genotypes !== undefined);
    expect(hasGenotypes).toBe(true);

    if (variants[0].genotypes) {
      const sampleNames = Object.keys(variants[0].genotypes);
      expect(sampleNames.length).toBeGreaterThan(0);
    }
  });
});

describe("VCFParser - Unit Tests", () => {
  let parser;

  beforeEach(() => {
    parser = new VCFParser();
  });

  describe("constructor", () => {
    it("initializes with empty variants array", () => {
      expect(parser.variants).toEqual([]);
    });

    it("initializes with empty header", () => {
      expect(parser.header).toEqual({
        meta: [],
        columns: "",
      });
    });
  });

  describe("parseVCF", () => {
    it("parses minimal VCF with single variant", async () => {
      const vcfText = createMinimalVcf(1);
      const buffer = new TextEncoder().encode(vcfText).buffer;

      const variants = await parser.parseVCF(buffer);

      expect(variants).toHaveLength(1);
      expect(variants[0].chr).toBe("NC_001133.9");
      expect(variants[0].pos).toBe(1000);
    });

    it("parses multiple variants", async () => {
      const vcfText = createMinimalVcf(5);
      const buffer = new TextEncoder().encode(vcfText).buffer;

      const variants = await parser.parseVCF(buffer);

      expect(variants).toHaveLength(5);
      expect(variants[0].pos).toBe(1000);
      expect(variants[1].pos).toBe(2000);
      expect(variants[4].pos).toBe(5000);
    });

    it("respects maxVariants parameter", async () => {
      const vcfText = createMinimalVcf(100);
      const buffer = new TextEncoder().encode(vcfText).buffer;

      const variants = await parser.parseVCF(buffer, 10);

      expect(variants).toHaveLength(10);
    });

    it("handles empty lines in VCF", async () => {
      const vcfText = createMinimalVcf(2) + "\n\n\n";
      const buffer = new TextEncoder().encode(vcfText).buffer;

      const variants = await parser.parseVCF(buffer);

      expect(variants).toHaveLength(2);
    });

    it("stores variants in parser instance", async () => {
      const vcfText = createMinimalVcf(3);
      const buffer = new TextEncoder().encode(vcfText).buffer;

      await parser.parseVCF(buffer);

      expect(parser.variants).toHaveLength(3);
    });

    it("resets header on each parse", async () => {
      const vcfText1 = createMinimalVcf(1);
      const buffer1 = new TextEncoder().encode(vcfText1).buffer;

      await parser.parseVCF(buffer1);
      const firstHeaderLength = parser.header.meta.length;

      const vcfText2 = createMinimalVcf(1);
      const buffer2 = new TextEncoder().encode(vcfText2).buffer;

      await parser.parseVCF(buffer2);

      // Header should be reset (not accumulated)
      expect(parser.header.meta.length).toBe(firstHeaderLength);
    });
  });

  describe("parseHeaderLine", () => {
    it("parses INFO header line", () => {
      const headers = { info: {}, format: {}, samples: [] };
      const line = '##INFO=<ID=SVTYPE,Number=1,Type=String,Description="Structural variant type">';

      HeaderParser.parseHeaderLine(line, headers);

      expect(headers.info.SVTYPE).toBe(true);
    });

    it("parses FORMAT header line", () => {
      const headers = { info: {}, format: {}, samples: [] };
      const line = '##FORMAT=<ID=GT,Number=1,Type=String,Description="Genotype">';

      HeaderParser.parseHeaderLine(line, headers);

      expect(headers.format.GT).toBe(true);
    });

    it("parses multiple INFO fields", () => {
      const headers = { info: {}, format: {}, samples: [] };
      const lines = [
        '##INFO=<ID=SVTYPE,Number=1,Type=String,Description="Type">',
        '##INFO=<ID=SVLEN,Number=1,Type=Integer,Description="Length">',
        '##INFO=<ID=END,Number=1,Type=Integer,Description="End">',
      ];

      lines.forEach((line) => HeaderParser.parseHeaderLine(line, headers));

      expect(headers.info.SVTYPE).toBe(true);
      expect(headers.info.SVLEN).toBe(true);
      expect(headers.info.END).toBe(true);
    });

    it("ignores non-INFO/FORMAT header lines", () => {
      const headers = { info: {}, format: {}, samples: [] };
      const line = "##fileformat=VCFv4.2";

      HeaderParser.parseHeaderLine(line, headers);

      expect(Object.keys(headers.info)).toHaveLength(0);
      expect(Object.keys(headers.format)).toHaveLength(0);
    });
  });

  describe("parseVariantLine", () => {
    it("parses basic variant fields", () => {
      const headers = { info: {}, format: {}, samples: [] };
      const line = "NC_001133.9\t1000\tvar1\tN\t<DEL>\t100\tPASS\tSVTYPE=DEL;SVLEN=-500;END=1500";

      const variant = VariantParser.parseVariantLine(line, headers);

      expect(variant.chr).toBe("NC_001133.9");
      expect(variant.pos).toBe(1000);
      expect(variant.id).toBe("var1");
      expect(variant.ref).toBe("N");
      expect(variant.alt).toBe("<DEL>");
      expect(variant.qual).toBe(100);
      expect(variant.filter).toBe("PASS");
    });

    it("handles missing ID field", () => {
      const headers = { info: {}, format: {}, samples: [] };
      const line = "NC_001133.9\t1000\t.\tN\t<DEL>\t.\tPASS\tSVTYPE=DEL";

      const variant = VariantParser.parseVariantLine(line, headers);

      expect(variant.id).toBe("var_1000");
    });

    it("handles missing QUAL field", () => {
      const headers = { info: {}, format: {}, samples: [] };
      const line = "NC_001133.9\t1000\t.\tN\t<DEL>\t.\tPASS\tSVTYPE=DEL";

      const variant = VariantParser.parseVariantLine(line, headers);

      expect(variant.qual).toBeNull();
    });

    it("calculates locus with END field", () => {
      const headers = { info: {}, format: {}, samples: [] };
      const line = "NC_001133.9\t1000\tvar1\tN\t<DEL>\t.\tPASS\tSVTYPE=DEL;END=1500";

      const variant = VariantParser.parseVariantLine(line, headers);

      expect(variant.locus).toBe("NC_001133.9:1000-1500");
    });

    it("calculates locus without END field", () => {
      const headers = { info: {}, format: {}, samples: [] };
      const line = "NC_001133.9\t5000\tvar1\tN\t<DEL>\t.\tPASS\tSVTYPE=DEL";

      const variant = VariantParser.parseVariantLine(line, headers);

      expect(variant.locus).toBe("NC_001133.9:4000-6000");
    });

    it("handles locus at start of chromosome", () => {
      const headers = { info: {}, format: {}, samples: [] };
      const line = "NC_001133.9\t500\tvar1\tN\t<DEL>\t.\tPASS\tSVTYPE=DEL";

      const variant = VariantParser.parseVariantLine(line, headers);

      // Start should be max(1, pos - 1000)
      expect(variant.locus).toBe("NC_001133.9:1-1500");
    });

    it("returns null for invalid line", () => {
      const headers = { info: {}, format: {}, samples: [] };
      const line = "incomplete\tline";

      const variant = VariantParser.parseVariantLine(line, headers);

      expect(variant).toBeNull();
    });

    it("parses genotypes for single sample", () => {
      const headers = { info: {}, format: {}, samples: ["sample1"] };
      const line = "NC_001133.9\t1000\t.\tN\t<DEL>\t.\tPASS\tSVTYPE=DEL\tGT:DP\t0/1:30";

      const variant = VariantParser.parseVariantLine(line, headers);

      expect(variant.genotypes).toBeDefined();
      expect(variant.genotypes.sample1).toBeDefined();
      expect(variant.genotypes.sample1.GT).toBe("0/1");
      expect(variant.genotypes.sample1.DP).toBe("30");
    });

    it("parses genotypes for multiple samples", () => {
      const headers = { info: {}, format: {}, samples: ["sample1", "sample2"] };
      const line = "NC_001133.9\t1000\t.\tN\t<DEL>\t.\tPASS\tSVTYPE=DEL\tGT:DP\t0/1:30\t1/1:40";

      const variant = VariantParser.parseVariantLine(line, headers);

      expect(variant.genotypes.sample1.GT).toBe("0/1");
      expect(variant.genotypes.sample1.DP).toBe("30");
      expect(variant.genotypes.sample2.GT).toBe("1/1");
      expect(variant.genotypes.sample2.DP).toBe("40");
    });

    it("handles missing genotype values", () => {
      const headers = { info: {}, format: {}, samples: ["sample1"] };
      const line = "NC_001133.9\t1000\t.\tN\t<DEL>\t.\tPASS\tSVTYPE=DEL\tGT:DP:GQ\t0/1:30";

      const variant = VariantParser.parseVariantLine(line, headers);

      expect(variant.genotypes.sample1.GT).toBe("0/1");
      expect(variant.genotypes.sample1.DP).toBe("30");
      expect(variant.genotypes.sample1.GQ).toBe(".");
    });

    it("adds computed numeric fields", () => {
      const headers = { info: {}, format: {}, samples: [] };
      const line = "NC_001133.9\t1000\t.\tN\t<DEL>\t.\tPASS\tSVTYPE=DEL;SVLEN=-500";

      const variant = VariantParser.parseVariantLine(line, headers);

      expect(variant._computed).toBeDefined();
    });
  });

  describe("parseINFO", () => {
    it("parses simple key=value pairs", () => {
      const result = VariantParser.parseINFO("SVTYPE=DEL;SVLEN=-500;END=1500");

      expect(result.parsed.SVTYPE).toBe("DEL");
      expect(result.parsed.SVLEN).toBe(-500);
      expect(result.parsed.END).toBe(1500);
    });

    it("preserves raw INFO string", () => {
      const infoStr = "SVTYPE=DEL;SVLEN=-500;END=1500";
      const result = VariantParser.parseINFO(infoStr);

      expect(result.raw).toBe(infoStr);
    });

    it("parses numeric values as numbers", () => {
      const result = VariantParser.parseINFO("SVLEN=-500;END=1500;QUAL=99.5");

      expect(typeof result.parsed.SVLEN).toBe("number");
      expect(typeof result.parsed.END).toBe("number");
      expect(typeof result.parsed.QUAL).toBe("number");
    });

    it("keeps string values as strings", () => {
      const result = VariantParser.parseINFO("SVTYPE=DEL;CALLER=delly");

      expect(typeof result.parsed.SVTYPE).toBe("string");
      expect(typeof result.parsed.CALLER).toBe("string");
    });

    it("handles flag fields (no value)", () => {
      const result = VariantParser.parseINFO("IMPRECISE;SVTYPE=DEL;PASS");

      expect(result.parsed.IMPRECISE).toBe(true);
      expect(result.parsed.PASS).toBe(true);
    });

    it("handles comma-separated values", () => {
      const result = VariantParser.parseINFO("DR=14,0;SUPP_VEC=01100000000000");

      expect(result.parsed.DR).toBe("14,0");
      expect(result.parsed.SUPP_VEC).toBe("01100000000000");
    });

    it("handles empty INFO field", () => {
      const result = VariantParser.parseINFO(".");

      expect(result.parsed).toEqual({});
      expect(result.raw).toBe(".");
    });

    it("handles null/undefined INFO field", () => {
      const result1 = VariantParser.parseINFO(null);
      const result2 = VariantParser.parseINFO(undefined);

      expect(result1.parsed).toEqual({});
      expect(result1.raw).toBe(".");
      expect(result2.parsed).toEqual({});
      expect(result2.raw).toBe(".");
    });

    it("handles complex real-world INFO field", () => {
      const infoStr =
        "SVTYPE=DEL;SVLEN=-500;END=1500;CIPOS=-50,50;CIEND=-30,30;IMPRECISE;SUPP_VEC=01100000000000;SUPP_CALLERS=delly,dysgu;PRIMARY_CALLER=delly";
      const result = VariantParser.parseINFO(infoStr);

      expect(result.parsed.SVTYPE).toBe("DEL");
      expect(result.parsed.SVLEN).toBe(-500);
      expect(result.parsed.END).toBe(1500);
      expect(result.parsed.IMPRECISE).toBe(true);
      expect(result.parsed.SUPP_VEC).toBe("01100000000000");
      expect(result.parsed.CIPOS).toBe("-50,50");
      expect(result.parsed.CIEND).toBe("-30,30");
    });
  });

  describe("computeNumericFields", () => {
    it("extracts numeric SVLEN from INFO", () => {
      const variant = {
        info: { SVLEN: -500 },
      };

      const computed = VariantParser.computeNumericFields(variant);

      expect(computed.SVLEN_num).toBe(-500);
    });

    it("handles missing SVLEN", () => {
      const variant = {
        info: {},
      };

      const computed = VariantParser.computeNumericFields(variant);

      expect(computed.SVLEN_num).toBeUndefined();
    });

    it("computes absolute SVLEN", () => {
      const variant = {
        info: { SVLEN: -500 },
      };

      const computed = VariantParser.computeNumericFields(variant);

      expect(computed.abs_SVLEN).toBe(500);
    });
  });
});

describe("VCFParser - Edge Cases", () => {
  let parser;

  beforeEach(() => {
    parser = new VCFParser();
  });

  it("handles VCF with no variants", async () => {
    const vcfText = createMinimalVcf(0);
    const buffer = new TextEncoder().encode(vcfText).buffer;

    const variants = await parser.parseVCF(buffer);

    expect(variants).toHaveLength(0);
  });

  it("handles VCF with only header", async () => {
    const vcfText = `##fileformat=VCFv4.2
##contig=<ID=NC_001133.9>
#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO
`;
    const buffer = new TextEncoder().encode(vcfText).buffer;

    const variants = await parser.parseVCF(buffer);

    expect(variants).toHaveLength(0);
    expect(parser.header.meta.length).toBeGreaterThan(0);
  });

  it("handles malformed variant lines gracefully", async () => {
    const vcfText =
      createMinimalVcf(1) + "\nmalformed\tline\n" + createVcfVariantLine({ pos: 2000 });
    const buffer = new TextEncoder().encode(vcfText).buffer;

    const variants = await parser.parseVCF(buffer);

    expect(variants).toHaveLength(2);
  });

  it("handles very long INFO fields", () => {
    let fields = ["FIELD1=value"];
    for (let i = 0; i < 1000; i++) {
      fields.push(`X${i}=1`);
    }
    const longInfo = fields.join(";");
    const result = VariantParser.parseINFO(longInfo);

    expect(result.parsed.FIELD1).toBe("value");
    expect(Object.keys(result.parsed).length).toBe(1001);
  });

  it("handles special characters in INFO values", () => {
    const result = VariantParser.parseINFO("DESC=Has%20spaces;URL=http://example.com");

    expect(result.parsed.DESC).toBe("Has%20spaces");
    expect(result.parsed.URL).toBe("http://example.com");
  });
});
