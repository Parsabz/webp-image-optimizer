/**
 * Command-line interface components
 */

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs-extra';
import { OptimizationConfig, DEFAULT_CONFIG } from '../types';

/**
 * CLI configuration interface
 */
export interface CLIOptions {
  source: string;
  output: string;
  quality?: number;
  photoQuality?: number;
  graphicQuality?: number;
  mixedQuality?: number;
  concurrency?: number;
  continueOnError?: boolean;
  noProgress?: boolean;
  noReport?: boolean;
  reportFormat?: 'json' | 'text';
  verbose?: boolean;
}

/**
 * CLI argument parser and configuration manager
 */
export class CLIArgumentParser {
  private program: Command;

  constructor() {
    this.program = new Command();
    this.setupCommands();
  }

  /**
   * Setup CLI commands and options
   */
  private setupCommands(): void {
    this.program
      .name('image-optimizer')
      .description('Convert and optimize images to WebP format with intelligent compression')
      .version('1.0.0');

    // Main optimization command
    this.program
      .argument('<source>', 'Source directory containing images to optimize')
      .argument('[output]', 'Output directory for optimized images (default: ./optimized)')
      .option('-q, --quality <number>', 'Default quality setting for all images (1-100)', this.parseQuality, DEFAULT_CONFIG.quality.mixed)
      .option('--photo-quality <number>', 'Quality setting for photographs (1-100)', this.parseQuality, DEFAULT_CONFIG.quality.photo)
      .option('--graphic-quality <number>', 'Quality setting for graphics/screenshots (1-100)', this.parseQuality, DEFAULT_CONFIG.quality.graphic)
      .option('--mixed-quality <number>', 'Quality setting for mixed content (1-100)', this.parseQuality, DEFAULT_CONFIG.quality.mixed)
      .option('-c, --concurrency <number>', 'Number of images to process concurrently', this.parseConcurrency, DEFAULT_CONFIG.processing.concurrency)
      .option('--continue-on-error', 'Continue processing remaining images if individual conversions fail', DEFAULT_CONFIG.processing.continueOnError)
      .option('--no-progress', 'Disable progress reporting during batch processing')
      .option('--no-report', 'Skip generating optimization report')
      .option('--report-format <format>', 'Report format (json|text)', this.parseReportFormat, DEFAULT_CONFIG.output.reportFormat)
      .option('-v, --verbose', 'Enable verbose output with detailed processing information')
      .action(async (source: string, output: string | undefined, options: any) => {
        // This will be handled by the main CLI handler
        // Store parsed options for retrieval
        this.program.setOptionValue('parsedSource', source);
        this.program.setOptionValue('parsedOutput', output || './optimized');
        this.program.setOptionValue('parsedOptions', options);
      });

    // Add help examples
    this.program.addHelpText('after', `
Examples:
  $ image-optimizer ./images                          # Optimize images in ./images to ./optimized
  $ image-optimizer ./photos ./web-photos            # Optimize ./photos to ./web-photos
  $ image-optimizer ./images -q 85                   # Set default quality to 85%
  $ image-optimizer ./images --photo-quality 90      # Set photo quality to 90%
  $ image-optimizer ./images -c 8                    # Process 8 images concurrently
  $ image-optimizer ./images --no-progress           # Disable progress reporting
  $ image-optimizer ./images --report-format text    # Generate text report instead of JSON
  $ image-optimizer ./images -v                      # Enable verbose output
    `);
  }

