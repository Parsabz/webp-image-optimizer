/**
 * Batch processing engine for image optimization
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { EventEmitter } from 'events';
import { 
  OptimizationResult, 
  ProcessingReport, 
  OptimizationConfig, 
  DEFAULT_CONFIG,
  ConfigManager 
} from '../types';
import { FileManager } from '../utils';
import { FormatDetector, WebPConverter } from './index';
import { ImageContentAnalyzer, DynamicQualityCalculator, QualityValidator } from './quality-optimizer';
import { ProgressReporter, ProgressReporterConfig } from './progress-reporter';

/**
 * Progress event data for batch processing
 */
export interface ProgressEvent {
  current: number;
  total: number;
  percentage: number;
  currentFile: string;
  status: 'processing' | 'completed' | 'failed' | 'skipped';
  result?: OptimizationResult;
}

/**
 * Batch processing options
 */
export interface BatchProcessingOptions {
  sourceDirectory: string;
  outputDirectory: string;
  config?: Partial<OptimizationConfig>;
  progressConfig?: Partial<ProgressReporterConfig>;
  onProgress?: (progress: ProgressEvent) => void;
  onError?: (error: Error, file: string) => void;
}

/**
 * Main processing orchestrator that coordinates the entire optimization workflow
 */
export class BatchProcessor extends EventEmitter {
  private configManager: ConfigManager;
  private fileManager: FileManager;
  private formatDetector: FormatDetector;
  private webpConverter: WebPConverter;
  private contentAnalyzer: ImageContentAnalyzer;
  private qualityCalculator: DynamicQualityCalculator;
  private qualityValidator: QualityValidator;
  private progressReporter: ProgressReporter;

  constructor(config?: Partial<OptimizationConfig>) {
    super();
    
    this.configManager = new ConfigManager(config);
    const currentConfig = this.configManager.getConfig();
    
    this.fileManager = new FileManager(currentConfig.supportedFormats);
    this.formatDetector = new FormatDetector(currentConfig.supportedFormats);
    this.webpConverter = new WebPConverter(this.formatDetector);
    this.contentAnalyzer = new ImageContentAnalyzer();
    this.qualityCalculator = new DynamicQualityCalculator(currentConfig.quality.minimum);
    this.qualityValidator = new QualityValidator(currentConfig.quality.minimum);
    this.progressReporter = new ProgressReporter();
  }

  /**
   * Process all images in a directory with batch optimization
   * @param options - Batch processing configuration
   * @returns Promise resolving to processing report
   */
  async processDirectory(options: BatchProcessingOptions): Promise<ProcessingReport> {
    const startTime = Date.now();
    
    try {
      // Validate input parameters
      await this.validateProcessingOptions(options);
      
      // Scan source directory for images
      const imageFiles = await this.fileManager.scanDirectory(options.sourceDirectory);
      
      if (imageFiles.length === 0) {
        throw new Error(`No supported image files found in ${options.sourceDirectory}`);
      }

      // Create output directory
      await this.fileManager.createOutputDirectory(options.outputDirectory);

      // Initialize progress tracking
      const totalFiles = imageFiles.length;
      let processedFiles = 0;
      const results: OptimizationResult[] = [];

      // Configure and start progress reporter
      if (options.progressConfig) {
        this.progressReporter.updateConfig(options.progressConfig);
      }
      this.progressReporter.start(totalFiles, options.sourceDirectory);

      // Emit start event
      this.emit('start', { totalFiles, sourceDirectory: options.sourceDirectory });

      // Process images with parallel processing and error resilience
      const concurrency = this.configManager.getConcurrency();
      await this.processImagesInParallel(
        imageFiles, 
        options.outputDirectory, 
        concurrency,
        (result, index) => {
          results.push(result);
          processedFiles++;

          const filename = path.basename(imageFiles[index]);
          
          // Update progress reporter
          this.progressReporter.updateProgress(result, filename);

          // Emit progress event
          const progressEvent: ProgressEvent = {
            current: processedFiles,
            total: totalFiles,
            percentage: Math.round((processedFiles / totalFiles) * 100),
            currentFile: filename,
            status: result.status === 'success' ? 'completed' : result.status === 'failed' ? 'failed' : 'skipped',
            result
          };

          this.emit('progress', progressEvent);
          
          // Call progress callback if provided
          if (options.onProgress) {
            options.onProgress(progressEvent);
          }
        },
        (error, imagePath) => {
          // Report error to progress reporter
          this.progressReporter.reportError(error, path.basename(imagePath));
          
          // Emit error event
          this.emit('error', error, imagePath);
          
          // Call error callback if provided
          if (options.onError) {
            options.onError(error, imagePath);
          }
        }
      );

      // Complete progress reporting and get final report
      const report = this.progressReporter.complete();

      // Save filename mapping if configured
      if (this.configManager.getConfig().output.generateReport) {
        await this.saveProcessingArtifacts(imageFiles, options.outputDirectory, report);
      }

      // Emit completion event
      this.emit('complete', report);

      return report;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown batch processing error';
      
      // Emit error event
      this.emit('error', new Error(errorMessage));
      
      throw new Error(`Batch processing failed: ${errorMessage}`);
    }
  }

