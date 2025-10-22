/**
 * Progress reporting system for batch image processing operations
 */

import { EventEmitter } from 'events';
import { OptimizationResult, ProcessingReport } from '../types';

/**
 * Detailed progress information
 */
export interface DetailedProgress {
  // Current state
  current: number;
  total: number;
  percentage: number;
  
  // Current operation
  currentFile: string;
  currentStatus: 'processing' | 'completed' | 'failed' | 'skipped';
  
  // Timing information
  startTime: number;
  elapsedTime: number;
  estimatedTimeRemaining: number;
  averageProcessingTime: number;
  
  // Statistics
  successCount: number;
  failureCount: number;
  skippedCount: number;
  
  // Size information
  totalOriginalSize: number;
  totalOptimizedSize: number;
  totalSizeReduction: number;
  averageCompressionRatio: number;
  
  // Current result
  currentResult?: OptimizationResult;
}

/**
 * Progress reporting configuration
 */
export interface ProgressReporterConfig {
  enableConsoleOutput: boolean;
  enableDetailedStats: boolean;
  updateInterval: number; // milliseconds
  showFileNames: boolean;
  showSizeReduction: boolean;
  showTimeEstimates: boolean;
}

/**
 * Default progress reporter configuration
 */
export const DEFAULT_PROGRESS_CONFIG: ProgressReporterConfig = {
  enableConsoleOutput: true,
  enableDetailedStats: true,
  updateInterval: 100, // Update every 100ms
  showFileNames: true,
  showSizeReduction: true,
  showTimeEstimates: true
};

/**
 * Comprehensive progress reporting system for batch operations
 */
export class ProgressReporter extends EventEmitter {
  private config: ProgressReporterConfig;
  private startTime: number = 0;
  private lastUpdateTime: number = 0;
  private processedFiles: number = 0;
  private totalFiles: number = 0;
  private results: OptimizationResult[] = [];
  private processingTimes: number[] = [];
  private isActive: boolean = false;

  constructor(config?: Partial<ProgressReporterConfig>) {
    super();
    this.config = { ...DEFAULT_PROGRESS_CONFIG, ...config };
  }

  /**
   * Start progress tracking for a batch operation
   * @param totalFiles - Total number of files to process
   * @param sourceDirectory - Source directory being processed
   */
  start(totalFiles: number, sourceDirectory: string): void {
    this.startTime = Date.now();
    this.lastUpdateTime = this.startTime;
    this.processedFiles = 0;
    this.totalFiles = totalFiles;
    this.results = [];
    this.processingTimes = [];
    this.isActive = true;

    if (this.config.enableConsoleOutput) {
      console.log(`\n🚀 Starting image optimization...`);
      console.log(`📁 Source: ${sourceDirectory}`);
      console.log(`📊 Total files: ${totalFiles}`);
      console.log('─'.repeat(60));
    }

    this.emit('start', { totalFiles, sourceDirectory });
  }

  /**
   * Update progress with a completed file result
   * @param result - Optimization result for the processed file
   * @param filename - Name of the processed file
   */
  updateProgress(result: OptimizationResult, filename: string): void {
    if (!this.isActive) return;

    this.processedFiles++;
    this.results.push(result);
    
    if (result.processingTime > 0) {
      this.processingTimes.push(result.processingTime);
    }

    const currentTime = Date.now();
    const shouldUpdate = (currentTime - this.lastUpdateTime) >= this.config.updateInterval;

    if (shouldUpdate || this.processedFiles === this.totalFiles) {
      this.lastUpdateTime = currentTime;
      
      const progress = this.generateDetailedProgress(result, filename);
      
      if (this.config.enableConsoleOutput) {
        this.displayConsoleProgress(progress);
      }

      this.emit('progress', progress);
    }
  }

  /**
   * Report an error during processing
   * @param error - Error that occurred
   * @param filename - File that caused the error
   */
  reportError(error: Error, filename: string): void {
    if (!this.isActive) return;

    if (this.config.enableConsoleOutput) {
      console.log(`❌ Error processing ${filename}: ${error.message}`);
    }

    this.emit('error', { error, filename, processedFiles: this.processedFiles });
  }

