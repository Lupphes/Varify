/**
 * IGV Integration Component
 *
 * Handles initialization and management of IGV browsers for BCF and SURVIVOR variants.
 * Includes loading indicators, progress tracking, and lazy loading functionality.
 */

import { LoggerService } from "../utils/LoggerService.js";

const logger = new LoggerService("IGVIntegration");

export class IGVIntegration {
  constructor(genomeDBManager, igvLoader, vcfParser) {
    this.genomeDBManager = genomeDBManager;
    this.igvLoader = igvLoader;
    this.vcfParser = vcfParser;

    // State
    this.bcfVariants = [];
    this.survivorVariants = [];
    this.variantsLoaded = false;
    this.bcfHeader = null;
    this.survivorHeader = null;
    this.bcfIGVBrowser = null;
    this.survivorIGVBrowser = null;
    this.requiredFiles = null;
  }

  /**
   * Set required files configuration
   */
  setRequiredFiles(config) {
    this.requiredFiles = config;
  }

  /**
   * Load and parse VCF files from IndexedDB
   * Note: Loading messages are handled by ReportInitializer
   */
  async loadAndParseVCFs(bcfVcfFilename, survivorVcfFilename) {
    // Early return if variants already loaded
    if (this.variantsLoaded) {
      logger.info("Variants already loaded, skipping parse");
      return {
        bcfVariants: this.bcfVariants,
        survivorVariants: this.survivorVariants,
      };
    }

    try {
      // Load and parse BCF VCF
      if (bcfVcfFilename) {
        logger.info("Loading BCF VCF from IndexedDB...");

        let bcfData;
        let useCompressed = false;

        // For .gz files, try to load uncompressed version first
        if (bcfVcfFilename.endsWith(".gz")) {
          const uncompressedName = bcfVcfFilename.replace(".gz", "");
          bcfData = await this.genomeDBManager.getFile(uncompressedName);

          if (bcfData) {
            logger.debug(`Using uncompressed VCF for table parsing: ${uncompressedName}`);
            useCompressed = false;
          } else {
            logger.debug(`Uncompressed VCF not found, using compressed: ${bcfVcfFilename}`);
            bcfData = await this.genomeDBManager.getFile(bcfVcfFilename);
            useCompressed = true;
          }
        } else {
          bcfData = await this.genomeDBManager.getFile(bcfVcfFilename);
        }

        logger.info("Parsing BCF variants...");
        if (useCompressed) {
          this.bcfVariants = await this.vcfParser.parseCompressedVCF(bcfData, 10000);
        } else {
          this.bcfVariants = await this.vcfParser.parseVCF(bcfData, 10000);
        }

        // Add index for table display
        this.bcfVariants.forEach((v, i) => (v.index = i + 1));
        logger.info(`Parsed ${this.bcfVariants.length} BCF variants`);

        // Store in IndexedDB for AG-Grid
        logger.debug("Storing BCF variants in IndexedDB...");
        await this.genomeDBManager.clearVariants("bcf"); // Clear old data
        await this.genomeDBManager.storeVariants("bcf", this.bcfVariants);
        logger.debug("BCF variants stored in IndexedDB");

        // Save BCF header before parsing SURVIVOR
        this.bcfHeader = {
          meta: [...this.vcfParser.header.meta],
          columns: this.vcfParser.header.columns,
        };
      }

      // Load and parse SURVIVOR VCF
      if (survivorVcfFilename) {
        logger.info("Loading SURVIVOR VCF from IndexedDB...");
        let survivorData;
        let useCompressedSurvivor = false;

        // For .gz files, try to load uncompressed version first
        if (survivorVcfFilename.endsWith(".gz")) {
          const uncompressedName = survivorVcfFilename.replace(".gz", "");
          survivorData = await this.genomeDBManager.getFile(uncompressedName);

          if (survivorData) {
            logger.debug(`Using uncompressed VCF for table parsing: ${uncompressedName}`);
            useCompressedSurvivor = false;
          } else {
            logger.debug(`Uncompressed VCF not found, using compressed: ${survivorVcfFilename}`);
            survivorData = await this.genomeDBManager.getFile(survivorVcfFilename);
            useCompressedSurvivor = true;
          }
        } else {
          survivorData = await this.genomeDBManager.getFile(survivorVcfFilename);
        }

        logger.info("Parsing SURVIVOR variants...");
        if (useCompressedSurvivor) {
          this.survivorVariants = await this.vcfParser.parseCompressedVCF(survivorData, 10000);
        } else {
          this.survivorVariants = await this.vcfParser.parseVCF(survivorData, 10000);
        }

        // Add index for table display
        this.survivorVariants.forEach((v, i) => (v.index = i + 1));
        logger.info(`Parsed ${this.survivorVariants.length} SURVIVOR variants`);

        // Store in IndexedDB for AG-Grid
        logger.debug("Storing SURVIVOR variants in IndexedDB...");
        await this.genomeDBManager.clearVariants("survivor"); // Clear old data
        await this.genomeDBManager.storeVariants("survivor", this.survivorVariants);
        logger.debug("SURVIVOR variants stored in IndexedDB");

        // Save SURVIVOR header
        this.survivorHeader = {
          meta: [...this.vcfParser.header.meta],
          columns: this.vcfParser.header.columns,
        };
      }

      // Mark variants as loaded
      this.variantsLoaded = true;

      return {
        bcfVariants: this.bcfVariants,
        survivorVariants: this.survivorVariants,
      };
    } catch (error) {
      logger.error("VCF parsing error:", error);
      throw new Error(`Failed to parse VCF files: ${error.message}`);
    }
  }

