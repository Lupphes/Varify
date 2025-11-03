/**
 * Tests for VariantParser
 */

import { describe, it, expect } from "vitest";
import { VariantParser } from "../../../../src/varify/assets/js/core/parsers/VariantParser.js";

describe("VariantParser - Variant Line Parsing", () => {
  it("parses complete variant line", () => {
    const line = "chr1\t1000\trs123\tA\tT\t30\tPASS\tSVTYPE=SNP;AF=0.5\tGT:GQ:DP\t0/1:20:30";
    const headers = { samples: ["Sample1"] };

    const variant = VariantParser.parseVariantLine(line, headers);

    expect(variant.chr).toBe("chr1");
    expect(variant.pos).toBe(1000);
    expect(variant.id).toBe("rs123");
    expect(variant.ref).toBe("A");
    expect(variant.alt).toBe("T");
    expect(variant.qual).toBe(30);
    expect(variant.filter).toBe("PASS");
    expect(variant.info.SVTYPE).toBe("SNP");
    expect(variant.info.AF).toBe(0.5);
  });

  it("returns null for malformed line (too few fields)", () => {
    const line = "chr1\t1000\trs123\tA\tT";
    const headers = { samples: [] };

    const variant = VariantParser.parseVariantLine(line, headers);

    expect(variant).toBeNull();
  });

  it("generates ID when missing", () => {
    const line = "chr1\t1000\t.\tA\tT\t30\tPASS\tSVTYPE=SNP";
    const headers = { samples: [] };

    const variant = VariantParser.parseVariantLine(line, headers);

    expect(variant.id).toBe("var_1000");
  });

  it("handles null QUAL", () => {
    const line = "chr1\t1000\trs123\tA\tT\t.\tPASS\tSVTYPE=SNP";
    const headers = { samples: [] };

    const variant = VariantParser.parseVariantLine(line, headers);

    expect(variant.qual).toBeNull();
  });

  it("parses genotypes when present", () => {
    const line = "chr1\t1000\trs123\tA\tT\t30\tPASS\tSVTYPE=SNP\tGT:GQ:DP\t0/1:20:30";
    const headers = { samples: ["Sample1"] };

    const variant = VariantParser.parseVariantLine(line, headers);

    expect(variant.genotypes).toBeDefined();
    expect(variant.genotypes.Sample1).toEqual({
      GT: "0/1",
      GQ: "20",
      DP: "30",
    });
  });

  it("skips genotypes when no samples", () => {
    const line = "chr1\t1000\trs123\tA\tT\t30\tPASS\tSVTYPE=SNP";
    const headers = { samples: [] };

    const variant = VariantParser.parseVariantLine(line, headers);

    expect(variant.genotypes).toBeUndefined();
  });

  it("includes computed numeric fields", () => {
    const line = "chr1\t1000\trs123\tA\tT\t30\tPASS\tSVLEN=-500\tGT:GQ:DP\t0/1:20:30";
    const headers = { samples: ["Sample1"] };

    const variant = VariantParser.parseVariantLine(line, headers);

    expect(variant._computed).toBeDefined();
    expect(variant._computed.QUAL).toBe(30);
    expect(variant._computed.GQ).toBe(20);
    expect(variant._computed.DP).toBe(30);
  });

  it("calculates locus for IGV", () => {
    const line = "chr1\t1000\trs123\tA\tT\t30\tPASS\tSVTYPE=SNP";
    const headers = { samples: [] };

    const variant = VariantParser.parseVariantLine(line, headers);

    expect(variant.locus).toBeDefined();
    expect(variant.locus).toMatch(/^chr1:\d+-\d+$/);
  });
});

