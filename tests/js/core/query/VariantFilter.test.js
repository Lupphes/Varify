/**
 * Tests for VariantFilter
 */

import { describe, it, expect } from "vitest";
import { VariantFilter } from "../../../../src/varify/assets/js/core/query/VariantFilter.js";

describe("VariantFilter - Index Selection", () => {
  it("selects CHROM index when available", () => {
    const filters = { CHROM: "chr1" };

    const result = VariantFilter.selectBestIndex(filters);

    expect(result).toBe("CHROM");
  });

  it("selects CHROM_POS compound index when both filters present", () => {
    const filters = { CHROM: "chr1", POS: 1000 };

    const result = VariantFilter.selectBestIndex(filters);

    expect(result).toBe("CHROM_POS");
  });

  it("selects SVTYPE index when available", () => {
    const filters = { SVTYPE: "DEL" };

    const result = VariantFilter.selectBestIndex(filters);

    expect(result).toBe("SVTYPE");
  });

  it("selects PRIMARY_CALLER index when available", () => {
    const filters = { PRIMARY_CALLER: "delly" };

    const result = VariantFilter.selectBestIndex(filters);

    expect(result).toBe("PRIMARY_CALLER");
  });

  it("selects GQ index when available", () => {
    const filters = { GQ: 20 };

    const result = VariantFilter.selectBestIndex(filters);

    expect(result).toBe("GQ");
  });

  it("returns null when filters are empty", () => {
    const filters = {};

    const result = VariantFilter.selectBestIndex(filters);

    expect(result).toBeNull();
  });

  it("skips categorical filters (object with values array)", () => {
    const filters = { SVTYPE: { values: ["DEL", "DUP"] } };

    const result = VariantFilter.selectBestIndex(filters);

    expect(result).toBeNull();
  });

  it("prefers compound index over single-field index", () => {
    const filters = { CHROM: "chr1", POS: 1000, SVTYPE: "DEL" };

    const result = VariantFilter.selectBestIndex(filters);

    expect(result).toBe("CHROM_POS"); // Compound index prioritized
  });
});

describe("VariantFilter - KeyRange Building", () => {
  it("creates compound range for CHROM_POS index", () => {
    const filters = { CHROM: "chr1", POS: 1000 };

    const range = VariantFilter.buildKeyRange(filters, "CHROM_POS");

    expect(range.lower).toEqual(["chr1", 0]);
    expect(range.upper).toEqual(["chr1", Number.MAX_SAFE_INTEGER]);
  });

  it("creates exact match range for string value", () => {
    const filters = { CHROM: "chr1" };

    const range = VariantFilter.buildKeyRange(filters, "CHROM");

    expect(range.lower).toBe("chr1");
    expect(range.upper).toBe("chr1");
    expect(range.lowerOpen).toBe(false);
    expect(range.upperOpen).toBe(false);
  });

  it("creates range with min and max for numeric filter", () => {
    const filters = { GQ: { min: 20, max: 30 } };

    const range = VariantFilter.buildKeyRange(filters, "GQ");

    expect(range.lower).toBe(20);
    expect(range.upper).toBe(30);
    expect(range.lowerOpen).toBe(false);
    expect(range.upperOpen).toBe(false);
  });

  it("creates lower bound range (min only)", () => {
    const filters = { GQ: { min: 20 } };

    const range = VariantFilter.buildKeyRange(filters, "GQ");

    expect(range.lower).toBe(20);
    expect(range.upper).toBeUndefined();
    expect(range.lowerOpen).toBe(false);
  });

  it("creates upper bound range (max only)", () => {
    const filters = { GQ: { max: 30 } };

    const range = VariantFilter.buildKeyRange(filters, "GQ");

    expect(range.lower).toBeUndefined();
    expect(range.upper).toBe(30);
    expect(range.upperOpen).toBe(false);
  });

  it("creates exact match range for numeric value", () => {
    const filters = { GQ: 20 };

    const range = VariantFilter.buildKeyRange(filters, "GQ");

    expect(range.lower).toBe(20);
    expect(range.upper).toBe(20);
  });

  it("returns null for categorical filter (can't use KeyRange)", () => {
    const filters = { SVTYPE: { values: ["DEL", "DUP"] } };

    const range = VariantFilter.buildKeyRange(filters, "SVTYPE");

    expect(range).toBeNull();
  });
});

