/**
 * Color Schemes for Varify Plots
 *
 * Uses deterministic hash-based color generation for consistent,
 * differentiable colors for any SV type or caller name.
 */

import {
  QUALITATIVE_PALETTE,
  SVTYPE_PREFERRED_COLORS,
  CALLER_PREFERRED_COLORS,
} from "../config/colors.js";

/**
 * Generate a simple hash from a string
 * @param {string} str - Input string
 * @returns {number} - Hash value
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Generate a visually distinct color from a string using ColorBrewer-style palette
 * Uses deterministic hash to select from qualitative color palette
 * @param {string} name - Name to generate color from
 * @returns {string} - Hex color code
 */
function generateColorFromName(name) {
  const hash = simpleHash(name.toLowerCase());
  const index = hash % QUALITATIVE_PALETTE.length;
  return QUALITATIVE_PALETTE[index];
}

/**
 * Get color for SV type
 * Uses preferred color if available, otherwise generates from name hash
 * Complex types like "DUP:INV" get unique colors based on full name
 */
export function getSVTypeColor(svtype) {
  if (!svtype) return "#95a5a6";

  const upperSvtype = svtype.toUpperCase();
  if (SVTYPE_PREFERRED_COLORS[upperSvtype]) {
    return SVTYPE_PREFERRED_COLORS[upperSvtype];
  }

  // For any other type (including complex types like "DUP:INV", "DUP:TANDEM"),
  // generate unique deterministic color from full name
  return generateColorFromName(svtype);
}

/**
 * Get color for caller
 * Uses preferred color if available, otherwise generates from name hash
 */
export function getCallerColor(caller) {
  if (!caller) return "#95a5a6";

  const lowerCaller = caller.toLowerCase();

  if (CALLER_PREFERRED_COLORS[lowerCaller]) {
    return CALLER_PREFERRED_COLORS[lowerCaller];
  }

  return generateColorFromName(caller);
}
