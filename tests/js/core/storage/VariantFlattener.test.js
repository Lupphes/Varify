/**
 * Tests for VariantFlattener
 */

import { describe, it, expect, beforeEach } from "vitest";
import { VariantFlattener } from "../../../../src/varify/assets/js/core/storage/VariantFlattener.js";
import { variantHandlerRegistry } from "../../../../src/varify/assets/js/core/variant-handlers/VariantHandlerRegistry.js";
import { BCFHandler } from "../../../../src/varify/assets/js/core/variant-handlers/BCFHandler.js";
import { SURVIVORHandler } from "../../../../src/varify/assets/js/core/variant-handlers/SURVIVORHandler.js";

describe("VariantFlattener - Basic Flattening", () => {
  beforeEach(() => {
    variantHandlerRegistry.clear();
    variantHandlerRegistry.register(new SURVIVORHandler());
    variantHandlerRegistry.register(new BCFHandler());
  });

  it("flattens basic VCF fields", () => {
    const variant = {
      chr: "chr1",
      pos: 1000,
      id: "rs123",
      ref: "A",
      alt: "T",
      qual: 30,
      filter: "PASS",
      info: {},
      _computed: {},
      locus: "chr1:0-2000",
    };

    const flattened = VariantFlattener.flattenVariantForStorage(variant);

    expect(flattened.CHROM).toBe("chr1");
    expect(flattened.POS).toBe(1000);
    expect(flattened.ID).toBe("rs123");
    expect(flattened.REF).toBe("A");
    expect(flattened.ALT).toBe("T");
    expect(flattened.QUAL).toBe(30);
    expect(flattened.FILTER).toBe("PASS");
    expect(flattened.locus).toBe("chr1:0-2000");
  });

  it("preserves original variant", () => {
    const variant = {
      chr: "chr1",
      pos: 1000,
      id: ".",
      ref: "A",
      alt: "T",
      qual: null,
      filter: "PASS",
      info: {},
      _computed: {},
    };

    const flattened = VariantFlattener.flattenVariantForStorage(variant);

    expect(flattened._variant).toBe(variant);
  });

  it("flattens INFO fields to top level", () => {
    const variant = {
      chr: "chr1",
      pos: 1000,
      id: ".",
      ref: "N",
      alt: "<DEL>",
      qual: null,
      filter: "PASS",
      info: {
        SVTYPE: "DEL",
        SVLEN: -500,
        END: 1500,
      },
      _computed: {},
    };

    const flattened = VariantFlattener.flattenVariantForStorage(variant);

    expect(flattened.SVTYPE).toBe("DEL");
    expect(flattened.SVLEN).toBe(-500);
    expect(flattened.END).toBe(1500);
  });

  it("flattens computed fields to top level", () => {
    const variant = {
      chr: "chr1",
      pos: 1000,
      id: ".",
      ref: "N",
      alt: "<DEL>",
      qual: null,
      filter: "PASS",
      info: {},
      _computed: {
        GQ: 20,
        DP: 30,
        SVLEN_num: -500,
        abs_SVLEN: 500,
      },
    };

    const flattened = VariantFlattener.flattenVariantForStorage(variant);

    expect(flattened.GQ).toBe(20);
    expect(flattened.DP).toBe(30);
    expect(flattened.SVLEN_num).toBe(-500);
    expect(flattened.abs_SVLEN).toBe(500);
  });

  it("forces SUPP_VEC to string", () => {
    const variant = {
      chr: "chr1",
      pos: 1000,
      id: ".",
      ref: "N",
      alt: "<DEL>",
      qual: null,
      filter: "PASS",
      info: {
        SUPP_VEC: 101,
      },
      _computed: {},
    };

    const flattened = VariantFlattener.flattenVariantForStorage(variant);

    expect(flattened.SUPP_VEC).toBe("101");
    expect(typeof flattened.SUPP_VEC).toBe("string");
  });
});

