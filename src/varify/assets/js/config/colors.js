/**
 * Color Configuration
 *
 * Centralized color definitions for the entire Varify application.
 * Consolidates UI colors, data visualization colors, and chart themes.
 */

// ============================================================================
// UI COLORS (from theme.js)
// ============================================================================

export const UI_COLORS = {
  // Modal styling
  modal: {
    backdrop: "rgba(0, 0, 0, 0.5)",
    backdropDark: "rgba(0, 0, 0, 0.8)",
    background: "#ffffff",
    borderRadius: "8px",
    shadow: "0 4px 16px rgba(0, 0, 0, 0.15)",
  },

  // Table styling
  table: {
    headerBg: "#f3f4f6",
    border: "#e5e7eb",
    borderColor: "#e5e7eb",
    borderDark: "#d1d5db",
    rowEven: "#ffffff",
    rowOdd: "#f9fafb",
    cellPadding: "8px 10px",
    headerPadding: "10px",
  },

  // Button styling
  buttons: {
    primary: "#3b82f6",
    primaryLight: "#eff6ff",
    primaryHover: "#3182ce",
    secondary: "#6b7280",
    danger: "#e53e3e",
    dangerHover: "#c53030",
    accent: "#667eea",
    accentHover: "#5a67d8",
  },

  // Status colors
  status: {
    success: "#48bb78",
    successBg: "#edf2f7",
    warning: "#f6ad55",
    warningBg: "#fffaf0",
    warningBorder: "#f6ad55",
    error: "#fc8181",
    errorBg: "#fff5f5",
    errorBorder: "#fc8181",
    info: "#667eea",
  },

  // Text colors
  text: {
    primary: "#1f2937",
    secondary: "#6b7280",
    tertiary: "#4a5568",
    light: "#666666",
    dark: "#2d3748",
    warning: "#c05621",
    warningDark: "#7c2d12",
    error: "#c53030",
    errorDark: "#742a2a",
  },

  // Data display colors
  data: {
    missingValue: "#9ca3af",
    conflictIndicator: "#f59e0b", // amber-500 for conflicting multi-caller values
  },

  // IGV browser colors
  igv: {
    trackOverlay: "rgba(94, 255, 1, 0.25)", // Translucent green highlight
  },

  // Progress bar colors
  progress: {
    background: "#e2e8f0",
    fill: "#4299e1",
    height: "24px",
  },
};

// ============================================================================
// DATA COLORS (from color-schemes.js)
// ============================================================================

// ColorBrewer-inspired qualitative palette (similar to R's Set1/Set2/Dark2)
// These colors are carefully chosen for maximum distinguishability
export const QUALITATIVE_PALETTE = [
  "#E41A1C", // Red
  "#377EB8", // Blue
  "#4DAF4A", // Green
  "#984EA3", // Purple
  "#FF7F00", // Orange
  "#FFFF33", // Yellow
  "#A65628", // Brown
  "#F781BF", // Pink
  "#999999", // Gray
  "#66C2A5", // Teal
  "#FC8D62", // Light orange
  "#8DA0CB", // Light blue
  "#E78AC3", // Light pink
  "#A6D854", // Light green
  "#FFD92F", // Light yellow
  "#E5C494", // Tan
  "#B3B3B3", // Light gray
  "#8DD3C7", // Cyan
  "#FFFFB3", // Pale yellow
  "#BEBADA", // Lavender
  "#FB8072", // Salmon
  "#80B1D3", // Sky blue
  "#FDB462", // Peach
  "#B3DE69", // Lime
];

// SV Type colors - preferred mappings, fallback to palette-based generation
export const SVTYPE_PREFERRED_COLORS = {
  DEL: "#e74c3c", // Red - deletions
  DUP: "#3498db", // Blue - duplications
  INV: "#2ecc71", // Green - inversions
  INS: "#f39c12", // Orange - insertions
  TRA: "#9b59b6", // Purple - translocations
  BND: "#1abc9c", // Teal - breakends
  CNV: "#e67e22", // Dark orange - copy number variants
};

// Caller colors - preferred mappings, fallback to hash-based generation
export const CALLER_PREFERRED_COLORS = {
  delly: "#377EB8", // Blue (ColorBrewer)
  manta: "#E41A1C", // Red (ColorBrewer)
  lumpy: "#4DAF4A", // Green (ColorBrewer)
  smoove: "#FF7F00", // Orange (ColorBrewer)
  dysgu: "#984EA3", // Purple (ColorBrewer)
  sniffles: "#66C2A5", // Teal (ColorBrewer)
  gridss: "#A65628", // Brown (ColorBrewer)
  svaba: "#4DAF4A", // Green (same as lumpy is ok)
  tiddit: "#F781BF", // Pink (ColorBrewer)
  pbsv: "#999999", // Gray (ColorBrewer)
  cutesv: "#8DD3C7", // Cyan (ColorBrewer)
  svim: "#FC8D62", // Peach (ColorBrewer)
};

// Quality score color scale (low to high)
export const QUALITY_COLORS = {
  low: "#e74c3c", // Red (< 10)
  medium: "#f39c12", // Orange (10-30)
  high: "#2ecc71", // Green (> 30)
};

// ECharts color palette (general purpose)
export const ECHARTS_PALETTE = [
  "#3498db",
  "#e74c3c",
  "#2ecc71",
  "#f39c12",
  "#9b59b6",
  "#1abc9c",
  "#34495e",
  "#e67e22",
  "#95a5a6",
  "#16a085",
];

// ============================================================================
// CHART COLORS (ECharts theme from plot-config.js)
// ============================================================================

// ECharts theme configuration (matching Tailwind styling)
export const ECHARTS_THEME = {
  color: ECHARTS_PALETTE,

  backgroundColor: "transparent",

  textStyle: {
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontSize: 12,
    color: "#374151", // gray-700
  },

  title: {
    textStyle: {
      fontSize: 16,
      fontWeight: 600,
      color: "#1f2937", // gray-800
    },
    subtextStyle: {
      fontSize: 12,
      color: "#6b7280", // gray-500
      lineHeight: 20, // Add spacing between title and subtitle
    },
    padding: [10, 0, 15, 0], // Add padding: top, right, bottom, left
  },

  line: {
    lineStyle: {
      width: 2,
    },
    smooth: false,
  },

  bar: {
    itemStyle: {
      borderRadius: [4, 4, 0, 0],
    },
  },

  scatter: {
    itemStyle: {
      borderWidth: 0,
    },
    symbolSize: 8,
  },

  tooltip: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderColor: "#e5e7eb",
    borderWidth: 1,
    textStyle: {
      color: "#374151",
      fontSize: 12,
    },
    padding: 10,
  },

  legend: {
    textStyle: {
      fontSize: 12,
      color: "#374151",
    },
    icon: "circle",
  },

  categoryAxis: {
    axisLine: {
      show: true,
      lineStyle: {
        color: "#d1d5db", // gray-300
      },
    },
    axisTick: {
      show: true,
      lineStyle: {
        color: "#d1d5db",
      },
    },
    axisLabel: {
      color: "#6b7280", // gray-500
      fontSize: 11,
    },
    splitLine: {
      show: false,
    },
  },

  valueAxis: {
    axisLine: {
      show: false,
    },
    axisTick: {
      show: false,
    },
    axisLabel: {
      color: "#6b7280",
      fontSize: 11,
    },
    splitLine: {
      show: true,
      lineStyle: {
        color: "#f3f4f6", // gray-100
        type: "solid",
      },
    },
  },
};
