/**
 * Type definitions for the Image Optimization System
 */

/**
 * Metadata information about an image file
 */
export interface ImageMetadata {
  originalPath: string;
  filename: string;
  format: string;
  dimensions: { width: number; height: number };
  fileSize: number;
  contentType: 'photo' | 'graphic' | 'mixed';
}

/**
 * Result of an image optimization operation
 */
export interface OptimizationResult {
  originalPath: string;
  optimizedPath: string;
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number;
  qualityScore: number;
  processingTime: number;
  status: 'success' | 'failed' | 'skipped';
  errorMessage?: string;
}

/**
 * Comprehensive report of a batch processing operation
 */
export interface ProcessingReport {
  totalImages: number;
  successfulConversions: number;
  failedConversions: number;
  totalSizeReduction: number;
  averageCompressionRatio: number;
  processingTime: number;
  results: OptimizationResult[];
}

/**
 * Validation utilities for data integrity
 */
export class DataValidator {
  /**
   * Validates ImageMetadata structure and values
   */
  static validateImageMetadata(metadata: ImageMetadata): boolean {
    if (!metadata.originalPath || typeof metadata.originalPath !== 'string') {
      return false;
    }
    if (!metadata.filename || typeof metadata.filename !== 'string') {
      return false;
    }
    if (!metadata.format || typeof metadata.format !== 'string') {
      return false;
    }
    if (!metadata.dimensions || 
        typeof metadata.dimensions.width !== 'number' || 
        typeof metadata.dimensions.height !== 'number' ||
        metadata.dimensions.width <= 0 || 
        metadata.dimensions.height <= 0) {
      return false;
    }
    if (typeof metadata.fileSize !== 'number' || metadata.fileSize <= 0) {
      return false;
    }
    if (!['photo', 'graphic', 'mixed'].includes(metadata.contentType)) {
      return false;
    }
    return true;
  }

  /**
   * Validates OptimizationResult structure and values
   */
  static validateOptimizationResult(result: OptimizationResult): boolean {
    if (!result.originalPath || typeof result.originalPath !== 'string') {
      return false;
    }
    if (!result.optimizedPath || typeof result.optimizedPath !== 'string') {
      return false;
    }
    if (typeof result.originalSize !== 'number' || result.originalSize <= 0) {
      return false;
    }
    if (typeof result.optimizedSize !== 'number' || result.optimizedSize <= 0) {
      return false;
    }
    if (typeof result.compressionRatio !== 'number' || result.compressionRatio < 0) {
      return false;
    }
    if (typeof result.qualityScore !== 'number' || result.qualityScore < 0 || result.qualityScore > 100) {
      return false;
    }
    if (typeof result.processingTime !== 'number' || result.processingTime < 0) {
      return false;
    }
    if (!['success', 'failed', 'skipped'].includes(result.status)) {
      return false;
    }
    return true;
  }

  /**
   * Validates ProcessingReport structure and values
   */
  static validateProcessingReport(report: ProcessingReport): boolean {
    if (typeof report.totalImages !== 'number' || report.totalImages < 0) {
      return false;
    }
    if (typeof report.successfulConversions !== 'number' || report.successfulConversions < 0) {
      return false;
    }
    if (typeof report.failedConversions !== 'number' || report.failedConversions < 0) {
      return false;
    }
    if (typeof report.totalSizeReduction !== 'number' || report.totalSizeReduction < 0) {
      return false;
    }
    if (typeof report.averageCompressionRatio !== 'number' || report.averageCompressionRatio < 0) {
      return false;
    }
    if (typeof report.processingTime !== 'number' || report.processingTime < 0) {
      return false;
    }
    if (!Array.isArray(report.results)) {
      return false;
    }
    // Validate that totals match results array
    if (report.totalImages !== report.results.length) {
      return false;
    }
    return true;
  }
}
/**

 * Configuration interface for quality settings and processing options
 */
export interface OptimizationConfig {
  quality: {
    photo: number;
    graphic: number;
    mixed: number;
    minimum: number;
  };
  dimensions: {
    maxWidth: number;
    maxHeight: number;
    preserveAspectRatio: boolean;
  };
  processing: {
    concurrency: number;
    enableProgressReporting: boolean;
    continueOnError: boolean;
  };
  output: {
    preserveFilenames: boolean;
    generateReport: boolean;
    reportFormat: 'json' | 'text';
  };
  supportedFormats: string[];
}

