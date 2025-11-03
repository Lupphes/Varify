/**
 * Tests for BCFHandler
 */

import { describe, it, expect, beforeEach } from "vitest";
import { BCFHandler } from "../../../../src/varify/assets/js/core/variant-handlers/BCFHandler.js";

describe("BCFHandler", () => {
  let handler;

  beforeEach(() => {
    handler = new BCFHandler();
  });

  describe("canHandle()", () => {
    it("returns true for variant without SUPP_VEC", () => {
      const variant = {
        info: {
          EUK_CALLER: "delly",
          SVTYPE: "DEL",
        },
      };
      expect(handler.canHandle(variant)).toBe(true);
    });

    it("returns false for variant with SUPP_VEC (SURVIVOR)", () => {
      const variant = {
        info: {
          SUPP_VEC: "101",
          SVTYPE: "DEL",
        },
      };
      expect(handler.canHandle(variant)).toBe(false);
    });

    it("returns true for variant with empty info", () => {
      const variant = { info: {} };
      expect(handler.canHandle(variant)).toBe(true);
    });
  });

  describe("extractPrimaryCaller()", () => {
    it("extracts from EUK_CALLER field", () => {
      const variant = {
        info: { EUK_CALLER: "delly" },
      };
      expect(handler.extractPrimaryCaller(variant)).toBe("delly");
    });

    it("extracts from CALLER field (legacy)", () => {
      const variant = {
        info: { CALLER: "dysgu" },
      };
      expect(handler.extractPrimaryCaller(variant)).toBe("dysgu");
    });

    it("prefers EUK_CALLER over CALLER", () => {
      const variant = {
        info: {
          EUK_CALLER: "delly",
          CALLER: "dysgu",
        },
      };
      expect(handler.extractPrimaryCaller(variant)).toBe("delly");
    });

    it('returns "unknown" when no caller field present', () => {
      const variant = { info: {} };
      expect(handler.extractPrimaryCaller(variant)).toBe("unknown");
    });

    it("trims whitespace from caller name", () => {
      const variant = {
        info: { EUK_CALLER: "  manta  " },
      };
      expect(handler.extractPrimaryCaller(variant)).toBe("manta");
    });
  });

  describe("selectPrimarySample()", () => {
    it("returns first genotype", () => {
      const variant = {
        genotypes: [
          { GQ: 10, DR: 5 },
          { GQ: 20, DR: 8 },
        ],
      };
      const sample = handler.selectPrimarySample(variant);
      expect(sample).toEqual({ GQ: 10, DR: 5 });
    });

    it("returns null when no genotypes", () => {
      const variant = { genotypes: [] };
      expect(handler.selectPrimarySample(variant)).toBeNull();
    });

    it("returns null when genotypes is undefined", () => {
      const variant = {};
      expect(handler.selectPrimarySample(variant)).toBeNull();
    });
  });

  describe("extractAllCallers()", () => {
    it("returns null (BCF does not support multi-caller)", () => {
      const variant = {
        genotypes: [{ GQ: 10 }],
      };
      expect(handler.extractAllCallers(variant)).toBeNull();
    });
  });

  describe("getStoreName()", () => {
    it('returns "bcf_variants"', () => {
      expect(handler.getStoreName()).toBe("bcf_variants");
    });
  });

  describe("supportsMultiCaller()", () => {
    it("returns false", () => {
      expect(handler.supportsMultiCaller()).toBe(false);
    });
  });
});
