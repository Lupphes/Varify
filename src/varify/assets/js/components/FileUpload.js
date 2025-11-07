/**
 * File Upload UI for IndexedDB Storage
 *
 * Modal interface for uploading genome files to IndexedDB on first use.
 * Shows progress, handles validation, and persists files for future sessions.
 */

import { LoggerService } from "../utils/LoggerService.js";

const logger = new LoggerService("FileUpload");

class FileUploadUI {
  constructor(dbManager, requiredFiles = {}) {
    this.dbManager = dbManager;
    this.requiredFiles = requiredFiles;
    this.uploadedFiles = new Map();
    this.modalId = "file-upload-modal";
    this.hasFileSystemAccess = "showDirectoryPicker" in window;
  }

  /**
   * Check if all required files are in IndexedDB
   */
  async checkFilesExist() {
    const allFiles = [
      this.requiredFiles.fasta,
      this.requiredFiles.fasta + ".fai",
      ...(this.requiredFiles.vcf || []),
      // For compressed VCFs, need .tbi index and uncompressed version
      ...(this.requiredFiles.vcf || []).filter((f) => f.endsWith(".gz")).map((f) => f + ".tbi"),
      ...(this.requiredFiles.vcf || [])
        .filter((f) => f.endsWith(".gz"))
        .map((f) => f.replace(".gz", "")),
      ...(this.requiredFiles.bam || []),
      ...(this.requiredFiles.bam || []).map((f) => f + ".bai"),
      ...(this.requiredFiles.stats || []),
    ].filter(Boolean);

    const missing = [];
    for (const filename of allFiles) {
      const exists = await this.dbManager.hasFile(filename);
      if (!exists) {
        missing.push(filename);
      }
    }

    return { allExist: missing.length === 0, missing };
  }

  /**
   * Check if report version has changed
   * @param {string} currentVersion - Current report version
   * @returns {Promise<Object>} - { mismatch: boolean, reason: string }
   */
  async checkVersionMismatch(currentVersion) {
    if (!currentVersion || currentVersion === "None") {
      return { mismatch: false, reason: "no-versioning" };
    }

    const storedVersion = await this.dbManager.getStoredVersion();

    if (!storedVersion) {
      logger.debug("No stored version found - files may be from old report");
      return { mismatch: true, reason: "no-stored-version" };
    }

    if (storedVersion !== currentVersion) {
      logger.warn(`Version mismatch! Stored: ${storedVersion}, Current: ${currentVersion}`);
      return { mismatch: true, reason: "version-changed" };
    }

    logger.debug(`Version match: ${currentVersion}`);
    return { mismatch: false, reason: "version-match" };
  }

  /**
   * Show the upload modal
   */
  async showModal(currentVersion = null) {
    const versionCheck = await this.checkVersionMismatch(currentVersion);

    const { allExist, missing } = await this.checkFilesExist();

    if (allExist && !versionCheck.mismatch && versionCheck.reason === "version-match") {
      logger.info("All required files already in IndexedDB with correct version");
      return true;
    }

    if (versionCheck.mismatch) {
      if (versionCheck.reason === "no-stored-version") {
        logger.debug("Files exist but no version info - prompting re-upload for safety");
      } else if (versionCheck.reason === "version-changed") {
        logger.warn("Version mismatch detected - prompting user to re-upload files");
      }
    } else {
      logger.info(`Missing files: ${missing.join(", ")}`);
    }

    this.createModalHTML(missing, versionCheck.mismatch, versionCheck.reason);

    const modal = document.getElementById(this.modalId);
    modal.style.display = "flex";

    return new Promise((resolve) => {
      this.resolveUpload = resolve;
    });
  }

