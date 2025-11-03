/**
 * ReportInitializer - Main coordinator for Varify tab-based reports
 */

import { VarifyPlots } from "./visualization/VarifyPlots.js";
import { VariantTableAGGrid } from "./VariantTableAGGrid.js";
import { MetadataService } from "../services/MetadataService.js";
import { SectionGenerator } from "./SectionGenerator.js";
import { TabManager } from "./TabManager.js";
import { EmptyState } from "./EmptyState.js";

export class ReportInitializer {
  constructor(genomeDBManager, igvIntegration, vcfParser, parsers) {
    this.genomeDBManager = genomeDBManager;
    this.igvIntegration = igvIntegration;
    this.vcfParser = vcfParser;

    this.parseBCFToolsStats = parsers.parseBCFToolsStats;
    this.parseSURVIVORStats = parsers.parseSURVIVORStats;
    this.renderBCFToolsStatsHTML = parsers.renderBCFToolsStatsHTML;
    this.renderSURVIVORStatsHTML = parsers.renderSURVIVORStatsHTML;
    this.BCFTOOLS_SECTION_DESCRIPTIONS = parsers.BCFTOOLS_SECTION_DESCRIPTIONS;

    this.tabManager = null;
    this.dataLoaded = false;
    window.survivorMultiCallerMode = false;
    this.metadata = null;
  }

  /**
   * Initialize the report on page load
   * Checks cache and auto-loads data if files are already cached
   */
  async initialize() {
    console.log("[ReportInitializer] Initializing report (tab-based UI)...");

    this.metadata = await this.loadMetadata();
    this.populateHeader(this.metadata);

    this.tabManager = new TabManager((newTab, previousTab) => {
      console.log(`[ReportInitializer] Tab switched: ${previousTab} -> ${newTab}`);
    });

    this.setupButtonHandlers();

    window.toggleMultiCallerFilter = this.toggleMultiCallerFilter.bind(this);

    const filesAreCached = await this.checkIfFilesAreCached();

    if (filesAreCached) {
      console.log("[ReportInitializer] Files cached - auto-loading data...");
      await this.loadAllData(true);
    } else {
      console.log("[ReportInitializer] Files not cached - showing empty state");
      this.setupEmptyStates();
    }

    await this.updateCacheStatus();

    console.log("[ReportInitializer] Report initialized");
  }

  /**
   * Check if all required files are cached in IndexedDB
   * @returns {Promise<boolean>} - true if files are cached and ready, false otherwise
   */
  async checkIfFilesAreCached() {
    try {
      await this.genomeDBManager.init();

      const bcfVcfFilename = this.metadata.bcf?.vcf_filename;
      const survivorVcfFilename = this.metadata.survivor?.vcf_filename;

      const statsFiles = [];
      if (this.metadata.bcf?.stats_filename) statsFiles.push(this.metadata.bcf.stats_filename);
      if (this.metadata.survivor?.stats_filename)
        statsFiles.push(this.metadata.survivor.stats_filename);

      this.igvIntegration.setRequiredFiles({
        fasta: this.metadata.fasta_filename,
        vcf: [bcfVcfFilename, survivorVcfFilename].filter(Boolean),
        bam: [],
        stats: statsFiles,
      });

      const uploadUI = new window.FileUploadUI(
        this.genomeDBManager,
        this.igvIntegration.requiredFiles
      );

      const versionCheck = await uploadUI.checkVersionMismatch(window.REPORT_VERSION);

      const { allExist } = await uploadUI.checkFilesExist();

      const filesCached =
        allExist && !versionCheck.mismatch && versionCheck.reason === "version-match";

      console.log("[ReportInitializer] Cache check:", {
        allExist,
        versionMatch: !versionCheck.mismatch,
        filesCached,
      });

      return filesCached;
    } catch (error) {
      console.error("[ReportInitializer] Error checking cache:", error);
      return false;
    }
  }

  /**
   * Setup empty states for tabs
   */
  setupEmptyStates() {
    if (this.metadata.bcf) {
      const bcfEmptyContainer = document.getElementById("bcf-empty-state");
      if (bcfEmptyContainer) {
        const emptyState = EmptyState.generate("bcf", {
          fasta_filename: this.metadata.fasta_filename,
          vcf_filename: this.metadata.bcf.vcf_filename,
          stats_filename: this.metadata.bcf.stats_filename,
        });
        bcfEmptyContainer.innerHTML = "";
        bcfEmptyContainer.appendChild(emptyState);

        const loadBtn = document.getElementById("bcf-load-trigger");
        if (loadBtn) {
          loadBtn.addEventListener("click", () => this.loadAllData());
        }
      }
    }

    if (this.metadata.survivor) {
      const survivorEmptyContainer = document.getElementById("survivor-empty-state");
      if (survivorEmptyContainer) {
        const emptyState = EmptyState.generate("survivor", {
          fasta_filename: this.metadata.fasta_filename,
          vcf_filename: this.metadata.survivor.vcf_filename,
          stats_filename: this.metadata.survivor.stats_filename,
        });
        survivorEmptyContainer.innerHTML = "";
        survivorEmptyContainer.appendChild(emptyState);

        const loadBtn = document.getElementById("survivor-load-trigger");
        if (loadBtn) {
          loadBtn.addEventListener("click", () => this.loadAllData());
        }
      }
    }
  }

