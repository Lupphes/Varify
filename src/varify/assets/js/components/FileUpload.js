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
   * Generate version warning HTML
   */
  getVersionWarningHTML(versionMismatch, reason) {
    if (!versionMismatch) return "";

    if (reason === "no-stored-version") {
      return `
        <div style="background: #fffaf0; border-left: 4px solid #f6ad55; padding: 12px 16px; margin-bottom: 20px; border-radius: 4px;">
          <p style="margin: 0 0 8px 0; font-weight: 600; color: #c05621; font-size: 14px;">⚠️ Version Check Recommended</p>
          <p style="margin: 0; font-size: 13px; color: #7c2d12; line-height: 1.6;">
            Cached files detected without version information. To ensure you're viewing the latest data, please clear cache and re-upload files from the <code style="background: #fff; padding: 2px 6px; border-radius: 3px;">genome_files/</code> folder.
          </p>
        </div>
      `;
    }

    return `
      <div style="background: #fff5f5; border-left: 4px solid #fc8181; padding: 12px 16px; margin-bottom: 20px; border-radius: 4px;">
        <p style="margin: 0 0 8px 0; font-weight: 600; color: #c53030; font-size: 14px;">⚠️ Report Data Updated</p>
        <p style="margin: 0; font-size: 13px; color: #742a2a; line-height: 1.6;">
          The genome files have been updated since your last visit. Please clear the cache and re-upload the files to see the latest data.
        </p>
      </div>
    `;
  }

  /**
   * Generate auto-upload section HTML
   */
  getAutoUploadSectionHTML() {
    if (!this.hasFileSystemAccess) return "";

    return `
      <div id="auto-upload-section" style="text-align: center; padding: 48px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; box-shadow: 0 8px 32px rgba(102, 126, 234, 0.25); margin-bottom: 24px;">
        <div style="font-size: 64px; margin-bottom: 20px; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.1));">📁</div>
        <h3 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 700; color: white;">Quick Upload</h3>
        <p style="margin: 0 0 32px 0; color: rgba(255,255,255,0.9); font-size: 15px; line-height: 1.8; max-width: 400px; margin-left: auto; margin-right: auto;">
          Select the <strong style="color: white;">genome_files</strong> folder and all required files will be uploaded automatically
        </p>
        <button id="auto-upload-btn" style="padding: 16px 40px; background: white; color: #667eea;
                border: none; border-radius: 10px; font-size: 17px; font-weight: 700; cursor: pointer;
                transition: all 0.2s; display: inline-flex; align-items: center; justify-content: center; gap: 12px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);"
                onmouseover="this.style.transform='translateY(-3px) scale(1.02)'; this.style.boxShadow='0 8px 30px rgba(0,0,0,0.25)';"
                onmouseout="this.style.transform='translateY(0) scale(1)'; this.style.boxShadow='0 4px 20px rgba(0,0,0,0.15)';">
          <svg style="width: 22px; height: 22px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path>
          </svg>
          Select Folder
        </button>
        <div style="margin-top: 28px; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.2);">
          <button onclick="document.getElementById('upload-form').style.display='flex'; document.getElementById('auto-upload-section').style.display='none';"
                  style="background: rgba(255,255,255,0.15); border: 2px solid white; color: white; padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s;"
                  onmouseover="this.style.background='rgba(255,255,255,0.25)'; this.style.transform='scale(1.05)';"
                  onmouseout="this.style.background='rgba(255,255,255,0.15)'; this.style.transform='scale(1)';">
            Upload Files Manually
          </button>
        </div>
        <div style="margin-top: 20px;">
          <button id="auto-clear-storage-btn" style="background: none; border: none; color: rgba(255,255,255,0.8); font-size: 13px; cursor: pointer; text-decoration: underline; padding: 8px;"
                  onmouseover="this.style.color='white';"
                  onmouseout="this.style.color='rgba(255,255,255,0.8)';">
            Clear Storage
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Generate back to folder upload button HTML
   */
  getBackButtonHTML() {
    if (!this.hasFileSystemAccess) return "";

    return `
      <div style="margin-bottom: 32px; text-align: center; padding-bottom: 24px; border-bottom: 2px solid #e2e8f0;">
        <button onclick="document.getElementById('auto-upload-section').style.display='block'; document.getElementById('upload-form').style.display='none';"
                style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; color: white; padding: 12px 28px; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 10px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3); transition: all 0.2s;"
                onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 25px rgba(102, 126, 234, 0.4)';"
                onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(102, 126, 234, 0.3)';">
          <svg style="width: 18px; height: 18px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
          </svg>
          Back to Quick Upload
        </button>
      </div>
    `;
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

    const modalHTML = `
            <div id="${this.modalId}" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); z-index: 100000; justify-content: center; align-items: center; padding: 20px;" onclick="if(event.target.id === '${this.modalId}' && ${filesExist}) { this.style.display = 'none'; }">
                <div style="background: white; border-radius: 12px; padding: 40px; max-width: 1200px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 10px 40px rgba(0,0,0,0.3);" onclick="event.stopPropagation();">
                    <h2 style="margin: 0 0 16px 0; font-size: 24px; color: #333;">Upload Genome Files</h2>
                    <p style="margin: 0 0 12px 0; color: #666; line-height: 1.5;">
                        To use the IGV genome browser, please upload the required genome data files.
                        These files will be stored in your browser for future use (no re-upload needed).
                    </p>

                    ${this.getVersionWarningHTML(versionMismatch, reason)}

                    <div style="background: #edf2f7; border-left: 4px solid #48bb78; padding: 12px 16px; margin-bottom: 20px; border-radius: 4px;">
                        <p style="margin: 0 0 8px 0; font-weight: 600; color: #2d3748; font-size: 14px;">📁 Files are located in the same directory as this HTML report:</p>
                        <p style="margin: 0; font-size: 13px; color: #4a5568; line-height: 1.6;">
                            Look for a folder named <code style="background: #fff; padding: 2px 6px; border-radius: 3px; font-weight: 600;">genome_files/</code> next to the report
                        </p>
                    </div>

                    ${this.getAutoUploadSectionHTML()}

                    <!-- Unified Progress Indicator (outside both sections) -->
                    <div id="upload-progress" style="display: none; margin: 20px 0; padding: 32px 24px; text-align: center;">
                        <div style="font-size: 24px; font-weight: 600; color: #1a202c; margin-bottom: 20px;">
                            <span id="upload-status-main">Processing...</span>
                        </div>
                        <div style="background: #e2e8f0; border-radius: 12px; height: 40px; overflow: hidden; position: relative; margin-bottom: 16px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);">
                            <div id="upload-progress-bar" style="background: linear-gradient(90deg, #667eea 0%, #764ba2 100%); height: 100%; width: 0%; transition: width 0.3s ease;"></div>
                            <div id="upload-progress-text" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; color: #1a202c;">
                                0%
                            </div>
                        </div>
                        <div style="font-size: 14px; color: #718096; line-height: 1.8;">
                            <span id="upload-status-subtitle">Preparing...</span>
                        </div>
                    </div>

                    <div id="upload-form" style="display: ${this.hasFileSystemAccess ? "none" : "flex"}; flex-direction: column;">
                        ${this.getBackButtonHTML()}

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                            <div class="upload-section" style="padding: 24px; background: #f9fafb; border-radius: 8px; border: 1px solid #d1d5db;">
                                <label style="display: block; font-weight: 600; margin-bottom: 8px; color: #374151; font-size: 15px;">
                                    Reference Genome (FASTA) <span style="color: #dc2626;">*</span>
                                </label>
                                <p style="margin: 0 0 16px 0; font-size: 13px; color: #6b7280;">
                                    <strong>${this.requiredFiles.fasta}</strong>
                                </p>

                                <div style="margin-bottom: 12px;">
                                    <input type="file" id="upload-fasta" accept=".fna,.fa,.fasta" style="display: none;">
                                    <label for="upload-fasta" style="display: inline-block; padding: 8px 16px; background: #3b82f6; color: white; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; transition: background 0.2s;"
                                           onmouseover="this.style.background='#2563eb';"
                                           onmouseout="this.style.background='#3b82f6';">
                                        FASTA File
                                    </label>
                                    <div id="upload-fasta-name" style="margin-top: 8px; font-size: 13px; color: #6b7280; font-style: italic;">No file selected</div>
                                </div>

                                <div style="margin-bottom: 0;">
                                    <input type="file" id="upload-fai" accept=".fai" style="display: none;">
                                    <label for="upload-fai" style="display: inline-block; padding: 8px 16px; background: #3b82f6; color: white; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; transition: background 0.2s;"
                                           onmouseover="this.style.background='#2563eb';"
                                           onmouseout="this.style.background='#3b82f6';">
                                        FAI Index
                                    </label>
                                    <div id="upload-fai-name" style="margin-top: 8px; font-size: 13px; color: #6b7280; font-style: italic;">No file selected</div>
                                </div>
                            </div>

                        ${(this.requiredFiles.vcf || [])
                          .map(
                            (vcfFile, i) => `
                            <div class="upload-section" style="padding: 24px; background: #f9fafb; border-radius: 8px; border: 1px solid #d1d5db;">
                                <label style="display: block; font-weight: 600; margin-bottom: 8px; color: #374151; font-size: 15px;">
                                    VCF File ${i + 1} <span style="color: #dc2626;">*</span>
                                </label>
                                <p style="margin: 0 0 16px 0; font-size: 13px; color: #6b7280;">
                                    <strong>${vcfFile}</strong>
                                </p>

                                <div style="margin-bottom: 12px;">
                                    <input type="file" id="upload-vcf-${i}" accept=".vcf,.vcf.gz" data-filename="${vcfFile}" style="display: none;">
                                    <label for="upload-vcf-${i}" style="display: inline-block; padding: 8px 16px; background: #8b5cf6; color: white; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; transition: background 0.2s;"
                                           onmouseover="this.style.background='#7c3aed';"
                                           onmouseout="this.style.background='#8b5cf6';">
                                        VCF File
                                    </label>
                                    <div id="upload-vcf-${i}-name" style="margin-top: 8px; font-size: 13px; color: #6b7280; font-style: italic;">No file selected</div>
                                </div>

                                ${
                                  vcfFile.endsWith(".gz")
                                    ? `
                                    <div style="margin-bottom: 12px;">
                                        <input type="file" id="upload-tbi-${i}" accept=".tbi" data-filename="${vcfFile}.tbi" style="display: none;">
                                        <label for="upload-tbi-${i}" style="display: inline-block; padding: 8px 16px; background: #8b5cf6; color: white; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; transition: background 0.2s;"
                                               onmouseover="this.style.background='#7c3aed';"
                                               onmouseout="this.style.background='#8b5cf6';">
                                            TBI Index
                                        </label>
                                        <div id="upload-tbi-${i}-name" style="margin-top: 8px; font-size: 13px; color: #6b7280; font-style: italic;">No file selected</div>
                                    </div>

                                    <div style="margin-bottom: 0;">
                                        <input type="file" id="upload-vcf-uncompressed-${i}" accept=".vcf" data-filename="${vcfFile.replace(".gz", "")}" style="display: none;">
                                        <label for="upload-vcf-uncompressed-${i}" style="display: inline-block; padding: 8px 16px; background: #8b5cf6; color: white; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; transition: background 0.2s;"
                                               onmouseover="this.style.background='#7c3aed';"
                                               onmouseout="this.style.background='#8b5cf6';">
                                            Uncompressed VCF
                                        </label>
                                        <div id="upload-vcf-uncompressed-${i}-name" style="margin-top: 8px; font-size: 13px; color: #6b7280; font-style: italic;">No file selected</div>
                                    </div>
                                `
                                    : ""
                                }
                            </div>
                        `
                          )
                          .join("")}
                        </div>

                        ${
                          (this.requiredFiles.bam || []).length > 0
                            ? `
                            <div style="background: #f9fafb; border-radius: 8px; padding: 24px; margin-bottom: 20px; border: 1px solid #d1d5db;">
                                <h3 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #374151;">
                                    BAM Files (Optional)
                                </h3>
                                ${(this.requiredFiles.bam || [])
                                  .map(
                                    (bamFile, i) => `
                                    <div style="background: white; border-radius: 6px; padding: 16px; margin-bottom: 12px; border: 1px solid #e5e7eb;">
                                        <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #374151;">
                                            ${bamFile}
                                        </p>

                                        <div style="margin-bottom: 10px;">
                                            <input type="file" id="upload-bam-${i}" accept=".bam" data-filename="${bamFile}" style="display: none;">
                                            <label for="upload-bam-${i}" style="display: inline-block; padding: 8px 16px; background: #10b981; color: white; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; transition: background 0.2s;"
                                                   onmouseover="this.style.background='#059669';"
                                                   onmouseout="this.style.background='#10b981';">
                                                BAM File
                                            </label>
                                            <span id="upload-bam-${i}-name" style="display: block; margin-top: 8px; font-size: 13px; color: #6b7280; font-style: italic;">No file chosen</span>
                                        </div>

                                        <div style="margin-bottom: 0;">
                                            <input type="file" id="upload-bai-${i}" accept=".bai" data-filename="${bamFile}.bai" style="display: none;">
                                            <label for="upload-bai-${i}" style="display: inline-block; padding: 8px 16px; background: #10b981; color: white; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; transition: background 0.2s;"
                                                   onmouseover="this.style.background='#059669';"
                                                   onmouseout="this.style.background='#10b981';">
                                                BAI Index
                                            </label>
                                            <span id="upload-bai-${i}-name" style="display: block; margin-top: 8px; font-size: 13px; color: #6b7280; font-style: italic;">No file chosen</span>
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
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                                <div style="background: #f9fafb; border-radius: 8px; padding: 24px; border: 1px solid #d1d5db;">
                                    <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #374151;">
                                        BCF Statistics (Optional)
                                    </h3>
                                    <p style="margin: 0 0 16px 0; font-size: 13px; color: #6b7280;">
                                        Stats files will be parsed and displayed in the report
                                    </p>
                                    ${(this.requiredFiles.stats || [])
                                      .filter((_, i) => i === 0)
                                      .map(
                                        (statsFile, i) => `
                                        <div style="margin-bottom: 12px;">
                                            <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #374151;">
                                                ${statsFile}
                                            </p>
                                            <input type="file" id="upload-stats-${i}" accept=".txt,.stats" data-filename="${statsFile}" style="display: none;">
                                            <label for="upload-stats-${i}" style="display: inline-block; padding: 8px 16px; background: #f59e0b; color: white; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; transition: background 0.2s;"
                                                   onmouseover="this.style.background='#d97706';"
                                                   onmouseout="this.style.background='#f59e0b';">
                                                Stats File
                                            </label>
                                            <span id="upload-stats-${i}-name" style="display: block; margin-top: 8px; font-size: 13px; color: #6b7280; font-style: italic;">No file chosen</span>
                                        </div>
                                    `
                                      )
                                      .join("")}
                                </div>

                                ${
                                  (this.requiredFiles.stats || []).length > 1
                                    ? `
                                    <div style="background: #f9fafb; border-radius: 8px; padding: 24px; border: 1px solid #d1d5db;">
                                        <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #374151;">
                                            SURVIVOR Statistics (Optional)
                                        </h3>
                                        <p style="margin: 0 0 16px 0; font-size: 13px; color: #6b7280;">
                                            Stats files will be parsed and displayed in the report
                                        </p>
                                        ${(this.requiredFiles.stats || [])
                                          .filter((_, i) => i === 1)
                                          .map(
                                            (statsFile, i) => `
                                            <div style="margin-bottom: 12px;">
                                                <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #374151;">
                                                    ${statsFile}
                                                </p>
                                                <input type="file" id="upload-stats-${i + 1}" accept=".txt,.stats" data-filename="${statsFile}" style="display: none;">
                                                <label for="upload-stats-${i + 1}" style="display: inline-block; padding: 8px 16px; background: #f59e0b; color: white; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; transition: background 0.2s;"
                                                       onmouseover="this.style.background='#d97706';"
                                                       onmouseout="this.style.background='#f59e0b';">
                                                    Stats File
                                                </label>
                                                <span id="upload-stats-${i + 1}-name" style="display: block; margin-top: 8px; font-size: 13px; color: #6b7280; font-style: italic;">No file chosen</span>
                                            </div>
                                        `
                                          )
                                          .join("")}
                                    </div>
                                `
                                    : ""
                                }
                            </div>
                        `
                            : ""
                        }

                        <div style="display: flex; gap: 12px; margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                            <button id="upload-btn" style="flex: 1; padding: 12px 24px; background: #10b981; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 15px; transition: background 0.2s;"
                                    onmouseover="this.style.background='#059669';"
                                    onmouseout="this.style.background='#10b981';">
                                Upload Files
                            </button>
                            <button id="manual-clear-storage-btn" style="padding: 12px 24px; background: #ef4444; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 15px; transition: background 0.2s;"
                                    onmouseover="this.style.background='#dc2626';"
                                    onmouseout="this.style.background='#ef4444';">
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

    const manualClearBtn = document.getElementById("manual-clear-storage-btn");
    if (manualClearBtn) {
      manualClearBtn.addEventListener("click", () => this.handleClearStorage());
    }

    this.setupFileInputListeners();

    if (this.hasFileSystemAccess) {
      const autoUploadBtn = document.getElementById("auto-upload-btn");
      if (autoUploadBtn) {
        autoUploadBtn.addEventListener("click", () => this.handleAutoUpload());
      }

      const autoClearBtn = document.getElementById("auto-clear-storage-btn");
      if (autoClearBtn) {
        autoClearBtn.addEventListener("click", () => this.handleClearStorage());
      }
    }
  }

  /**
   * Update unified progress indicator (used by both auto-upload and manual upload)
   * @param {string} mainStatus - Main status message (large text)
   * @param {string} subtitle - Subtitle with details (small text)
   * @param {number} percent - Progress percentage (0-100)
   */
  updateProgress(mainStatus, subtitle = "", percent = 0) {
    const progressDiv = document.getElementById("upload-progress");
    const mainStatusEl = document.getElementById("upload-status-main");
    const subtitleEl = document.getElementById("upload-status-subtitle");
    const progressBar = document.getElementById("upload-progress-bar");
    const progressText = document.getElementById("upload-progress-text");

    if (progressDiv) progressDiv.style.display = "block";
    if (mainStatusEl) mainStatusEl.textContent = mainStatus;
    if (subtitleEl) subtitleEl.textContent = subtitle;
    if (progressBar) progressBar.style.width = `${percent}%`;
    if (progressText) progressText.textContent = `${Math.round(percent)}%`;
  }

  /**
   * Hide progress indicator
   */
  hideProgress() {
    const progressDiv = document.getElementById("upload-progress");
    if (progressDiv) progressDiv.style.display = "none";
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

    uploadBtn.disabled = true;
    this.updateProgress("Preparing upload...", "Collecting selected files", 0);

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
        this.hideProgress();
        return;
      }

      await this.uploadFiles(filesToUpload);
    } catch (error) {
      logger.error("Upload error:", error);
      alert(`Upload failed: ${error.message}`);
      uploadBtn.disabled = false;
      this.hideProgress();
    }
  }

  /**
   * Upload files to IndexedDB with progress tracking
   * Reusable for both manual and auto-upload
   */
  async uploadFiles(filesToUpload) {
    const total = filesToUpload.length;
    const totalSize = filesToUpload.reduce((sum, f) => sum + f.file.size, 0);
    const startTime = Date.now();
    let uploadedSize = 0;

    for (let i = 0; i < total; i++) {
      const { file, name } = filesToUpload[i];

      this.updateProgress(
        `Uploading ${name}`,
        `File ${i + 1} of ${total} • ${this.dbManager.formatBytes(file.size)}`,
        (i / total) * 100
      );

      const onChunkProgress = (chunkIndex, totalChunks, bytesProcessed, totalBytes) => {
        const filesCompleted = i;
        const bytesFromCompletedFiles = uploadedSize;
        const currentFileBytesProcessed = bytesProcessed;
        const overallBytesProcessed = bytesFromCompletedFiles + currentFileBytesProcessed;
        const overallProgress = (overallBytesProcessed / totalSize) * 100;

        const subtitle =
          totalChunks > 1
            ? `Chunk ${chunkIndex}/${totalChunks} • ${this.dbManager.formatBytes(currentFileBytesProcessed)} / ${this.dbManager.formatBytes(totalBytes)}`
            : `File ${i + 1} of ${total} • ${this.dbManager.formatBytes(file.size)}`;

        this.updateProgress(`Uploading ${name}`, subtitle, overallProgress);
      };

      await this.dbManager.storeFile(name, file, {}, onChunkProgress);

      uploadedSize += file.size;
      const elapsedMs = Date.now() - startTime;
      const bytesPerMs = uploadedSize / elapsedMs;
      const remainingBytes = totalSize - uploadedSize;
      const estimatedRemainingMs = remainingBytes / bytesPerMs;

      const progress = ((i + 1) / total) * 100;

      if (i < total - 1) {
        const remainingSec = Math.ceil(estimatedRemainingMs / 1000);
        this.updateProgress(
          `Uploaded ${name}`,
          `${i + 1} of ${total} files complete • ~${remainingSec}s remaining`,
          progress
        );
      }
    }

    if (window.REPORT_VERSION && window.REPORT_VERSION !== "None") {
      await this.dbManager.storeVersion(window.REPORT_VERSION);
      logger.info(`Stored report version: ${window.REPORT_VERSION}`);
    }

    this.updateProgress("Upload complete!", `All ${total} files uploaded successfully`, 100);

    if (typeof window.updateCacheStatus === "function") {
      await window.updateCacheStatus();
    }

    if (typeof window.loadStatsFiles === "function") {
      logger.debug("Triggering stats files load after upload...");
      setTimeout(() => {
        window.loadStatsFiles().catch((err) => logger.warn("Could not load stats files:", err));
      }, 500);
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
    document.getElementById(this.modalId).style.display = "none";
    this.resolveUpload(true);
  }

  /**
   * Handle auto-upload from folder using File System Access API
   */
  async handleAutoUpload() {
    const autoUploadBtn = document.getElementById("auto-upload-btn");
    const autoUploadSection = document.getElementById("auto-upload-section");
    const uploadFormSection = document.getElementById("upload-form");

    try {
      autoUploadBtn.disabled = true;
      if (autoUploadBtn) autoUploadBtn.style.opacity = "0.5";

      logger.debug("Requesting directory picker...");

      const dirHandle = await window.showDirectoryPicker({
        mode: "read",
        startIn: "downloads",
      });

      if (autoUploadSection) autoUploadSection.style.display = "none";
      if (uploadFormSection) uploadFormSection.style.display = "none";

      logger.info("Directory selected:", dirHandle.name);
      this.updateProgress("Scanning folder...", `Reading contents of "${dirHandle.name}"`, 10);

      const allFilesInDir = [];
      for await (const entry of dirHandle.values()) {
        if (entry.kind === "file") {
          allFilesInDir.push(entry.name);
        }
      }
      logger.debug("Files in selected folder:", allFilesInDir);

      this.updateProgress(
        "Validating files...",
        `Found ${allFilesInDir.length} files • Checking required files`,
        20
      );

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
          this.updateProgress(
            "Validating files...",
            `Checking ${i + 1}/${requiredFilenames.length} files • Found: ${filename}`,
            fileProgress
          );
        } catch (e) {
          missingFiles.push(filename);
          logger.warn(`Missing: ${filename}`);
        }
      }

      if (missingFiles.length > 0) {
        throw new Error(
          `Missing ${missingFiles.length} file(s) in selected folder:\n\n${missingFiles.join("\n")}\n\nPlease select the correct folder or use manual upload.`
        );
      }

      const totalSize = foundFiles.reduce((sum, f) => sum + f.file.size, 0);
      const fileList = foundFiles
        .map((f) => {
          const sizeMB = (f.file.size / 1024 / 1024).toFixed(2);
          const sizeKB = (f.file.size / 1024).toFixed(0);
          const displaySize = f.file.size > 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`;
          return `${f.name} (${displaySize})`;
        })
        .join(", ");

      this.updateProgress(
        "Files validated!",
        `Found all ${foundFiles.length} required files • Total: ${this.dbManager.formatBytes(totalSize)}`,
        45
      );

      this.autoFillFileInputs(foundFiles);

      await new Promise((resolve) => setTimeout(resolve, 800));

      this.updateProgress("Starting upload...", `Uploading ${foundFiles.length} files`, 50);
      await this.uploadFiles(foundFiles);
    } catch (error) {
      logger.error("Auto-upload error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });

      // Reset UI
      if (autoUploadBtn) {
        autoUploadBtn.disabled = false;
        autoUploadBtn.style.opacity = "1";
      }

      // User cancelled - show selection UI again
      if (error.name === "AbortError") {
        logger.debug("User cancelled folder selection");
        this.hideProgress();
        if (autoUploadSection) autoUploadSection.style.display = "block";
        return;
      }

      // Show error
      logger.error("Auto-upload failed:", error);
      this.updateProgress(
        "Upload failed",
        error.message.split("\n")[0],
        0
      );

      // Show selection UI again after delay
      setTimeout(() => {
        this.hideProgress();
        if (autoUploadSection) autoUploadSection.style.display = "block";
      }, 3000);

      alert(`Auto-upload failed:\n\n${error.message}\n\nYou can try again or use manual upload.`);
    }
  }

  /**
   * Auto-fill file inputs using DataTransfer API
   * Provides visual confirmation that files were found
   */
  autoFillFileInputs(foundFiles) {
    for (const { file, name } of foundFiles) {
      const input = this.findInputForFilename(name);
      if (input) {
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
