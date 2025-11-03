/**
 * Plot Renderer
 *
 * Utility class for ECharts loading states.
 * Provides consistent loading indicators across all charts.
 */

export class PlotRenderer {
  constructor(echarts) {
    this.echarts = echarts;
  }

  /**
   * Show loading animation on chart
   * @param {Object} chartInstance - ECharts instance
   * @param {string} text - Loading text
   */
  showLoading(chartInstance, text = "Loading...") {
    if (chartInstance) {
      chartInstance.showLoading("default", {
        text: text,
        color: "#3498db",
        textColor: "#374151",
        maskColor: "rgba(255, 255, 255, 0.8)",
        zlevel: 0,
      });
    }
  }

  /**
   * Hide loading animation
   * @param {Object} chartInstance - ECharts instance
   */
  hideLoading(chartInstance) {
    if (chartInstance) {
      chartInstance.hideLoading();
    }
  }
}
