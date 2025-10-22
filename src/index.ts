#!/usr/bin/env node

/**
 * Image Optimizer CLI Entry Point
 * Main entry point for the image optimization tool
 */

import { 
  createCLIParser, 
  createConsoleReporter, 
  createReportGenerator,
  CLIOptions 
} from './cli';
import { BatchProcessor } from './core/batch-processor';
import { ProgressReporter } from './core/progress-reporter';

/**
 * Main CLI application function
 */
async function main(): Promise<void> {
  const parser = createCLIParser();
  let consoleReporter: any;
  
  try {
    // Parse command line arguments
    const cliOptions = await parser.parseArguments();
    
    // Create console reporter with verbose setting
    consoleReporter = createConsoleReporter(cliOptions.verbose);
    
    // Display welcome message and configuration
    consoleReporter.displayWelcome(cliOptions);
    
    // Convert CLI options to optimization configuration
    const optimizationConfig = parser.convertToOptimizationConfig(cliOptions);
    
    // Create batch processor with configuration
    const batchProcessor = new BatchProcessor(optimizationConfig);
    
    // Configure progress reporting
    const progressConfig = {
      enableConsoleOutput: !cliOptions.noProgress,
      enableDetailedStats: cliOptions.verbose,
      showFileNames: true,
      showSizeReduction: true,
      showTimeEstimates: true
    };
    
    // Set up progress callback for verbose mode
    const onProgress = cliOptions.verbose ? consoleReporter.createProgressCallback() : undefined;
    
    // Set up error callback
    const onError = (error: Error, file: string) => {
      if (cliOptions.verbose) {
        consoleReporter.displayVerbose(`Error processing ${file}`, { error: error.message });
      }
    };
    
    // Process images
    consoleReporter.displayVerbose('Starting batch processing...');
    
    const report = await batchProcessor.processDirectory({
      sourceDirectory: cliOptions.source,
      outputDirectory: cliOptions.output,
      config: optimizationConfig,
      progressConfig,
      onProgress,
      onError
    });
    
    // Generate report if requested
    let reportPath: string | undefined;
    if (!cliOptions.noReport) {
      try {
        const reportGenerator = createReportGenerator();
        reportPath = await reportGenerator.generateReport(
          report, 
          cliOptions.output, 
          cliOptions.reportFormat || 'json'
        );
        consoleReporter.displayVerbose('Report generated successfully', { path: reportPath });
      } catch (reportError) {
        consoleReporter.displayWarning(`Failed to generate report: ${reportError instanceof Error ? reportError.message : 'Unknown error'}`);
      }
    }
    
    // Display completion summary
    const summaryReport = {
      ...report,
      reportGenerated: !!reportPath,
      reportPath
    };
    
    consoleReporter.displayCompletionSummary(summaryReport, cliOptions.output);
    
    // Exit with appropriate code
    const exitCode = report.failedConversions > 0 ? 1 : 0;
    process.exit(exitCode);
    
  } catch (error) {
    // Handle different types of errors appropriately
    if (error instanceof Error) {
      if (error.message.includes('CLI argument parsing failed') || 
          error.message.includes('Configuration Error') ||
          error.message.includes('Invalid source directory') ||
          error.message.includes('Quality must be') ||
          error.message.includes('Output directory cannot')) {
        // Validation/configuration errors
        if (consoleReporter) {
          consoleReporter.displayValidationError(error);
        } else {
          console.error(`\n⚠️  ${error.message}\n`);
        }
        process.exit(2);
      } else {
        // Runtime/processing errors
        if (consoleReporter) {
          consoleReporter.displayError(error, 'Image processing');
        } else {
          console.error(`\n❌ Error: ${error.message}\n`);
        }
        process.exit(1);
      }
    } else {
      // Unknown errors
      console.error('\n❌ An unknown error occurred\n');
      process.exit(1);
    }
  }
}

/**
 * Handle uncaught exceptions and unhandled rejections
 */
process.on('uncaughtException', (error) => {
  console.error('\n💥 Uncaught Exception:', error.message);
  if (process.env.NODE_ENV === 'development') {
    console.error(error.stack);
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\n💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

/**
 * Handle graceful shutdown on SIGINT (Ctrl+C)
 */
process.on('SIGINT', () => {
  console.log('\n\n⏹️  Operation cancelled by user');
  process.exit(130);
});

/**
 * Handle graceful shutdown on SIGTERM
 */
process.on('SIGTERM', () => {
  console.log('\n\n⏹️  Operation terminated');
  process.exit(143);
});

// Run the main function
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error in main function:', error);
    process.exit(1);
  });
}

export { main };