describe("VariantFlattener - BCF Variant Flattening", () => {
  beforeEach(() => {
    variantHandlerRegistry.clear();
    variantHandlerRegistry.register(new SURVIVORHandler());
    variantHandlerRegistry.register(new BCFHandler());
  });

  it("flattens BCF variant with genotypes", () => {
    const variant = {
      chr: "chr1",
      pos: 1000,
      id: ".",
      ref: "N",
      alt: "<DEL>",
      qual: null,
      filter: "PASS",
      info: { EUK_CALLER: "delly" },
      genotypes: {
        Sample1: { GT: "0/1", GQ: "20", DP: "30", DR: "15" },
      },
      _computed: {},
    };

    const flattened = VariantFlattener.flattenVariantForStorage(variant);

    expect(flattened.GT).toBe("0/1");
    expect(flattened.GQ).toBe(20);
    expect(flattened.DP).toBe(30);
    expect(flattened.DR).toBe(15);
  });

  it("uses first genotype for BCF variants", () => {
    const variant = {
      chr: "chr1",
      pos: 1000,
      id: ".",
      ref: "A",
      alt: "T",
      qual: null,
      filter: "PASS",
      info: {},
      genotypes: {
        Sample1: { GQ: "20", DP: "30" },
        Sample2: { GQ: "40", DP: "50" },
      },
      _computed: {},
    };

    const flattened = VariantFlattener.flattenVariantForStorage(variant);

    expect(flattened.GQ).toBe(20);
    expect(flattened.DP).toBe(30);
  });

  it("converts numeric strings to numbers", () => {
    const variant = {
      chr: "chr1",
      pos: 1000,
      id: ".",
      ref: "A",
      alt: "T",
      qual: null,
      filter: "PASS",
      info: {},
      genotypes: {
        Sample1: { GQ: "20", AF: "0.5" },
      },
      _computed: {},
    };

    const flattened = VariantFlattener.flattenVariantForStorage(variant);

    expect(flattened.GQ).toBe(20);
    expect(flattened.AF).toBe(0.5);
  });

  it("keeps non-numeric strings as strings", () => {
    const variant = {
      chr: "chr1",
      pos: 1000,
      id: ".",
      ref: "A",
      alt: "T",
      qual: null,
      filter: "PASS",
      info: {},
      genotypes: {
        Sample1: { GT: "0/1", CALLER: "delly" },
      },
      _computed: {},
    };

    const flattened = VariantFlattener.flattenVariantForStorage(variant);

    expect(flattened.GT).toBe("0/1");
    expect(flattened.CALLER).toBe("delly");
  });

  it("handles missing values (dot)", () => {
    const variant = {
      chr: "chr1",
      pos: 1000,
      id: ".",
      ref: "A",
      alt: "T",
      qual: null,
      filter: "PASS",
      info: {},
      genotypes: {
        Sample1: { GQ: ".", DP: "30" },
      },
      _computed: {},
    };

    const flattened = VariantFlattener.flattenVariantForStorage(variant);

    expect(flattened.GQ).toBe(".");
    expect(flattened.DP).toBe(30);
  });

  it("handles comma-separated values (uses first)", () => {
    const variant = {
      chr: "chr1",
      pos: 1000,
      id: ".",
      ref: "A",
      alt: "T",
      qual: null,
      filter: "PASS",
      info: {},
      genotypes: {
        Sample1: { AD: "10,20,30", SR: "5,8" },
      },
      _computed: {},
    };

    const flattened = VariantFlattener.flattenVariantForStorage(variant);

    expect(flattened.AD).toBe(10);
    expect(flattened.SR).toBe(5);
  });

  it("skips ID field from genotype (preserves VCF column ID)", () => {
    const variant = {
      chr: "chr1",
      pos: 1000,
      id: "rs123",
      ref: "A",
      alt: "T",
      qual: null,
      filter: "PASS",
      info: {},
      genotypes: {
        Sample1: { ID: "genotype_id", GQ: "20" },
      },
      _computed: {},
    };

    const flattened = VariantFlattener.flattenVariantForStorage(variant);

    expect(flattened.ID).toBe("rs123");
    expect(flattened.GQ).toBe(20);
  });
});