  /**
   * Create the modal HTML structure
   */
  createModalHTML(missingFiles, versionMismatch = false, reason = null) {
    const existing = document.getElementById(this.modalId);
    if (existing) {
      existing.remove();
    }

    const filesExist = missingFiles.length === 0 && !versionMismatch;

    let versionWarning = "";
    if (versionMismatch) {
      if (reason === "no-stored-version") {
        versionWarning = `
                    <div style="background: #fffaf0; border-left: 4px solid #f6ad55; padding: 12px 16px; margin-bottom: 20px; border-radius: 4px;">
                        <p style="margin: 0 0 8px 0; font-weight: 600; color: #c05621; font-size: 14px;">⚠️ Version Check Recommended</p>
                        <p style="margin: 0; font-size: 13px; color: #7c2d12; line-height: 1.6;">
                            Cached files detected without version information. To ensure you're viewing the latest data, please clear cache and re-upload files from the <code style="background: #fff; padding: 2px 6px; border-radius: 3px;">genome_files/</code> folder.
                        </p>
                    </div>
                `;
      } else {
        versionWarning = `
                    <div style="background: #fff5f5; border-left: 4px solid #fc8181; padding: 12px 16px; margin-bottom: 20px; border-radius: 4px;">
                        <p style="margin: 0 0 8px 0; font-weight: 600; color: #c53030; font-size: 14px;">⚠️ Report Data Updated</p>
                        <p style="margin: 0; font-size: 13px; color: #742a2a; line-height: 1.6;">
                            The genome files have been updated since your last visit. Please clear the cache and re-upload the files to see the latest data.
                        </p>
                    </div>
                `;
      }
    }

    const modalHTML = `
            <div id="${this.modalId}" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); z-index: 100000; justify-content: center; align-items: center;" onclick="if(event.target.id === '${this.modalId}' && ${filesExist}) { this.style.display = 'none'; }">
                <div style="background: white; border-radius: 8px; padding: 32px; max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto; box-shadow: 0 4px 20px rgba(0,0,0,0.3);" onclick="event.stopPropagation();">
                    <h2 style="margin: 0 0 16px 0; font-size: 24px; color: #333;">Upload Genome Files</h2>
                    <p style="margin: 0 0 12px 0; color: #666; line-height: 1.5;">
                        To use the IGV genome browser, please upload the required genome data files.
                        These files will be stored in your browser for future use (no re-upload needed).
                    </p>

                    ${versionWarning}

                    <div style="background: #edf2f7; border-left: 4px solid #48bb78; padding: 12px 16px; margin-bottom: 20px; border-radius: 4px;">
                        <p style="margin: 0 0 8px 0; font-weight: 600; color: #2d3748; font-size: 14px;">📁 Files are located in the same directory as this HTML report:</p>
                        <p style="margin: 0; font-size: 13px; color: #4a5568; line-height: 1.6;">
                            Look for a folder named <code style="background: #fff; padding: 2px 6px; border-radius: 3px; font-weight: 600;">genome_files/</code> next to the report
                        </p>
                    </div>

                    ${
                      this.hasFileSystemAccess
                        ? `
                        <div id="auto-upload-section" style="text-align: center; padding: 40px 20px;">
                            <div style="font-size: 56px; margin-bottom: 16px;">📁</div>
                            <h3 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 600; color: #1a202c;">Select Folder to Upload</h3>
                            <p style="margin: 0 0 24px 0; color: #718096; font-size: 14px; line-height: 1.6;">
                                Choose the <strong>genome_files</strong> folder and all files will be uploaded automatically
                            </p>
                            <button id="auto-upload-btn" style="padding: 14px 32px; background: #667eea; color: white;
                                    border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer;
                                    transition: all 0.2s; display: inline-flex; align-items: center; justify-content: center; gap: 10px;
                                    box-shadow: 0 4px 14px rgba(102, 126, 234, 0.4);"
                                    onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(102, 126, 234, 0.5)';"
                                    onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 14px rgba(102, 126, 234, 0.4)';">
                                <svg style="width: 20px; height: 20px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path>
                                </svg>
                                Select Folder
                            </button>
                            <div style="margin-top: 24px;">
                                <button onclick="document.getElementById('upload-form').style.display='block'; document.getElementById('auto-upload-section').style.display='none';"
                                        style="background: none; border: none; color: #667eea; font-size: 14px; cursor: pointer; text-decoration: underline;">
                                    Or upload files manually
                                </button>
                            </div>
                        </div>
                    `
                        : ""
                    }

                    <div id="upload-form" style="display: ${this.hasFileSystemAccess ? "none" : "block"};">
                        ${
                          this.hasFileSystemAccess
                            ? `
                            <div style="margin-bottom: 20px; text-align: center;">
                                <button onclick="document.getElementById('auto-upload-section').style.display='block'; document.getElementById('upload-form').style.display='none';"
                                        style="background: none; border: none; color: #667eea; font-size: 14px; cursor: pointer; text-decoration: underline; display: inline-flex; align-items: center; gap: 6px;">
                                    <svg style="width: 14px; height: 14px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                                    </svg>
                                    Back to folder upload
                                </button>
                            </div>
                        `
                            : ""
                        }

                        <div class="upload-section" style="margin-bottom: 20px;">
                            <label style="display: block; font-weight: 600; margin-bottom: 8px; color: #333;">
                                Reference Genome (FASTA)
                                <span style="color: #e53e3e;">*</span>
                            </label>
                            <p style="margin: 0 0 8px 0; font-size: 14px; color: #666;">
                                Required: ${this.requiredFiles.fasta}
                            </p>

                            <div style="margin-bottom: 8px;">
                                <input type="file" id="upload-fasta" accept=".fna,.fa,.fasta" style="display: none;">
                                <label for="upload-fasta" style="display: inline-block; padding: 8px 16px; background-color: #4299e1; color: white; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500; transition: background-color 0.2s;">
                                    Choose FASTA File
                                </label>
                                <span id="upload-fasta-name" style="margin-left: 12px; font-size: 14px; color: #666;">No file chosen</span>
                            </div>

                            <div style="margin-bottom: 4px;">
                                <input type="file" id="upload-fai" accept=".fai" style="display: none;">
                                <label for="upload-fai" style="display: inline-block; padding: 8px 16px; background-color: #4299e1; color: white; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500; transition: background-color 0.2s;">
                                    Choose FAI File
                                </label>
                                <span id="upload-fai-name" style="margin-left: 12px; font-size: 14px; color: #666;">No file chosen</span>
                            </div>

                            <p style="margin: 4px 0 0 0; font-size: 12px; color: #999;">
                                Also upload the .fai index file
                            </p>
                        </div>

                        ${(this.requiredFiles.vcf || [])
                          .map(
                            (vcfFile, i) => `
                            <div class="upload-section" style="margin-bottom: 20px;">
                                <label style="display: block; font-weight: 600; margin-bottom: 8px; color: #333;">
                                    VCF File ${i + 1}
                                    <span style="color: #e53e3e;">*</span>
                                </label>
                                <p style="margin: 0 0 8px 0; font-size: 14px; color: #666;">
                                    Required: ${vcfFile}
                                </p>

                                <div style="margin-bottom: 8px;">
                                    <input type="file" id="upload-vcf-${i}" accept=".vcf,.vcf.gz" data-filename="${vcfFile}" style="display: none;">
                                    <label for="upload-vcf-${i}" style="display: inline-block; padding: 8px 16px; background-color: #4299e1; color: white; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500; transition: background-color 0.2s;">
                                        Choose VCF File
                                    </label>
                                    <span id="upload-vcf-${i}-name" style="margin-left: 12px; font-size: 14px; color: #666;">No file chosen</span>
                                </div>

                                ${
                                  vcfFile.endsWith(".gz")
                                    ? `
                                    <div style="margin-bottom: 8px;">
                                        <input type="file" id="upload-tbi-${i}" accept=".tbi" data-filename="${vcfFile}.tbi" style="display: none;">
                                        <label for="upload-tbi-${i}" style="display: inline-block; padding: 8px 16px; background-color: #4299e1; color: white; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500; transition: background-color 0.2s;">
                                            Choose TBI File
                                        </label>
                                        <span id="upload-tbi-${i}-name" style="margin-left: 12px; font-size: 14px; color: #666;">No file chosen</span>
                                    </div>

                                    <div style="margin-bottom: 4px;">
                                        <input type="file" id="upload-vcf-uncompressed-${i}" accept=".vcf" data-filename="${vcfFile.replace(".gz", "")}" style="display: none;">
                                        <label for="upload-vcf-uncompressed-${i}" style="display: inline-block; padding: 8px 16px; background-color: #4299e1; color: white; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500; transition: background-color 0.2s;">
                                            Choose Uncompressed VCF
                                        </label>
                                        <span id="upload-vcf-uncompressed-${i}-name" style="margin-left: 12px; font-size: 14px; color: #666;">No file chosen</span>
                                    </div>

                                    <p style="margin: 4px 0 0 0; font-size: 12px; color: #999;">
                                        Also upload the .tbi index file and uncompressed .vcf file (for table parsing)
                                    </p>
                                `
                                    : ""
                                }
                            </div>
                        `
                          )
                          .join("")}

                        ${
                          (this.requiredFiles.bam || []).length > 0
                            ? `
                            <div class="upload-section" style="margin-bottom: 20px;">
                                <label style="display: block; font-weight: 600; margin-bottom: 8px; color: #333;">
                                    BAM Files (Optional)
                                </label>
                                ${(this.requiredFiles.bam || [])
                                  .map(
                                    (bamFile, i) => `
                                    <div style="margin-bottom: 12px;">
                                        <p style="margin: 0 0 8px 0; font-size: 14px; color: #666;">
                                            ${bamFile}
                                        </p>

                                        <div style="margin-bottom: 8px;">
                                            <input type="file" id="upload-bam-${i}" accept=".bam" data-filename="${bamFile}" style="display: none;">
                                            <label for="upload-bam-${i}" style="display: inline-block; padding: 8px 16px; background-color: #4299e1; color: white; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500; transition: background-color 0.2s;">
                                                Choose BAM File
                                            </label>
                                            <span id="upload-bam-${i}-name" style="margin-left: 12px; font-size: 14px; color: #666;">No file chosen</span>
                                        </div>

                                        <div style="margin-bottom: 4px;">
                                            <input type="file" id="upload-bai-${i}" accept=".bai" data-filename="${bamFile}.bai" style="display: none;">
                                            <label for="upload-bai-${i}" style="display: inline-block; padding: 8px 16px; background-color: #4299e1; color: white; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500; transition: background-color 0.2s;">
                                                Choose BAI File
                                            </label>
                                            <span id="upload-bai-${i}-name" style="margin-left: 12px; font-size: 14px; color: #666;">No file chosen</span>
                                        </div>
                                    </div>
                                `
                                  )
                                  .join("")}
                            </div>
                        `
                            : ""
                        }

                        ${
                          (this.requiredFiles.stats || []).length > 0
                            ? `
                            <div class="upload-section" style="margin-bottom: 20px;">
                                <label style="display: block; font-weight: 600; margin-bottom: 8px; color: #333;">
                                    Statistics Files (Optional)
                                </label>
                                <p style="margin: 0 0 12px 0; font-size: 13px; color: #666;">
                                    Stats files will be parsed and displayed in the report
                                </p>
                                ${(this.requiredFiles.stats || [])
                                  .map(
                                    (statsFile, i) => `
                                    <div style="margin-bottom: 12px;">
                                        <p style="margin: 0 0 8px 0; font-size: 14px; color: #666;">
                                            ${statsFile}
                                        </p>

                                        <div style="margin-bottom: 4px;">
                                            <input type="file" id="upload-stats-${i}" accept=".txt,.stats" data-filename="${statsFile}" style="display: none;">
                                            <label for="upload-stats-${i}" style="display: inline-block; padding: 8px 16px; background-color: #4299e1; color: white; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500; transition: background-color 0.2s;">
                                                Choose Stats File
                                            </label>
                                            <span id="upload-stats-${i}-name" style="margin-left: 12px; font-size: 14px; color: #666;">No file chosen</span>
                                        </div>
                                    </div>
                                `
                                  )
                                  .join("")}
                            </div>
                        `
                            : ""
                        }

                        <div id="upload-progress" style="display: none; margin: 20px 0;">
                            <div style="background: #e2e8f0; border-radius: 4px; height: 24px; overflow: hidden; position: relative;">
                                <div id="upload-progress-bar" style="background: #4299e1; height: 100%; width: 0%; transition: width 0.3s;"></div>
                                <div id="upload-progress-text" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; color: #2d3748;">
                                    0%
                                </div>
                            </div>
                            <p id="upload-status" style="margin: 8px 0 0 0; font-size: 14px; color: #666;"></p>
                        </div>

                        <div style="display: flex; gap: 12px; margin-top: 24px;">
                            <button id="upload-btn" style="flex: 1; padding: 12px 24px; background: #4299e1; color: white; border: none; border-radius: 4px; font-weight: 600; cursor: pointer; font-size: 16px;">
                                Upload Files
                            </button>
                            <button id="clear-storage-btn" style="padding: 12px 24px; background: #e53e3e; color: white; border: none; border-radius: 4px; font-weight: 600; cursor: pointer; font-size: 16px;">
                                Clear Storage
                            </button>
                        </div>

                        <p style="margin: 16px 0 0 0; font-size: 12px; color: #999; line-height: 1.5;">
                            Files are stored in your browser's IndexedDB. They persist across sessions and are only accessible on this device and browser.
                        </p>
                    </div>
                </div>
            </div>
        `;

    document.body.insertAdjacentHTML("beforeend", modalHTML);

    document.getElementById("upload-btn").addEventListener("click", () => this.handleUpload());
    document
      .getElementById("clear-storage-btn")
      .addEventListener("click", () => this.handleClearStorage());

    this.setupFileInputListeners();

    if (this.hasFileSystemAccess) {
      const autoUploadBtn = document.getElementById("auto-upload-btn");
      if (autoUploadBtn) {
        autoUploadBtn.addEventListener("click", () => this.handleAutoUpload());
      }
    }
  }

