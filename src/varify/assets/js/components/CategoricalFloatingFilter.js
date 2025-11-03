/**
 * Custom Floating Filter for Categorical Filter
 *
 * Displays the currently selected categorical values in the floating filter row
 * and provides a button to open the main filter popup.
 */

import { createLogger } from "../utils/LoggerService.js";

const logger = createLogger("CategoricalFloatingFilter");

export class CategoricalFloatingFilter {
  /**
   * Initialize the floating filter
   * @param {Object} params - Floating filter parameters from AG-Grid
   */
  init(params) {
    this.params = params;
    this.currentModel = null;

    this.eGui = document.createElement("div");
    this.eGui.className = "ag-floating-filter-input";
    this.eGui.style.display = "flex";
    this.eGui.style.alignItems = "center";
    this.eGui.style.width = "100%";

    this.eInput = document.createElement("input");
    this.eInput.type = "text";
    this.eInput.className = "ag-input-field-input ag-text-field-input";
    this.eInput.readOnly = true;
    this.eInput.disabled = true;
    this.eInput.placeholder = "(All)";
    this.eInput.style.flex = "1";
    this.eInput.style.cursor = "pointer";
    this.eInput.title = "Click filter button to select values";

    this.eInput.addEventListener("click", () => {
      params.showParentFilter();
    });

    this.eGui.appendChild(this.eInput);
  }

  /**
   * Called when the main filter changes
   * @param {Object} parentModel - The filter model from the main filter
   */
  onParentModelChanged(parentModel) {
    this.currentModel = parentModel;
    logger.debug("Model changed:", parentModel);
    this.updateDisplay();
  }

  updateDisplay() {
    if (!this.currentModel || !this.currentModel.values || this.currentModel.values.length === 0) {
      this.eInput.value = "";
      this.eInput.placeholder = "(All)";
      this.eInput.title = "Click filter button to select values";
      logger.debug("Cleared display");
      return;
    }

    const values = this.currentModel.values;
    let displayText = "";

    if (values.length === 1) {
      displayText = values[0];
    } else if (values.length === 2) {
      displayText = `${values[0]}, ${values[1]}`;
    } else {
      displayText = `${values[0]} (+${values.length - 1})`;
    }

    this.eInput.value = displayText;
    this.eInput.setAttribute("value", displayText);
    this.eInput.title = `Selected: ${values.join(", ")}`;
    logger.debug("Updated display:", displayText, "from values:", values);
  }

  /**
   * Return the DOM element
   * @returns {HTMLElement}
   */
  getGui() {
    return this.eGui;
  }

  destroy() {}
}