  /**
   * Parse and validate CLI arguments
   * @param args - Command line arguments (defaults to process.argv)
   * @returns Parsed CLI options
   */
  async parseArguments(args?: string[]): Promise<CLIOptions> {
    try {
      // Parse arguments
      this.program.parse(args);

      // Get parsed values
      const source = this.program.getOptionValue('parsedSource') as string;
      const output = this.program.getOptionValue('parsedOutput') as string;
      const options = this.program.getOptionValue('parsedOptions') as any;

      if (!source) {
        throw new Error('Source directory is required');
      }

      // Build CLI options object
      const cliOptions: CLIOptions = {
        source: path.resolve(source),
        output: path.resolve(output),
        quality: options.quality,
        photoQuality: options.photoQuality,
        graphicQuality: options.graphicQuality,
        mixedQuality: options.mixedQuality,
        concurrency: options.concurrency,
        continueOnError: options.continueOnError,
        noProgress: options.noProgress,
        noReport: options.noReport,
        reportFormat: options.reportFormat,
        verbose: options.verbose
      };

      // Validate options
      await this.validateOptions(cliOptions);

      return cliOptions;

    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`CLI argument parsing failed: ${error.message}`);
      }
      throw new Error('CLI argument parsing failed: Unknown error');
    }
  }

  /**
   * Convert CLI options to optimization configuration
   * @param cliOptions - Parsed CLI options
   * @returns Optimization configuration
   */
  convertToOptimizationConfig(cliOptions: CLIOptions): OptimizationConfig {
    const config: OptimizationConfig = {
      quality: {
        photo: cliOptions.photoQuality || cliOptions.quality || DEFAULT_CONFIG.quality.photo,
        graphic: cliOptions.graphicQuality || cliOptions.quality || DEFAULT_CONFIG.quality.graphic,
        mixed: cliOptions.mixedQuality || cliOptions.quality || DEFAULT_CONFIG.quality.mixed,
        minimum: DEFAULT_CONFIG.quality.minimum
      },
      dimensions: {
        maxWidth: DEFAULT_CONFIG.dimensions.maxWidth,
        maxHeight: DEFAULT_CONFIG.dimensions.maxHeight,
        preserveAspectRatio: DEFAULT_CONFIG.dimensions.preserveAspectRatio
      },
      processing: {
        concurrency: cliOptions.concurrency || DEFAULT_CONFIG.processing.concurrency,
        enableProgressReporting: !cliOptions.noProgress,
        continueOnError: cliOptions.continueOnError !== undefined ? cliOptions.continueOnError : DEFAULT_CONFIG.processing.continueOnError
      },
      output: {
        preserveFilenames: DEFAULT_CONFIG.output.preserveFilenames,
        generateReport: !cliOptions.noReport,
        reportFormat: cliOptions.reportFormat || DEFAULT_CONFIG.output.reportFormat
      },
      supportedFormats: DEFAULT_CONFIG.supportedFormats
    };

    return config;
  }

  /**
   * Get help text
   * @returns Help text string
   */
  getHelp(): string {
    return this.program.helpInformation();
  }

  /**
   * Display help and exit
   */
  displayHelp(): void {
    this.program.help();
  }

  /**
   * Display version and exit
   */
  displayVersion(): void {
    console.log(this.program.version());
  }

  /**
   * Parse quality value with validation
   * @param value - Quality value string
   * @returns Parsed quality number
   */
  private parseQuality(value: string): number {
    const quality = parseInt(value, 10);
    if (isNaN(quality) || quality < 1 || quality > 100) {
      throw new Error(`Quality must be a number between 1 and 100, got: ${value}`);
    }
    return quality;
  }

  /**
   * Parse concurrency value with validation
   * @param value - Concurrency value string
   * @returns Parsed concurrency number
   */
  private parseConcurrency(value: string): number {
    const concurrency = parseInt(value, 10);
    if (isNaN(concurrency) || concurrency < 1) {
      throw new Error(`Concurrency must be a positive number, got: ${value}`);
    }
    return concurrency;
  }

  /**
   * Parse report format with validation
   * @param value - Report format string
   * @returns Validated report format
   */
  private parseReportFormat(value: string): 'json' | 'text' {
    if (value !== 'json' && value !== 'text') {
      throw new Error(`Report format must be 'json' or 'text', got: ${value}`);
    }
    return value;
  }

  /**
   * Validate CLI options
   * @param options - CLI options to validate
   */
  private async validateOptions(options: CLIOptions): Promise<void> {
    // Validate source directory
    try {
      const sourceExists = await fs.pathExists(options.source);
      if (!sourceExists) {
        throw new Error(`Source directory does not exist: ${options.source}`);
      }

      const sourceStats = await fs.stat(options.source);
      if (!sourceStats.isDirectory()) {
        throw new Error(`Source path is not a directory: ${options.source}`);
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Invalid source directory: ${error.message}`);
      }
      throw new Error('Invalid source directory: Unknown error');
    }

    // Validate output directory path (don't require it to exist yet)
    if (!path.isAbsolute(options.output)) {
      // Convert to absolute path for consistency
      options.output = path.resolve(options.output);
    }

    // Validate that output is not the same as source
    if (path.resolve(options.source) === path.resolve(options.output)) {
      throw new Error('Output directory cannot be the same as source directory');
    }

    // Validate that output is not a subdirectory of source
    const relativePath = path.relative(options.source, options.output);
    if (relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath)) {
      throw new Error('Output directory cannot be a subdirectory of source directory');
    }

    // Validate quality settings consistency
    const minQuality = DEFAULT_CONFIG.quality.minimum;
    if (options.quality && options.quality < minQuality) {
      throw new Error(`Quality cannot be below minimum threshold of ${minQuality}%`);
    }
    if (options.photoQuality && options.photoQuality < minQuality) {
      throw new Error(`Photo quality cannot be below minimum threshold of ${minQuality}%`);
    }
    if (options.graphicQuality && options.graphicQuality < minQuality) {
      throw new Error(`Graphic quality cannot be below minimum threshold of ${minQuality}%`);
    }
    if (options.mixedQuality && options.mixedQuality < minQuality) {
      throw new Error(`Mixed quality cannot be below minimum threshold of ${minQuality}%`);
    }
  }
}

/**
 * CLI console output and user feedback manager
 */
export class CLIConsoleReporter {
  private verbose: boolean;
  private startTime: number = 0;

  constructor(verbose: boolean = false) {
    this.verbose = verbose;
  }

  /**
   * Display welcome message and configuration summary
   * @param options - CLI options being used
   */
  displayWelcome(options: CLIOptions): void {
    console.log('\n🖼️  Image Optimizer v1.0.0');
    console.log('═'.repeat(50));
    
    console.log(`📁 Source: ${options.source}`);
    console.log(`📂 Output: ${options.output}`);
    
    if (this.verbose) {
      console.log('\n⚙️  Configuration:');
      if (options.quality) {
        console.log(`   Default Quality: ${options.quality}%`);
      } else {
        console.log(`   Photo Quality: ${options.photoQuality || 87}%`);
        console.log(`   Graphic Quality: ${options.graphicQuality || 80}%`);
        console.log(`   Mixed Quality: ${options.mixedQuality || 83}%`);
      }
      console.log(`   Concurrency: ${options.concurrency || 4} images`);
      console.log(`   Continue on Error: ${options.continueOnError ? 'Yes' : 'No'}`);
      console.log(`   Progress Reporting: ${!options.noProgress ? 'Enabled' : 'Disabled'}`);
      console.log(`   Generate Report: ${!options.noReport ? 'Yes' : 'No'}`);
      if (!options.noReport) {
        console.log(`   Report Format: ${options.reportFormat || 'json'}`);
      }
    }
    
    console.log('═'.repeat(50));
    this.startTime = Date.now();
  }

  /**
   * Display error message with proper formatting
   * @param error - Error to display
   * @param context - Additional context information
   */
  displayError(error: Error, context?: string): void {
    console.error('\n❌ Error occurred:');
    console.error('─'.repeat(30));
    
    if (context) {
      console.error(`Context: ${context}`);
    }
    
    console.error(`Message: ${error.message}`);
    
    if (this.verbose && error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    
    console.error('─'.repeat(30));
  }

  /**
   * Display validation error with suggestions
   * @param error - Validation error
   */
  displayValidationError(error: Error): void {
    console.error('\n⚠️  Configuration Error:');
    console.error('─'.repeat(35));
    console.error(`${error.message}`);
    console.error('─'.repeat(35));
    
    // Provide helpful suggestions based on common errors
    const message = error.message.toLowerCase();
    
    if (message.includes('source directory')) {
      console.error('\n💡 Suggestions:');
      console.error('   • Check that the source directory path is correct');
      console.error('   • Ensure the directory exists and contains images');
      console.error('   • Verify you have read permissions for the directory');
    } else if (message.includes('quality')) {
      console.error('\n💡 Suggestions:');
      console.error('   • Quality values must be between 1 and 100');
      console.error('   • Use --quality for all images or specific options:');
      console.error('     --photo-quality, --graphic-quality, --mixed-quality');
    } else if (message.includes('output directory')) {
      console.error('\n💡 Suggestions:');
      console.error('   • Choose a different output directory');
      console.error('   • Ensure output is not the same as source');
      console.error('   • Output cannot be a subdirectory of source');
    }
    
    console.error('\n📖 Use --help for more information\n');
  }

  /**
   * Display completion summary with results
   * @param report - Processing report
   * @param outputPath - Path where files were saved
   */
  displayCompletionSummary(report: any, outputPath: string): void {
    const processingTime = Date.now() - this.startTime;
    const processingSeconds = (processingTime / 1000).toFixed(1);
    
    console.log('\n🎉 Optimization Complete!');
    console.log('═'.repeat(50));
    
    // Results summary
    console.log(`📊 Results:`);
    console.log(`   Total Images: ${report.totalImages}`);
    console.log(`   ✅ Successful: ${report.successfulConversions}`);
    console.log(`   ❌ Failed: ${report.failedConversions}`);
    
    const skipped = report.totalImages - report.successfulConversions - report.failedConversions;
    if (skipped > 0) {
      console.log(`   ⏭️  Skipped: ${skipped}`);
    }
    
    // Size reduction information
    if (report.totalSizeReduction > 0) {
      const sizeReductionMB = (report.totalSizeReduction / (1024 * 1024)).toFixed(2);
      const compressionPercent = report.averageCompressionRatio.toFixed(1);
      console.log(`\n💾 Size Optimization:`);
      console.log(`   Total Reduction: ${sizeReductionMB} MB`);
      console.log(`   Average Compression: ${compressionPercent}%`);
    }
    
    // Timing information
    console.log(`\n⏱️  Performance:`);
    console.log(`   Total Time: ${processingSeconds}s`);
    
    if (report.successfulConversions > 0) {
      const avgTimePerImage = (processingTime / report.successfulConversions / 1000).toFixed(2);
      console.log(`   Average per Image: ${avgTimePerImage}s`);
    }
    
    // Output location
    console.log(`\n📂 Output Location:`);
    console.log(`   ${outputPath}`);
    
    // Report file information
    if (report.reportGenerated) {
      console.log(`\n📋 Report Generated:`);
      console.log(`   ${report.reportPath}`);
    }
    
    console.log('═'.repeat(50));
    
    // Success/failure summary
    if (report.failedConversions === 0) {
      console.log('🎊 All images optimized successfully!');
    } else if (report.successfulConversions > 0) {
      console.log(`⚠️  ${report.failedConversions} images failed to process`);
      if (this.verbose) {
        console.log('   Use --verbose to see detailed error information');
      }
    } else {
      console.log('❌ No images were successfully optimized');
    }
    
    console.log('');
  }

  /**
   * Display progress callback for batch processing
   * @param progress - Progress information
   */
  createProgressCallback() {
    return (progress: any) => {
      if (this.verbose && progress.result?.errorMessage) {
        console.log(`\n⚠️  ${progress.currentFile}: ${progress.result.errorMessage}`);
      }
    };
  }

  /**
   * Display verbose processing information
   * @param message - Message to display
   * @param details - Optional details object
   */
  displayVerbose(message: string, details?: any): void {
    if (!this.verbose) return;
    
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${message}`);
    
    if (details && typeof details === 'object') {
      console.log('   Details:', JSON.stringify(details, null, 2));
    }
  }

  /**
   * Display warning message
   * @param message - Warning message
   */
  displayWarning(message: string): void {
    console.warn(`⚠️  Warning: ${message}`);
  }

  /**
   * Display info message
   * @param message - Info message
   */
  displayInfo(message: string): void {
    console.log(`ℹ️  ${message}`);
  }

  /**
   * Set verbose mode
   * @param verbose - Enable/disable verbose output
   */
  setVerbose(verbose: boolean): void {
    this.verbose = verbose;
  }
}

