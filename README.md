# Varify

**Variant File Report Generator**
A Python-based tool to generate rich, interactive HTML reports from structural variant (SV) VCF files, such as those produced by [bcftools](http://samtools.github.io/bcftools/) and [SURVIVOR](https://github.com/fritzsedlazeck/SURVIVOR).

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
![Version](https://img.shields.io/badge/version-1.0.0-brightgreen)
![Python](https://img.shields.io/badge/python-3.10%2B-blue)
![JavaScript](https://img.shields.io/badge/javascript-ES6-yellow)
![Node.js](https://img.shields.io/badge/node.js-18%2B-green)
![Vitest](https://img.shields.io/badge/vitest-575%20tests-green)
![esbuild](https://img.shields.io/badge/esbuild-bundler-orange)

> **⚠️ v1.0.0 Major Release**: This version includes significant architectural changes. JavaScript assets must be built with `npm run build:package` before packaging.

---

## ✨ Features

- 📊 **Interactive ECharts visualizations** including bar charts, histograms, scatter plots, boxplots, and heatmaps
- 🗄️ **Dexie-powered IndexedDB storage** for client-side variant data with fast querying and filtering
- 📈 **Self-contained HTML reports** with embedded JavaScript bundle (~3.5 MB)
  - BCFtools and SURVIVOR stats parsing and visualization
  - IGV.js genome browser integration with BAM track support
- ⚡ **AG-Grid tables** with infinite scrolling, virtual rendering, and advanced filtering
- 🔍 **Categorical and numeric filters** with real-time search across variant fields
- 🧬 **Variant handlers** for BCFtools and SURVIVOR VCF formats
- 📊 **Caller overlap analysis** and quality distributions
- 🚀 **No server required** - runs entirely in the browser
- 📤 **Export functionality** for filtered variants and tables

---

## 🧰 Requirements

### Python Dependencies

- Python 3.10+
- pandas, numpy, pysam, vcfpy (auto-installed)

### JavaScript Dependencies (for building)

- Node.js 18+
- npm (comes with Node.js)

### Installation

**Option 1: Install from source**

```bash
# Install Python dependencies
pip install -r requirements.txt

# Build JavaScript assets (required for v3.0.0+)
npm install
npm run build:package

# Install package
pip install .
```

**Option 2: Development mode**

```bash
pip install -r requirements.txt -r requirements-dev.txt
npm install
npm run build:package
pip install -e .
```

---

## 🚀 Usage

### After Installation

```bash
varify \
  --output-dir results/ \
  --bcf-vcf-file data/bcftools_concat.vcf.gz \
  --survivor-vcf-file data/survivor_merge.vcf \
  --fasta-file data/reference.fna \
  --bcf-stats-file data/bcftools.stats \
  --survivor-stats-file data/survivor.stats \
  --report-file index.html
```

### From Source (Without Installation)

```bash
# Activate virtual environment
source venv/bin/activate

# Run as module
python -m src.varify.varify \
  --output-dir /path/to/output/ \
  --bcf-vcf-file data/bcftools_concat.vcf.gz \
  --survivor-vcf-file data/survivor_merge.vcf \
  --fasta-file data/GCF_000146045.fna \
  --bcf-stats-file data/bcftools.stats \
  --survivor-stats-file data/survivor.stats \
  --report-file "index.html"
```

---

### Required Inputs

| Argument                | Description                                                |
| ----------------------- | ---------------------------------------------------------- |
| `--output-dir`          | Directory to write plots and reports                       |
| `--bcf-vcf-file`        | VCF file from BCFtools merge                               |
| `--survivor-vcf-file`   | VCF file from SURVIVOR merge                               |
| `--bcf-stats-file`      | Output from `bcftools stats` on the BCF VCF                |
| `--survivor-stats-file` | Tabular SURVIVOR summary file (e.g. SV types per size bin) |
| `--fasta-file`          | Reference genome used for alignment                        |
| `--report-file`         | Path to output HTML file                                   |

---

### Optional Inputs

| Argument             | Description                                                      |
| -------------------- | ---------------------------------------------------------------- |
| `--sample-vcf-files` | List of individual sample VCFs (optional, not yet used)          |
| `--bam-files`        | One or more BAM files for IGV iframe views                       |
| `--profile`          | Pipeline or execution profile label (e.g. "default", "nextflow") |

---

## 📂 Output

- 📄 `varify_report.html`: Self-contained interactive HTML report (~3.5 MB)
  - Embedded JavaScript bundle with all functionality
  - No external dependencies required
  - Works offline in any modern browser
- 🗄️ **IndexedDB Storage**: Variants stored client-side for instant filtering
- 📊 **Interactive Visualizations**: ECharts-powered plots with zoom, pan, and selection
- 🧬 **Genome Browser**: IGV.js integration with BAM track support
- ⚡ **Fast Tables**: AG-Grid with virtual scrolling for thousands of variants

---

## 🖼️ Example Screenshots

| Summary                  | Interactive Plot                   | IGV Section          |
| ------------------------ | ---------------------------------- | -------------------- |
| ![Plots](docs/index.png) | ![Statistics](docs/statistics.png) | ![IGV](docs/IGV.png) |

---

## 🧪 Architecture

Varify is built with a modern, modular architecture:

### Python Backend

- `src/varify/varify.py`: Main CLI entry point and report generator
- `src/varify/cli/`: Command-line interface components
- `src/varify/core/`: Core parsing and processing logic
- `src/varify/reporting/`: HTML report generation
- Generates a single HTML file with embedded assets

### JavaScript Frontend (ES6 Modules)

- **Components**: Interactive UI components
  - `VariantTableAGGrid`: AG-Grid-based variant tables with infinite scrolling
  - `VarifyPlots`: ECharts visualization engine with multiple chart types
  - `FileUploadUI`: Client-side file upload and processing
  - `IGVIntegration`: IGV.js genome browser integration
  - `CategoricalFilter`: Custom AG-Grid filters for variant fields
  - `ReportInitializer`: Report setup and data loading
  - `TabManager`: Multi-section tab navigation
- **Core**: Data processing and storage
  - `VCFParser`: VCF file parsing (variants, genotypes, headers)
  - `IndexedDBManager`/`DexieDB`: Client-side database using Dexie.js
  - `VariantHandlers`: BCFtools and SURVIVOR format handlers with registry pattern
  - `VariantFilter`: Query engine for filtering variants
  - `VariantFlattener`: Converts nested VCF data to flat table structure
- **Services**: Metadata analysis and field detection
  - `MetadataService`: Automatic field type detection and statistics
- **Utils**: Statistics, validation, color schemes, and logging
- **Config**: Display settings, VCF field definitions, plot configurations
- **Build**: esbuild bundler with PostCSS and Tailwind CSS v4 processing

---

## 🧪 Development & Testing

### JavaScript Development

The frontend is built with modern JavaScript tooling:

```bash
# Install dependencies
npm install

# Build JavaScript bundle to dist/ (for development)
npm run build

# Build bundles directly to src/varify/dist/ (for packaging)
npm run build:package

# Development mode (watch for changes)
npm run dev

# Format code (Prettier)
npm run format

# Check formatting
npm run format:check
```

**Key Dependencies:**

- **esbuild**: Ultra-fast JavaScript bundler (0.25.12)
- **Tailwind CSS v4**: Utility-first CSS framework (4.1.16)
- **AG-Grid Community**: High-performance data tables (31.0.0)
- **ECharts**: Interactive visualization library (5.5.0)
- **IGV.js**: Integrative Genomics Viewer for genome browsing (3.0.5)
- **Dexie**: IndexedDB wrapper for client-side storage (4.2.1)
- **Vitest**: Fast unit testing framework (4.0.8)
- **Prettier**: Code formatter (3.6.2)

---

### Frontend Testing

Varify includes a test suite for the JavaScript frontend:

```bash
# Run all tests
npm test -- --run

# Run tests in watch mode
npm test

# Run specific test file
npm test -- tests/js/core/query/VariantFilter.test.js

# View coverage report
npm test -- --coverage
```

#### Test Files

- ✅ Variant Handlers (BCF, SURVIVOR, Registry)
- ✅ VCF Parsers (Variant, Genotype, Header)
- ✅ Query & Filtering (VariantFilter)
- ✅ Storage & Flattening (VariantFlattener, CallerDataProcessor)
- ✅ Services (MetadataService)
- ✅ Components (AG-Grid Table, Export Handlers)
- ✅ Utilities (StatisticsUtils)

---

## 📜 License

GPL-3.0-or-later.  
Created with ❤️ by **Lupphes** for structural variant exploration.

---

Contributions welcome! If you'd like to add filters, annotation support, pipeline integration, or new visualizations, open a PR!
