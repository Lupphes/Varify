/**
 * Heatmap Chart Generators
 *
 * Implements:
 * - SV Type Heatmap by Chromosome
 */

import { PlotDataProcessor } from "../PlotDataProcessor.js";
import { getGridConfig } from "../../../config/plots.js";

/**
 * Render SV Type Heatmap by Chromosome
 *
 * @param {Array} variants - Array of variant objects
 * @param {Object} echarts - ECharts library
 * @param {HTMLElement} container - DOM element
 * @param {Object} eventBus - Plot event bus
 * @returns {Object} - ECharts instance
 */
export function renderTypeHeatmap(variants, echarts, container, eventBus) {
  const title = "Structural Variant Type Heatmap by Chromosome";

  const { rows, cols, values } = PlotDataProcessor.crosstab(variants, "CHROM", "SVTYPE");

  if (rows.length === 0 || cols.length === 0) {
    return renderEmptyChart(echarts, container, title);
  }

  // Flatten for ECharts heatmap format: [[colIndex, rowIndex, value], ...]
  const data = [];
  let maxValue = 0;

  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    for (let colIdx = 0; colIdx < cols.length; colIdx++) {
      const value = values[rowIdx][colIdx];
      data.push([colIdx, rowIdx, value]);
      maxValue = Math.max(maxValue, value);
    }
  }

  const option = {
    title: { text: title },
    tooltip: {
      position: "top",
      formatter: (params) => {
        return `
          ${rows[params.data[1]]} - ${cols[params.data[0]]}<br/>
          Count: ${params.data[2]}
        `;
      },
    },
    grid: {
      ...getGridConfig("heatmap"),
      top: "12%",
    },
    xAxis: {
      type: "category",
      data: cols,
      name: "SV Type",
      nameLocation: "middle",
      nameGap: 80, // Increased to push name below rotated labels
      splitArea: { show: true },
      axisLabel: {
        interval: 0,
        rotate: 45, // Rotate to prevent overlap
        fontSize: 11,
      },
    },
    yAxis: {
      type: "category",
      data: rows,
      name: "Chromosome",
      nameLocation: "middle",
      nameGap: 100, // Increased to push name further left from Y-axis labels
      splitArea: { show: true },
      axisLabel: {
        interval: 0,
        fontSize: 11,
      },
    },
    visualMap: {
      min: 0,
      max: maxValue,
      calculable: true,
      orient: "horizontal",
      left: "center",
      inRange: {
        // YlGnBu color scale
        color: ["#e0f3ff", "#add8e6", "#87ceeb", "#4682b4", "#1e90ff", "#00008b"],
      },
    },
    series: [
      {
        name: "SV Count",
        type: "heatmap",
        data: data,
        label: {
          show: false,
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: "rgba(0, 0, 0, 0.5)",
          },
        },
      },
    ],
  };

  const chart = echarts.init(container);
  chart.setOption(option);

  chart.on("click", (params) => {
    if (params.componentType === "series") {
      const [colIdx, rowIdx] = params.data;
      const chrom = rows[rowIdx];
      const svtype = cols[colIdx];

      eventBus.emitPlotSelection({
        CHROM: chrom,
        SVTYPE: svtype,
      });
    }
  });

  return chart;
}

/**
 * Render empty chart
 */
function renderEmptyChart(echarts, container, title) {
  const option = {
    title: { text: title, subtext: "No data to display" },
    xAxis: { type: "category", data: [] },
    yAxis: { type: "category", data: [] },
    series: [{ type: "heatmap", data: [] }],
  };

  const chart = echarts.init(container);
  chart.setOption(option);
  return chart;
}