describe("VariantFilter - Standard Filtering", () => {
  it("matches variant with exact filter", () => {
    const variant = { CHROM: "chr1", POS: 1000, SVTYPE: "DEL" };
    const filters = { CHROM: "chr1" };

    const result = VariantFilter.matchesFilters(variant, filters);

    expect(result).toBe(true);
  });

  it("rejects variant that doesn't match exact filter", () => {
    const variant = { CHROM: "chr1", POS: 1000, SVTYPE: "DEL" };
    const filters = { CHROM: "chr2" };

    const result = VariantFilter.matchesFilters(variant, filters);

    expect(result).toBe(false);
  });

  it("matches variant with multiple filters (AND logic)", () => {
    const variant = { CHROM: "chr1", POS: 1000, SVTYPE: "DEL" };
    const filters = { CHROM: "chr1", SVTYPE: "DEL" };

    const result = VariantFilter.matchesFilters(variant, filters);

    expect(result).toBe(true);
  });

  it("rejects variant when one filter doesn't match", () => {
    const variant = { CHROM: "chr1", POS: 1000, SVTYPE: "DEL" };
    const filters = { CHROM: "chr1", SVTYPE: "DUP" };

    const result = VariantFilter.matchesFilters(variant, filters);

    expect(result).toBe(false);
  });

  it("matches variant with numeric range filter", () => {
    const variant = { CHROM: "chr1", GQ: 25 };
    const filters = { GQ: { min: 20, max: 30 } };

    const result = VariantFilter.matchesFilters(variant, filters);

    expect(result).toBe(true);
  });

  it("rejects variant outside numeric range (below min)", () => {
    const variant = { CHROM: "chr1", GQ: 15 };
    const filters = { GQ: { min: 20, max: 30 } };

    const result = VariantFilter.matchesFilters(variant, filters);

    expect(result).toBe(false);
  });

  it("rejects variant outside numeric range (above max)", () => {
    const variant = { CHROM: "chr1", GQ: 35 };
    const filters = { GQ: { min: 20, max: 30 } };

    const result = VariantFilter.matchesFilters(variant, filters);

    expect(result).toBe(false);
  });

  it("matches variant with min-only range", () => {
    const variant = { CHROM: "chr1", GQ: 25 };
    const filters = { GQ: { min: 20 } };

    const result = VariantFilter.matchesFilters(variant, filters);

    expect(result).toBe(true);
  });

  it("matches variant with max-only range", () => {
    const variant = { CHROM: "chr1", GQ: 25 };
    const filters = { GQ: { max: 30 } };

    const result = VariantFilter.matchesFilters(variant, filters);

    expect(result).toBe(true);
  });

  it("rejects variant with missing numeric value", () => {
    const variant = { CHROM: "chr1", GQ: null };
    const filters = { GQ: { min: 20 } };

    const result = VariantFilter.matchesFilters(variant, filters);

    expect(result).toBe(false);
  });

  it("rejects variant with dot value in numeric filter", () => {
    const variant = { CHROM: "chr1", GQ: "." };
    const filters = { GQ: { min: 20 } };

    const result = VariantFilter.matchesFilters(variant, filters);

    expect(result).toBe(false);
  });

  it("matches variant with categorical filter (OR logic)", () => {
    const variant = { CHROM: "chr1", SVTYPE: "DEL" };
    const filters = { SVTYPE: { values: ["DEL", "DUP", "INV"] } };

    const result = VariantFilter.matchesFilters(variant, filters);

    expect(result).toBe(true);
  });

  it("rejects variant not in categorical values", () => {
    const variant = { CHROM: "chr1", SVTYPE: "INS" };
    const filters = { SVTYPE: { values: ["DEL", "DUP", "INV"] } };

    const result = VariantFilter.matchesFilters(variant, filters);

    expect(result).toBe(false);
  });

  it("matches variant with string contains filter (case insensitive)", () => {
    const variant = { CHROM: "chr1", CALLER: "delly" };
    const filters = { CALLER: "del" };

    const result = VariantFilter.matchesFilters(variant, filters);

    expect(result).toBe(true);
  });

  it("matches variant with string contains filter (different case)", () => {
    const variant = { CHROM: "chr1", CALLER: "Delly" };
    const filters = { CALLER: "DEL" };

    const result = VariantFilter.matchesFilters(variant, filters);

    expect(result).toBe(true);
  });

  it("rejects variant that doesn't contain string", () => {
    const variant = { CHROM: "chr1", CALLER: "manta" };
    const filters = { CALLER: "del" };

    const result = VariantFilter.matchesFilters(variant, filters);

    expect(result).toBe(false);
  });

  it("matches variant with no filters", () => {
    const variant = { CHROM: "chr1", POS: 1000 };
    const filters = {};

    const result = VariantFilter.matchesFilters(variant, filters);

    expect(result).toBe(true);
  });
});

