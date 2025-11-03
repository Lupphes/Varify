/**
 * Varify - TEST BUILD (AG-Grid + Alpine Only, NO IGV)
 * Testing if the issue is with AG-Grid or Alpine
 */

import { createGrid } from "ag-grid-community";
import Alpine from "alpinejs";

window.Alpine = Alpine;
window.agGrid = { createGrid };

Alpine.start();

console.log("AG-Grid + Alpine test build loaded");
