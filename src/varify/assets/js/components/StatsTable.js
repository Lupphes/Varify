/**
 * Stats Table Renderer
 *
 * Renders statistics data as HTML tables with Tailwind CSS styling.
 * Mirrors the Python render_stats_table() logic from html_generator.py
 */

/**
 * Render a single stats table with title and description
 * @param {string} title - Table title
 * @param {string} description - Table description (HTML allowed)
 * @param {Array} data - Array of row objects
 * @returns {string} HTML string for the table
 */
function renderStatsTable(title, description, data) {
  if (!data || data.length === 0) {
    return "";
  }

  const columns = Object.keys(data[0]);

  const headerHtml = columns
    .map((col) => `<th class="px-4 py-2 font-medium">${escapeHtml(col)}</th>`)
    .join("");

  const rowsHtml = data
    .map((row) => {
      const cells = columns
        .map((col) => {
          const value = row[col];
          const displayValue =
            typeof value === "number" && !Number.isInteger(value) ? value.toFixed(2) : value;
          return `<td class="px-4 py-2">${escapeHtml(String(displayValue))}</td>`;
        })
        .join("");
      return `<tr class="hover:bg-gray-50 even:bg-gray-50">${cells}</tr>`;
    })
    .join("");

  const tableHtml = `
    <table class="min-w-full table-auto text-sm text-left text-gray-700" border="0">
      <thead class="bg-blue-600 text-white text-sm uppercase tracking-wider">
        <tr>${headerHtml}</tr>
      </thead>
      <tbody class="divide-y divide-gray-200">
        ${rowsHtml}
      </tbody>
    </table>
  `;

  return `
    <div class="mb-6 mt-6 mx-4 overflow-x-auto">
      <h3 class="text-lg font-semibold mb-2">${escapeHtml(title)}</h3>
      <p class="text-sm text-gray-600 mb-3">${description}</p>
      <div class="overflow-x-auto bg-white border border-gray-300 rounded-md shadow-sm">
        ${tableHtml}
      </div>
    </div>
  `;
}

/**
 * Render BCFtools stats (multiple tables for different sections)
 * @param {Object} statsData - Parsed BCFtools stats (sections object)
 * @param {Object} descriptions - Section descriptions
 * @returns {string} HTML string for all tables
 */
export function renderBCFToolsStatsHTML(statsData, descriptions) {
  if (!statsData || Object.keys(statsData).length === 0) {
    return "";
  }

  const tableHtmlParts = [];

  for (const [sectionKey, sectionData] of Object.entries(statsData)) {
    const title = `BCF - ${sectionKey} Section`;
    const description = descriptions[sectionKey] || "No description available.";

    const tableHtml = renderStatsTable(title, description, sectionData);
    if (tableHtml) {
      tableHtmlParts.push(tableHtml);
    }
  }

  return tableHtmlParts.join("\n");
}

/**
 * Render SURVIVOR stats (single table)
 * @param {Array} statsData - Parsed SURVIVOR stats
 * @returns {string} HTML string for the table
 */
export function renderSURVIVORStatsHTML(statsData) {
  if (!statsData || statsData.length === 0) {
    return "";
  }

  const title = "SURVIVOR Summary Table";
  const description = `
    This table summarizes structural variant types (e.g., Deletions, Duplications, Insertions, Translocations)
    across different size ranges. It is derived from SURVIVOR's support file and shows how many variants
    fall into each class.
  `;

  return renderStatsTable(title, description, statsData);
}

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
