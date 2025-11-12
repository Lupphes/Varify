/**
 * IGV.js IndexedDB File Loader
 *
 * Custom data loader for IGV.js that loads genome files from IndexedDB instead of HTTP.
 * Supports FASTA, VCF, BAM, and their index files (.fai, .tbi, .bai).
 */

import { LoggerService } from "../utils/LoggerService.js";

const logger = new LoggerService("IGVLoader");

class IGVIndexedDBLoader {
  constructor(dbManager) {
    this.dbManager = dbManager;
    this.fileCache = new Map();
  }

  async loadFile(filename) {
    const result = await this.dbManager.getFile(filename, true);
    if (!result) {
      throw new Error(`File not found in IndexedDB: ${filename}`);
    }

    const blob = result.data || result;

    if (result.isFileReference && blob instanceof File) {
      logger.info(
        `Using original File reference for ${filename} (${this.dbManager.formatBytes(blob.size)})`
      );
      return blob;
    }

    const file = new File([blob], filename, {
      type: this.getMimeType(filename),
    });

    logger.debug(`Loaded ${filename} as File (${this.dbManager.formatBytes(file.size)})`);
    return file;
  }

  getMimeType(filename) {
    const ext = filename.split(".").pop().toLowerCase();
    const mimeTypes = {
      fna: "text/plain",
      fa: "text/plain",
      fasta: "text/plain",
      fai: "text/plain",
      vcf: "text/plain",
      gz: "application/gzip",
      bam: "application/octet-stream",
      bai: "application/octet-stream",
      tbi: "application/octet-stream",
    };
    return mimeTypes[ext] || "application/octet-stream";
  }

  extractFilename(urlOrPath) {
    if (urlOrPath.startsWith("blob:") || urlOrPath.startsWith("data:")) {
      return null;
    }

    const parts = urlOrPath.split("/");
    return parts[parts.length - 1];
  }

  async checkRequiredFiles(fileList) {
    const missing = [];
    for (const filename of fileList) {
      const has = await this.dbManager.hasFile(filename);
      if (!has) {
        missing.push(filename);
      }
    }
    return missing;
  }

  clearCache() {
    this.fileCache.clear();
    logger.debug("Cleared file cache");
  }

  async createIGVConfig(options = {}) {
    const {
      fastaFile,
      vcfFiles = [],
      bamFiles = [],
      roiFiles = [],
      roiFeatures = null,
      locus = null,
    } = options;

    const requiredFiles = [
      fastaFile,
      fastaFile + ".fai",
      ...vcfFiles,
      ...vcfFiles.map((f) => f + ".tbi").filter((f) => !f.endsWith(".vcf.tbi")),
      ...bamFiles,
      ...bamFiles.map((f) => f + ".bai"),
    ].filter(Boolean);

    const missing = await this.checkRequiredFiles(requiredFiles);
    if (missing.length > 0) {
      throw new Error(`Missing files in IndexedDB: ${missing.join(", ")}`);
    }

    const fastaFileObj = await this.loadFile(fastaFile);
    const faiFileObj = await this.loadFile(fastaFile + ".fai");

    const config = {
      reference: {
        id: fastaFile.replace(/\.(fna|fa|fasta)$/, ""),
        name: fastaFile,
        fastaURL: fastaFileObj,
        indexURL: faiFileObj,
      },
      tracks: [],
      roi: [],
    };

    for (const vcfFile of vcfFiles) {
      const vcfFileObj = await this.loadFile(vcfFile);
      const track = {
        type: "variant",
        format: "vcf",
        url: vcfFileObj,
        name: vcfFile,
        displayMode: "EXPANDED",
      };

      if (vcfFile.endsWith(".vcf.gz")) {
        const tbiFile = vcfFile + ".tbi";
        if (await this.dbManager.hasFile(tbiFile)) {
          track.indexURL = await this.loadFile(tbiFile);
        }
      }

      config.tracks.push(track);
    }

    for (const bamFile of bamFiles) {
      const bamFileObj = await this.loadFile(bamFile);
      const baiFile = bamFile + ".bai";

      const track = {
        type: "alignment",
        format: "bam",
        url: bamFileObj,
        name: bamFile,
        displayMode: "SQUISHED",
      };

      if (await this.dbManager.hasFile(baiFile)) {
        track.indexURL = await this.loadFile(baiFile);
      }

      config.tracks.push(track);
    }

    if (roiFeatures && roiFeatures.length > 0) {
      const roiConfig = {
        name: "Variant Regions",
        color: "rgba(94, 255, 1, 0.25)",
        features: roiFeatures,
      };
      config.roi.push(roiConfig);
      logger.debug(`Added ROI overlay with ${roiFeatures.length} features`);
    } else if (roiFiles && roiFiles.length > 0) {
      for (const roiFile of roiFiles) {
        const roiFileObj = await this.loadFile(roiFile);

        const roiConfig = {
          name: `${roiFile} (ROI)`,
          type: "annotation",
          format: "vcf",
          url: roiFileObj,
          color: "rgba(94, 255, 1, 0.25)",
        };

        if (roiFile.endsWith(".vcf.gz")) {
          const tbiFile = roiFile + ".tbi";
          if (await this.dbManager.hasFile(tbiFile)) {
            roiConfig.indexURL = await this.loadFile(tbiFile);
          }
        }

        config.roi.push(roiConfig);
        logger.debug(`Added ROI from VCF: ${roiFile}`);
      }
    }

    if (locus) {
      config.locus = locus;
    }

    return config;
  }
}

export { IGVIndexedDBLoader };