  /**
   * Setup button event handlers
   */
  setupButtonHandlers() {
    const loadDataBtn = document.getElementById("load-data-btn");
    if (loadDataBtn) {
      loadDataBtn.addEventListener("click", () => this.loadAllData());
    }

    const clearCacheBtn = document.getElementById("clear-cache-btn");
    if (clearCacheBtn) {
      clearCacheBtn.addEventListener("click", () => this.clearCacheAndDatabase());
    }
  }

  /**
   * Load all data (BCF + SURVIVOR) at once (MAIN LOAD FUNCTION)
   * @param {boolean} skipFileCheck - Skip file existence check (already done in auto-load)
   */
  async loadAllData(skipFileCheck = false) {
    if (this.dataLoaded) {
      console.log("[ReportInitializer] Data already loaded");
      return;
    }

    console.log("[ReportInitializer] Loading all data (BCF + SURVIVOR)...");

    try {
      this.showLoadingIndicator(skipFileCheck ? "Loading data..." : "Checking for genome files...");

      await this.genomeDBManager.init();

      const bcfVcfFilename = this.metadata.bcf?.vcf_filename;
      const survivorVcfFilename = this.metadata.survivor?.vcf_filename;

      console.log(
        `[ReportInitializer] BCF VCF: ${bcfVcfFilename}, SURVIVOR VCF: ${survivorVcfFilename}`
      );

      const statsFiles = [];
      if (this.metadata.bcf?.stats_filename) statsFiles.push(this.metadata.bcf.stats_filename);
      if (this.metadata.survivor?.stats_filename)
        statsFiles.push(this.metadata.survivor.stats_filename);

      this.igvIntegration.setRequiredFiles({
        fasta: this.metadata.fasta_filename,
        vcf: [bcfVcfFilename, survivorVcfFilename].filter(Boolean),
        bam: [],
        stats: statsFiles,
      });

      if (!skipFileCheck) {
        const uploadUI = new window.FileUploadUI(
          this.genomeDBManager,
          this.igvIntegration.requiredFiles
        );

        const filesReady = await uploadUI.showModal(window.REPORT_VERSION);
        if (!filesReady) {
          console.error("[ReportInitializer] Files not uploaded");
          this.hideLoadingIndicator();
          return;
        }
      }

      console.log("[ReportInitializer] All files ready, parsing VCFs...");
      this.showLoadingIndicator("Parsing VCF files...");

      await this.igvIntegration.loadAndParseVCFs(bcfVcfFilename, survivorVcfFilename);

      console.log("[ReportInitializer] VCFs parsed, initializing tabs...");
      console.log("[ReportInitializer] Metadata check:", {
        hasBcf: !!this.metadata.bcf,
        hasSurvivor: !!this.metadata.survivor,
        bcfVcfFilename,
        survivorVcfFilename,
      });

      if (this.metadata.bcf && bcfVcfFilename) {
        console.log("[ReportInitializer] Initializing BCF tab...");
        this.showLoadingIndicator("Initializing BCFtools genome browser...");
        await this.initializeTabContent("bcf", bcfVcfFilename);
        console.log("[ReportInitializer] BCF tab content initialized, marking as ready...");
        this.tabManager.markTabInitialized("bcf");
        console.log("[ReportInitializer] BCF tab marked as initialized");
      }

      if (this.metadata.survivor && survivorVcfFilename) {
        console.log("[ReportInitializer] Initializing SURVIVOR tab...");
        this.showLoadingIndicator("Initializing SURVIVOR genome browser...");
        await this.initializeTabContent("survivor", survivorVcfFilename);
        console.log("[ReportInitializer] SURVIVOR tab content initialized, marking as ready...");
        this.tabManager.markTabInitialized("survivor");
        console.log("[ReportInitializer] SURVIVOR tab marked as initialized");
      }

      this.showLoadingIndicator("Finalizing report...");
      await new Promise((resolve) => setTimeout(resolve, 300));

      this.dataLoaded = true;

      console.log("[ReportInitializer] All data loaded successfully");
      console.log("[ReportInitializer] Tab initialized status:", this.tabManager.initialized);

      await this.updateCacheStatus();

      this.hideLoadingIndicator();

      const loadDataBtn = document.getElementById("load-data-btn");
      if (loadDataBtn) {
        loadDataBtn.style.display = "none";
      }
    } catch (error) {
      this.hideLoadingIndicator();
      console.error("[ReportInitializer] Error loading data:", error);
      alert(`Failed to load data: ${error.message}`);
    }
  }