  /**
   * Setup event listeners for file inputs to update filename displays
   */
  setupFileInputListeners() {
    const fastaInput = document.getElementById("upload-fasta");
    const faiInput = document.getElementById("upload-fai");
    if (fastaInput) {
      fastaInput.addEventListener("change", (e) => {
        const span = document.getElementById("upload-fasta-name");
        if (span) span.textContent = e.target.files[0]?.name || "No file chosen";
      });
    }
    if (faiInput) {
      faiInput.addEventListener("change", (e) => {
        const span = document.getElementById("upload-fai-name");
        if (span) span.textContent = e.target.files[0]?.name || "No file chosen";
      });
    }

    (this.requiredFiles.vcf || []).forEach((vcfFile, i) => {
      const vcfInput = document.getElementById(`upload-vcf-${i}`);
      const tbiInput = document.getElementById(`upload-tbi-${i}`);
      const vcfUncompInput = document.getElementById(`upload-vcf-uncompressed-${i}`);

      if (vcfInput) {
        vcfInput.addEventListener("change", (e) => {
          const span = document.getElementById(`upload-vcf-${i}-name`);
          if (span) span.textContent = e.target.files[0]?.name || "No file chosen";
        });
      }
      if (tbiInput) {
        tbiInput.addEventListener("change", (e) => {
          const span = document.getElementById(`upload-tbi-${i}-name`);
          if (span) span.textContent = e.target.files[0]?.name || "No file chosen";
        });
      }
      if (vcfUncompInput) {
        vcfUncompInput.addEventListener("change", (e) => {
          const span = document.getElementById(`upload-vcf-uncompressed-${i}-name`);
          if (span) span.textContent = e.target.files[0]?.name || "No file chosen";
        });
      }
    });

    (this.requiredFiles.bam || []).forEach((bamFile, i) => {
      const bamInput = document.getElementById(`upload-bam-${i}`);
      const baiInput = document.getElementById(`upload-bai-${i}`);

      if (bamInput) {
        bamInput.addEventListener("change", (e) => {
          const span = document.getElementById(`upload-bam-${i}-name`);
          if (span) span.textContent = e.target.files[0]?.name || "No file chosen";
        });
      }
      if (baiInput) {
        baiInput.addEventListener("change", (e) => {
          const span = document.getElementById(`upload-bai-${i}-name`);
          if (span) span.textContent = e.target.files[0]?.name || "No file chosen";
        });
      }
    });

    (this.requiredFiles.stats || []).forEach((statsFile, i) => {
      const statsInput = document.getElementById(`upload-stats-${i}`);

      if (statsInput) {
        statsInput.addEventListener("change", (e) => {
          const span = document.getElementById(`upload-stats-${i}-name`);
          if (span) span.textContent = e.target.files[0]?.name || "No file chosen";
        });
      }
    });
  }