  /**
   * Process a single image through the optimization pipeline
   * @param imagePath - Path to the image file
   * @param outputDirectory - Directory for optimized output
   * @returns Promise resolving to optimization result
   */
  async processImage(imagePath: string, outputDirectory: string): Promise<OptimizationResult> {
    try {
      // Validate image file
      const validation = await this.formatDetector.validateImageFile(imagePath);
      if (!validation.isValid) {
        return {
          originalPath: imagePath,
          optimizedPath: '',
          originalSize: 0,
          optimizedSize: 0,
          compressionRatio: 0,
          qualityScore: 0,
          processingTime: 0,
          status: 'skipped',
          errorMessage: validation.errorMessage || 'Invalid image file'
        };
      }

      // Analyze image content for optimal quality settings
      const qualityResult = await this.qualityCalculator.calculateOptimalQuality(imagePath);
      const optimalQuality = qualityResult.quality;

      // Generate output path
      const outputPath = this.fileManager.generateWebPOutputPath(imagePath, outputDirectory);

      // Convert to WebP with dimension constraints for web optimization
      const config = this.configManager.getConfig();
      const result = await this.webpConverter.convertToWebP(
        imagePath, 
        outputPath, 
        optimalQuality, 
        config.dimensions.maxWidth, 
        config.dimensions.maxHeight
      );

      // Validate output quality if conversion was successful
      if (result.status === 'success') {
        const qualityValidation = await this.qualityValidator.validateOutputQuality(imagePath, outputPath, optimalQuality);
        if (!qualityValidation.isValid) {
          // If quality validation fails, mark as failed but keep the file
          result.status = 'failed';
          result.errorMessage = `Quality validation failed: ${qualityValidation.issues.join(', ')}`;
        }
      }

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown processing error';
      return {
        originalPath: imagePath,
        optimizedPath: '',
        originalSize: 0,
        optimizedSize: 0,
        compressionRatio: 0,
        qualityScore: 0,
        processingTime: 0,
        status: 'failed',
        errorMessage
      };
    }
  }

  /**
   * Validate batch processing options
   * @param options - Processing options to validate
   */
  private async validateProcessingOptions(options: BatchProcessingOptions): Promise<void> {
    // Check source directory exists
    const sourceExists = await fs.pathExists(options.sourceDirectory);
    if (!sourceExists) {
      throw new Error(`Source directory does not exist: ${options.sourceDirectory}`);
    }

    const sourceStats = await fs.stat(options.sourceDirectory);
    if (!sourceStats.isDirectory()) {
      throw new Error(`Source path is not a directory: ${options.sourceDirectory}`);
    }

    // Check if output directory is safe to use
    const isOutputSafe = await this.fileManager.isOutputDirectorySafe(options.outputDirectory);
    if (!isOutputSafe) {
      throw new Error(`Output directory contains files that might be overwritten: ${options.outputDirectory}`);
    }
  }

  /**
   * Generate comprehensive processing report
   * @param results - Array of optimization results
   * @param processingTime - Total processing time in milliseconds
   * @returns Processing report
   */
  private generateProcessingReport(results: OptimizationResult[], processingTime: number): ProcessingReport {
    const successfulResults = results.filter(r => r.status === 'success');
    const failedResults = results.filter(r => r.status === 'failed');
    
    const totalSizeReduction = successfulResults.reduce((sum, result) => {
      return sum + (result.originalSize - result.optimizedSize);
    }, 0);

    const averageCompressionRatio = successfulResults.length > 0 
      ? successfulResults.reduce((sum, result) => sum + result.compressionRatio, 0) / successfulResults.length
      : 0;

    return {
      totalImages: results.length,
      successfulConversions: successfulResults.length,
      failedConversions: failedResults.length,
      totalSizeReduction,
      averageCompressionRatio,
      processingTime,
      results
    };
  }

