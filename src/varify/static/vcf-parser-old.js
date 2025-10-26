/**
 * VCF Parser for Browser
 *
 * Parses VCF files from IndexedDB and extracts variant data for tables
 */

class VCFParser {
    constructor() {
        this.variants = [];
        this.header = {
            meta: [],      // All ## header lines for VCF export
            columns: ''    // #CHROM header line
        };
    }

    /**
     * Parse VCF file from ArrayBuffer
     * @param {ArrayBuffer} arrayBuffer - VCF file data
     * @param {number} maxVariants - Maximum variants to parse (optional)
     * @returns {Array} - Array of variant objects
     */
    async parseVCF(arrayBuffer, maxVariants = 10000) {
        // Convert ArrayBuffer to text
        const decoder = new TextDecoder('utf-8');
        const text = decoder.decode(arrayBuffer);

        const lines = text.split('\n');
        const variants = [];
        const headers = { info: {}, format: {}, samples: [] };

        // Reset header storage
        this.header = { meta: [], columns: '' };

        // Parse headers and variants
        for (let i = 0; i < lines.length && variants.length < maxVariants; i++) {
            const line = lines[i].trim();

            if (!line) continue;

            // Store ALL header lines starting with ##
            if (line.startsWith('##')) {
                this.header.meta.push(line);
                this.parseHeaderLine(line, headers);
            }
            // Store column header line
            else if (line.startsWith('#CHROM')) {
                this.header.columns = line;
                headers.samples = line.split('\t').slice(9);
            }
            // Parse variant lines
            else {
                const variant = this.parseVariantLine(line, headers);
                if (variant) {
                    variants.push(variant);
                }
            }
        }

        this.variants = variants;
        return variants;
    }

    /**
     * Parse header line (##INFO, ##FORMAT, etc.)
     */
    parseHeaderLine(line, headers) {
        if (line.startsWith('##INFO=')) {
            const match = line.match(/ID=([^,]+)/);
            if (match) {
                headers.info[match[1]] = true;
            }
        } else if (line.startsWith('##FORMAT=')) {
            const match = line.match(/ID=([^,]+)/);
            if (match) {
                headers.format[match[1]] = true;
            }
        }
    }

    /**
     * Parse a single variant line
     */
    parseVariantLine(line, headers) {
        const fields = line.split('\t');
        if (fields.length < 8) return null;

        const [chrom, pos, id, ref, alt, qual, filter, info] = fields;

        // Parse INFO field (returns both parsed object and raw string)
        const infoParsed = this.parseINFO(info);

        // Calculate locus for IGV
        let locus;
        if (infoParsed.parsed.END) {
            locus = `${chrom}:${pos}-${infoParsed.parsed.END}`;
        } else {
            const start = Math.max(1, parseInt(pos) - 1000);
            const end = parseInt(pos) + 1000;
            locus = `${chrom}:${start}-${end}`;
        }

        const variant = {
            chr: chrom,
            pos: parseInt(pos),
            id: id !== '.' ? id : `var_${pos}`,
            ref: ref,
            alt: alt,
            qual: qual !== '.' ? parseFloat(qual) : null,
            filter: filter,
            info: infoParsed.parsed,   // Parsed INFO object
            rawInfo: infoParsed.raw,   // Original INFO string for VCF export
            locus: locus
        };

        // Parse genotypes if present
        if (fields.length > 9 && headers.samples.length > 0) {
            const format = fields[8].split(':');
            variant.genotypes = {};

            for (let i = 0; i < headers.samples.length; i++) {
                const sample = headers.samples[i];
                const values = fields[9 + i].split(':');
                variant.genotypes[sample] = {};

                format.forEach((key, idx) => {
                    variant.genotypes[sample][key] = values[idx] || '.';
                });
            }
        }

        return variant;
    }

    /**
     * Parse INFO field into object
     * Returns both parsed object and raw string for VCF export
     */
    parseINFO(infoStr) {
        const parsed = {};
        if (!infoStr || infoStr === '.') {
            return { parsed: {}, raw: infoStr || '.' };
        }

        const pairs = infoStr.split(';');
        for (const pair of pairs) {
            const [key, value] = pair.split('=');
            if (value !== undefined) {
                // Try to parse as number
                const num = parseFloat(value);
                parsed[key] = isNaN(num) ? value : num;
            } else {
                // Flag field (no value)
                parsed[key] = true;
            }
        }

        return {
            parsed: parsed,
            raw: infoStr
        };
    }