  /**
   * Initialize content for a tab (table, IGV, charts, stats)
   * Note: VCF parsing is done BEFORE this is called in loadAllData()
   */
  async initializeTabContent(tabId, vcfFilename) {
    console.log(`[ReportInitializer] Initializing content for ${tabId}`);

    try {
      const tabMetadata = this.metadata[tabId];
      if (!tabMetadata) {
        throw new Error(`No metadata found for ${tabId}`);
      }

      console.log(`[ReportInitializer] Initializing UI for ${tabId}...`);
      SectionGenerator.initializeTab(tabId, tabMetadata);

      console.log(`[ReportInitializer] Initializing IGV for ${tabId}...`);
      if (tabId === "bcf") {
        await this.igvIntegration.initializeBCFIGV(this.createVariantTableWithHandlers.bind(this));
      } else {
        await this.igvIntegration.initializeSURVIVORIGV(
          this.createVariantTableWithHandlers.bind(this)
        );
      }

      console.log(`[ReportInitializer] Loading stats for ${tabId}...`);
      await this.loadStatsForTab(tabId);

      console.log(`[ReportInitializer] Tab ${tabId} fully initialized`);
    } catch (error) {
      console.error(`[ReportInitializer] ERROR initializing ${tabId}:`, error);
      throw error;
    }
  }

  /**
   * Create variant table with handlers
   */
  async createVariantTableWithHandlers(prefix, variants, igvBrowser, header) {
    console.log(`[ReportInitializer] Creating table for ${prefix}`);

    const metadataService = new MetadataService();
    const fieldMetadata = metadataService.buildFieldMetadata(variants);
    window[`${prefix}FieldMetadata`] = fieldMetadata;

    const plotsComponent = new VarifyPlots(this.genomeDBManager, prefix, prefix);
    window[`${prefix}Plots`] = plotsComponent;

    const containerId = `${prefix}-table-container`;
    const agTable = new VariantTableAGGrid(this.vcfParser, this.genomeDBManager, plotsComponent);
    const grid = await agTable.createVariantTable(prefix, igvBrowser, header, containerId);

    window[`${prefix}Table`] = agTable;

    plotsComponent.onPlotSelection((event) => {
      console.log(`Plot selection for ${prefix}:`, event.criteria);
      agTable.applyFilterFromPlot(event.criteria);
    });

    try {
      await plotsComponent.initialize();
      console.log(`[ReportInitializer] Plots initialized for ${prefix}`);
    } catch (error) {
      console.error(`[ReportInitializer] Plot initialization error for ${prefix}:`, error);
    }
  }

  /**
   * Load stats files for a tab
   */
  async loadStatsForTab(tabId) {
    const files = await this.detectAvailableFiles();

    if (tabId === "bcf") {
      const bcfStatsFile = files.stats.find((f) => f.includes("bcftools") || f.includes("bcf"));
      if (bcfStatsFile) {
        await this.loadBCFStats(bcfStatsFile);
      }
    } else if (tabId === "survivor") {
      const survivorStatsFile = files.stats.find((f) => f.includes("survivor"));
      if (survivorStatsFile) {
        await this.loadSURVIVORStats(survivorStatsFile);
      }
    }
  }

  /**
   * Load BCF stats
   */
  async loadBCFStats(filename) {
    try {
      const arrayBuffer = await this.genomeDBManager.getFile(filename);
      if (arrayBuffer) {
        const decoder = new TextDecoder("utf-8");
        const text = decoder.decode(arrayBuffer);
        const statsData = this.parseBCFToolsStats(text);
        const statsHTML = this.renderBCFToolsStatsHTML(
          statsData,
          this.BCFTOOLS_SECTION_DESCRIPTIONS
        );

        const container = document.getElementById("bcf-stats-container");
        if (container) {
          container.innerHTML = statsHTML;
          console.log("[ReportInitializer] BCF stats loaded");
        }
      }
    } catch (error) {
      console.error("[ReportInitializer] Error loading BCF stats:", error);
    }
  }

