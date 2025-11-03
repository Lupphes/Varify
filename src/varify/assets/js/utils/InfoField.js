/**
 * INFO Field Utilities
 *
 * Utilities for handling VCF INFO field reconstruction and parsing.
 * Consolidates INFO field handling logic used across export and processing.
 */

import { isMissing } from "./DataValidation.js";

/**
 * Reconstruct INFO field string from parsed object
 *
 * Handles the conversion of a parsed INFO object back to VCF format:
 * - Boolean true values become flags (key only)
 * - Boolean false values are omitted
 * - Other valid values become key=value pairs
 * - Missing values are skipped
 *
 * @param {Object} infoObj - Parsed INFO field as object
 * @returns {string} - Reconstructed INFO string in VCF format
 *
 * @example
 * reconstructINFO({ SVTYPE: "DEL", IMPRECISE: true, END: 1000 })
 * // Returns: "SVTYPE=DEL;IMPRECISE;END=1000"
 *
 * reconstructINFO({ DP: 10, PASS: true, FAIL: false })
 * // Returns: "DP=10;PASS"
 *
 * reconstructINFO({})
 * // Returns: "."
 */
export function reconstructINFO(infoObj) {
  if (!infoObj || typeof infoObj !== "object") {
    return ".";
  }

  const parts = [];

  for (const [key, value] of Object.entries(infoObj)) {
    if (isMissing(value)) {
      continue;
    }

    if (typeof value === "boolean") {
      if (value === true) {
        parts.push(key);
      }
      continue;
    }

    parts.push(`${key}=${value}`);
  }

  return parts.length > 0 ? parts.join(";") : ".";
}
