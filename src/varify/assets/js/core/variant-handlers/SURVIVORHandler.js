/**
 * SURVIVORHandler - Handler for SURVIVOR-merged multi-caller variants
 *
 * Handles variants produced by SURVIVOR merge, which have these characteristics:
 * - Each variant can be detected by multiple callers
 * - SUPP_VEC field encodes which callers detected the variant (binary string)
 * - SUPP_CALLERS lists the caller names (comma-separated)
 * - Primary caller extracted from variant ID (e.g., "delly_DEL_27" -> "delly")
 * - Supports multi-caller filtering (check ANY caller, not just primary)
 *
 */

import { BaseVariantHandler } from "./BaseVariantHandler.js";
import { SURVIVOR_INFO_FIELDS } from "../../config/vcf.js";
import { INDEXEDDB } from "../../config/storage.js";

export class SURVIVORHandler extends BaseVariantHandler {
  /**
   * SURVIVOR variants are identified by the PRESENCE of SUPP_VEC
   * @param {Object} variant - Parsed VCF variant
   * @returns {boolean} True if this is a SURVIVOR variant
   */
  canHandle(variant) {
    return variant.info && variant.info[SURVIVOR_INFO_FIELDS.SUPP_VEC] !== undefined;
  }

  /**
   * Extract primary caller from variant ID
   *
   * SURVIVOR variant IDs follow the pattern: "<caller>_<type>_<number>"
   * Examples:
   *   - "delly_DEL_27" -> "delly"
   *   - "dysgu_INS_42" -> "dysgu"
   *   - "manta_DUP_13" -> "manta"
   *
   * Fallback: Use PRIMARY_CALLER INFO field if ID doesn't match pattern
   *
   * @param {Object} variant - Parsed VCF variant
   * @returns {string} Caller name (e.g., "delly", "dysgu", "manta")
   */
  extractPrimaryCaller(variant) {
    if (variant.id && typeof variant.id === "string" && variant.id.includes("_")) {
      const parts = variant.id.split("_");
      if (parts.length >= 2) {
        return parts[0].toLowerCase().trim();
      }
    }

    if (variant.info && variant.info[SURVIVOR_INFO_FIELDS.PRIMARY_CALLER]) {
      return String(variant.info[SURVIVOR_INFO_FIELDS.PRIMARY_CALLER]).trim();
    }

    return "unknown";
  }

  /**
   * Select the first active sample based on SUPP_VEC
   *
   * SUPP_VEC is a binary string where '1' = caller detected variant, '0' = did not
   * Example: SUPP_VEC="101" means callers at positions 0 and 2 detected it
   *
   * The first '1' in SUPP_VEC indicates which sample/genotype is primary
   *
   * @param {Object} variant - Parsed VCF variant
   * @returns {Object|null} Primary genotype object, or null if no active samples
   */
  selectPrimarySample(variant) {
    if (!variant.genotypes || Object.keys(variant.genotypes).length === 0) {
      return null;
    }

    const sampleNames = Object.keys(variant.genotypes);

    if (!variant.info || !variant.info[SURVIVOR_INFO_FIELDS.SUPP_VEC]) {
      return variant.genotypes[sampleNames[0]];
    }

    const suppVec = String(variant.info[SURVIVOR_INFO_FIELDS.SUPP_VEC]);
    const firstActiveIndex = suppVec.indexOf("1");

    if (firstActiveIndex < 0 || firstActiveIndex >= sampleNames.length) {
      return variant.genotypes[sampleNames[0]];
    }

    return variant.genotypes[sampleNames[firstActiveIndex]];
  }

  /**
   * Extract genotype data for ALL active callers
   *
   * This is used for multi-caller filtering, where we want to check if ANY
   * caller meets the filter criteria (not just the primary caller).
   *
   * Example output:
   * [
   *   { caller: "delly", GQ: 10, DR: 5, SR: 3, GT: "0/1" },
   *   { caller: "dysgu", GQ: 40, DR: 8, SR: 6, GT: "0/1" }
   * ]
   *
   * Algorithm:
   * 1. Parse SUPP_VEC to find positions of all '1's
   * 2. For each '1', get caller name from SUPP_CALLERS
   * 3. Get genotype data from corresponding genotypes array position
   * 4. Combine into {caller, ...genotype} objects
   *
   * @param {Object} variant - Parsed VCF variant
   * @returns {Array<Object>} Array of {caller, ...genotype} objects
   */
  extractAllCallers(variant) {
    if (!variant.genotypes || !variant.info) {
      return [];
    }

    const sampleNames = Object.keys(variant.genotypes);

    const suppVec = String(variant.info[SURVIVOR_INFO_FIELDS.SUPP_VEC] || "");
    if (!suppVec) {
      return [];
    }

    const suppCallersStr = variant.info[SURVIVOR_INFO_FIELDS.SUPP_CALLERS];
    const suppCallers = suppCallersStr
      ? String(suppCallersStr)
          .split(/[,\s]+/)
          .map((c) => c.trim())
          .filter(Boolean)
      : [];

    const allCallers = [];
    let callerIndex = 0;

    for (let i = 0; i < suppVec.length; i++) {
      if (suppVec[i] === "1") {
        let callerName;
        if (callerIndex < suppCallers.length) {
          // Use SUPP_CALLERS if available
          callerName = suppCallers[callerIndex];
        } else if (variant.id && variant.id.includes("_")) {
          // Fallback: Extract from variant ID
          callerName = variant.id.split("_")[0];
        } else {
          // Last resort: Use generic name
          callerName = `sample_${i}`;
        }

        const genotype = i < sampleNames.length ? variant.genotypes[sampleNames[i]] : {};

        allCallers.push({
          caller: callerName,
          ...genotype,
        });

        callerIndex++;
      }
    }

    return allCallers;
  }

  /**
   * Get the IndexedDB store name for SURVIVOR variants
   * @returns {string} 'survivor_variants'
   */
  getStoreName() {
    return INDEXEDDB.STORES.SURVIVOR_VARIANTS;
  }

  /**
   * SURVIVOR supports multi-caller filtering
   * @returns {boolean} True
   */
  supportsMultiCaller() {
    return true;
  }
}
