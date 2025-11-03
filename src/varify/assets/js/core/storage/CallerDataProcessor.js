/**
 * Caller Data Processor
 *
 * Provides utility methods for multi-caller data processing.
 */

import { isMissing } from "../../utils/DataValidation.js";

export class CallerDataProcessor {
  /**
   * Check if a value is missing/invalid
   * @param {*} value - Value to check
   * @returns {boolean} True if missing
   * @deprecated Use isMissing from utils/DataValidation.js instead
   */
  static isMissing(value) {
    return isMissing(value);
  }
}