/**
 * CLI report generator for saving detailed optimization reports
 */
export class CLIReportGenerator {
  /**
   * Generate and save optimization report
   * @param report - Processing report data
   * @param outputDirectory - Directory to save report
   * @param format - Report format ('json' or 'text')
   * @returns Path to generated report file
   */
  async generateReport(
    report: any, 
    outputDirectory: string, 
    format: 'json' | 'text' = 'json'
  ): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFileName = `optimization-report-${timestamp}.${format}`;
    const reportPath = path.join(outputDirectory, reportFileName);

    try {
      await fs.ensureDir(outputDirectory);

      if (format === 'json') {
        await this.generateJSONReport(report, reportPath);
      } else {
        await this.generateTextReport(report, reportPath);
      }

      return reportPath;
    } catch (error) {
      throw new Error(`Failed to generate report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate JSON format report
   * @param report - Report data
   * @param reportPath - Output file path
   */
  private async generateJSONReport(report: any, reportPath: string): Promise<void> {
    const jsonReport = {
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
      summary: {
        totalImages: report.totalImages,
        successfulConversions: report.successfulConversions,
        failedConversions: report.failedConversions,
        skippedConversions: report.totalImages - report.successfulConversions - report.failedConversions,
        totalSizeReduction: report.totalSizeReduction,
        totalSizeReductionMB: Math.round(report.totalSizeReduction / (1024 * 1024) * 100) / 100,
        averageCompressionRatio: Math.round(report.averageCompressionRatio * 100) / 100,
        processingTimeSeconds: Math.round(report.processingTime / 1000 * 100) / 100,
        averageTimePerImage: report.successfulConversions > 0 
          ? Math.round(report.processingTime / report.successfulConversions / 1000 * 100) / 100 
          : 0
      },
      results: report.results.map((result: any) => ({
        originalPath: result.originalPath,
        optimizedPath: result.optimizedPath,
        originalSizeBytes: result.originalSize,
        optimizedSizeBytes: result.optimizedSize,
        originalSizeMB: Math.round(result.originalSize / (1024 * 1024) * 100) / 100,
        optimizedSizeMB: Math.round(result.optimizedSize / (1024 * 1024) * 100) / 100,
        compressionRatio: Math.round(result.compressionRatio * 100) / 100,
        qualityScore: result.qualityScore,
        processingTimeMs: result.processingTime,
        status: result.status,
        errorMessage: result.errorMessage
      }))
    };

    await fs.writeJson(reportPath, jsonReport, { spaces: 2 });
  }

  /**
   * Generate text format report
   * @param report - Report data
   * @param reportPath - Output file path
   */
  private async generateTextReport(report: any, reportPath: string): Promise<void> {
    const lines: string[] = [];
    
    // Header
    lines.push('IMAGE OPTIMIZATION REPORT');
    lines.push('='.repeat(50));
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push(`Version: 1.0.0`);
    lines.push('');
    
    // Summary
    lines.push('SUMMARY');
    lines.push('-'.repeat(20));
    lines.push(`Total Images: ${report.totalImages}`);
    lines.push(`Successful Conversions: ${report.successfulConversions}`);
    lines.push(`Failed Conversions: ${report.failedConversions}`);
    
    const skipped = report.totalImages - report.successfulConversions - report.failedConversions;
    if (skipped > 0) {
      lines.push(`Skipped Conversions: ${skipped}`);
    }
    
    if (report.totalSizeReduction > 0) {
      const sizeReductionMB = Math.round(report.totalSizeReduction / (1024 * 1024) * 100) / 100;
      lines.push(`Total Size Reduction: ${sizeReductionMB} MB`);
      lines.push(`Average Compression: ${Math.round(report.averageCompressionRatio * 100) / 100}%`);
    }
    
    const processingSeconds = Math.round(report.processingTime / 1000 * 100) / 100;
    lines.push(`Processing Time: ${processingSeconds} seconds`);
    
    if (report.successfulConversions > 0) {
      const avgTime = Math.round(report.processingTime / report.successfulConversions / 1000 * 100) / 100;
      lines.push(`Average Time per Image: ${avgTime} seconds`);
    }
    
    lines.push('');
    
    // Detailed results
    lines.push('DETAILED RESULTS');
    lines.push('-'.repeat(30));
    
    report.results.forEach((result: any, index: number) => {
      lines.push(`${index + 1}. ${path.basename(result.originalPath)}`);
      lines.push(`   Status: ${result.status.toUpperCase()}`);
      
      if (result.status === 'success') {
        const originalMB = Math.round(result.originalSize / (1024 * 1024) * 100) / 100;
        const optimizedMB = Math.round(result.optimizedSize / (1024 * 1024) * 100) / 100;
        const compression = Math.round(result.compressionRatio * 100) / 100;
        
        lines.push(`   Original Size: ${originalMB} MB`);
        lines.push(`   Optimized Size: ${optimizedMB} MB`);
        lines.push(`   Compression: ${compression}%`);
        lines.push(`   Quality: ${result.qualityScore}%`);
        lines.push(`   Processing Time: ${result.processingTime}ms`);
        lines.push(`   Output: ${result.optimizedPath}`);
      } else if (result.status === 'failed' && result.errorMessage) {
        lines.push(`   Error: ${result.errorMessage}`);
      }
      
      lines.push('');
    });
    
    // Footer
    lines.push('='.repeat(50));
    lines.push('Report generated by Image Optimizer v1.0.0');
    
    await fs.writeFile(reportPath, lines.join('\n'), 'utf8');
  }
}

/**
 * Create and configure CLI argument parser
 * @returns Configured CLI argument parser instance
 */
export function createCLIParser(): CLIArgumentParser {
  return new CLIArgumentParser();
}

/**
 * Create CLI console reporter
 * @param verbose - Enable verbose output
 * @returns Configured console reporter instance
 */
export function createConsoleReporter(verbose: boolean = false): CLIConsoleReporter {
  return new CLIConsoleReporter(verbose);
}

/**
 * Create CLI report generator
 * @returns Report generator instance
 */
export function createReportGenerator(): CLIReportGenerator {
  return new CLIReportGenerator();
}