    /**
     * Parse compressed VCF (.vcf.gz) file
     * Requires pako library for gzip decompression
     * Handles both regular gzip and BGZF (Blocked GNU Zip Format)
     */
    async parseCompressedVCF(arrayBuffer, maxVariants = 10000) {
        // Check if pako is available
        if (typeof pako === 'undefined') {
            throw new Error('Pako library required for compressed VCF files. Include: https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js');
        }

        try {
            const uint8Array = new Uint8Array(arrayBuffer);

            // Check if this is a BGZF file (has BGZF extra field)
            // BGZF files may have multiple gzip blocks concatenated
            const isBGZF = uint8Array[0] === 0x1f && uint8Array[1] === 0x8b;

            let decompressed;

            if (isBGZF) {
                // BGZF: decompress with concatenation support
                try {
                    decompressed = pako.inflate(uint8Array);
                } catch (e) {
                    // Try ungzip instead for BGZF
                    console.log('pako.inflate failed, trying pako.ungzip for BGZF...');
                    decompressed = pako.ungzip(uint8Array);
                }
            } else {
                // Regular gzip
                decompressed = pako.inflate(uint8Array);
            }

            // Create a new ArrayBuffer from the decompressed data
            const decompressedBuffer = decompressed.buffer.slice(
                decompressed.byteOffset,
                decompressed.byteOffset + decompressed.byteLength
            );

            // Parse decompressed VCF
            return await this.parseVCF(decompressedBuffer, maxVariants);
        } catch (error) {
            console.error('Error decompressing VCF:', error.message);
            console.error('Error details:', error);
            throw new Error(`Failed to decompress VCF file: ${error.message}`);
        }
    }

    /**
     * Filter variants by criteria
     */
    filterVariants(criteria = {}) {
        let filtered = [...this.variants];

        if (criteria.minQual) {
            filtered = filtered.filter(v => v.qual !== null && v.qual >= criteria.minQual);
        }

        if (criteria.chr) {
            filtered = filtered.filter(v => v.chr === criteria.chr);
        }

        if (criteria.svtype) {
            filtered = filtered.filter(v => v.info.SVTYPE === criteria.svtype);
        }

        if (criteria.filter === 'PASS') {
            filtered = filtered.filter(v => v.filter === 'PASS' || v.filter === '.');
        }

        return filtered;
    }

    /**
     * Get summary statistics
     */
    getSummary() {
        const summary = {
            totalVariants: this.variants.length,
            chromosomes: new Set(),
            svTypes: {},
            qualityStats: { min: Infinity, max: -Infinity, avg: 0 }
        };

        let qualSum = 0;
        let qualCount = 0;

        for (const variant of this.variants) {
            summary.chromosomes.add(variant.chr);

            if (variant.info.SVTYPE) {
                summary.svTypes[variant.info.SVTYPE] = (summary.svTypes[variant.info.SVTYPE] || 0) + 1;
            }

            if (variant.qual !== null) {
                qualSum += variant.qual;
                qualCount++;
                summary.qualityStats.min = Math.min(summary.qualityStats.min, variant.qual);
                summary.qualityStats.max = Math.max(summary.qualityStats.max, variant.qual);
            }
        }

        summary.chromosomes = Array.from(summary.chromosomes).sort();
        summary.qualityStats.avg = qualCount > 0 ? qualSum / qualCount : 0;

        return summary;
    }

    /**
     * Analyze all fields in variants to determine filter types
     * Returns metadata about each field for dynamic filter generation
     */
    analyzeFields(variants) {
        const fieldStats = {};

        // Collect all unique INFO field names
        const allInfoKeys = new Set();
        variants.forEach(v => {
            Object.keys(v.info).forEach(k => allInfoKeys.add(k));
        });

        // Analyze standard VCF fields
        const analyzeField = (fieldName, values) => {
            const uniqueValues = [...new Set(values.filter(v => v !== null && v !== undefined && v !== '.' && v !== ''))];
            const isNumeric = values.every(v => v === null || v === undefined || typeof v === 'number');
            const isBoolean = values.every(v => v === null || v === undefined || typeof v === 'boolean' || v === true);
            const isList = values.some(v => typeof v === 'string' && v.includes(','));

            const stats = {
                type: isBoolean ? 'boolean' :
                      isNumeric ? 'numeric' :
                      isList ? 'list' :
                      uniqueValues.length <= 100 ? 'categorical' : 'text',
                uniqueValues: uniqueValues.length <= 100 ? uniqueValues.sort() : [],
                count: uniqueValues.length
            };

            if (isNumeric && uniqueValues.length > 0) {
                const numericValues = values.filter(v => typeof v === 'number');
                stats.min = Math.min(...numericValues);
                stats.max = Math.max(...numericValues);
            }

            return stats;
        };

        // Analyze standard fields
        fieldStats['CHROM'] = analyzeField('CHROM', variants.map(v => v.chr));
        fieldStats['FILTER'] = analyzeField('FILTER', variants.map(v => v.filter));

        // Analyze all INFO fields
        for (const key of allInfoKeys) {
            const values = variants.map(v => v.info[key]);
            fieldStats[key] = analyzeField(key, values);
        }

        return fieldStats;
    }
}

// Global instance
const vcfParser = new VCFParser();