/**
 * Default configuration with enhanced web optimization settings
 * Maximized visual quality with strict adherence to format & dimension rules
 */
export const DEFAULT_CONFIG: OptimizationConfig = {
  quality: {
    photo: 88,        // Enhanced quality for photographs - no perceivable artifacts
    graphic: 85,      // High quality for graphics/screenshots - preserve sharp edges
    mixed: 86,        // Balanced quality for mixed content
    minimum: 78       // Higher minimum threshold for web optimization
  },
  dimensions: {
    maxWidth: 1920,               // Maximum width constraint (Full HD)
    maxHeight: 1080,              // Maximum height constraint (Full HD)
    preserveAspectRatio: true     // Always maintain original aspect ratio
  },
  processing: {
    concurrency: 4,                    // Process 4 images concurrently
    enableProgressReporting: true,     // Show progress during batch operations
    continueOnError: true              // Continue processing if individual images fail
  },
  output: {
    preserveFilenames: true,           // Maintain original filename structure
    generateReport: true,              // Create optimization summary report
    reportFormat: 'json'               // Default report format
  },
  supportedFormats: ['jpg', 'jpeg', 'png', 'dng']  // Supported input formats
};

/**
 * Configuration management utilities
 */
export class ConfigManager {
  private config: OptimizationConfig;

  constructor(customConfig?: Partial<OptimizationConfig>) {
    this.config = this.mergeConfig(DEFAULT_CONFIG, customConfig);
  }

  /**
   * Get current configuration
   */
  getConfig(): OptimizationConfig {
    return { ...this.config };
  }

  /**
   * Get quality setting for specific content type
   */
  getQualityForContentType(contentType: 'photo' | 'graphic' | 'mixed'): number {
    return this.config.quality[contentType];
  }

  /**
   * Check if format is supported
   */
  isFormatSupported(format: string): boolean {
    return this.config.supportedFormats.includes(format.toLowerCase());
  }

  /**
   * Get processing concurrency limit
   */
  getConcurrency(): number {
    return this.config.processing.concurrency;
  }

  /**
   * Check if progress reporting is enabled
   */
  isProgressReportingEnabled(): boolean {
    return this.config.processing.enableProgressReporting;
  }

  /**
   * Check if processing should continue on individual errors
   */
  shouldContinueOnError(): boolean {
    return this.config.processing.continueOnError;
  }

  /**
   * Get maximum width constraint
   */
  getMaxWidth(): number {
    return this.config.dimensions.maxWidth;
  }

  /**
   * Get maximum height constraint
   */
  getMaxHeight(): number {
    return this.config.dimensions.maxHeight;
  }

  /**
   * Check if aspect ratio should be preserved
   */
  shouldPreserveAspectRatio(): boolean {
    return this.config.dimensions.preserveAspectRatio;
  }

  /**
   * Update configuration with new values
   */
  updateConfig(updates: Partial<OptimizationConfig>): void {
    this.config = this.mergeConfig(this.config, updates);
    this.validateConfig();
  }

  /**
   * Merge configuration objects with deep merge for nested objects
   */
  private mergeConfig(base: OptimizationConfig, updates?: Partial<OptimizationConfig>): OptimizationConfig {
    if (!updates) return base;

    return {
      quality: { ...base.quality, ...updates.quality },
      dimensions: { ...base.dimensions, ...updates.dimensions },
      processing: { ...base.processing, ...updates.processing },
      output: { ...base.output, ...updates.output },
      supportedFormats: updates.supportedFormats || base.supportedFormats
    };
  }

  /**
   * Validate configuration values
   */
  private validateConfig(): void {
    const { quality, processing } = this.config;

    // Validate quality settings
    if (quality.photo < quality.minimum || quality.photo > 100) {
      throw new Error(`Photo quality must be between ${quality.minimum} and 100`);
    }
    if (quality.graphic < quality.minimum || quality.graphic > 100) {
      throw new Error(`Graphic quality must be between ${quality.minimum} and 100`);
    }
    if (quality.mixed < quality.minimum || quality.mixed > 100) {
      throw new Error(`Mixed quality must be between ${quality.minimum} and 100`);
    }
    if (quality.minimum < 1 || quality.minimum > 100) {
      throw new Error('Minimum quality must be between 1 and 100');
    }

    // Validate processing settings
    if (processing.concurrency < 1) {
      throw new Error('Concurrency must be at least 1');
    }
  }
}