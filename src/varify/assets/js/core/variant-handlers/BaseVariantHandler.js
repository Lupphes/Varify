/**
 * BaseVariantHandler - Abstract base class for variant type handlers
 *
 */

export class BaseVariantHandler {
  /**
   * Detect if this handler can process the given variant
   * @param {Object} variant - Parsed VCF variant object
   * @returns {boolean} True if this handler applies to this variant type
   * @abstract
   */
  canHandle(variant) {
    throw new Error("BaseVariantHandler.canHandle() must be implemented by subclass");
  }

  /**
   * Extract the primary caller name from variant metadata
   *
   * For BCF: Uses EUK_CALLER or CALLER INFO field
   * For SURVIVOR: Extracts from variant ID (e.g., "delly_DEL_27" -> "delly")
   *
   * @param {Object} variant - Parsed VCF variant object
   * @returns {string} Caller name (e.g., "delly", "dysgu", "manta")
   * @abstract
   */
  extractPrimaryCaller(variant) {
    throw new Error("BaseVariantHandler.extractPrimaryCaller() must be implemented by subclass");
  }

  /**
   * Select which sample/genotype to use as the primary data source for flattening
   *
   * Flattening converts nested VCF structure (array of genotypes per variant)
   * into flat IndexedDB records (one record per variant with single genotype values).
   *
   * For BCF: Returns first sample (index 0)
   * For SURVIVOR: Returns first active sample based on SUPP_VEC
   *
   * @param {Object} variant - Parsed VCF variant object
   * @returns {Object|null} The genotype object to use, or null if no samples
   * @abstract
   */
  selectPrimarySample(variant) {
    throw new Error("BaseVariantHandler.selectPrimarySample() must be implemented by subclass");
  }

  /**
   * Extract all caller data for multi-caller variants (SURVIVOR only)
   *
   * SURVIVOR variants can be detected by multiple callers. This method extracts
   * genotype data for ALL callers, not just the primary one.
   *
   * Returns: [
   *   { caller: "delly", GQ: 10, DR: 5, SR: 3 },
   *   { caller: "dysgu", GQ: 40, DR: 8, SR: 6 }
   * ]
   *
   * For BCF: Returns null (BCF variants have only one caller)
   * For SURVIVOR: Returns array of caller objects with genotype data
   *
   * @param {Object} variant - Parsed VCF variant object
   * @returns {Array<Object>|null} Array of {caller, ...genotype} objects, or null for single-caller variants
   * @abstract
   */
  extractAllCallers(variant) {
    throw new Error("BaseVariantHandler.extractAllCallers() must be implemented by subclass");
  }

  /**
   * Get the IndexedDB object store name for this variant type
   *
   * BCF and SURVIVOR variants are stored in separate object stores
   * to enable type-specific indexing and querying.
   *
   * @returns {string} Object store name ('bcf_variants' or 'survivor_variants')
   * @abstract
   */
  getStoreName() {
    throw new Error("BaseVariantHandler.getStoreName() must be implemented by subclass");
  }

  /**
   * Get the variant type name for logging/debugging
   * @returns {string} Human-readable type name (e.g., "BCF", "SURVIVOR")
   */
  getTypeName() {
    return this.constructor.name.replace("Handler", "").toUpperCase();
  }

  /**
   * Check if this variant type supports multi-caller mode
   *
   * Multi-caller mode allows filtering/querying across ALL callers for a variant,
   * not just the primary caller. Only SURVIVOR variants support this.
   *
   * @returns {boolean} True if multi-caller operations are supported
   */
  supportsMultiCaller() {
    return false;
  }
}
