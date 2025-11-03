/**
 * Varify - TEST BUILD (IGV Only)
 * Testing if IGV.js causes the syntax error
 */

// Test ONLY IGV
import * as igvNamespace from "igv";

window.igv = igvNamespace.default || igvNamespace;

console.log("IGV-only test build loaded", {
  hasIGV: !!window.igv,
  hasCreateBrowser: typeof window.igv?.createBrowser === "function",
});
