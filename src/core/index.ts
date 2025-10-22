/**
 * Core processing components
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import sharp from 'sharp';
import { DEFAULT_CONFIG, ImageMetadata, OptimizationResult } from '../types';

// Export quality optimization components
export { ImageContentAnalyzer, DynamicQualityCalculator, QualityValidator } from './quality-optimizer';

// Export progress reporting components
export { ProgressReporter } from './progress-reporter';

/**
 * Format detection system for image files
 */
export class FormatDetector {
  private supportedFormats: string[];

  constructor(supportedFormats?: string[]) {
    this.supportedFormats = supportedFormats || DEFAULT_CONFIG.supportedFormats;
  }

  /**
   * Detect image format from file headers (magic bytes)
   * @param imagePath - Path to the image file
   * @returns Detected format or null if unsupported
   */
  async detectFormat(imagePath: string): Promise<string | null> {
    try {
      // Check if file exists
      const exists = await fs.pathExists(imagePath);
      if (!exists) {
        throw new Error(`File does not exist: ${imagePath}`);
      }

      // Read the first 12 bytes to identify format by magic bytes
      const buffer = Buffer.alloc(12);
      const fileDescriptor = await fs.open(imagePath, 'r');
      
      try {
        await fs.read(fileDescriptor, buffer, 0, 12, 0);
      } finally {
        await fs.close(fileDescriptor);
      }

      // Detect format based on magic bytes
      const format = this.identifyFormatFromBuffer(buffer);
      
      // Validate detected format against file extension as additional check
      const fileExtension = path.extname(imagePath).toLowerCase().replace('.', '');
      if (format && this.isFormatConsistentWithExtension(format, fileExtension)) {
        return format;
      }

      // If magic bytes detection fails, fall back to extension-based detection
      return this.detectFormatFromExtension(imagePath);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to detect format for ${imagePath}: ${error.message}`);
      }
      throw new Error(`Failed to detect format for ${imagePath}: Unknown error`);
    }
  }

  /**
   * Identify format from buffer magic bytes
   * @param buffer - Buffer containing file header bytes
   * @returns Detected format or null
   */
  private identifyFormatFromBuffer(buffer: Buffer): string | null {
    // JPEG magic bytes: FF D8 FF
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      return 'jpeg';
    }

    // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
        buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A) {
      return 'png';
    }

    // DNG/TIFF magic bytes: 49 49 2A 00 (little endian) or 4D 4D 00 2A (big endian)
    if ((buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2A && buffer[3] === 0x00) ||
        (buffer[0] === 0x4D && buffer[1] === 0x4D && buffer[2] === 0x00 && buffer[3] === 0x2A)) {
      return 'dng';
    }

    return null;
  }

  /**
   * Check if detected format is consistent with file extension
   * @param detectedFormat - Format detected from magic bytes
   * @param fileExtension - File extension (without dot)
   * @returns True if format and extension are consistent
   */
  private isFormatConsistentWithExtension(detectedFormat: string, fileExtension: string): boolean {
    const extensionMap: Record<string, string[]> = {
      'jpeg': ['jpg', 'jpeg'],
      'png': ['png'],
      'dng': ['dng', 'tiff', 'tif']
    };

    const validExtensions = extensionMap[detectedFormat.toLowerCase()];
    return validExtensions ? validExtensions.includes(fileExtension.toLowerCase()) : false;
  }

  /**
   * Detect format from file extension as fallback
   * @param imagePath - Path to the image file
   * @returns Detected format or null if unsupported
   */
  private detectFormatFromExtension(imagePath: string): string | null {
    const extension = path.extname(imagePath).toLowerCase().replace('.', '');
    
    // Map extensions to standard format names
    const extensionMap: Record<string, string> = {
      'jpg': 'jpeg',
      'jpeg': 'jpeg',
      'png': 'png',
      'dng': 'dng'
    };

    const format = extensionMap[extension];
    return format && this.supportedFormats.includes(format) ? format : null;
  }

  /**
   * Validate format compatibility with WebP conversion
   * @param format - Image format to validate
   * @returns True if format can be converted to WebP
   */
  validateWebPCompatibility(format: string): boolean {
    // All our supported formats can be converted to WebP using Sharp
    const webpCompatibleFormats = ['jpeg', 'png', 'dng'];
    return webpCompatibleFormats.includes(format.toLowerCase());
  }

  /**
   * Check if format is supported by the system
   * @param format - Format to check
   * @returns True if format is supported
   */
  isFormatSupported(format: string): boolean {
    return this.supportedFormats.includes(format.toLowerCase());
  }

  /**
   * Get list of supported formats
   * @returns Array of supported format names
   */
  getSupportedFormats(): string[] {
    return [...this.supportedFormats];
  }

  /**
   * Validate image file for processing
   * @param imagePath - Path to the image file
   * @returns Validation result with format and compatibility info
   */
  async validateImageFile(imagePath: string): Promise<{
    isValid: boolean;
    format: string | null;
    isWebPCompatible: boolean;
    errorMessage?: string;
  }> {
    try {
      const format = await this.detectFormat(imagePath);
      
      if (!format) {
        return {
          isValid: false,
          format: null,
          isWebPCompatible: false,
          errorMessage: 'Unsupported or unrecognized image format'
        };
      }

      const isSupported = this.isFormatSupported(format);
      const isWebPCompatible = this.validateWebPCompatibility(format);

      if (!isSupported) {
        return {
          isValid: false,
          format,
          isWebPCompatible,
          errorMessage: `Format ${format} is not supported`
        };
      }

      if (!isWebPCompatible) {
        return {
          isValid: false,
          format,
          isWebPCompatible,
          errorMessage: `Format ${format} cannot be converted to WebP`
        };
      }

      return {
        isValid: true,
        format,
        isWebPCompatible: true
      };
    } catch (error) {
      return {
        isValid: false,
        format: null,
        isWebPCompatible: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown validation error'
      };
    }
  }
}

/**
 * WebP conversion engine using Sharp library
 */
export class WebPConverter {
  private formatDetector: FormatDetector;

  constructor(formatDetector?: FormatDetector) {
    this.formatDetector = formatDetector || new FormatDetector();
  }

  /**
   * Convert image to WebP format with specified quality and web optimization constraints
   * @param inputPath - Path to source image
   * @param outputPath - Path for WebP output
   * @param quality - Quality setting (1-100)
   * @param maxWidth - Maximum width constraint (default: 1920px)
   * @param maxHeight - Maximum height constraint (default: 1080px)
   * @returns Promise resolving to optimization result
   */
  async convertToWebP(
    inputPath: string, 
    outputPath: string, 
    quality: number = 80,
    maxWidth: number = 1920,
    maxHeight: number = 1080
  ): Promise<OptimizationResult> {
    const startTime = Date.now();
    
    try {
      // Validate input file
      const validation = await this.formatDetector.validateImageFile(inputPath);
      if (!validation.isValid) {
        throw new Error(validation.errorMessage || 'Invalid image file');
      }

      // Get original file stats
      const originalStats = await fs.stat(inputPath);
      const originalSize = originalStats.size;

      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      await fs.ensureDir(outputDir);

      // Get image metadata for preprocessing decisions
      const metadata = await this.getImageMetadata(inputPath);

      // Apply format-specific preprocessing and convert to WebP
      const sharpInstance = await this.createSharpInstance(inputPath, validation.format!);
      let processedImage = await this.applyPreprocessing(sharpInstance, validation.format!, metadata);
      
      // Apply dimension constraints while preserving aspect ratio
      processedImage = await this.applyDimensionConstraints(processedImage, metadata, maxWidth, maxHeight);
      
      // Convert to WebP with enhanced settings for web optimization
      await processedImage
        .webp({ 
          quality: Math.round(quality),
          effort: 6,        // Higher effort for better compression
          lossless: false,  // Use lossy compression for smaller files
          nearLossless: false,
          smartSubsample: true,  // Better color subsampling
          preset: 'photo'   // Optimize for photographic content
        })
        .toFile(outputPath);

      // Get output file stats
      const outputStats = await fs.stat(outputPath);
      const optimizedSize = outputStats.size;
      const compressionRatio = ((originalSize - optimizedSize) / originalSize) * 100;
      const processingTime = Date.now() - startTime;

      return {
        originalPath: inputPath,
        optimizedPath: outputPath,
        originalSize,
        optimizedSize,
        compressionRatio,
        qualityScore: quality,
        processingTime,
        status: 'success'
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown conversion error';

      return {
        originalPath: inputPath,
        optimizedPath: outputPath,
        originalSize: 0,
        optimizedSize: 0,
        compressionRatio: 0,
        qualityScore: quality,
        processingTime,
        status: 'failed',
        errorMessage
      };
    }
  }

  /**
   * Create Sharp instance with error handling for corrupted files
   * @param inputPath - Path to source image
   * @param format - Detected image format
   * @returns Sharp instance
   */
  private async createSharpInstance(inputPath: string, format: string): Promise<sharp.Sharp> {
    try {
      const sharpInstance = sharp(inputPath);
      
      // Test if the image can be read by attempting to get metadata
      await sharpInstance.metadata();
      
      return sharpInstance;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Corrupted or unsupported image file: ${error.message}`);
      }
      throw new Error('Corrupted or unsupported image file');
    }
  }

  /**
   * Apply dimension constraints while preserving aspect ratio
   * @param sharpInstance - Sharp instance
   * @param metadata - Image metadata
   * @param maxWidth - Maximum allowed width
   * @param maxHeight - Maximum allowed height
   * @returns Sharp instance with dimension constraints applied
   */
  private async applyDimensionConstraints(
    sharpInstance: sharp.Sharp,
    metadata: ImageMetadata,
    maxWidth: number,
    maxHeight: number
  ): Promise<sharp.Sharp> {
    const { width, height } = metadata.dimensions;
    
    // Check if resizing is needed
    if (width <= maxWidth && height <= maxHeight) {
      return sharpInstance; // No resizing needed
    }

    // Calculate scaling factor to fit within constraints while preserving aspect ratio
    const widthScale = maxWidth / width;
    const heightScale = maxHeight / height;
    const scale = Math.min(widthScale, heightScale);

    // Calculate new dimensions
    const newWidth = Math.round(width * scale);
    const newHeight = Math.round(height * scale);

    console.log(`Resizing ${metadata.filename}: ${width}x${height} → ${newWidth}x${newHeight} (${(scale * 100).toFixed(1)}% scale)`);

    // Apply resize with high-quality settings
    return sharpInstance.resize(newWidth, newHeight, {
      kernel: sharp.kernel.lanczos3,  // High-quality resampling
      withoutEnlargement: true,       // Never enlarge images
      fastShrinkOnLoad: true          // Optimize for shrinking
    });
  }

  /**
   * Apply format-specific preprocessing before WebP conversion
   * @param sharpInstance - Sharp instance
   * @param format - Source image format
   * @param metadata - Image metadata
   * @returns Preprocessed Sharp instance
   */
  private async applyPreprocessing(
    sharpInstance: sharp.Sharp, 
    format: string, 
    metadata: ImageMetadata
  ): Promise<sharp.Sharp> {
    let processed = sharpInstance;

    switch (format.toLowerCase()) {
      case 'jpeg':
        // JPEG preprocessing: handle EXIF orientation and color space
        processed = processed
          .rotate() // Auto-rotate based on EXIF orientation
          .jpeg({ mozjpeg: true }); // Use mozjpeg for better quality
        break;

      case 'png':
        // PNG preprocessing: handle transparency and color depth
        processed = processed
          .png({ compressionLevel: 6, adaptiveFiltering: true });
        break;

      case 'dng':
        // DNG/RAW preprocessing: apply basic tone mapping and color correction
        processed = processed
          .gamma(2.2) // Apply standard gamma correction
          .normalize(); // Normalize contrast and brightness
        break;

      default:
        // Default preprocessing for unknown formats
        processed = processed.rotate(); // At minimum, handle orientation
        break;
    }

    // Apply web-optimized sharpening for better visual quality after compression
    const { width, height } = metadata.dimensions;
    if (width > 1000 || height > 1000) {
      // For larger images, apply subtle sharpening to maintain perceived quality
      processed = processed.sharpen({ 
        sigma: 0.8,   // Moderate sharpening
        m1: 1.0,      // Flat areas threshold
        m2: 2.0,      // Jagged areas threshold
        x1: 2.0,      // Flat areas multiplier
        y2: 10.0,     // Jagged areas multiplier
        y3: 20.0      // Highly jagged areas multiplier
      });
    }

    return processed;
  }

  /**
   * Get image metadata for preprocessing decisions
   * @param imagePath - Path to image file
   * @returns Image metadata
   */
  private async getImageMetadata(imagePath: string): Promise<ImageMetadata> {
    try {
      const sharpInstance = sharp(imagePath);
      const metadata = await sharpInstance.metadata();
      const stats = await fs.stat(imagePath);

      // Determine content type based on image characteristics
      const contentType = this.determineContentType(metadata);

      return {
        originalPath: imagePath,
        filename: path.basename(imagePath),
        format: metadata.format || 'unknown',
        dimensions: {
          width: metadata.width || 0,
          height: metadata.height || 0
        },
        fileSize: stats.size,
        contentType
      };
    } catch (error) {
      throw new Error(`Failed to get image metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Determine content type based on image characteristics
   * @param metadata - Sharp metadata object
   * @returns Content type classification
   */
  private determineContentType(metadata: sharp.Metadata): 'photo' | 'graphic' | 'mixed' {
    // Simple heuristic based on color depth and channels
    const channels = metadata.channels || 3;
    const density = metadata.density || 72;
    const hasAlpha = channels === 4;

    // Graphics typically have fewer colors, higher density, or alpha channel
    if (hasAlpha || density > 150) {
      return 'graphic';
    }

    // Photos typically have 3 channels and standard density
    if (channels === 3 && density <= 150) {
      return 'photo';
    }

    // Default to mixed for uncertain cases
    return 'mixed';
  }

  /**
   * Batch convert multiple images to WebP
   * @param inputPaths - Array of input image paths
   * @param outputDirectory - Directory for WebP outputs
   * @param quality - Quality setting for all images
   * @param concurrency - Number of concurrent conversions
   * @returns Promise resolving to array of optimization results
   */
  async batchConvertToWebP(
    inputPaths: string[], 
    outputDirectory: string, 
    quality: number = 80,
    concurrency: number = 4
  ): Promise<OptimizationResult[]> {
    const results: OptimizationResult[] = [];
    
    // Process images in batches to control memory usage
    for (let i = 0; i < inputPaths.length; i += concurrency) {
      const batch = inputPaths.slice(i, i + concurrency);
      
      const batchPromises = batch.map(async (inputPath) => {
        const filename = path.basename(inputPath, path.extname(inputPath)) + '.webp';
        const outputPath = path.join(outputDirectory, filename);
        
        return this.convertToWebP(inputPath, outputPath, quality);
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Check if WebP conversion is supported for given file
   * @param imagePath - Path to image file
   * @returns Promise resolving to boolean indicating support
   */
  async isConversionSupported(imagePath: string): Promise<boolean> {
    try {
      const validation = await this.formatDetector.validateImageFile(imagePath);
      return validation.isValid && validation.isWebPCompatible;
    } catch {
      return false;
    }
  }

  /**
   * Get estimated output size for WebP conversion
   * @param imagePath - Path to source image
   * @param quality - Target quality setting
   * @returns Promise resolving to estimated output size in bytes
   */
  async estimateOutputSize(imagePath: string, quality: number): Promise<number> {
    try {
      const originalStats = await fs.stat(imagePath);
      const originalSize = originalStats.size;

      // Rough estimation based on quality and format
      // WebP typically achieves 25-50% size reduction compared to JPEG
      // and 70-90% reduction compared to PNG
      const validation = await this.formatDetector.validateImageFile(imagePath);
      
      if (!validation.isValid || !validation.format) {
        return originalSize; // Return original size if can't process
      }

      let estimatedReduction: number;
      switch (validation.format.toLowerCase()) {
        case 'png':
          estimatedReduction = 0.8; // 80% reduction typical for PNG to WebP
          break;
        case 'jpeg':
          estimatedReduction = 0.35; // 35% reduction typical for JPEG to WebP
          break;
        case 'dng':
          estimatedReduction = 0.6; // 60% reduction typical for RAW to WebP
          break;
        default:
          estimatedReduction = 0.4; // Default 40% reduction
      }

      // Adjust based on quality setting
      const qualityFactor = quality / 100;
      const adjustedReduction = estimatedReduction * (1 - qualityFactor * 0.3);

      return Math.round(originalSize * (1 - adjustedReduction));
    } catch {
      // If estimation fails, return original size
      const stats = await fs.stat(imagePath);
      return stats.size;
    }
  }
}