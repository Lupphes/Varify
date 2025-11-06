/**
 * SectionGenerator - Generates UI components for BCF/SURVIVOR tabs
 *
 * This no longer generates full sections (now in HTML template),
 * but generates specific components:
 * - Summary cards (stats overview)
 * - Chart containers (for ECharts plots)
 */

import { LoggerService } from "../utils/LoggerService.js";

const logger = new LoggerService("SectionGenerator");

export class SectionGenerator {
  /**
   * Generate summary cards for a tab
   * @param {string} type - 'bcf' or 'survivor'
   * @param {Object} summary - { total_sv, unique_sv, mqs }
   * @returns {HTMLElement[]} - Array of 3 card elements
   */
  static generateSummaryCards(type, summary) {
    const cards = [];

    // Card 1: Total Variants
    const totalCard = document.createElement("div");
    totalCard.className = "stat-card";
    totalCard.innerHTML = `
      <div class="stat-card-title">Total Variants</div>
      <div class="stat-card-value">${summary.total_sv.toLocaleString()}</div>
      <div class="stat-card-label">Structural variants detected</div>
    `;
    cards.push(totalCard);

    // Card 2: Unique SV Types
    const uniqueSv =
      typeof summary.unique_sv === "number" && !isNaN(summary.unique_sv)
        ? summary.unique_sv
        : "N/A";
    const typesCard = document.createElement("div");
    typesCard.className = "stat-card";
    typesCard.innerHTML = `
      <div class="stat-card-title">Unique SV Types</div>
      <div class="stat-card-value">${uniqueSv}</div>
      <div class="stat-card-label">Different variant classes</div>
    `;
    cards.push(typesCard);

    // Card 3: Median Quality Score
    const mqsValue =
      typeof summary.mqs === "number" && !isNaN(summary.mqs) ? summary.mqs.toFixed(1) : "N/A";
    const mqsCard = document.createElement("div");
    mqsCard.className = "stat-card";
    mqsCard.innerHTML = `
      <div class="stat-card-title">Median Quality</div>
      <div class="stat-card-value">${mqsValue}</div>
      <div class="stat-card-label">Quality score (MQS)</div>
    `;
    cards.push(mqsCard);

    return cards;
  }

  /**
   * Populate summary cards container
   * @param {string} type - 'bcf' or 'survivor'
   * @param {Object} summary - { total_sv, unique_sv, mqs }
   */
  static populateSummaryCards(type, summary) {
    const container = document.getElementById(`${type}-summary-cards`);
    if (!container) {
      logger.warn(`Summary cards container not found: ${type}-summary-cards`);
      return;
    }

    container.innerHTML = "";

    const cards = this.generateSummaryCards(type, summary);
    cards.forEach((card) => container.appendChild(card));

    logger.debug(`Populated summary cards for ${type}`);
  }

  /**
   * Generate chart containers for a tab
   * @param {string} type - 'bcf' or 'survivor'
   * @returns {HTMLElement[]} - Array of chart container elements
   */
  static generateChartContainers(type) {
    const containers = [];

    // Plot configurations: [id, height, fullWidth]
    const plots = [
      [`${type}-sv-callers`, 500, false],
      [`${type}-primary-callers`, 500, false],
      [`${type}-type-distribution`, 500, false],
      [`${type}-size-distribution`, 500, false],
      [`${type}-quality-distribution`, 500, false],
      [`${type}-type-vs-size`, 500, false],
      [`${type}-size-vs-quality`, 500, false],
      [`${type}-type-heatmap`, 500, false],
      [`${type}-cumulative-length`, 500, false],
      [`${type}-types-by-caller`, 500, false],
      [`${type}-caller-combinations`, 500, true],
      [`${type}-quality-by-caller`, 500, true],
    ];

    plots.forEach(([id, height, fullWidth]) => {
      const container = document.createElement("div");
      container.id = id;
      container.className = `plot-container bg-white rounded-lg shadow-sm border border-gray-200 p-4${
        fullWidth ? " lg:col-span-2" : ""
      }`;
      container.style.height = `${height}px`;
      containers.push(container);
    });

    return containers;
  }

  /**
   * Populate charts container
   * @param {string} type - 'bcf' or 'survivor'
   */
  static populateChartContainers(type) {
    const container = document.getElementById(`${type}-charts-container`);
    if (!container) {
      logger.warn(`Charts container not found: ${type}-charts-container`);
      return;
    }

    container.innerHTML = "";

    const chartContainers = this.generateChartContainers(type);
    chartContainers.forEach((chart) => container.appendChild(chart));

    logger.debug(`Populated chart containers for ${type}`);
  }

  /**
   * Initialize a tab with all its components
   * @param {string} type - 'bcf' or 'survivor'
   * @param {Object} metadata - { summary, vcf_filename, stats_filename }
   */
  static initializeTab(type, metadata) {
    logger.debug(`Initializing tab: ${type}`);

    if (metadata.summary) {
      this.populateSummaryCards(type, metadata.summary);
    }

    this.populateChartContainers(type);

    logger.debug(`Tab ${type} initialized`);
  }

  /**
   * Clear a tab's generated content (used when resetting)
   * @param {string} type - 'bcf' or 'survivor'
   */
  static clearTab(type) {
    const summaryContainer = document.getElementById(`${type}-summary-cards`);
    if (summaryContainer) {
      summaryContainer.innerHTML = "";
    }

    const chartsContainer = document.getElementById(`${type}-charts-container`);
    if (chartsContainer) {
      chartsContainer.innerHTML = "";
    }

    const statsContainer = document.getElementById(`${type}-stats-container`);
    if (statsContainer) {
      statsContainer.innerHTML = `
        <div class="p-8 text-center text-gray-500">
          <p>Loading statistics...</p>
        </div>
      `;
    }

    logger.debug(`Cleared tab: ${type}`);
  }

  /**
   * Show an error state in a tab
   * @param {string} type - 'bcf' or 'survivor'
   * @param {string} message - Error message to display
   */
  static showError(type, message) {
    const contentDiv = document.getElementById(`${type}-content`);
    if (contentDiv) {
      contentDiv.innerHTML = `
        <div class="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <svg class="w-16 h-16 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z">
            </path>
          </svg>
          <h3 class="text-xl font-semibold text-red-800 mb-2">Error Loading Data</h3>
          <p class="text-red-600">${message}</p>
        </div>
      `;
    }
  }

  /**
   * Generate empty state component (fallback if EmptyState.js not loaded)
   * @param {string} type - 'bcf' or 'survivor'
   * @returns {HTMLElement}
   */
  static generateEmptyState(type) {
    const title = type === "bcf" ? "BCFtools" : "SURVIVOR";
    const container = document.createElement("div");
    container.className = "empty-state";
    container.id = `${type}-empty-state`;

    container.innerHTML = `
      <svg class="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4">
        </path>
      </svg>
      <h2 class="empty-state-title">No ${title} Data Loaded</h2>
      <p class="empty-state-text">
        Click the <strong>"Load Data"</strong> button to initialize the ${title} variant analysis.
      </p>
    `;

    return container;
  }
}
