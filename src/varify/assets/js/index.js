/**
 * Varify - Main JavaScript Entry Point
 */

import { createGrid } from "ag-grid-community";
import Alpine from "alpinejs";
import * as igvNamespace from "igv";

import { IndexedDBManager } from "./core/IndexedDBManager.js";
import { IGVIndexedDBLoader } from "./core/IGVLoader.js";
import { VCFParser } from "./core/VCFParser.js";
import { parseBCFToolsStats } from "./core/parsers/BCFStatsParser.js";
import { parseSURVIVORStats } from "./core/parsers/SURVIVORStatsParser.js";
import { BCFTOOLS_SECTION_DESCRIPTIONS } from "./config/display.js";
import { MetadataService } from "./services/MetadataService.js";
import { FileUploadUI } from "./components/FileUpload.js";
import { IGVIntegration } from "./components/IGVIntegration.js";
import { VariantTableAGGrid } from "./components/VariantTableAGGrid.js";
import { CategoricalFilter } from "./components/CategoricalFilter.js";
import { CategoricalFloatingFilter } from "./components/CategoricalFloatingFilter.js";
import { VarifyPlots } from "./components/visualization/VarifyPlots.js";
import { renderBCFToolsStatsHTML, renderSURVIVORStatsHTML } from "./components/StatsTable.js";
import { ReportInitializer } from "./components/ReportInitializer.js";
import { TabManager } from "./components/TabManager.js";
import { EmptyState } from "./components/EmptyState.js";
import { SectionGenerator } from "./components/SectionGenerator.js";
import { LoggerService } from "./utils/LoggerService.js";

const logger = new LoggerService("Index");

const reportHash = window.REPORT_METADATA?.file_version;
const genomeDBManager = new IndexedDBManager("varify-genome-data", 3, reportHash);
const igvLoader = new IGVIndexedDBLoader(genomeDBManager);
const vcfParser = new VCFParser();
const igvIntegration = new IGVIntegration(genomeDBManager, igvLoader, vcfParser);

const reportInitializer = new ReportInitializer(genomeDBManager, igvIntegration, vcfParser, {
  parseBCFToolsStats,
  parseSURVIVORStats,
  renderBCFToolsStatsHTML,
  renderSURVIVORStatsHTML,
  BCFTOOLS_SECTION_DESCRIPTIONS,
});

window.igv = igvNamespace.default || igvNamespace;

logger.debug("IGV import check:", {
  hasNamespace: !!igvNamespace,
  hasDefault: !!igvNamespace.default,
  usingDefault: !!igvNamespace.default,
  hasCreateBrowser: typeof window.igv?.createBrowser === "function",
  igvKeys: window.igv ? Object.keys(window.igv).slice(0, 10) : [],
});

window.Alpine = Alpine;
window.agGrid = { createGrid };

Alpine.start();

window.IndexedDBManager = IndexedDBManager;
window.IGVIndexedDBLoader = IGVIndexedDBLoader;
window.VCFParser = VCFParser;
window.MetadataService = MetadataService;
window.FileUploadUI = FileUploadUI;
window.IGVIntegration = IGVIntegration;
window.VariantTableAGGrid = VariantTableAGGrid;
window.CategoricalFilter = CategoricalFilter;
window.CategoricalFloatingFilter = CategoricalFloatingFilter;
window.VarifyPlots = VarifyPlots;
window.ReportInitializer = ReportInitializer;
window.TabManager = TabManager;
window.EmptyState = EmptyState;
window.SectionGenerator = SectionGenerator;

window.parseBCFToolsStats = parseBCFToolsStats;
window.parseSURVIVORStats = parseSURVIVORStats;
window.renderBCFToolsStatsHTML = renderBCFToolsStatsHTML;
window.renderSURVIVORStatsHTML = renderSURVIVORStatsHTML;
window.BCFTOOLS_SECTION_DESCRIPTIONS = BCFTOOLS_SECTION_DESCRIPTIONS;

window.genomeDBManager = genomeDBManager;
window.igvLoader = igvLoader;
window.vcfParser = vcfParser;
window.igvIntegration = igvIntegration;
window.reportInitializer = reportInitializer;

logger.debug("Varify JavaScript modules loaded successfully");

document.addEventListener("DOMContentLoaded", () => {
  reportInitializer.initialize();
});