describe("VariantParser - INFO Field Parsing", () => {
  it("parses simple INFO field", () => {
    const info = "SVTYPE=DEL;SVLEN=-500;END=2000";

    const result = VariantParser.parseINFO(info);

    expect(result.parsed.SVTYPE).toBe("DEL");
    expect(result.parsed.SVLEN).toBe(-500);
    expect(result.parsed.END).toBe(2000);
    expect(result.raw).toBe(info);
  });

  it("parses boolean flags", () => {
    const info = "IMPRECISE;SVTYPE=DEL";

    const result = VariantParser.parseINFO(info);

    expect(result.parsed.IMPRECISE).toBe(true);
    expect(result.parsed.SVTYPE).toBe("DEL");
  });

  it("handles empty INFO field", () => {
    const info = ".";

    const result = VariantParser.parseINFO(info);

    expect(result.parsed).toEqual({});
    expect(result.raw).toBe(".");
  });

  it("handles null/undefined INFO", () => {
    const result = VariantParser.parseINFO(null);

    expect(result.parsed).toEqual({});
    expect(result.raw).toBe(".");
  });

  it("keeps comma-separated values as strings", () => {
    const info = "CIPOS=-10,10;CIEND=-5,5";

    const result = VariantParser.parseINFO(info);

    expect(result.parsed.CIPOS).toBe("-10,10");
    expect(result.parsed.CIEND).toBe("-5,5");
  });

  it("keeps string-only fields as strings (SUPP_VEC)", () => {
    const info = "SUPP_VEC=101;SUPP=2";

    const result = VariantParser.parseINFO(info);

    expect(result.parsed.SUPP_VEC).toBe("101"); // String
    expect(result.parsed.SUPP).toBe(2);
  });

  it("keeps SUPP_CALLERS as string", () => {
    const info = "SUPP_CALLERS=delly,dysgu,manta";

    const result = VariantParser.parseINFO(info);

    expect(result.parsed.SUPP_CALLERS).toBe("delly,dysgu,manta");
  });

  it("keeps MATEID as string", () => {
    const info = "MATEID=bnd_1";

    const result = VariantParser.parseINFO(info);

    expect(result.parsed.MATEID).toBe("bnd_1");
  });

  it("parses numeric values", () => {
    const info = "AF=0.5;AC=10;AN=20";

    const result = VariantParser.parseINFO(info);

    expect(result.parsed.AF).toBe(0.5);
    expect(result.parsed.AC).toBe(10);
    expect(result.parsed.AN).toBe(20);
  });

  it("keeps non-numeric strings as strings", () => {
    const info = "SVTYPE=DEL;CHR2=chr2;CALLER=delly";

    const result = VariantParser.parseINFO(info);

    expect(result.parsed.SVTYPE).toBe("DEL");
    expect(result.parsed.CHR2).toBe("chr2");
    expect(result.parsed.CALLER).toBe("delly");
  });
});

describe("VariantParser - Locus Calculation", () => {
  it("calculates locus with END position", () => {
    const locus = VariantParser.calculateLocus("chr1", "1000", 2000);

    expect(locus).toBe("chr1:1000-2000");
  });

  it("calculates locus without END position (adds +/- 1000bp)", () => {
    const locus = VariantParser.calculateLocus("chr1", "1000", undefined);

    // Start = Math.max(1, 1000 - 1000) = 1, End = 1000 + 1000 = 2000
    expect(locus).toBe("chr1:1-2000");
  });

  it("handles position at start of chromosome", () => {
    const locus = VariantParser.calculateLocus("chr1", "100", undefined);

    // Should not go below 1
    expect(locus).toBe("chr1:1-1100");
  });

  it("handles different chromosome formats", () => {
    const locus1 = VariantParser.calculateLocus("1", "1000", 2000);
    const locus2 = VariantParser.calculateLocus("chrX", "1000", 2000);
    const locus3 = VariantParser.calculateLocus("MT", "1000", 2000);

    expect(locus1).toBe("1:1000-2000");
    expect(locus2).toBe("chrX:1000-2000");
    expect(locus3).toBe("MT:1000-2000");
  });
});

describe("VariantParser - Numeric Parsing", () => {
  it("parses valid numbers", () => {
    expect(VariantParser.parseNumeric("123")).toBe(123);
    expect(VariantParser.parseNumeric("123.45")).toBe(123.45);
    expect(VariantParser.parseNumeric("-500")).toBe(-500);
    expect(VariantParser.parseNumeric("0")).toBe(0);
  });

  it("returns null for missing values", () => {
    expect(VariantParser.parseNumeric(null)).toBeNull();
    expect(VariantParser.parseNumeric(undefined)).toBeNull();
    expect(VariantParser.parseNumeric("")).toBeNull();
    expect(VariantParser.parseNumeric(".")).toBeNull();
  });

  it("returns null for non-numeric strings", () => {
    expect(VariantParser.parseNumeric("abc")).toBeNull();
    expect(VariantParser.parseNumeric("N/A")).toBeNull();
  });

  it("handles numeric values already parsed", () => {
    expect(VariantParser.parseNumeric(123)).toBe(123);
    expect(VariantParser.parseNumeric(123.45)).toBe(123.45);
  });
});

describe("VariantParser - Numeric Array Parsing", () => {
  it("parses comma-separated numbers", () => {
    const result = VariantParser.parseNumericArray("10,20,30");

    expect(result).toEqual([10, 20, 30]);
  });

  it("skips missing values (.)", () => {
    const result = VariantParser.parseNumericArray("10,.,20,.,30");

    expect(result).toEqual([10, 20, 30]);
  });

  it("skips empty values", () => {
    const result = VariantParser.parseNumericArray("10,,20");

    expect(result).toEqual([10, 20]);
  });

  it("handles whitespace", () => {
    const result = VariantParser.parseNumericArray("10, 20, 30");

    expect(result).toEqual([10, 20, 30]);
  });

  it("returns empty array for null/undefined", () => {
    expect(VariantParser.parseNumericArray(null)).toEqual([]);
    expect(VariantParser.parseNumericArray(undefined)).toEqual([]);
  });

  it("returns empty array for non-string values", () => {
    expect(VariantParser.parseNumericArray(123)).toEqual([]);
    expect(VariantParser.parseNumericArray([])).toEqual([]);
  });

  it("skips non-numeric values", () => {
    const result = VariantParser.parseNumericArray("10,abc,20");

    expect(result).toEqual([10, 20]);
  });

  it("handles floating point numbers", () => {
    const result = VariantParser.parseNumericArray("10.5,20.3,30.7");

    expect(result).toEqual([10.5, 20.3, 30.7]);
  });
});

