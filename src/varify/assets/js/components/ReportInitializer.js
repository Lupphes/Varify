/**
 * ReportInitializer - Main coordinator for Varify tab-based reports
 */

import { VarifyPlots } from "./visualization/VarifyPlots.js";
import { VariantTableAGGrid } from "./VariantTableAGGrid.js";
import { MetadataService } from "../services/MetadataService.js";
import { SectionGenerator } from "./SectionGenerator.js";
import { TabManager } from "./TabManager.js";
import { EmptyState } from "./EmptyState.js";
import { LoggerService } from "../utils/LoggerService.js";

const logger = new LoggerService("ReportInitializer");

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
    logger.info("Initializing report (tab-based UI)...");

    this.metadata = await this.loadMetadata();
    this.populateHeader(this.metadata);

    this.tabManager = new TabManager((newTab, previousTab) => {
      logger.debug(`Tab switched: ${previousTab} -> ${newTab}`);
    });

    this.setupButtonHandlers();

    window.toggleMultiCallerFilter = this.toggleMultiCallerFilter.bind(this);

    const filesAreCached = await this.checkIfFilesAreCached();

    if (filesAreCached) {
      logger.info("Files cached - auto-loading data...");
      await this.loadAllData(true);
    } else {
      logger.info("Files not cached - showing empty state");
      this.setupEmptyStates();
    }

    await this.updateCacheStatus();

    logger.info("Report initialized");
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

      logger.debug("Cache check:", {
        allExist,
        versionMatch: !versionCheck.mismatch,
        filesCached,
      });

      return filesCached;
    } catch (error) {
      logger.error("Error checking cache:", error);
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
      clearCacheBtn.addEventListener("click", () => {
        setTimeout(() => this.clearCacheAndDatabase(), 0);
      });
    }

    const clearAllCacheBtn = document.getElementById("clear-all-cache-btn");
    if (clearAllCacheBtn) {
      clearAllCacheBtn.addEventListener("click", () => this.clearAllCaches());
    }
  }

  /**
   * Load all data (BCF + SURVIVOR) at once (MAIN LOAD FUNCTION)
   * @param {boolean} skipFileCheck - Skip file existence check (already done in auto-load)
   */
  async loadAllData(skipFileCheck = false) {
    if (this.dataLoaded) {
      logger.info("Data already loaded");
      return;
    }

    logger.info("Loading all data (BCF + SURVIVOR)...");

    try {
      this.showLoadingIndicator(skipFileCheck ? "Loading data..." : "Checking for genome files...");

      await this.genomeDBManager.init();

      const bcfVcfFilename = this.metadata.bcf?.vcf_filename;
      const survivorVcfFilename = this.metadata.survivor?.vcf_filename;

      logger.debug(`BCF VCF: ${bcfVcfFilename}, SURVIVOR VCF: ${survivorVcfFilename}`);

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
          logger.error("Files not uploaded");
          this.hideLoadingIndicator();
          return;
        }
      }

      logger.info("All files ready, parsing VCFs...");
      this.showLoadingIndicator("Parsing VCF files...");

      // Throttle progress updates to avoid overwhelming the UI
      let progressUpdatePending = false;
      let latestProgress = null;

      const progressCallback = (message, source, current, total, subtitle = "") => {
        // Store the latest progress data
        latestProgress = { message, source, current, total, subtitle };

        // Schedule an update if one isn't already pending
        if (progressUpdatePending) return;

        progressUpdatePending = true;
        requestAnimationFrame(() => {
          // Use the latest progress data
          if (latestProgress) {
            const loadingText = document.getElementById("loading-text");
            const loadingSubtitle = document.getElementById("loading-subtitle");

            if (loadingText) {
              loadingText.textContent = latestProgress.message;
            }

            if (loadingSubtitle) {
              if (latestProgress.subtitle) {
                loadingSubtitle.textContent = latestProgress.subtitle;
                loadingSubtitle.style.display = "block";
                loadingSubtitle.style.visibility = "visible";
              } else {
                loadingSubtitle.style.display = "none";
              }
            }
          }

          progressUpdatePending = false;
        });
      };

      await this.igvIntegration.loadAndParseVCFs(
        bcfVcfFilename,
        survivorVcfFilename,
        progressCallback
      );

      logger.info("VCFs parsed, initializing tabs...");
      logger.debug("Metadata check:", {
        hasBcf: !!this.metadata.bcf,
        hasSurvivor: !!this.metadata.survivor,
        bcfVcfFilename,
        survivorVcfFilename,
      });

      if (this.metadata.bcf && bcfVcfFilename) {
        logger.info("Initializing BCF tab...");
        this.showLoadingIndicator("Initializing BCFtools genome browser...");
        await this.initializeTabContent("bcf", bcfVcfFilename);
        logger.debug("BCF tab content initialized, marking as ready...");
        this.tabManager.markTabInitialized("bcf");
        logger.debug("BCF tab marked as initialized");
      }

      if (this.metadata.survivor && survivorVcfFilename) {
        logger.info("Initializing SURVIVOR tab...");
        this.showLoadingIndicator("Initializing SURVIVOR genome browser...");
        await this.initializeTabContent("survivor", survivorVcfFilename);
        logger.debug("SURVIVOR tab content initialized, marking as ready...");
        this.tabManager.markTabInitialized("survivor");
        logger.debug("SURVIVOR tab marked as initialized");
      }

      this.showLoadingIndicator("Finalizing report...");
      await new Promise((resolve) => setTimeout(resolve, 300));

      this.dataLoaded = true;

      logger.info("All data loaded successfully");
      logger.debug("Tab initialized status:", this.tabManager.initialized);

      await this.updateCacheStatus();

      this.hideLoadingIndicator();

      const loadDataBtn = document.getElementById("load-data-btn");
      if (loadDataBtn) {
        loadDataBtn.style.display = "none";
      }
    } catch (error) {
      this.hideLoadingIndicator();
      logger.error("Error loading data:", error);
      alert(`Failed to load data: ${error.message}`);
    }
  }

  /**
   * Initialize content for a tab (table, IGV, charts, stats)
   * Note: VCF parsing is done BEFORE this is called in loadAllData()
   */
  async initializeTabContent(tabId, vcfFilename) {
    logger.info(`Initializing content for ${tabId}`);

    try {
      const tabMetadata = this.metadata[tabId];
      if (!tabMetadata) {
        throw new Error(`No metadata found for ${tabId}`);
      }

      logger.debug(`Initializing UI for ${tabId}...`);
      SectionGenerator.initializeTab(tabId, tabMetadata);

      logger.debug(`Initializing IGV for ${tabId}...`);
      if (tabId === "bcf") {
        await this.igvIntegration.initializeBCFIGV(this.createVariantTableWithHandlers.bind(this));
      } else {
        await this.igvIntegration.initializeSURVIVORIGV(
          this.createVariantTableWithHandlers.bind(this)
        );
      }

      logger.debug(`Loading stats for ${tabId}...`);
      await this.loadStatsForTab(tabId);

      logger.info(`Tab ${tabId} fully initialized`);
    } catch (error) {
      logger.error(`ERROR initializing ${tabId}:`, error);
      throw error;
    }
  }

  /**
   * Create variant table with handlers
   */
  async createVariantTableWithHandlers(prefix, variants, igvBrowser, header) {
    logger.debug(`Creating table for ${prefix}`);

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
      logger.debug(`Plot selection for ${prefix}:`, event.criteria);
      agTable.applyFilterFromPlot(event.criteria);
    });

    try {
      await plotsComponent.initialize();
      logger.info(`Plots initialized for ${prefix}`);
    } catch (error) {
      logger.error(`Plot initialization error for ${prefix}:`, error);
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
      const data = await this.genomeDBManager.getFile(filename);
      if (data) {
        let arrayBuffer;
        if (data instanceof Blob) {
          arrayBuffer = await data.arrayBuffer();
        } else {
          arrayBuffer = data;
        }

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
          logger.info("BCF stats loaded");
        }
      }
    } catch (error) {
      logger.error("Error loading BCF stats:", error);
    }
  }

  /**
   * Load SURVIVOR stats
   */
  async loadSURVIVORStats(filename) {
    try {
      const data = await this.genomeDBManager.getFile(filename);
      if (data) {
        let arrayBuffer;
        if (data instanceof Blob) {
          arrayBuffer = await data.arrayBuffer();
        } else {
          arrayBuffer = data;
        }

        const decoder = new TextDecoder("utf-8");
        const text = decoder.decode(arrayBuffer);
        const statsData = this.parseSURVIVORStats(text);
        const statsHTML = this.renderSURVIVORStatsHTML(statsData);

        const container = document.getElementById("survivor-stats-container");
        if (container) {
          container.innerHTML = statsHTML;
          logger.info("SURVIVOR stats loaded");
        }
      }
    } catch (error) {
      logger.error("Error loading SURVIVOR stats:", error);
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
      logger.info("Loaded embedded metadata");
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
      const hashPart = metadata.file_version
        ? ` | Hash: ${metadata.file_version.substring(0, 8)}`
        : "";
      headerEl.textContent = `Generated: ${metadata.generated_on} | Profiles: ${metadata.profiles} | Reference: ${metadata.reference_name}${hashPart}`;
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
    logger.info(`Multi-caller filter: ${enabled ? "ANY" : "PRIMARY"}`);

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

      const statusText = document.getElementById("cache-status-text");
      if (statusText) statusText.textContent = "Cache cleared!";

      location.reload();
    } catch (error) {
      logger.error("Clear cache error:", error);
      alert(`Failed to clear cache: ${error.message}`);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    }
  }

  /**
   * Clear all Varify databases
   */
  async clearAllCaches() {
    const databases = await this.genomeDBManager.getAllVarifyDatabases();
    const totalSize = await this.genomeDBManager.getTotalStorageSize();
    const sizeText = this.genomeDBManager.formatBytes(totalSize);

    if (
      !confirm(
        `Delete ALL Varify databases?\n\nThis will remove ${databases.length} database${databases.length !== 1 ? "s" : ""} (${sizeText}) from all reports.\n\nClose all other Varify report tabs first.`
      )
    ) {
      return;
    }

    const btn = document.getElementById("clear-all-cache-btn");
    const originalText = btn?.innerHTML;

    if (btn) {
      btn.disabled = true;
      btn.innerHTML =
        '<svg class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-width="4" stroke="currentColor" stroke-opacity="0.25"></circle></svg> Clearing...';
    }

    try {
      await this.genomeDBManager.deleteAllVarifyDatabases();

      alert(
        `Successfully deleted all Varify databases (${databases.length} database${databases.length !== 1 ? "s" : ""}, ${sizeText})`
      );

      const statusText = document.getElementById("cache-status-text");
      if (statusText) statusText.textContent = "All caches cleared!";

      location.reload();
    } catch (error) {
      logger.error("Clear all caches error:", error);
      alert(`Failed to clear all caches: ${error.message}`);
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

      // Update total storage across all databases
      const totalSize = await this.genomeDBManager.getTotalStorageSize();
      const totalSizeText = this.genomeDBManager.formatBytes(totalSize);
      const databases = await this.genomeDBManager.getAllVarifyDatabases();

      const totalStorageEl = document.getElementById("total-storage-text");
      const totalDbCountEl = document.getElementById("total-db-count");

      if (totalStorageEl) {
        totalStorageEl.textContent = totalSizeText;
      }

      if (totalDbCountEl) {
        totalDbCountEl.textContent =
          databases.length > 0
            ? `(${databases.length} DB${databases.length !== 1 ? "s" : ""})`
            : "";
      }
    } catch (error) {
      logger.error("Cache status error:", error);
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