describe("VariantFlattener - SURVIVOR Variant Flattening", () => {
  beforeEach(() => {
    variantHandlerRegistry.clear();
    variantHandlerRegistry.register(new SURVIVORHandler());
    variantHandlerRegistry.register(new BCFHandler());
  });

  it("flattens SURVIVOR variant with primary caller", () => {
    const variant = {
      chr: "chr1",
      pos: 1000,
      id: "delly_DEL_27",
      ref: "N",
      alt: "<DEL>",
      qual: null,
      filter: "PASS",
      info: {
        SUPP_VEC: "101",
        SUPP_CALLERS: "delly, dysgu, manta",
      },
      genotypes: {
        Sample1: { GQ: "20", DP: "30" },
        Sample2: { GQ: "25", DP: "35" },
        Sample3: { GQ: "30", DP: "40" },
      },
      _computed: {},
    };

    const flattened = VariantFlattener.flattenVariantForStorage(variant);

    // index 0, SUPP_VEC='101'
    expect(flattened.GQ).toBe(20);
    expect(flattened.DP).toBe(30);
  });

  it("stores all callers data for SURVIVOR variants", () => {
    const variant = {
      chr: "chr1",
      pos: 1000,
      id: "delly_DEL_27",
      ref: "N",
      alt: "<DEL>",
      qual: null,
      filter: "PASS",
      info: {
        SUPP_VEC: "11",
        SUPP_CALLERS: "delly,dysgu",
      },
      genotypes: {
        Sample1: { GQ: "20", DP: "30" },
        Sample2: { GQ: "25", DP: "35" },
      },
      _computed: {},
    };

    const flattened = VariantFlattener.flattenVariantForStorage(variant);

    expect(flattened._allCallers).toBeDefined();
    expect(flattened._allCallers).toHaveLength(2);
    expect(flattened._allCallers[0].caller).toBe("delly");
    expect(flattened._allCallers[1].caller).toBe("dysgu");
  });

  it("stores primary caller metadata", () => {
    const variant = {
      chr: "chr1",
      pos: 1000,
      id: "delly_DEL_27",
      ref: "N",
      alt: "<DEL>",
      qual: null,
      filter: "PASS",
      info: {
        SUPP_VEC: "10",
        SUPP_CALLERS: "delly,dysgu",
      },
      genotypes: {
        Sample1: { GQ: "20" },
        Sample2: { GQ: "25" },
      },
      _computed: {},
    };

    const flattened = VariantFlattener.flattenVariantForStorage(variant);

    expect(flattened._primaryCallerName).toBe("delly");
    expect(flattened._primaryCallerIndex).toBe(0);
  });

  it("does not store _allCallers for BCF variants", () => {
    const variant = {
      chr: "chr1",
      pos: 1000,
      id: ".",
      ref: "A",
      alt: "T",
      qual: null,
      filter: "PASS",
      info: { EUK_CALLER: "delly" },
      genotypes: {
        Sample1: { GQ: "20" },
      },
      _computed: {},
    };

    const flattened = VariantFlattener.flattenVariantForStorage(variant);

    expect(flattened._allCallers).toBeUndefined();
    expect(flattened._primaryCallerName).toBeUndefined();
  });
});

describe("VariantFlattener - Edge Cases", () => {
  beforeEach(() => {
    variantHandlerRegistry.clear();
    variantHandlerRegistry.register(new SURVIVORHandler());
    variantHandlerRegistry.register(new BCFHandler());
  });

  it("handles variant without genotypes", () => {
    const variant = {
      chr: "chr1",
      pos: 1000,
      id: ".",
      ref: "A",
      alt: "T",
      qual: 30,
      filter: "PASS",
      info: {},
      _computed: {},
    };

    const flattened = VariantFlattener.flattenVariantForStorage(variant);

    expect(flattened.CHROM).toBe("chr1");
    expect(flattened.POS).toBe(1000);
    expect(flattened.GQ).toBeUndefined();
  });

  it("handles empty genotypes object", () => {
    const variant = {
      chr: "chr1",
      pos: 1000,
      id: ".",
      ref: "A",
      alt: "T",
      qual: null,
      filter: "PASS",
      info: {},
      genotypes: {},
      _computed: {},
    };

    const flattened = VariantFlattener.flattenVariantForStorage(variant);

    expect(flattened.CHROM).toBe("chr1");
  });

  it("handles empty INFO object", () => {
    const variant = {
      chr: "chr1",
      pos: 1000,
      id: ".",
      ref: "A",
      alt: "T",
      qual: null,
      filter: "PASS",
      info: {},
      _computed: {},
    };

    const flattened = VariantFlattener.flattenVariantForStorage(variant);

    expect(flattened.CHROM).toBe("chr1");
    expect(flattened.SVTYPE).toBeUndefined();
  });

  it("handles empty _computed object", () => {
    const variant = {
      chr: "chr1",
      pos: 1000,
      id: ".",
      ref: "A",
      alt: "T",
      qual: null,
      filter: "PASS",
      info: {},
      _computed: {},
    };

    const flattened = VariantFlattener.flattenVariantForStorage(variant);

    expect(flattened.CHROM).toBe("chr1");
  });
});
