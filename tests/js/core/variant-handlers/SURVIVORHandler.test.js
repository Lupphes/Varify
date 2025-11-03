/**
 * Tests for SURVIVORHandler
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SURVIVORHandler } from "../../../../src/varify/assets/js/core/variant-handlers/SURVIVORHandler.js";

describe("SURVIVORHandler", () => {
  let handler;

  beforeEach(() => {
    handler = new SURVIVORHandler();
  });

  describe("canHandle()", () => {
    it("returns true for variant with SUPP_VEC", () => {
      const variant = {
        info: {
          SUPP_VEC: "101",
          SVTYPE: "DEL",
        },
      };
      expect(handler.canHandle(variant)).toBe(true);
    });

    it("returns false for variant without SUPP_VEC", () => {
      const variant = {
        info: {
          EUK_CALLER: "delly",
          SVTYPE: "DEL",
        },
      };
      expect(handler.canHandle(variant)).toBe(false);
    });
  });

  describe("extractPrimaryCaller()", () => {
    it('extracts from variant ID pattern "<caller>_<type>_<number>"', () => {
      const variant = {
        id: "delly_DEL_27",
        info: { SUPP_VEC: "101" },
      };
      expect(handler.extractPrimaryCaller(variant)).toBe("delly");
    });

    it("handles different caller names in ID", () => {
      const testCases = [
        { id: "dysgu_INS_42", expected: "dysgu" },
        { id: "manta_DUP_13", expected: "manta" },
        { id: "gridss_INV_99", expected: "gridss" },
        { id: "lumpy_BND_5", expected: "lumpy" },
      ];

      for (const { id, expected } of testCases) {
        const variant = { id, info: { SUPP_VEC: "1" } };
        expect(handler.extractPrimaryCaller(variant)).toBe(expected);
      }
    });

    it("falls back to PRIMARY_CALLER field if ID does not match pattern", () => {
      const variant = {
        id: "NoUnderscores",
        info: {
          SUPP_VEC: "1",
          PRIMARY_CALLER: "delly",
        },
      };
      expect(handler.extractPrimaryCaller(variant)).toBe("delly");
    });

    it('returns "unknown" when no ID or PRIMARY_CALLER', () => {
      const variant = {
        info: { SUPP_VEC: "1" },
      };
      expect(handler.extractPrimaryCaller(variant)).toBe("unknown");
    });

    it("trims and lowercases caller from ID", () => {
      const variant = {
        id: "DELLY_DEL_27",
        info: { SUPP_VEC: "1" },
      };
      expect(handler.extractPrimaryCaller(variant)).toBe("delly");
    });
  });

  describe("selectPrimarySample()", () => {
    it('returns genotype at first "1" position in SUPP_VEC', () => {
      const variant = {
        info: { SUPP_VEC: "010" },
        genotypes: [
          { GQ: 5, caller: "delly" },
          { GQ: 40, caller: "dysgu" },
          { GQ: 15, caller: "manta" },
        ],
      };
      const sample = handler.selectPrimarySample(variant);
      expect(sample).toEqual({ GQ: 40, caller: "dysgu" });
    });

    it("returns first genotype when SUPP_VEC has multiple 1s", () => {
      const variant = {
        info: { SUPP_VEC: "101" },
        genotypes: [{ GQ: 10 }, { GQ: 20 }, { GQ: 30 }],
      };
      const sample = handler.selectPrimarySample(variant);
      expect(sample).toEqual({ GQ: 10 });
    });

    it("falls back to first genotype when no SUPP_VEC", () => {
      const variant = {
        info: {},
        genotypes: [{ GQ: 10 }, { GQ: 20 }],
      };
      const sample = handler.selectPrimarySample(variant);
      expect(sample).toEqual({ GQ: 10 });
    });

    it("falls back to first genotype when SUPP_VEC has no 1s", () => {
      const variant = {
        info: { SUPP_VEC: "000" },
        genotypes: [{ GQ: 10 }, { GQ: 20 }],
      };
      const sample = handler.selectPrimarySample(variant);
      expect(sample).toEqual({ GQ: 10 });
    });

    it("returns null when no genotypes", () => {
      const variant = {
        info: { SUPP_VEC: "101" },
        genotypes: [],
      };
      expect(handler.selectPrimarySample(variant)).toBeNull();
    });
  });

  describe("extractAllCallers()", () => {
    it("extracts caller data for all active samples", () => {
      const variant = {
        info: {
          SUPP_VEC: "101",
          SUPP_CALLERS: "delly, dysgu, manta",
        },
        genotypes: [
          { GQ: 10, DR: 5, SR: 3 },
          { GQ: 20, DR: 8, SR: 4 },
          { GQ: 30, DR: 12, SR: 6 },
        ],
      };

      const allCallers = handler.extractAllCallers(variant);

      expect(allCallers).toHaveLength(2);
      expect(allCallers[0]).toEqual({ caller: "delly", GQ: 10, DR: 5, SR: 3 });
      expect(allCallers[1]).toEqual({ caller: "dysgu", GQ: 30, DR: 12, SR: 6 });
    });

    it("handles comma-separated SUPP_CALLERS", () => {
      const variant = {
        info: {
          SUPP_VEC: "11",
          SUPP_CALLERS: "delly,dysgu",
        },
        genotypes: [{ GQ: 10 }, { GQ: 20 }],
      };

      const allCallers = handler.extractAllCallers(variant);

      expect(allCallers).toHaveLength(2);
      expect(allCallers[0].caller).toBe("delly");
      expect(allCallers[1].caller).toBe("dysgu");
    });

    it("uses variant ID as fallback when SUPP_CALLERS missing", () => {
      const variant = {
        id: "delly_DEL_27",
        info: { SUPP_VEC: "10" },
        genotypes: [{ GQ: 10 }, { GQ: 20 }],
      };

      const allCallers = handler.extractAllCallers(variant);

      expect(allCallers).toHaveLength(1);
      expect(allCallers[0].caller).toBe("delly");
    });

    it("returns entries with empty genotype data when no genotypes", () => {
      const variant = {
        info: { SUPP_VEC: "101" },
        genotypes: [],
      };
      const allCallers = handler.extractAllCallers(variant);
      expect(allCallers).toHaveLength(2);
      expect(allCallers[0]).toEqual({ caller: "sample_0" });
      expect(allCallers[1]).toEqual({ caller: "sample_2" });
    });

    it("returns empty array when no SUPP_VEC", () => {
      const variant = {
        genotypes: [{ GQ: 10 }],
      };
      expect(handler.extractAllCallers(variant)).toEqual([]);
    });
  });

  describe("getStoreName()", () => {
    it('returns "survivor_variants"', () => {
      expect(handler.getStoreName()).toBe("survivor_variants");
    });
  });

  describe("supportsMultiCaller()", () => {
    it("returns true", () => {
      expect(handler.supportsMultiCaller()).toBe(true);
    });
  });
});
