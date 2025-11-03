/**
 * EmptyState - Generates empty state UI for tabs before data is loaded
 *
 * Shows a friendly message with instructions to click "Load Data" button
 */

export class EmptyState {
  /**
   * Generate empty state HTML for a specific tab
   * @param {string} type - 'bcf' or 'survivor'
   * @param {Object} metadata - Optional metadata about required files
   * @returns {HTMLElement}
   */
  static generate(type, metadata = {}) {
    const title = type === "bcf" ? "BCFtools" : "SURVIVOR";
    const container = document.createElement("div");
    container.className = "empty-state";
    container.id = `${type}-empty-state`;

    const icon = `
      <svg class="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4">
        </path>
      </svg>
    `;

    let filesList = "";
    if (metadata.vcf_filename || metadata.fasta_filename) {
      const files = [];
      if (metadata.fasta_filename) {
        files.push(
          `<li class="text-sm">FASTA: <code class="bg-gray-100 px-2 py-0.5 rounded">${metadata.fasta_filename}</code></li>`
        );
        files.push(
          `<li class="text-sm">FASTA Index: <code class="bg-gray-100 px-2 py-0.5 rounded">${metadata.fasta_filename}.fai</code></li>`
        );
      }
      if (metadata.vcf_filename) {
        files.push(
          `<li class="text-sm">VCF: <code class="bg-gray-100 px-2 py-0.5 rounded">${metadata.vcf_filename}</code></li>`
        );
        if (metadata.vcf_filename.endsWith(".gz")) {
          files.push(
            `<li class="text-sm">VCF Index: <code class="bg-gray-100 px-2 py-0.5 rounded">${metadata.vcf_filename}.tbi</code></li>`
          );
          files.push(
            `<li class="text-sm">Uncompressed VCF: <code class="bg-gray-100 px-2 py-0.5 rounded">${metadata.vcf_filename.replace(".gz", "")}</code></li>`
          );
        }
      }
      if (metadata.stats_filename) {
        files.push(
          `<li class="text-sm">Stats: <code class="bg-gray-100 px-2 py-0.5 rounded">${metadata.stats_filename}</code></li>`
        );
      }

      if (files.length > 0) {
        filesList = `
          <div class="mt-6 text-left max-w-xl mx-auto">
            <p class="text-sm font-medium text-gray-600 mb-2">Required files:</p>
            <ul class="space-y-1 text-gray-500">
              ${files.join("")}
            </ul>
          </div>
        `;
      }
    }

    container.innerHTML = `
      ${icon}
      <h2 class="empty-state-title">No ${title} Data Loaded</h2>
      <p class="empty-state-text">
        Click the <strong>"Load Data"</strong> button at the top to initialize the ${title} variant analysis.
        This will load genome files from your browser's storage or prompt you to upload them.
      </p>
      ${filesList}
      <div class="mt-8">
        <button id="${type}-load-trigger" class="btn-primary">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12">
            </path>
          </svg>
          Load ${title} Data
        </button>
      </div>
    `;

    return container;
  }

  /**
   * Generate a simpler empty state (no metadata)
   * @param {string} type - 'bcf' or 'survivor'
   * @returns {HTMLElement}
   */
  static generateSimple(type) {
    return EmptyState.generate(type, {});
  }

  /**
   * Show the empty state for a tab
   * @param {string} type - 'bcf' or 'survivor'
   */
  static show(type) {
    const emptyState = document.getElementById(`${type}-empty-state`);
    if (emptyState) {
      emptyState.classList.remove("hidden");
    }
  }

  /**
   * Hide the empty state for a tab
   * @param {string} type - 'bcf' or 'survivor'
   */
  static hide(type) {
    const emptyState = document.getElementById(`${type}-empty-state`);
    if (emptyState) {
      emptyState.classList.add("hidden");
    }
  }

  /**
   * Check if empty state is currently shown
   * @param {string} type - 'bcf' or 'survivor'
   * @returns {boolean}
   */
  static isShown(type) {
    const emptyState = document.getElementById(`${type}-empty-state`);
    return emptyState && !emptyState.classList.contains("hidden");
  }
}
