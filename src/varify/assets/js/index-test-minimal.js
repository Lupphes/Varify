/**
 * Varify - MINIMAL TEST BUILD (No External Libraries)
 * Testing to isolate which library causes the syntax error
 */

// Comment out all external library imports
// import { createGrid } from "ag-grid-community";
// import Alpine from "alpinejs";
// import * as igvNamespace from "igv";

// Keep only our internal imports
import { IndexedDBManager } from "./core/IndexedDBManager.js";
import { VCFParser } from "./core/VCFParser.js";
import { MetadataService } from "./services/MetadataService.js";

// Create minimal window exports
window.IndexedDBManager = IndexedDBManager;
window.VCFParser = VCFParser;
window.MetadataService = MetadataService;

console.log("Varify MINIMAL test build loaded - no external libraries");

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM loaded - minimal build active");
});