describe("VariantFilter - Multi-Caller Filtering", () => {
  it("matches variant when any caller matches FORMAT field filter", () => {
    const variant = {
      CHROM: "chr1",
      GQ: ".", // Missing in primary
      _allCallers: [
        { caller: "delly", GQ: 15 },
        { caller: "dysgu", GQ: 25 },
        { caller: "manta", GQ: 18 },
      ],
    };
    const filters = { GQ: { min: 20 } };

    const result = VariantFilter.matchesFilters(variant, filters, true);

    expect(result).toBe(true); // dysgu has GQ=25
  });

  it("rejects variant when no caller matches FORMAT field filter", () => {
    const variant = {
      CHROM: "chr1",
      GQ: ".",
      _allCallers: [
        { caller: "delly", GQ: 15 },
        { caller: "dysgu", GQ: 18 },
        { caller: "manta", GQ: 12 },
      ],
    };
    const filters = { GQ: { min: 20 } };

    const result = VariantFilter.matchesFilters(variant, filters, true);

    expect(result).toBe(false); // No caller has GQ >= 20
  });

  it("matches variant when any caller matches SVTYPE filter (maps to TY)", () => {
    const variant = {
      CHROM: "chr1",
      SVTYPE: "DEL",
      _allCallers: [
        { caller: "delly", TY: "DEL" },
        { caller: "dysgu", TY: "DEL" },
        { caller: "manta", TY: "DEL" },
      ],
    };
    const filters = { SVTYPE: { values: ["DEL", "DUP"] } };

    const result = VariantFilter.matchesFilters(variant, filters, true);

    expect(result).toBe(true);
  });

  it("rejects variant when no caller matches SVTYPE filter", () => {
    const variant = {
      CHROM: "chr1",
      SVTYPE: "INS",
      _allCallers: [
        { caller: "delly", TY: "INS" },
        { caller: "dysgu", TY: "INS" },
      ],
    };
    const filters = { SVTYPE: { values: ["DEL", "DUP"] } };

    const result = VariantFilter.matchesFilters(variant, filters, true);

    expect(result).toBe(false);
  });

  it("uses standard filtering for INFO fields in multi-caller mode", () => {
    const variant = {
      CHROM: "chr1",
      NUM_CALLERS: 3,
      _allCallers: [{ caller: "delly" }, { caller: "dysgu" }, { caller: "manta" }],
    };
    const filters = { NUM_CALLERS: { min: 2 } };

    const result = VariantFilter.matchesFilters(variant, filters, true);

    expect(result).toBe(true);
  });

  it("handles multi-caller with categorical filter", () => {
    const variant = {
      CHROM: "chr1",
      _allCallers: [
        { caller: "delly", GT: "0/1" },
        { caller: "dysgu", GT: "1/1" },
        { caller: "manta", GT: "0/0" },
      ],
    };
    const filters = { GT: { values: ["0/1", "1/1"] } };

    const result = VariantFilter.matchesFilters(variant, filters, true);

    expect(result).toBe(true); // delly and dysgu match
  });

  it("skips callers with missing values", () => {
    const variant = {
      CHROM: "chr1",
      _allCallers: [
        { caller: "delly", GQ: "." },
        { caller: "dysgu", GQ: null },
        { caller: "manta", GQ: 25 },
      ],
    };
    const filters = { GQ: { min: 20 } };

    const result = VariantFilter.matchesFilters(variant, filters, true);

    expect(result).toBe(true); // manta has GQ=25
  });

  it("handles string contains in multi-caller mode", () => {
    const variant = {
      CHROM: "chr1",
      _allCallers: [
        { caller: "delly", CALLER: "delly_v0.9" },
        { caller: "dysgu", CALLER: "dysgu_v1.2" },
        { caller: "manta", CALLER: "manta_v1.6" },
      ],
    };
    const filters = { CALLER: "dysgu" };

    const result = VariantFilter.matchesFilters(variant, filters, true);

    expect(result).toBe(true);
  });
});

