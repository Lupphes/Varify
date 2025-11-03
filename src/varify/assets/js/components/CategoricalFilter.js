/**
 * Custom Categorical Filter for AG-Grid Community Edition
 *
 * Provides a multi-select checkbox filter for categorical fields (SVTYPE, FILTER, GT, etc.)
 * Works with Client-Side Row Model - filtering happens in-memory using doesFilterPass().
 */

export class CategoricalFilter {
  /**
   * Initialize the filter with parameters from AG-Grid
   * @param {Object} params - Filter parameters from AG-Grid
   */
  init(params) {
    this.params = params;
    this.uniqueValues = params.colDef.filterParams?.uniqueValues || [];
    this.selectedValues = new Set();

    this.eGui = document.createElement("div");
    this.eGui.className = "ag-filter-body-wrapper ag-simple-filter-body-wrapper";
    this.eGui.style.padding = "8px";
    this.eGui.style.maxHeight = "300px";
    this.eGui.style.overflowY = "auto";

    const buttonsHtml = `
            <div style="margin-bottom: 8px; display: flex; gap: 4px;">
                <button class="select-all-btn" style="flex: 1; padding: 4px 8px; font-size: 12px; cursor: pointer;">Select All</button>
                <button class="clear-all-btn" style="flex: 1; padding: 4px 8px; font-size: 12px; cursor: pointer;">Clear</button>
            </div>
        `;

    const checkboxesHtml = this.uniqueValues
      .map(
        (value) => `
            <label style="display: block; padding: 4px 0; cursor: pointer; user-select: none;">
                <input type="checkbox" value="${this.escapeHtml(value)}" style="margin-right: 6px;">
                <span>${this.escapeHtml(value)}</span>
            </label>
        `
      )
      .join("");

    this.eGui.innerHTML = buttonsHtml + checkboxesHtml;

    this.selectAllBtn = this.eGui.querySelector(".select-all-btn");
    this.clearAllBtn = this.eGui.querySelector(".clear-all-btn");
    this.checkboxes = Array.from(this.eGui.querySelectorAll('input[type="checkbox"]'));

    this.selectAllBtn.addEventListener("click", () => this.selectAll());
    this.clearAllBtn.addEventListener("click", () => this.clearAll());

    this.checkboxes.forEach((checkbox) => {
      checkbox.addEventListener("change", () => this.onCheckboxChange());
    });

    if (params.model) {
      this.setModel(params.model);
    }
  }

  onCheckboxChange() {
    this.selectedValues.clear();
    this.checkboxes.forEach((checkbox) => {
      if (checkbox.checked) {
        this.selectedValues.add(checkbox.value);
      }
    });

    this.params.filterChangedCallback();
  }

  selectAll() {
    this.checkboxes.forEach((checkbox) => {
      checkbox.checked = true;
    });
    this.onCheckboxChange();
  }

  clearAll() {
    this.checkboxes.forEach((checkbox) => {
      checkbox.checked = false;
    });
    this.onCheckboxChange();
  }

  /**
   * Return the DOM element for the filter
   * @returns {HTMLElement}
   */
  getGui() {
    return this.eGui;
  }

  /**
   * Get the current filter model
   * This is what gets passed to datasource.getRows(params.filterModel)
   * @returns {Object|null} - Filter model or null if no filter active
   */
  getModel() {
    if (this.selectedValues.size === 0) {
      return null;
    }

    return {
      filterType: "set",
      values: Array.from(this.selectedValues),
    };
  }

  /**
   * Set the filter model (used when restoring filter state)
   * @param {Object|null} model - Filter model to apply
   */
  setModel(model) {
    if (!model || !model.values) {
      this.selectedValues.clear();
      this.checkboxes.forEach((checkbox) => {
        checkbox.checked = false;
      });
      return;
    }

    this.selectedValues = new Set(model.values);
    this.checkboxes.forEach((checkbox) => {
      checkbox.checked = this.selectedValues.has(checkbox.value);
    });
  }

  /**
   * Check if filter is currently active
   * @returns {boolean}
   */
  isFilterActive() {
    return this.selectedValues.size > 0;
  }

  /**
   * Check if a row passes the filter (Client-Side Row Model)
   * @param {Object} params - Contains node data
   * @returns {boolean} - True if row should be included
   */
  doesFilterPass(params) {
    if (this.selectedValues.size === 0) {
      return true;
    }

    const value = params.data[this.params.colDef.field];

    return this.selectedValues.has(String(value));
  }

  /**
   * Get display text for floating filter (shows selected values)
   * @returns {string}
   */
  getModelAsString() {
    if (this.selectedValues.size === 0) {
      return "";
    }

    const values = Array.from(this.selectedValues);
    if (values.length === 1) {
      return values[0];
    }

    if (values.length === 2) {
      return `${values[0]}, ${values[1]}`;
    }

    return `${values[0]} (+${values.length - 1})`;
  }

  /**
   * Called when filter popup is shown
   */
  afterGuiAttached() {
    if (this.checkboxes.length > 0) {
      this.checkboxes[0].focus();
    }
  }

  /**
   * Cleanup when filter is destroyed
   */
  destroy() {
    if (this.selectAllBtn) {
      this.selectAllBtn.removeEventListener("click", this.selectAll);
    }
    if (this.clearAllBtn) {
      this.clearAllBtn.removeEventListener("click", this.clearAll);
    }
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text
   * @returns {string}
   */
  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = String(text);
    return div.innerHTML;
  }
}
