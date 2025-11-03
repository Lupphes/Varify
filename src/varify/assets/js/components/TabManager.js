/**
 * TabManager - Manages tab navigation between BCF and SURVIVOR views
 *
 * Responsibilities:
 * - Switch between tabs
 * - Track which tabs have been initialized
 * - Show/hide empty states
 * - Lazy-load tab content when first accessed
 */

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

    console.log("[TabManager] Initialized");
  }

  /**
   * Switch to a different tab
   * @param {string} tabId - 'bcf' or 'survivor'
   */
  switchTab(tabId) {
    if (!this.tabs.includes(tabId)) {
      console.error(`[TabManager] Invalid tab ID: ${tabId}`);
      return;
    }

    if (this.activeTab === tabId) {
      console.log(`[TabManager] Tab ${tabId} already active`);
      return;
    }

    console.log(`[TabManager] Switching from ${this.activeTab} to ${tabId}`);

    // Update active tab
    const previousTab = this.activeTab;
    this.activeTab = tabId;

    this.updateTabButtons();

    this.updateTabContent();

    if (this.onTabSwitch) {
      this.onTabSwitch(tabId, previousTab);
    }

    // If tab not initialized, trigger load via callback
    if (!this.initialized[tabId]) {
      console.log(`[TabManager] Tab ${tabId} not initialized, showing empty state`);
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

          // ECharts instances need to be resized after their container is shown
          setTimeout(() => {
            this.resizeChartsInTab(tabId);
          }, 50);

          // Only navigate if tab is initialized (data loaded)
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
      console.log(`[TabManager] Table or IGV browser not found for ${tabId}`);
      return;
    }

    const lastSelected = window.lastSelectedVariant && window.lastSelectedVariant[tabId];

    if (lastSelected) {
      console.log(`[TabManager] Restoring last selected variant for ${tabId}`);
      table.navigateToVariant(lastSelected, igvBrowser, false);
    } else {
      console.log(`[TabManager] Navigating to first variant for ${tabId}`);
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
        console.warn(`[TabManager] Database manager not found`);
        return;
      }

      const variants = await dbManager.queryVariants(tabId, {}, { offset: 0, limit: 1 });

      if (variants && variants.length > 0) {
        const firstVariant = variants[0];
        console.log(`[TabManager] Got first variant for ${tabId}:`, firstVariant);
        table.navigateToVariant(firstVariant, igvBrowser, false); // Don't scroll

        if (!window.lastSelectedVariant) {
          window.lastSelectedVariant = {};
        }
        window.lastSelectedVariant[tabId] = firstVariant;
      } else {
        console.warn(`[TabManager] No first variant found for ${tabId}`);
      }
    } catch (error) {
      console.error(`[TabManager] Error navigating to first variant:`, error);
    }
  }

  /**
   * Resize all ECharts instances in a tab
   * @param {string} tabId - 'bcf' or 'survivor'
   */
  resizeChartsInTab(tabId) {
    const plotsComponent = window[`${tabId}Plots`];
    if (plotsComponent && plotsComponent.charts) {
      console.log(`[TabManager] Resizing ${plotsComponent.charts.size} charts in ${tabId} tab`);
      plotsComponent.charts.forEach((chart, chartId) => {
        if (chart && typeof chart.resize === "function") {
          chart.resize();
        }
      });
    }
  }

  /**
   * Mark a tab as initialized (data loaded)
   * @param {string} tabId - 'bcf' or 'survivor'
   */
  markTabInitialized(tabId) {
    if (!this.tabs.includes(tabId)) {
      console.error(`[TabManager] Invalid tab ID: ${tabId}`);
      return;
    }

    console.log(`[TabManager] Marking tab ${tabId} as initialized`);
    this.initialized[tabId] = true;
    this.hideEmptyState(tabId);
    this.showContent(tabId);

    // Resize charts after showing content to ensure proper rendering
    setTimeout(() => {
      this.resizeChartsInTab(tabId);
    }, 100);
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
      console.error(`[TabManager] Invalid tab ID: ${tabId}`);
      return;
    }

    console.log(`[TabManager] Resetting tab ${tabId}`);
    this.initialized[tabId] = false;
    this.showEmptyState(tabId);
  }

  /**
   * Reset all tabs to uninitialized state
   */
  resetAllTabs() {
    console.log("[TabManager] Resetting all tabs");
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