  /**
   * Save processing artifacts (mapping and report)
   * @param originalFiles - Array of original file paths
   * @param outputDirectory - Output directory path
   * @param report - Processing report
   */
  private async saveProcessingArtifacts(
    originalFiles: string[], 
    outputDirectory: string, 
    report: ProcessingReport
  ): Promise<void> {
    try {
      // Save filename mapping
      const mapping = this.fileManager.generateFilenameMapping(originalFiles, outputDirectory);
      await this.fileManager.saveFilenameMapping(mapping, outputDirectory);

      // Save processing report
      const reportPath = path.join(outputDirectory, 'optimization-report.json');
      const reportData = {
        generatedAt: new Date().toISOString(),
        summary: {
          totalImages: report.totalImages,
          successfulConversions: report.successfulConversions,
          failedConversions: report.failedConversions,
          totalSizeReduction: report.totalSizeReduction,
          averageCompressionRatio: Math.round(report.averageCompressionRatio * 100) / 100,
          processingTimeSeconds: Math.round(report.processingTime / 1000 * 100) / 100
        },
        results: report.results
      };

      await fs.writeJson(reportPath, reportData, { spaces: 2 });

    } catch (error) {
      // Don't fail the entire process if artifact saving fails
      console.warn('Warning: Failed to save processing artifacts:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Process images in parallel with configurable concurrency and error resilience
   * @param imageFiles - Array of image file paths
   * @param outputDirectory - Output directory path
   * @param concurrency - Maximum number of concurrent operations
   * @param onResult - Callback for each completed result
   * @param onError - Callback for each error
   */
  private async processImagesInParallel(
    imageFiles: string[],
    outputDirectory: string,
    concurrency: number,
    onResult: (result: OptimizationResult, index: number) => void,
    onError: (error: Error, imagePath: string) => void
  ): Promise<void> {
    // Create a semaphore to limit concurrent operations
    const semaphore = new Semaphore(concurrency);
    
    // Create promises for all image processing tasks
    const processingPromises = imageFiles.map(async (imagePath, index) => {
      // Acquire semaphore permit
      await semaphore.acquire();
      
      try {
        const result = await this.processImage(imagePath, outputDirectory);
        onResult(result, index);
        
        // If individual processing fails and we shouldn't continue on error, propagate the error
        if (result.status === 'failed' && !this.configManager.shouldContinueOnError()) {
          throw new Error(result.errorMessage || 'Image processing failed');
        }
        
      } catch (error) {
        const processError = error instanceof Error ? error : new Error('Unknown processing error');
        
        // Create failed result for tracking
        const failedResult: OptimizationResult = {
          originalPath: imagePath,
          optimizedPath: '',
          originalSize: 0,
          optimizedSize: 0,
          compressionRatio: 0,
          qualityScore: 0,
          processingTime: 0,
          status: 'failed',
          errorMessage: processError.message
        };
        
        onResult(failedResult, index);
        onError(processError, imagePath);
        
        // If configured to not continue on error, propagate the error
        if (!this.configManager.shouldContinueOnError()) {
          throw processError;
        }
        
      } finally {
        // Always release the semaphore permit
        semaphore.release();
      }
    });

    // Wait for all processing to complete
    // Use Promise.allSettled to ensure all promises complete even if some fail
    const results = await Promise.allSettled(processingPromises);
    
    // Check if any promises were rejected and we should stop on error
    if (!this.configManager.shouldContinueOnError()) {
      const rejectedPromises = results.filter(result => result.status === 'rejected');
      if (rejectedPromises.length > 0) {
        const firstError = (rejectedPromises[0] as PromiseRejectedResult).reason;
        throw firstError instanceof Error ? firstError : new Error('Parallel processing failed');
      }
    }
  }

  /**
   * Get current configuration
   * @returns Current optimization configuration
   */
  getConfig(): OptimizationConfig {
    return this.configManager.getConfig();
  }

  /**
   * Update configuration
   * @param updates - Configuration updates
   */
  updateConfig(updates: Partial<OptimizationConfig>): void {
    this.configManager.updateConfig(updates);
  }
}

/**
 * Semaphore implementation for controlling concurrent operations
 */
class Semaphore {
  private permits: number;
  private waitQueue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  /**
   * Acquire a permit, waiting if necessary
   */
  async acquire(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (this.permits > 0) {
        this.permits--;
        resolve();
      } else {
        this.waitQueue.push(resolve);
      }
    });
  }

  /**
   * Release a permit, potentially unblocking waiting operations
   */
  release(): void {
    this.permits++;
    
    if (this.waitQueue.length > 0) {
      const nextResolve = this.waitQueue.shift();
      if (nextResolve) {
        this.permits--;
        nextResolve();
      }
    }
  }

  /**
   * Get current number of available permits
   */
  availablePermits(): number {
    return this.permits;
  }

  /**
   * Get number of operations waiting for permits
   */
  getQueueLength(): number {
    return this.waitQueue.length;
  }
}