  /**
   * Complete progress tracking and generate final report
   * @returns Final processing report
   */
  complete(): ProcessingReport {
    if (!this.isActive) {
      throw new Error('Progress reporter is not active');
    }

    this.isActive = false;
    const endTime = Date.now();
    const totalProcessingTime = endTime - this.startTime;

    const report = this.generateFinalReport(totalProcessingTime);

    if (this.config.enableConsoleOutput) {
      this.displayFinalSummary(report);
    }

    this.emit('complete', report);
    return report;
  }

  /**
   * Generate detailed progress information
   * @param currentResult - Current optimization result
   * @param currentFile - Current file being processed
   * @returns Detailed progress object
   */
  private generateDetailedProgress(currentResult: OptimizationResult, currentFile: string): DetailedProgress {
    const currentTime = Date.now();
    const elapsedTime = currentTime - this.startTime;
    const percentage = Math.round((this.processedFiles / this.totalFiles) * 100);
    
    // Calculate timing estimates
    const averageProcessingTime = this.processingTimes.length > 0 
      ? this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length
      : 0;
    
    const remainingFiles = this.totalFiles - this.processedFiles;
    const estimatedTimeRemaining = remainingFiles * averageProcessingTime;

    // Calculate statistics
    const successCount = this.results.filter(r => r.status === 'success').length;
    const failureCount = this.results.filter(r => r.status === 'failed').length;
    const skippedCount = this.results.filter(r => r.status === 'skipped').length;

    // Calculate size information
    const successfulResults = this.results.filter(r => r.status === 'success');
    const totalOriginalSize = successfulResults.reduce((sum, r) => sum + r.originalSize, 0);
    const totalOptimizedSize = successfulResults.reduce((sum, r) => sum + r.optimizedSize, 0);
    const totalSizeReduction = totalOriginalSize - totalOptimizedSize;
    const averageCompressionRatio = successfulResults.length > 0
      ? successfulResults.reduce((sum, r) => sum + r.compressionRatio, 0) / successfulResults.length
      : 0;

    return {
      current: this.processedFiles,
      total: this.totalFiles,
      percentage,
      currentFile,
      currentStatus: this.mapResultStatusToProgressStatus(currentResult.status),
      startTime: this.startTime,
      elapsedTime,
      estimatedTimeRemaining,
      averageProcessingTime,
      successCount,
      failureCount,
      skippedCount,
      totalOriginalSize,
      totalOptimizedSize,
      totalSizeReduction,
      averageCompressionRatio,
      currentResult
    };
  }

  /**
   * Map optimization result status to progress status
   * @param status - Optimization result status
   * @returns Progress status
   */
  private mapResultStatusToProgressStatus(status: 'success' | 'failed' | 'skipped'): 'processing' | 'completed' | 'failed' | 'skipped' {
    switch (status) {
      case 'success':
        return 'completed';
      case 'failed':
        return 'failed';
      case 'skipped':
        return 'skipped';
      default:
        return 'processing';
    }
  }

  /**
   * Display progress information in console
   * @param progress - Detailed progress information
   */
  private displayConsoleProgress(progress: DetailedProgress): void {
    const { percentage, current, total, currentFile, currentStatus } = progress;
    
    // Create progress bar
    const barLength = 30;
    const filledLength = Math.round((percentage / 100) * barLength);
    const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
    
    // Status icon
    const statusIcon = this.getStatusIcon(currentStatus);
    
    // Format current file name (truncate if too long)
    const maxFileNameLength = 25;
    const displayFileName = currentFile.length > maxFileNameLength 
      ? '...' + currentFile.slice(-(maxFileNameLength - 3))
      : currentFile;

    // Basic progress line
    let progressLine = `${statusIcon} [${bar}] ${percentage}% (${current}/${total})`;
    
    if (this.config.showFileNames) {
      progressLine += ` | ${displayFileName}`;
    }

    // Additional statistics line
    let statsLine = '';
    if (this.config.enableDetailedStats) {
      const { successCount, failureCount, skippedCount } = progress;
      statsLine = `   ✅ ${successCount} | ❌ ${failureCount} | ⏭️  ${skippedCount}`;
      
      if (this.config.showSizeReduction && progress.totalSizeReduction > 0) {
        const sizeReductionMB = (progress.totalSizeReduction / (1024 * 1024)).toFixed(1);
        const compressionPercent = progress.averageCompressionRatio.toFixed(1);
        statsLine += ` | 💾 -${sizeReductionMB}MB (${compressionPercent}%)`;
      }
      
      if (this.config.showTimeEstimates && progress.estimatedTimeRemaining > 0) {
        const remainingSeconds = Math.round(progress.estimatedTimeRemaining / 1000);
        const remainingTime = remainingSeconds > 60 
          ? `${Math.floor(remainingSeconds / 60)}m ${remainingSeconds % 60}s`
          : `${remainingSeconds}s`;
        statsLine += ` | ⏱️  ~${remainingTime}`;
      }
    }

    // Clear previous lines and display new progress
    process.stdout.write('\r\x1b[K'); // Clear current line
    if (statsLine) {
      process.stdout.write('\x1b[1A\x1b[K'); // Move up and clear previous stats line
    }
    
    console.log(progressLine);
    if (statsLine) {
      console.log(statsLine);
    }
  }

