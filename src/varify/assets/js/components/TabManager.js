/**
 * TabManager - Manages tab navigation between BCF and SURVIVOR views
 *
 * Responsibilities:
 * - Switch between tabs
 * - Track which tabs have been initialized
 * - Show/hide empty states
 * - Lazy-load tab content when first accessed
 */

import { LoggerService } from "../utils/LoggerService.js";

const logger = new LoggerService("TabManager");

export class TabManager {
  constructor(onTabSwitch) {
    this.activeTab = "bcf";
    this.tabs = ["bcf", "survivor"];
    this.initialized = {
      bcf: false,
      survivor: false,
    };
    this.onTabSwitch = onTabSwitch;

    this.init();
  }

  /**
   * Initialize tab button event listeners
   */
  init() {
    this.tabs.forEach((tabId) => {
      const button = document.getElementById(`tab-${tabId}`);
      if (button) {
        button.addEventListener("click", () => this.switchTab(tabId));
      }
    });

    logger.info("Initialized");
  }

  /**
   * Switch to a different tab
   * @param {string} tabId - 'bcf' or 'survivor'
   */
  switchTab(tabId) {
    if (!this.tabs.includes(tabId)) {
      logger.error(`Invalid tab ID: ${tabId}`);
      return;
    }

    if (this.activeTab === tabId) {
      logger.debug(`Tab ${tabId} already active`);
      return;
    }

    logger.info(`Switching from ${this.activeTab} to ${tabId}`);

    const previousTab = this.activeTab;
    this.activeTab = tabId;

    this.updateTabButtons();

    this.updateTabContent();

    if (this.onTabSwitch) {
      this.onTabSwitch(tabId, previousTab);
    }

    if (!this.initialized[tabId]) {
      logger.debug(`Tab ${tabId} not initialized, showing empty state`);
      this.showEmptyState(tabId);
    }
  }

  /**
   * Update tab button active states
   */
  updateTabButtons() {
    this.tabs.forEach((tabId) => {
      const button = document.getElementById(`tab-${tabId}`);
      if (button) {
        if (tabId === this.activeTab) {
          button.classList.add("active");
        } else {
          button.classList.remove("active");
        }
      }
    });
  }

  /**
   * Show/hide tab content based on active tab
   */
  updateTabContent() {
    this.tabs.forEach((tabId) => {
      const content = document.getElementById(`${tabId}-tab-content`);
      if (content) {
        if (tabId === this.activeTab) {
          content.classList.add("active");

          setTimeout(() => {
            this.resizeChartsInTab(tabId);
          }, 50);

          if (this.initialized[tabId]) {
            setTimeout(() => {
              this.navigateIGVForTab(tabId);
            }, 100);
          }
        } else {
          content.classList.remove("active");
        }
      }
    });
  }

  /**
   * Navigate IGV to appropriate variant for a tab
   * @param {string} tabId - 'bcf' or 'survivor'
   */
  navigateIGVForTab(tabId) {
    const table = window[`${tabId}Table`];
    const igvBrowser = window[`${tabId}IGVBrowser`];

    if (!table || !igvBrowser) {
      logger.debug(`Table or IGV browser not found for ${tabId}`);
      return;
    }

    const lastSelected = window.lastSelectedVariant && window.lastSelectedVariant[tabId];

    if (lastSelected) {
      logger.debug(`Restoring last selected variant for ${tabId}`);
      table.navigateToVariant(lastSelected, igvBrowser, false);
    } else {
      logger.debug(`Navigating to first variant for ${tabId}`);
      this.navigateToFirstVariantInTab(tabId, table, igvBrowser);
    }
  }

  /**
   * Navigate to the first variant in a tab
   * @param {string} tabId - 'bcf' or 'survivor'
   * @param {Object} table - VariantTableAGGrid instance
   * @param {Object} igvBrowser - IGV browser instance
   */
  async navigateToFirstVariantInTab(tabId, table, igvBrowser) {
    try {
      const dbManager = window.genomeDBManager;
      if (!dbManager) {
        logger.warn(`Database manager not found`);
        return;
      }

      const variants = await dbManager.queryVariants(tabId, {}, { offset: 0, limit: 1 });

      if (variants && variants.length > 0) {
        const firstVariant = variants[0];
        logger.debug(`Got first variant for ${tabId}:`, firstVariant);
        table.navigateToVariant(firstVariant, igvBrowser, false); // Don't scroll

        if (!window.lastSelectedVariant) {
          window.lastSelectedVariant = {};
        }
        window.lastSelectedVariant[tabId] = firstVariant;
      } else {
        logger.warn(`No first variant found for ${tabId}`);
      }
    } catch (error) {
      logger.error(`Error navigating to first variant:`, error);
    }
  }