  /**
   * Handle file upload (collects files from inputs then uploads)
   */
  async handleUpload() {
    const uploadBtn = document.getElementById("upload-btn");
    const progressDiv = document.getElementById("upload-progress");

    uploadBtn.disabled = true;
    progressDiv.style.display = "block";

    try {
      const fileInputs = document.querySelectorAll('input[type="file"]');
      const filesToUpload = [];

      for (const input of fileInputs) {
        if (input.files && input.files[0]) {
          const file = input.files[0];
          const expectedName =
            input.dataset.filename || this.getExpectedFilename(input.id, file.name);
          filesToUpload.push({ file, name: expectedName });
        }
      }

      if (filesToUpload.length === 0) {
        alert("Please select files to upload");
        uploadBtn.disabled = false;
        progressDiv.style.display = "none";
        return;
      }

      await this.uploadFiles(filesToUpload);
    } catch (error) {
      logger.error("Upload error:", error);
      alert(`Upload failed: ${error.message}`);
      uploadBtn.disabled = false;
      progressDiv.style.display = "none";
    }
  }

  /**
   * Upload files to IndexedDB with progress tracking
   * Reusable for both manual and auto-upload
   */
  async uploadFiles(filesToUpload) {
    const progressBar = document.getElementById("upload-progress-bar");
    const progressText = document.getElementById("upload-progress-text");
    const statusText = document.getElementById("upload-status");

    const total = filesToUpload.length;
    const totalSize = filesToUpload.reduce((sum, f) => sum + f.file.size, 0);
    const startTime = Date.now();
    let uploadedSize = 0;

    for (let i = 0; i < total; i++) {
      const { file, name } = filesToUpload[i];

      statusText.textContent = `Uploading ${name} (${this.dbManager.formatBytes(file.size)})...`;

      const fileProgress = (i / total) * 100;
      progressBar.style.width = `${fileProgress}%`;
      progressText.textContent = `${i}/${total} files`;

      const onChunkProgress = (chunkIndex, totalChunks, bytesProcessed, totalBytes) => {
        const filesCompleted = i;
        const bytesFromCompletedFiles = uploadedSize;
        const currentFileBytesProcessed = bytesProcessed;
        const overallBytesProcessed = bytesFromCompletedFiles + currentFileBytesProcessed;
        const overallProgress = (overallBytesProcessed / totalSize) * 100;

        progressBar.style.width = `${overallProgress.toFixed(1)}%`;
        progressText.textContent = `${filesCompleted}/${total} files (${chunkIndex}/${totalChunks} chunks)`;

        if (totalChunks > 1) {
          statusText.textContent = `Uploading ${name} - chunk ${chunkIndex}/${totalChunks} (${this.dbManager.formatBytes(currentFileBytesProcessed)} / ${this.dbManager.formatBytes(totalBytes)})`;
        }
      };

      await this.dbManager.storeFile(name, file, {}, onChunkProgress);

      uploadedSize += file.size;
      const elapsedMs = Date.now() - startTime;
      const bytesPerMs = uploadedSize / elapsedMs;
      const remainingBytes = totalSize - uploadedSize;
      const estimatedRemainingMs = remainingBytes / bytesPerMs;

      const progress = ((i + 1) / total) * 100;
      progressBar.style.width = `${progress}%`;
      progressText.textContent = `${i + 1}/${total} files`;

      if (i < total - 1) {
        const remainingSec = Math.ceil(estimatedRemainingMs / 1000);
        statusText.textContent = `Uploaded ${name} • Est. ${remainingSec}s remaining`;
      }
    }

    if (window.REPORT_VERSION && window.REPORT_VERSION !== "None") {
      await this.dbManager.storeVersion(window.REPORT_VERSION);
      logger.info(`Stored report version: ${window.REPORT_VERSION}`);
    }

    statusText.textContent = "Upload complete!";
    progressBar.style.width = "100%";
    progressText.textContent = "100%";

    if (typeof window.updateCacheStatus === "function") {
      await window.updateCacheStatus();
    }

    if (typeof window.loadStatsFiles === "function") {
      logger.debug("Triggering stats files load after upload...");
      setTimeout(() => {
        window.loadStatsFiles().catch((err) => logger.warn("Could not load stats files:", err));
      }, 500);
    }

    setTimeout(() => {
      document.getElementById(this.modalId).style.display = "none";
      this.resolveUpload(true);
    }, 1000);
  }

