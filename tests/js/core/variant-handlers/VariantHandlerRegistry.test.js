/**
 * Tests for VariantHandlerRegistry
 */

import { describe, it, expect, beforeEach } from "vitest";
import { VariantHandlerRegistry } from "../../../../src/varify/assets/js/core/variant-handlers/VariantHandlerRegistry.js";
import { BCFHandler } from "../../../../src/varify/assets/js/core/variant-handlers/BCFHandler.js";
import { SURVIVORHandler } from "../../../../src/varify/assets/js/core/variant-handlers/SURVIVORHandler.js";

describe("VariantHandlerRegistry", () => {
  let registry;

  beforeEach(() => {
    registry = new VariantHandlerRegistry();
  });

  describe("register()", () => {
    it("registers a handler", () => {
      const handler = new BCFHandler();
      registry.register(handler);
      expect(registry.getAllHandlers()).toHaveLength(1);
    });

    it("throws error for invalid handler (no canHandle method)", () => {
      const invalid = {};
      expect(() => registry.register(invalid)).toThrow("Invalid handler");
    });
  });

  describe("getHandler()", () => {
    beforeEach(() => {
      registry.register(new SURVIVORHandler());
      registry.register(new BCFHandler());
    });

    it("returns SURVIVORHandler for SURVIVOR variant", () => {
      const variant = {
        info: { SUPP_VEC: "101" },
      };
      const handler = registry.getHandler(variant);
      expect(handler).toBeInstanceOf(SURVIVORHandler);
    });

    it("returns BCFHandler for BCF variant", () => {
      const variant = {
        info: { EUK_CALLER: "delly" },
      };
      const handler = registry.getHandler(variant);
      expect(handler).toBeInstanceOf(BCFHandler);
    });

    it("uses first matching handler (registration order matters)", () => {
      const variant = {
        info: { SUPP_VEC: "101" },
      };
      // SURVIVOR registered first, should match first
      const handler = registry.getHandler(variant);
      expect(handler).toBeInstanceOf(SURVIVORHandler);
    });

    it("throws error for null variant", () => {
      expect(() => registry.getHandler(null)).toThrow("null/undefined");
    });

    it("throws error when no handler matches", () => {
      registry.clear(); // Remove all handlers
      const variant = { info: {} };
      expect(() => registry.getHandler(variant)).toThrow("No handler found");
    });
  });

  describe("getHandlerByStore()", () => {
    beforeEach(() => {
      registry.register(new SURVIVORHandler());
      registry.register(new BCFHandler());
    });

    it('returns handler for "bcf_variants" store', () => {
      const handler = registry.getHandlerByStore("bcf_variants");
      expect(handler).toBeInstanceOf(BCFHandler);
    });

    it('returns handler for "survivor_variants" store', () => {
      const handler = registry.getHandlerByStore("survivor_variants");
      expect(handler).toBeInstanceOf(SURVIVORHandler);
    });

    it("returns null for unknown store", () => {
      const handler = registry.getHandlerByStore("unknown_store");
      expect(handler).toBeNull();
    });
  });

  describe("getAllHandlers()", () => {
    it("returns empty array when no handlers registered", () => {
      expect(registry.getAllHandlers()).toEqual([]);
    });

    it("returns all registered handlers", () => {
      registry.register(new SURVIVORHandler());
      registry.register(new BCFHandler());
      expect(registry.getAllHandlers()).toHaveLength(2);
    });
  });

  describe("clear()", () => {
    it("removes all handlers", () => {
      registry.register(new SURVIVORHandler());
      registry.register(new BCFHandler());
      registry.clear();
      expect(registry.getAllHandlers()).toHaveLength(0);
    });
  });

  describe("getInfo()", () => {
    it("returns handler registration info", () => {
      registry.register(new SURVIVORHandler());
      registry.register(new BCFHandler());

      const info = registry.getInfo();

      expect(info.handlerCount).toBe(2);
      expect(info.handlers[0].name).toBe("SURVIVORHandler");
      expect(info.handlers[1].name).toBe("BCFHandler");
      expect(info.handlers[0].supportsMultiCaller).toBe(true);
      expect(info.handlers[1].supportsMultiCaller).toBe(false);
    });
  });
});