describe("VariantFilter - Multi-Caller Helper", () => {
  it("returns true when any caller matches exact value", () => {
    const allCallers = [
      { caller: "delly", GT: "0/1" },
      { caller: "dysgu", GT: "1/1" },
      { caller: "manta", GT: "0/0" },
    ];

    const result = VariantFilter.checkMultiCallerFilter(allCallers, "GT", "1/1");

    expect(result).toBe(true);
  });

  it("returns false when no caller matches exact value", () => {
    const allCallers = [
      { caller: "delly", GT: "0/1" },
      { caller: "dysgu", GT: "0/1" },
      { caller: "manta", GT: "0/0" },
    ];

    const result = VariantFilter.checkMultiCallerFilter(allCallers, "GT", "1/1");

    expect(result).toBe(false);
  });

  it("returns true when any caller matches numeric range", () => {
    const allCallers = [
      { caller: "delly", GQ: 15 },
      { caller: "dysgu", GQ: 25 },
      { caller: "manta", GQ: 18 },
    ];

    const result = VariantFilter.checkMultiCallerFilter(allCallers, "GQ", { min: 20, max: 30 });

    expect(result).toBe(true); // dysgu matches
  });

  it("returns false when no caller matches numeric range", () => {
    const allCallers = [
      { caller: "delly", GQ: 15 },
      { caller: "dysgu", GQ: 18 },
      { caller: "manta", GQ: 12 },
    ];

    const result = VariantFilter.checkMultiCallerFilter(allCallers, "GQ", { min: 20 });

    expect(result).toBe(false);
  });

  it("returns true when any caller matches categorical filter", () => {
    const allCallers = [
      { caller: "delly", TY: "DEL" },
      { caller: "dysgu", TY: "DUP" },
      { caller: "manta", TY: "INV" },
    ];

    const result = VariantFilter.checkMultiCallerFilter(allCallers, "TY", {
      values: ["DUP", "INS"],
    });

    expect(result).toBe(true); // dysgu matches
  });

  it("returns true when any caller matches string contains", () => {
    const allCallers = [
      { caller: "delly", CALLER: "delly_v0.9" },
      { caller: "dysgu", CALLER: "dysgu_v1.2" },
      { caller: "manta", CALLER: "manta_v1.6" },
    ];

    const result = VariantFilter.checkMultiCallerFilter(allCallers, "CALLER", "dysgu");

    expect(result).toBe(true);
  });

  it("skips callers with missing values", () => {
    const allCallers = [
      { caller: "delly", GQ: "." },
      { caller: "dysgu", GQ: null },
      { caller: "manta", GQ: undefined },
    ];

    const result = VariantFilter.checkMultiCallerFilter(allCallers, "GQ", { min: 20 });

    expect(result).toBe(false);
  });

  it("handles NaN values gracefully", () => {
    const allCallers = [
      { caller: "delly", GQ: "abc" },
      { caller: "dysgu", GQ: "xyz" },
    ];

    const result = VariantFilter.checkMultiCallerFilter(allCallers, "GQ", { min: 20 });

    expect(result).toBe(false);
  });
});

describe("VariantFilter - Edge Cases", () => {
  it("handles variant with null values", () => {
    const variant = { CHROM: null, POS: null };
    const filters = { CHROM: "chr1" };

    const result = VariantFilter.matchesFilters(variant, filters);

    expect(result).toBe(false);
  });

  it("handles variant with undefined values", () => {
    const variant = { CHROM: undefined, POS: 1000 };
    const filters = { CHROM: "chr1" };

    const result = VariantFilter.matchesFilters(variant, filters);

    expect(result).toBe(false);
  });

  it("handles empty allCallers array in multi-caller mode", () => {
    const variant = {
      CHROM: "chr1",
      GQ: 25,
      _allCallers: [],
    };
    const filters = { GQ: { min: 20 } };

    const result = VariantFilter.matchesFilters(variant, filters, true);

    expect(result).toBe(true);
  });

  it("handles variant without allCallers in multi-caller mode", () => {
    const variant = {
      CHROM: "chr1",
      GQ: 25,
    };
    const filters = { GQ: { min: 20 } };

    const result = VariantFilter.matchesFilters(variant, filters, true);

    expect(result).toBe(true);
  });

  it("handles numeric string values in range filters", () => {
    const variant = { CHROM: "chr1", GQ: "25" };
    const filters = { GQ: { min: 20, max: 30 } };

    const result = VariantFilter.matchesFilters(variant, filters);

    expect(result).toBe(true);
  });

  it("handles negative numbers in range filters", () => {
    const variant = { CHROM: "chr1", SVLEN: -500 };
    const filters = { SVLEN: { min: -1000, max: -100 } };

    const result = VariantFilter.matchesFilters(variant, filters);

    expect(result).toBe(true);
  });

  it("handles zero in range filters", () => {
    const variant = { CHROM: "chr1", VALUE: 0 };
    const filters = { VALUE: { min: 0, max: 10 } };

    const result = VariantFilter.matchesFilters(variant, filters);

    expect(result).toBe(true);
  });
});