describe("VariantParser - Computed Numeric Fields", () => {
  it("computes numeric fields from genotype", () => {
    const variant = {
      qual: 30,
      genotypes: {
        Sample1: { GQ: "20", DP: "30", DR: "15", PR: "10" },
      },
      info: {},
    };

    const computed = VariantParser.computeNumericFields(variant);

    expect(computed.QUAL).toBe(30);
    expect(computed.GQ).toBe(20);
    expect(computed.DP).toBe(30);
    expect(computed.DR).toBe(15);
    expect(computed.PR).toBe(10);
  });

  it("computes SVLEN numeric fields", () => {
    const variant = {
      qual: null,
      genotypes: {},
      info: { SVLEN: -500 },
    };

    const computed = VariantParser.computeNumericFields(variant);

    expect(computed.SVLEN_num).toBe(-500);
    expect(computed.abs_SVLEN).toBe(500);
  });

  it("computes SR min/max from array", () => {
    const variant = {
      qual: null,
      genotypes: {
        Sample1: { SR: "10,20,30" },
      },
      info: {},
    };

    const computed = VariantParser.computeNumericFields(variant);

    expect(computed.SR_MIN).toBe(10);
    expect(computed.SR_MAX).toBe(30);
  });

  it("computes PL min/max from array", () => {
    const variant = {
      qual: null,
      genotypes: {
        Sample1: { PL: "0,10,100" },
      },
      info: {},
    };

    const computed = VariantParser.computeNumericFields(variant);

    expect(computed.PL_MIN).toBe(0);
    expect(computed.PL_MAX).toBe(100);
  });

  it("handles missing genotype fields", () => {
    const variant = {
      qual: null,
      genotypes: {},
      info: {},
    };

    const computed = VariantParser.computeNumericFields(variant);

    expect(computed.GQ).toBeNull();
    expect(computed.DP).toBeNull();
    expect(computed.DR).toBeNull();
    expect(computed.PR).toBeNull();
  });

  it("handles variant without genotypes", () => {
    const variant = {
      qual: 30,
      info: {},
    };

    const computed = VariantParser.computeNumericFields(variant);

    expect(computed.QUAL).toBe(30);
    expect(computed.GQ).toBeNull();
  });

  it("uses first sample when multiple samples", () => {
    const variant = {
      qual: null,
      genotypes: {
        Sample1: { GQ: "20", DP: "30" },
        Sample2: { GQ: "40", DP: "50" },
      },
      info: {},
    };

    const computed = VariantParser.computeNumericFields(variant);

    // Should be Sample1
    expect(computed.GQ).toBe(20);
    expect(computed.DP).toBe(30);
  });
});

describe("VariantParser - Integration Tests", () => {
  it("parses complete structural variant", () => {
    const line =
      "chr1\t1000\tdelly_DEL_27\tN\t<DEL>\t.\tPASS\tSVTYPE=DEL;SVLEN=-500;END=1500;SUPP_VEC=101;SUPP_CALLERS=delly,dysgu,manta\tGT:GQ:DP:DR:PR:SR\t0/1:20:30:15:10:5,8";
    const headers = { samples: ["Sample1"] };

    const variant = VariantParser.parseVariantLine(line, headers);

    expect(variant.chr).toBe("chr1");
    expect(variant.pos).toBe(1000);
    expect(variant.id).toBe("delly_DEL_27");
    expect(variant.info.SVTYPE).toBe("DEL");
    expect(variant.info.SVLEN).toBe(-500);
    expect(variant.info.SUPP_VEC).toBe("101"); // String
    expect(variant.locus).toBe("chr1:1000-1500");
    expect(variant._computed.SVLEN_num).toBe(-500);
    expect(variant._computed.abs_SVLEN).toBe(500);
    expect(variant._computed.GQ).toBe(20);
    expect(variant._computed.SR_MIN).toBe(5);
    expect(variant._computed.SR_MAX).toBe(8);
  });

  it("parses SNP variant", () => {
    const line = "chr1\t1000\trs123\tA\tT\t30\tPASS\tSVTYPE=SNP;AF=0.5\tGT:GQ:DP\t0/1:20:30";
    const headers = { samples: ["Sample1"] };

    const variant = VariantParser.parseVariantLine(line, headers);

    expect(variant.ref).toBe("A");
    expect(variant.alt).toBe("T");
    expect(variant.qual).toBe(30);
    expect(variant.filter).toBe("PASS");
    expect(variant.info.SVTYPE).toBe("SNP");
    expect(variant.info.AF).toBe(0.5);
    expect(variant.genotypes.Sample1.GT).toBe("0/1");
  });
});