  /**
   * Get status icon for display
   * @param status - Current status
   * @returns Status icon
   */
  private getStatusIcon(status: 'processing' | 'completed' | 'failed' | 'skipped'): string {
    switch (status) {
      case 'processing':
        return '⚡';
      case 'completed':
        return '✅';
      case 'failed':
        return '❌';
      case 'skipped':
        return '⏭️';
      default:
        return '📄';
    }
  }

  /**
   * Generate final processing report
   * @param totalProcessingTime - Total time taken for processing
   * @returns Final processing report
   */
  private generateFinalReport(totalProcessingTime: number): ProcessingReport {
    const successfulResults = this.results.filter(r => r.status === 'success');
    const failedResults = this.results.filter(r => r.status === 'failed');
    
    const totalSizeReduction = successfulResults.reduce((sum, result) => {
      return sum + (result.originalSize - result.optimizedSize);
    }, 0);

    const averageCompressionRatio = successfulResults.length > 0 
      ? successfulResults.reduce((sum, result) => sum + result.compressionRatio, 0) / successfulResults.length
      : 0;

    return {
      totalImages: this.results.length,
      successfulConversions: successfulResults.length,
      failedConversions: failedResults.length,
      totalSizeReduction,
      averageCompressionRatio,
      processingTime: totalProcessingTime,
      results: this.results
    };
  }

  /**
   * Display final summary in console
   * @param report - Final processing report
   */
  private displayFinalSummary(report: ProcessingReport): void {
    console.log('\n' + '═'.repeat(60));
    console.log('🎉 OPTIMIZATION COMPLETE!');
    console.log('═'.repeat(60));
    
    console.log(`📊 Total Images: ${report.totalImages}`);
    console.log(`✅ Successful: ${report.successfulConversions}`);
    console.log(`❌ Failed: ${report.failedConversions}`);
    console.log(`⏭️  Skipped: ${report.totalImages - report.successfulConversions - report.failedConversions}`);
    
    if (report.totalSizeReduction > 0) {
      const sizeReductionMB = (report.totalSizeReduction / (1024 * 1024)).toFixed(2);
      console.log(`💾 Size Reduction: ${sizeReductionMB} MB`);
      console.log(`📉 Average Compression: ${report.averageCompressionRatio.toFixed(1)}%`);
    }
    
    const processingTimeSeconds = (report.processingTime / 1000).toFixed(1);
    console.log(`⏱️  Total Time: ${processingTimeSeconds}s`);
    
    if (report.successfulConversions > 0) {
      const avgTimePerImage = (report.processingTime / report.successfulConversions / 1000).toFixed(2);
      console.log(`⚡ Average per Image: ${avgTimePerImage}s`);
    }
    
    console.log('═'.repeat(60));
  }

  /**
   * Check if progress reporter is currently active
   * @returns True if actively tracking progress
   */
  isReporting(): boolean {
    return this.isActive;
  }

  /**
   * Get current configuration
   * @returns Current progress reporter configuration
   */
  getConfig(): ProgressReporterConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   * @param updates - Configuration updates
   */
  updateConfig(updates: Partial<ProgressReporterConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}