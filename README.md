# Varify

**Variant File Report Generator**  
A Python-based tool to generate rich, interactive HTML reports from structural variant (SV) VCF files, such as those produced by [bcftools](http://samtools.github.io/bcftools/) and [SURVIVOR](https://github.com/fritzsedlazeck/SURVIVOR).

![License](https://img.shields.io/badge/license-MIT-blue.svg)  
![Python](https://img.shields.io/badge/python-3.10%2B-blue)  
![Plotly](https://img.shields.io/badge/plotly-interactive-lightgrey)

---

## ✨ Features

- 📊 Interactive Plotly-based visualizations for SV types, lengths, quality, and caller combinations
- 📈 Automatically generates a **combined HTML report** including:
  - BCFtools summary plots and tables
  - SURVIVOR summary plots and tables
  - IGV iframe sections (if BAMs are provided)
- 🎨 Responsive layout using **Tailwind CSS** and **Alpine.js**
- 📁 Supports sorting and interactive stats tables with beautiful styling
- 🔍 Caller overlap plots for BCFtools and SURVIVOR merges
- 🧬 Tracks SV quality, size, and types across chromosomes and samples
- 🧪 Profile-aware output if integrating with pipelines (e.g. `--profile nextflow`)

---

## 🧰 Requirements

- Python 3.10+

Install via pip:

```bash
pip install .
```

Or use from source:

```bash
python -m varify --help
```

---

## 🚀 Usage

```bash
python -m varify \
  --output-dir results/ \
  --bcf-vcf-file merged.bcf.vcf \
  --survivor-vcf-file merged.survivor.vcf \
  --bcf-stats-file merged.bcf.stats \
  --survivor-stats-file survivor_stats.txt \
  --fasta-file reference.fa \
  --bam-files sample1.bam sample2.bam \
  --report-file varify_report.html \
  --profile nextflow
```

---

### Required Inputs

| Argument | Description |
|----------|-------------|
| `--output-dir` | Directory to write plots and reports |
| `--bcf-vcf-file` | VCF file from BCFtools merge |
| `--survivor-vcf-file` | VCF file from SURVIVOR merge |
| `--bcf-stats-file` | Output from `bcftools stats` on the BCF VCF |
| `--survivor-stats-file` | Tabular SURVIVOR summary file (e.g. SV types per size bin) |
| `--fasta-file` | Reference genome used for alignment |
| `--report-file` | Path to output HTML file |

---

### Optional Inputs

| Argument | Description |
|----------|-------------|
| `--sample-vcf-files` | List of individual sample VCFs (optional, not yet used) |
| `--bam-files` | One or more BAM files for IGV iframe views |
| `--profile` | Pipeline or execution profile label (e.g. "default", "nextflow") |

---

## 📂 Output

- 📄 `varify_report.html`: Self-contained HTML report (interactive, styled)
- 📁 `/plots`: High-quality `.html` and `.png` figures for each plot
- 🧬 Chromosome heatmaps, caller overlap histograms, quality distributions, and more
- 🌐 IGV viewer per sample (only if BAMs and FASTA are provided)

All assets are local – no internet connection required to view the final output.

---

## 🖼️ Example Screenshots

| Summary | Interactive Plot | IGV Section |
|--------|------------------|-------------|
| ![Plots](docs/index.png) | ![Statistics](docs/statistics.png) | ![IGV](docs/IGV.png) |

---

## 🧪 Internals

Varify consists of:

- `parser.py`: VCF/stat table parsing and SURVIVOR format handling
- `plots.py`: Generates all interactive/static figures using Plotly
- `report.py`: Builds individual VCF HTML summaries
- `combine.py`: Merges the results and generates a combined final report
- `templates/`: Jinja2 templates styled with Tailwind CSS
- `varify.py`: Main CLI entry point

---

## 📜 License

MIT License.  
Created with ❤️ by **Luppo** for structural variant exploration.

---

Contributions welcome! If you'd like to add filters, annotation support, pipeline integration, or new visualizations, open a PR!