  /**
   * Initialize BCF IGV Browser
   * Note: Loading messages are handled by ReportInitializer
   */
  async initializeBCFIGV(onTableCreated) {
    try {
      logger.info("Initializing BCF IGV browser...");

      const vcfFiles = this.requiredFiles.vcf.filter((f) => f);

      // Convert variants to ROI features array for IGV
      let roiFeatures = [];
      if (this.bcfVariants && this.bcfVariants.length > 0) {
        logger.debug("Creating ROI features from BCF variants...");

        roiFeatures = this.bcfVariants
          .map((v) => {
            const chr = v.CHROM || v["#CHROM"] || v.chr || v.CHR;
            const pos = v.POS || v.pos;
            const end = v.END || v.end || v.INFO?.END || pos;

            return {
              chr: String(chr),
              start: parseInt(pos) - 1, // Convert to 0-based
              end: parseInt(end),
            };
          })
          .filter((f) => f.chr && !isNaN(f.start) && !isNaN(f.end));

        logger.debug(
          `Created ${roiFeatures.length} ROI features from ${this.bcfVariants.length} variants`
        );
      }

      const config = await this.igvLoader.createIGVConfig({
        fastaFile: this.requiredFiles.fasta,
        vcfFiles: vcfFiles,
        bamFiles: [],
        roiFeatures: roiFeatures,
        locus: this.bcfVariants[0] ? this.bcfVariants[0].locus : undefined,
      });

      this.bcfIGVBrowser = await igv.createBrowser(document.getElementById("bcf-igv-div"), config);
      logger.info("BCF IGV browser initialized");

      window.bcfIGVBrowser = this.bcfIGVBrowser;

      if (onTableCreated) {
        onTableCreated("bcf", this.bcfVariants, this.bcfIGVBrowser, this.bcfHeader);
      }

      logger.info("BCF IGV browser and table ready");
    } catch (error) {
      logger.error("BCF IGV initialization error:", error);
      const igvDiv = document.getElementById("bcf-igv-div");
      if (igvDiv) {
        igvDiv.innerHTML = `
          <div style="color: #e53e3e; padding: 20px; text-align: center;">
            <strong>Error loading BCF IGV browser:</strong> ${error.message}
          </div>
        `;
      }
      throw error;
    }
  }

  /**
   * Initialize SURVIVOR IGV Browser
   * Note: Loading messages are handled by ReportInitializer
   */
  async initializeSURVIVORIGV(onTableCreated) {
    try {
      logger.info("Initializing SURVIVOR IGV browser...");

      const vcfFiles = this.requiredFiles.vcf.filter((f) => f);

      // Convert variants to ROI features array for IGV
      let roiFeatures = [];
      if (this.survivorVariants && this.survivorVariants.length > 0) {
        logger.debug("Creating ROI features from SURVIVOR variants...");

        roiFeatures = this.survivorVariants
          .map((v) => {
            const chr = v.CHROM || v["#CHROM"] || v.chr || v.CHR;
            const pos = v.POS || v.pos;
            const end = v.END || v.end || v.INFO?.END || pos;

            return {
              chr: String(chr),
              start: parseInt(pos) - 1, // Convert to 0-based
              end: parseInt(end),
            };
          })
          .filter((f) => f.chr && !isNaN(f.start) && !isNaN(f.end));

        logger.debug(
          `Created ${roiFeatures.length} ROI features from ${this.survivorVariants.length} variants`
        );
      }

      const config = await this.igvLoader.createIGVConfig({
        fastaFile: this.requiredFiles.fasta,
        vcfFiles: vcfFiles,
        bamFiles: [],
        roiFeatures: roiFeatures,
        locus: this.survivorVariants[0] ? this.survivorVariants[0].locus : undefined,
      });

      this.survivorIGVBrowser = await igv.createBrowser(
        document.getElementById("survivor-igv-div"),
        config
      );
      logger.info("SURVIVOR IGV browser initialized");

      // Expose IGV browser globally for tab switching
      window.survivorIGVBrowser = this.survivorIGVBrowser;

      if (onTableCreated) {
        onTableCreated(
          "survivor",
          this.survivorVariants,
          this.survivorIGVBrowser,
          this.survivorHeader
        );
      }

      logger.info("SURVIVOR IGV browser and table ready");
    } catch (error) {
      logger.error("SURVIVOR IGV initialization error:", error);
      const igvDiv = document.getElementById("survivor-igv-div");
      if (igvDiv) {
        igvDiv.innerHTML = `
          <div style="color: #e53e3e; padding: 20px; text-align: center;">
            <strong>Error loading SURVIVOR IGV browser:</strong> ${error.message}
          </div>
        `;
      }
      throw error;
    }
  }

  /**
   * Setup lazy loading for IGV sections
   */
  setupLazyIGVLoad(sectionId, initFunction) {
    const section = document.getElementById(sectionId);
    if (!section) return;

    const details = section.closest("details");
    if (!details) return;

    let initialized = false;
    details.addEventListener("toggle", function () {
      if (details.open && !initialized) {
        logger.debug(`Lazy loading ${sectionId}...`);
        initialized = true;
        initFunction();
      }
    });
  }

  /**
   * Get variants and headers (for export)
   */
  getVariants() {
    return {
      bcf: { variants: this.bcfVariants, header: this.bcfHeader },
      survivor: {
        variants: this.survivorVariants,
        header: this.survivorHeader,
      },
    };
  }
}
