/**
 * BCFHandler - Handler for bcftools-merged variants
 *
 * Handles variants produced by bcftools merge, which have these characteristics:
 * - Each variant is detected by a single caller
 * - Caller name stored in EUK_CALLER or CALLER INFO field
 * - No SUPP_VEC field (distinguishes from SURVIVOR)
 * - Uses first sample for genotype data
 */

import { BaseVariantHandler } from "./BaseVariantHandler.js";
import { BCF_INFO_FIELDS, SURVIVOR_INFO_FIELDS } from "../../config/vcf.js";
import { INDEXEDDB } from "../../config/storage.js";

export class BCFHandler extends BaseVariantHandler {
  /**
   * BCF variants are identified by the ABSENCE of SUPP_VEC
   * @param {Object} variant - Parsed VCF variant
   * @returns {boolean} True if this is a BCF variant
   */
  canHandle(variant) {
    return variant.info && variant.info[SURVIVOR_INFO_FIELDS.SUPP_VEC] === undefined;
  }

  /**
   * Extract caller name from EUK_CALLER or CALLER INFO field
   * @param {Object} variant - Parsed VCF variant
   * @returns {string} Caller name (e.g., "delly", "dysgu", "manta")
   */
  extractPrimaryCaller(variant) {
    if (!variant.info) {
      return "unknown";
    }

    if (variant.info[BCF_INFO_FIELDS.EUK_CALLER]) {
      return String(variant.info[BCF_INFO_FIELDS.EUK_CALLER]).trim();
    }

    if (variant.info[BCF_INFO_FIELDS.CALLER]) {
      return String(variant.info[BCF_INFO_FIELDS.CALLER]).trim();
    }

    return "unknown";
  }

  /**
   * BCF uses the first sample for primary data
   * @param {Object} variant - Parsed VCF variant
   * @returns {Object|null} First genotype object, or null if no samples
   */
  selectPrimarySample(variant) {
    if (!variant.genotypes || Object.keys(variant.genotypes).length === 0) {
      return null;
    }

    const sampleNames = Object.keys(variant.genotypes);

    return variant.genotypes[sampleNames[0]];
  }

  /**
   * BCF variants have only one caller per variant (no multi-caller support)
   * @param {Object} variant - Parsed VCF variant
   * @returns {null} BCF doesn't support multiple callers
   */
  extractAllCallers(variant) {
    return null;
  }

  /**
   * Get the IndexedDB store name for BCF variants
   * @returns {string} 'bcf_variants'
   */
  getStoreName() {
    return INDEXEDDB.STORES.BCF_VARIANTS;
  }

  /**
   * BCF does not support multi-caller mode
   * @returns {boolean} False
   */
  supportsMultiCaller() {
    return false;
  }
}
