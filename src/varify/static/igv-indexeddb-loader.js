/**
 * IGV.js IndexedDB File Loader
 *
 * Custom data loader for IGV.js that loads genome files from IndexedDB instead of HTTP.
 * Supports FASTA, VCF, BAM, and their index files (.fai, .tbi, .bai).
 */

class IGVIndexedDBLoader {
    constructor(dbManager) {
        this.dbManager = dbManager;
        this.fileCache = new Map(); // Cache ArrayBuffers to avoid repeated IndexedDB reads
    }

    /**
     * Create a File object from IndexedDB data
     * IGV.js expects File or Blob objects
     */
    async loadFile(filename) {
        // Check cache first
        if (this.fileCache.has(filename)) {
            console.log(`Using cached file: ${filename}`);
            return this.fileCache.get(filename);
        }

        // Load from IndexedDB
        const arrayBuffer = await this.dbManager.getFile(filename);
        if (!arrayBuffer) {
            throw new Error(`File not found in IndexedDB: ${filename}`);
        }

        // Create a File object (IGV.js prefers File over Blob)
        const blob = new Blob([arrayBuffer]);
        const file = new File([blob], filename, {
            type: this.getMimeType(filename)
        });

        // Cache for future use
        this.fileCache.set(filename, file);

        console.log(`Loaded file from IndexedDB: ${filename} (${this.dbManager.formatBytes(arrayBuffer.byteLength)})`);
        return file;
    }

    /**
     * Get MIME type based on file extension
     */
    getMimeType(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const mimeTypes = {
            'fna': 'text/plain',
            'fa': 'text/plain',
            'fasta': 'text/plain',
            'fai': 'text/plain',
            'vcf': 'text/plain',
            'gz': 'application/gzip',
            'bam': 'application/octet-stream',
            'bai': 'application/octet-stream',
            'tbi': 'application/octet-stream',
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }

    /**
     * Extract filename from a URL or path
     * IGV.js may pass full URLs or relative paths
     */
    extractFilename(urlOrPath) {
        // Handle various formats:
        // - "GCF_000146045.fna"
        // - "../data/GCF_000146045.fna"
        // - "file:///path/to/GCF_000146045.fna"
        // - Blob URLs (skip)

        if (urlOrPath.startsWith('blob:') || urlOrPath.startsWith('data:')) {
            return null; // Don't intercept blob/data URLs
        }

        // Extract just the filename
        const parts = urlOrPath.split('/');
        return parts[parts.length - 1];
    }

    /**
     * Check if all required files are in IndexedDB
     */
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

    /**
     * Clear the file cache
     */
    clearCache() {
        this.fileCache.clear();
        console.log('Cleared file cache');
    }

    /**
     * Create IGV.js configuration with IndexedDB loader
     * This returns a config object that IGV.js can use
     */
    async createIGVConfig(options = {}) {
        const {
            fastaFile,
            vcfFiles = [],
            bamFiles = [],
            locus = null,
        } = options;

        // Check if files exist
        const requiredFiles = [
            fastaFile,
            fastaFile + '.fai',
            ...vcfFiles,
            ...vcfFiles.map(f => f + '.tbi').filter(f => !f.endsWith('.vcf.tbi')), // Only for .vcf.gz
            ...bamFiles,
            ...bamFiles.map(f => f + '.bai'),
        ].filter(Boolean);

        const missing = await this.checkRequiredFiles(requiredFiles);
        if (missing.length > 0) {
            throw new Error(`Missing files in IndexedDB: ${missing.join(', ')}`);
        }

        // Load reference genome
        const fastaFileObj = await this.loadFile(fastaFile);
        const faiFileObj = await this.loadFile(fastaFile + '.fai');

        const config = {
            reference: {
                id: fastaFile.replace(/\.(fna|fa|fasta)$/, ''),
                name: fastaFile,
                fastaURL: fastaFileObj,
                indexURL: faiFileObj,
            },
            tracks: []
        };

        // Add VCF tracks
        for (const vcfFile of vcfFiles) {
            const vcfFileObj = await this.loadFile(vcfFile);
            const track = {
                type: 'variant',
                format: 'vcf',
                url: vcfFileObj,
                name: vcfFile,
                displayMode: 'EXPANDED',
            };

            // Add index if it's a compressed VCF
            if (vcfFile.endsWith('.vcf.gz')) {
                const tbiFile = vcfFile + '.tbi';
                if (await this.dbManager.hasFile(tbiFile)) {
                    track.indexURL = await this.loadFile(tbiFile);
                }
            }

            config.tracks.push(track);
        }

        // Add BAM tracks
        for (const bamFile of bamFiles) {
            const bamFileObj = await this.loadFile(bamFile);
            const baiFile = bamFile + '.bai';

            const track = {
                type: 'alignment',
                format: 'bam',
                url: bamFileObj,
                name: bamFile,
                displayMode: 'SQUISHED',
            };

            if (await this.dbManager.hasFile(baiFile)) {
                track.indexURL = await this.loadFile(baiFile);
            }

            config.tracks.push(track);
        }

        // Set initial locus if provided
        if (locus) {
            config.locus = locus;
        }

        return config;
    }
}

// Create global instance
const igvLoader = new IGVIndexedDBLoader(genomeDBManager);