  /**
   * Resize all ECharts instances in a tab
   * @param {string} tabId - 'bcf' or 'survivor'
   */
  resizeChartsInTab(tabId) {
    const plotsComponent = window[`${tabId}Plots`];
    if (plotsComponent && plotsComponent.charts) {
      logger.debug(`Resizing ${plotsComponent.charts.size} charts in ${tabId} tab`);

      const chartArray = Array.from(plotsComponent.charts.values());

      const batchSize = 3;
      let index = 0;

      const resizeBatch = () => {
        const end = Math.min(index + batchSize, chartArray.length);

        for (let i = index; i < end; i++) {
          const chart = chartArray[i];
          if (chart && typeof chart.resize === "function") {
            chart.resize();
          }
        }

        index = end;

        if (index < chartArray.length) {
          requestAnimationFrame(resizeBatch);
        }
      };

      requestAnimationFrame(resizeBatch);
    }
  }

  /**
   * Mark a tab as initialized (data loaded)
   * @param {string} tabId - 'bcf' or 'survivor'
   */
  markTabInitialized(tabId) {
    if (!this.tabs.includes(tabId)) {
      logger.error(`Invalid tab ID: ${tabId}`);
      return;
    }

    logger.info(`Marking tab ${tabId} as initialized`);
    this.initialized[tabId] = true;
    this.hideEmptyState(tabId);
    this.showContent(tabId);

    setTimeout(() => {
      this.resizeChartsInTab(tabId);
    }, 100);

    if (this.activeTab === tabId) {
      setTimeout(() => {
        this.navigateIGVForTab(tabId);
      }, 150);
    }
  }

  /**
   * Check if a tab is initialized
   * @param {string} tabId - 'bcf' or 'survivor'
   * @returns {boolean}
   */
  isTabInitialized(tabId) {
    return this.initialized[tabId] || false;
  }

  /**
   * Show empty state for a tab
   * @param {string} tabId - 'bcf' or 'survivor'
   */
  showEmptyState(tabId) {
    const emptyState = document.getElementById(`${tabId}-empty-state`);
    const content = document.getElementById(`${tabId}-content`);

    if (emptyState) {
      emptyState.classList.remove("hidden");
    }
    if (content) {
      content.classList.add("hidden");
    }
  }

  /**
   * Hide empty state for a tab
   * @param {string} tabId - 'bcf' or 'survivor'
   */
  hideEmptyState(tabId) {
    const emptyState = document.getElementById(`${tabId}-empty-state`);
    if (emptyState) {
      emptyState.classList.add("hidden");
    }
  }

  /**
   * Show content for a tab (after initialization)
   * @param {string} tabId - 'bcf' or 'survivor'
   */
  showContent(tabId) {
    const content = document.getElementById(`${tabId}-content`);
    if (content) {
      content.classList.remove("hidden");
    }
  }

  /**
   * Reset a tab to uninitialized state (used after clearing cache)
   * @param {string} tabId - 'bcf' or 'survivor'
   */
  resetTab(tabId) {
    if (!this.tabs.includes(tabId)) {
      logger.error(`Invalid tab ID: ${tabId}`);
      return;
    }

    logger.info(`Resetting tab ${tabId}`);
    this.initialized[tabId] = false;
    this.showEmptyState(tabId);
  }

  /**
   * Reset all tabs to uninitialized state
   */
  resetAllTabs() {
    logger.info("Resetting all tabs");
    this.tabs.forEach((tabId) => this.resetTab(tabId));
  }

  /**
   * Get the currently active tab
   * @returns {string} - 'bcf' or 'survivor'
   */
  getActiveTab() {
    return this.activeTab;
  }

  /**
   * Get all tabs
   * @returns {string[]}
   */
  getAllTabs() {
    return [...this.tabs];
  }
}
