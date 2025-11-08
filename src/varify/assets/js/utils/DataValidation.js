/**
 * Data Validation Utilities
 *
 * Centralized validation functions for VCF data fields.
 * These utilities help maintain consistent data validation across the application.
 */

/**
 * Check if a value represents missing or invalid data in VCF context
 *
 * @param {*} value - The value to check
 * @returns {boolean} - True if the value is missing/invalid
 *
 * @example
 * isMissing(null)           // true
 * isMissing(undefined)      // true
 * isMissing(".")            // true
 * isMissing("")             // true
 * isMissing("NaN")          // true
 * isMissing("nan")          // true
 * isMissing(0)              // false
 * isMissing("value")        // false
 */
export function isMissing(value) {
  return (
    value === null ||
    value === undefined ||
    value === "." ||
    value === "" ||
    (typeof value === "string" && value.toUpperCase() === "NAN")
  );
}

/**
 * Check if a caller name is valid (not a placeholder or missing value)
 *
 * @param {*} callerName - The caller name to validate
 * @returns {boolean} - True if the caller name is valid
 *
 * @example
 * isValidCaller("sniffles")  // true
 * isValidCaller("DYSGU")     // true
 * isValidCaller(null)        // false
 * isValidCaller("—")         // false
 * isValidCaller(".")         // false
 * isValidCaller("NaN")       // false
 */
export function isValidCaller(callerName) {
  if (isMissing(callerName)) {
    return false;
  }

  // Additional invalid patterns for caller names
  if (callerName === "—" || callerName === ".") {
    return false;
  }

  return true;
}

/**
 * Check if a value is numeric (number or numeric string)
 *
 * @param {*} value - The value to check
 * @returns {boolean} - True if the value is numeric
 *
 * @example
 * isNumeric(42)              // true
 * isNumeric("42")            // true
 * isNumeric("3.14")          // true
 * isNumeric("hello")         // false
 * isNumeric(null)            // false
 * isNumeric(undefined)       // false
 */
export function isNumeric(value) {
  if (isMissing(value)) {
    return false;
  }

  // Handle numeric types
  if (typeof value === "number") {
    return !isNaN(value) && isFinite(value);
  }

  // Handle string representation of numbers
  if (typeof value === "string") {
    const num = Number(value);
    return !isNaN(num) && isFinite(num);
  }

  return false;
}

/**
 * Format a value for display, handling missing values consistently
 *
 * @param {*} value - The value to format
 * @param {string} [placeholder="—"] - The placeholder for missing values
 * @returns {string} - The formatted value
 *
 * @example
 * formatValue(42)            // "42"
 * formatValue(null)          // "—"
 * formatValue(".", "N/A")    // "N/A"
 * formatValue("value")       // "value"
 */
export function formatValue(value, placeholder = "—") {
  return isMissing(value) ? placeholder : String(value);
}

/**
 * Parse a numeric value safely, returning null for invalid values
 *
 * @param {*} value - The value to parse
 * @returns {number|null} - The parsed number or null if invalid
 *
 * @example
 * parseNumericValue("42")        // 42
 * parseNumericValue("3.14")      // 3.14
 * parseNumericValue("invalid")   // null
 * parseNumericValue(null)        // null
 */
export function parseNumericValue(value) {
  if (isMissing(value)) {
    return null;
  }

  const num = Number(value);
  return isNaN(num) || !isFinite(num) ? null : num;
}

/**
 * Parse SUPP_CALLERS field into an array of individual caller names
 * Handles comma-separated values and trims whitespace
 *
 * @param {string} suppCallersValue - The SUPP_CALLERS field value
 * @returns {string[]} - Array of trimmed caller names
 *
 * @example
 * parseSuppCallers("caller1,caller2,caller3")  // ["caller1", "caller2", "caller3"]
 * parseSuppCallers("caller1")                   // ["caller1"]
 * parseSuppCallers("  caller1 , caller2  ")     // ["caller1", "caller2"]
 * parseSuppCallers(null)                        // []
 * parseSuppCallers("")                          // []
 */
export function parseSuppCallers(suppCallersValue) {
  if (!suppCallersValue || typeof suppCallersValue !== "string") {
    return [];
  }

  return suppCallersValue
    .split(",")
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
}
