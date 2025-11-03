/**
 * VariantHandlerRegistry - Central registry for variant type handlers
 *
 * Implements a singleton registry pattern to dynamically select the appropriate
 * handler for a given variant. This eliminates the need for scattered type-checking
 * conditionals throughout the codebase.
 *
 * Usage:
 *   const handler = variantHandlerRegistry.getHandler(variant);
 *   const caller = handler.extractPrimaryCaller(variant);
 *   const sample = handler.selectPrimarySample(variant);
 */

import { BCFHandler } from "./BCFHandler.js";
import { SURVIVORHandler } from "./SURVIVORHandler.js";

export class VariantHandlerRegistry {
  constructor() {
    /**
     * Ordered list of registered handlers
     * @type {Array<BaseVariantHandler>}
     */
    this.handlers = [];
  }

  /**
   * Register a variant handler
   *
   * Handlers are checked in registration order, so register most specific
   * handlers first (e.g., SURVIVOR before BCF, since BCF is catch-all)
   *
   * @param {BaseVariantHandler} handler - Handler instance to register
   */
  register(handler) {
    if (!handler || typeof handler.canHandle !== "function") {
      throw new Error("Invalid handler: must have canHandle() method");
    }

    this.handlers.push(handler);
    console.log(`[VariantHandlerRegistry] Registered handler: ${handler.constructor.name}`);
  }

  /**
   * Get the appropriate handler for a variant
   *
   * Iterates through registered handlers in order and returns the first
   * one whose canHandle() method returns true.
   *
   * @param {Object} variant - Parsed VCF variant object
   * @returns {BaseVariantHandler} The handler for this variant type
   * @throws {Error} If no handler can handle the variant
   */
  getHandler(variant) {
    if (!variant) {
      throw new Error("Cannot get handler for null/undefined variant");
    }

    for (const handler of this.handlers) {
      if (handler.canHandle(variant)) {
        return handler;
      }
    }

    throw new Error(
      `No handler found for variant. ` +
        `ID: ${variant.id || "unknown"}, ` +
        `INFO fields: ${Object.keys(variant.info || {}).join(", ")}`
    );
  }

  /**
   * Get handler by store name
   *
   * Useful when you know the store name but don't have the variant object
   *
   * @param {string} storeName - Store name ('bcf_variants' or 'survivor_variants')
   * @returns {BaseVariantHandler|null} Handler for this store, or null if not found
   */
  getHandlerByStore(storeName) {
    for (const handler of this.handlers) {
      if (handler.getStoreName() === storeName) {
        return handler;
      }
    }
    return null;
  }

  /**
   * Get all registered handlers
   * @returns {Array<BaseVariantHandler>} Array of all handlers
   */
  getAllHandlers() {
    return [...this.handlers];
  }

  /**
   * Clear all registered handlers (useful for testing)
   */
  clear() {
    this.handlers = [];
  }

  /**
   * Get handler statistics for debugging
   * @returns {Object} Handler registration info
   */
  getInfo() {
    return {
      handlerCount: this.handlers.length,
      handlers: this.handlers.map((h) => ({
        name: h.constructor.name,
        type: h.getTypeName(),
        store: h.getStoreName(),
        supportsMultiCaller: h.supportsMultiCaller(),
      })),
    };
  }
}

/**
 * Singleton instance with pre-registered handlers
 *
 * IMPORTANT: Registration order matters!
 * - SURVIVOR must be checked first (has SUPP_VEC field)
 * - BCF is checked second (catch-all for variants without SUPP_VEC)
 */
export const variantHandlerRegistry = new VariantHandlerRegistry();

variantHandlerRegistry.register(new SURVIVORHandler());
variantHandlerRegistry.register(new BCFHandler()); // Default/catch-all

console.log("[VariantHandlerRegistry] Initialization complete:");
console.log(JSON.stringify(variantHandlerRegistry.getInfo(), null, 2));