  /**
   * Load SURVIVOR stats
   */
  async loadSURVIVORStats(filename) {
    try {
      const arrayBuffer = await this.genomeDBManager.getFile(filename);
      if (arrayBuffer) {
        const decoder = new TextDecoder("utf-8");
        const text = decoder.decode(arrayBuffer);
        const statsData = this.parseSURVIVORStats(text);
        const statsHTML = this.renderSURVIVORStatsHTML(statsData);

        const container = document.getElementById("survivor-stats-container");
        if (container) {
          container.innerHTML = statsHTML;
          console.log("[ReportInitializer] SURVIVOR stats loaded");
        }
      }
    } catch (error) {
      console.error("[ReportInitializer] Error loading SURVIVOR stats:", error);
    }
  }

  /**
   * Detect available files from IndexedDB
   */
  async detectAvailableFiles() {
    const files = await this.genomeDBManager.listFiles();
    return {
      fasta: files.find((f) => f.endsWith(".fna") || f.endsWith(".fa") || f.endsWith(".fasta")),
      vcf: files.filter((f) => f.endsWith(".vcf") || f.endsWith(".vcf.gz")),
      stats: files.filter((f) => f.includes(".stats") || f.includes("bcftools_stats")),
    };
  }

  /**
   * Load metadata from embedded window.REPORT_METADATA
   */
  async loadMetadata() {
    if (window.REPORT_METADATA) {
      console.log("[ReportInitializer] Loaded embedded metadata");
      return window.REPORT_METADATA;
    }

    return {
      generated_on: new Date().toISOString(),
      profiles: "unknown",
      reference_name: "unknown",
      file_version: "unknown",
      bcf: null,
      survivor: null,
    };
  }

  /**
   * Populate header with metadata
   */
  populateHeader(metadata) {
    const headerEl = document.getElementById("header-metadata");
    if (headerEl) {
      headerEl.textContent = `Generated: ${metadata.generated_on} | Profiles: ${metadata.profiles} | Reference: ${metadata.reference_name}`;
    }

    if (metadata.file_version) {
      window.REPORT_VERSION = metadata.file_version;
    }
  }

  /**
   * Toggle multi-caller filter mode (SURVIVOR)
   */
  toggleMultiCallerFilter(enabled) {
    window.survivorMultiCallerMode = enabled;
    console.log(`[ReportInitializer] Multi-caller filter: ${enabled ? "ANY" : "PRIMARY"}`);

    const grid = window.survivorGridApi;
    if (grid) {
      grid.purgeInfiniteCache();
      grid.onFilterChanged();
    }
  }

  /**
   * Clear cache and database
   */
  async clearCacheAndDatabase() {
    if (
      !confirm(
        "Delete the entire database?\n\nThis will remove all uploaded genome files. You will need to re-upload them.\n\nClose other tabs with this report first."
      )
    ) {
      return;
    }

    const btn = document.getElementById("clear-cache-btn");
    const originalText = btn?.innerHTML;

    if (btn) {
      btn.disabled = true;
      btn.innerHTML =
        '<svg class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-width="4" stroke="currentColor" stroke-opacity="0.25"></circle></svg> Clearing...';
    }

    try {
      await this.genomeDBManager.deleteDatabase();

      this.dataLoaded = false;
      this.tabManager.resetAllTabs();
      this.setupEmptyStates();

      const statusText = document.getElementById("cache-status-text");
      const sizeText = document.getElementById("cache-size-text");
      if (statusText) statusText.textContent = "Cache cleared!";
      if (sizeText) sizeText.textContent = "";

      setTimeout(() => location.reload(), 1000);
    } catch (error) {
      console.error("[ReportInitializer] Clear cache error:", error);
      alert(`Failed to clear cache: ${error.message}`);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    }
  }

  /**
   * Update cache status display
   */
  async updateCacheStatus() {
    try {
      const size = await this.genomeDBManager.getStorageSize();
      const sizeText = this.genomeDBManager.formatBytes(size);

      const statusTextEl = document.getElementById("cache-status-text");
      const sizeTextEl = document.getElementById("cache-size-text");

      if (statusTextEl && sizeTextEl) {
        if (size > 0) {
          statusTextEl.textContent = "Cache:";
          sizeTextEl.textContent = sizeText;
        } else {
          statusTextEl.textContent = "No cache";
          sizeTextEl.textContent = "";
        }
      }
    } catch (error) {
      console.error("[ReportInitializer] Cache status error:", error);
    }
  }

  /**
   * Show loading indicator
   */
  showLoadingIndicator(message = "Loading...") {
    const indicator = document.getElementById("loading-indicator");
    const text = document.getElementById("loading-text");
    if (indicator && text) {
      text.textContent = message;
      indicator.classList.remove("hidden");
      indicator.style.display = "flex";
    }
  }

  /**
   * Hide loading indicator
   */
  hideLoadingIndicator() {
    const indicator = document.getElementById("loading-indicator");
    if (indicator) {
      indicator.classList.add("hidden");
      setTimeout(() => {
        indicator.style.display = "none";
      }, 300);
    }
  }
}
