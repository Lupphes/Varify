/**
 * Varify - TEST BUILD (All External Libraries, No Internal Modules)
 * Testing if the combination of libraries causes the issue
 */

import { createGrid } from "ag-grid-community";
import Alpine from "alpinejs";
import * as igvNamespace from "igv";

window.igv = igvNamespace.default || igvNamespace;
window.Alpine = Alpine;
window.agGrid = { createGrid };

Alpine.start();

console.log("All libraries test build loaded");