  /**
   * Handle auto-upload from folder using File System Access API
   */
  async handleAutoUpload() {
    const autoUploadBtn = document.getElementById("auto-upload-btn");
    const statusText = document.getElementById("upload-status");
    const progressDiv = document.getElementById("upload-progress");
    const progressBar = progressDiv ? progressDiv.querySelector(".progress-bar") : null;
    const progressText = progressDiv ? progressDiv.querySelector(".progress-text") : null;

    try {
      autoUploadBtn.disabled = true;
      if (autoUploadBtn) autoUploadBtn.style.opacity = "0.5";
      if (statusText) statusText.textContent = "📁 Opening folder picker...";
      logger.debug("Requesting directory picker...");

      const dirHandle = await window.showDirectoryPicker({
        mode: "read",
        startIn: "downloads",
      });

      logger.info("Directory selected:", dirHandle.name);

      if (progressDiv) progressDiv.style.display = "block";
      if (progressBar) progressBar.style.width = "10%";
      if (progressText) progressText.textContent = "10%";
      if (statusText) statusText.textContent = `📂 Scanning "${dirHandle.name}" folder...`;

      const allFilesInDir = [];
      for await (const entry of dirHandle.values()) {
        if (entry.kind === "file") {
          allFilesInDir.push(entry.name);
        }
      }
      logger.debug("Files in selected folder:", allFilesInDir);

      if (progressBar) progressBar.style.width = "20%";
      if (progressText) progressText.textContent = "20%";
      if (statusText)
        statusText.textContent = `🔍 Found ${allFilesInDir.length} files, checking required files...`;

      const requiredFilenames = [
        this.requiredFiles.fasta,
        this.requiredFiles.fasta + ".fai",
        ...(this.requiredFiles.vcf || []),
        ...(this.requiredFiles.vcf || []).filter((f) => f.endsWith(".gz")).map((f) => f + ".tbi"),
        ...(this.requiredFiles.vcf || [])
          .filter((f) => f.endsWith(".gz"))
          .map((f) => f.replace(".gz", "")),
        ...(this.requiredFiles.bam || []),
        ...(this.requiredFiles.bam || []).map((f) => f + ".bai"),
        ...(this.requiredFiles.stats || []),
      ].filter(Boolean);

      logger.debug("Looking for these files:", requiredFilenames);

      // Search folder for all required files
      const foundFiles = [];
      const missingFiles = [];

      for (let i = 0; i < requiredFilenames.length; i++) {
        const filename = requiredFilenames[i];
        try {
          const fileHandle = await dirHandle.getFileHandle(filename);
          const file = await fileHandle.getFile();
          foundFiles.push({ file, name: filename });
          logger.debug(`Found: ${filename}`);

          const fileProgress = 20 + Math.floor(((i + 1) / requiredFilenames.length) * 20);
          if (progressBar) progressBar.style.width = `${fileProgress}%`;
          if (progressText) progressText.textContent = `${fileProgress}%`;
        } catch (e) {
          missingFiles.push(filename);
          logger.warn(`Missing: ${filename}`);
        }
      }

      // Validate all files found
      if (missingFiles.length > 0) {
        throw new Error(
          `Missing ${missingFiles.length} file(s) in selected folder:\n\n${missingFiles.join("\n")}\n\nPlease select the correct folder or use manual upload.`
        );
      }

      // Progress: 45% - all files validated
      if (progressBar) progressBar.style.width = "45%";
      if (progressText) progressText.textContent = "45%";

      // Display found files in UI
      if (statusText)
        statusText.innerHTML = `
                <div style="text-align: left;">
                    <strong>✅ Found all ${foundFiles.length} required files in "${dirHandle.name}":</strong>
                    <ul style="margin: 8px 0; padding-left: 20px; font-size: 13px;">
                        ${foundFiles
                          .map((f) => {
                            const sizeMB = (f.file.size / 1024 / 1024).toFixed(2);
                            const sizeKB = (f.file.size / 1024).toFixed(0);
                            const displaySize =
                              f.file.size > 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`;
                            return `<li>✓ ${f.name} <span style="color: #718096;">(${displaySize})</span></li>`;
                          })
                          .join("")}
                    </ul>
                    ${
                      allFilesInDir.length > foundFiles.length
                        ? `<div style="color: #718096; font-size: 12px; margin-top: 8px;">
                            📁 Folder contains ${allFilesInDir.length} total files, ${foundFiles.length} required
                        </div>`
                        : ""
                    }
                    <div style="margin-top: 12px; color: #667eea; font-weight: 600;">🚀 Preparing upload...</div>
                </div>
            `;

      // Auto-fill file inputs for visual confirmation
      this.autoFillFileInputs(foundFiles);

      // Wait a moment for user to see the file list
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Automatically trigger upload
      if (statusText) statusText.textContent = "Starting upload...";
      await this.uploadFiles(foundFiles);
    } catch (error) {
      logger.error("Auto-upload error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });

      // Reset button and progress
      if (autoUploadBtn) {
        autoUploadBtn.disabled = false;
        autoUploadBtn.style.opacity = "1";
      }
      if (progressDiv) progressDiv.style.display = "none";

      // User cancelled - no error needed
      if (error.name === "AbortError") {
        logger.debug("User cancelled folder selection");
        if (statusText)
          statusText.textContent =
            "Folder selection cancelled. You can try again or use manual upload below.";
        return;
      }

      // Show error and keep modal open for manual upload
      logger.error("Auto-upload failed:", error);
      if (statusText)
        statusText.innerHTML = `
                <div style="color: #e53e3e;">
                    <strong>❌ Auto-upload failed:</strong><br/>
                    ${error.message}
                </div>
                <div style="margin-top: 12px; color: #718096;">
                    You can try again or use manual upload below.
                </div>
            `;
      alert(`Auto-upload failed:\n\n${error.message}\n\nYou can still use manual upload below.`);
    }
  }

  /**
   * Auto-fill file inputs using DataTransfer API
   * Provides visual confirmation that files were found
   */
  autoFillFileInputs(foundFiles) {
    for (const { file, name } of foundFiles) {
      // Find the input field for this filename
      const input = this.findInputForFilename(name);
      if (input) {
        // Use DataTransfer to programmatically set file input
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        input.files = dataTransfer.files;
        logger.debug(`Auto-filled input for: ${name}`);
      }
    }
  }

  /**
   * Find the input element that should contain a specific filename
   */
  findInputForFilename(filename) {
    let input = document.querySelector(`input[type="file"][data-filename="${filename}"]`);
    if (input) return input;

    if (filename === this.requiredFiles.fasta) {
      return document.getElementById("upload-fasta");
    }
    if (filename === this.requiredFiles.fasta + ".fai") {
      return document.getElementById("upload-fai");
    }

    if (this.requiredFiles.vcf) {
      const vcfIndex = this.requiredFiles.vcf.indexOf(filename);
      if (vcfIndex !== -1) {
        return document.getElementById(`upload-vcf-${vcfIndex}`);
      }

      const tbiIndex = this.requiredFiles.vcf.findIndex((vcf) => vcf + ".tbi" === filename);
      if (tbiIndex !== -1) {
        return document.getElementById(`upload-tbi-${tbiIndex}`);
      }

      const uncompressedIndex = this.requiredFiles.vcf.findIndex(
        (vcf) => vcf.endsWith(".gz") && vcf.replace(".gz", "") === filename
      );
      if (uncompressedIndex !== -1) {
        return document.getElementById(`upload-vcf-uncompressed-${uncompressedIndex}`);
      }
    }

    if (this.requiredFiles.bam) {
      const bamIndex = this.requiredFiles.bam.indexOf(filename);
      if (bamIndex !== -1) {
        return document.getElementById(`upload-bam-${bamIndex}`);
      }

      const baiIndex = this.requiredFiles.bam.findIndex((bam) => bam + ".bai" === filename);
      if (baiIndex !== -1) {
        return document.getElementById(`upload-bai-${baiIndex}`);
      }
    }

    if (this.requiredFiles.stats) {
      const statsIndex = this.requiredFiles.stats.indexOf(filename);
      if (statsIndex !== -1) {
        return document.getElementById(`upload-stats-${statsIndex}`);
      }
    }

    return null;
  }

  /**
   * Handle clear storage
   */
  async handleClearStorage() {
    if (
      !confirm(
        "Are you sure you want to delete the entire database? You will need to re-upload all files."
      )
    ) {
      return;
    }

    try {
      await this.dbManager.deleteDatabase();
      alert("Database deleted successfully. The page will now reload.");
      // Reload the page to reinitialize everything
      location.reload();
    } catch (error) {
      logger.error("Delete database error:", error);
      alert(`Failed to delete database: ${error.message}`);
    }
  }

  /**
   * Get expected filename based on input ID and uploaded filename
   */
  getExpectedFilename(inputId, uploadedFilename) {
    if (inputId === "upload-fasta") {
      return this.requiredFiles.fasta;
    } else if (inputId === "upload-fai") {
      return this.requiredFiles.fasta + ".fai";
    }
    return uploadedFilename;
  }
}

export { FileUploadUI };
