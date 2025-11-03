/**
 * Tests for BaseVariantHandler
 */

import { describe, it, expect, beforeEach } from "vitest";
import { BaseVariantHandler } from "../../../../src/varify/assets/js/core/variant-handlers/BaseVariantHandler.js";

describe("BaseVariantHandler", () => {
  let handler;

  beforeEach(() => {
    handler = new BaseVariantHandler();
  });

  it("throws error for unimplemented canHandle()", () => {
    expect(() => handler.canHandle({})).toThrow("must be implemented by subclass");
  });

  it("throws error for unimplemented extractPrimaryCaller()", () => {
    expect(() => handler.extractPrimaryCaller({})).toThrow("must be implemented by subclass");
  });

  it("throws error for unimplemented selectPrimarySample()", () => {
    expect(() => handler.selectPrimarySample({})).toThrow("must be implemented by subclass");
  });

  it("throws error for unimplemented extractAllCallers()", () => {
    expect(() => handler.extractAllCallers({})).toThrow("must be implemented by subclass");
  });

  it("throws error for unimplemented getStoreName()", () => {
    expect(() => handler.getStoreName()).toThrow("must be implemented by subclass");
  });

  it("returns false for supportsMultiCaller() by default", () => {
    // Override just this method to test default behavior
    handler.canHandle = () => true;
    expect(handler.supportsMultiCaller()).toBe(false);
  });
});
