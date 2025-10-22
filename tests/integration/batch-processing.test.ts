/**
 * Integration tests for batch processing functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import { BatchProcessor } from '../../src/core/batch-processor';
import { OptimizationConfig } from '../../src/types';

describe('Batch Processing Integration Tests', () => {
  const testDataDir = path.join(__dirname, '../fixtures');
  const tempOutputDir = path.join(__dirname, '../temp/batch-output');
  
  beforeEach(async () => {
    // Ensure temp directory exists and is clean
    await fs.ensureDir(tempOutputDir);
    await fs.emptyDir(tempOutputDir);
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.remove(tempOutputDir);
  });

  it('should process a directory with mixed image formats', async () => {
    // Create test images directory
    const testImagesDir = path.join(__dirname, '../temp/test-images');
    await fs.ensureDir(testImagesDir);
    
    // Create sample test images (we'll create minimal valid images)
    await createTestImage(path.join(testImagesDir, 'photo.jpg'), 'jpeg');
    await createTestImage(path.join(testImagesDir, 'graphic.png'), 'png');
    
    const config: Partial<OptimizationConfig> = {
      quality: {
        photo: 85,
        graphic: 80,
        mixed: 82,
        minimum: 70
      },
      processing: {
        concurrency: 2,
        enableProgressReporting: false,
        continueOnError: true
      }
    };

    const batchProcessor = new BatchProcessor(config);
    
    const result = await batchProcessor.processDirectory({
      sourceDirectory: testImagesDir,
      outputDirectory: tempOutputDir
    });

    // Verify results
    expect(result.totalImages).toBe(2);
    expect(result.successfulConversions).toBeGreaterThan(0);
    expect(result.results).toHaveLength(2);
    
    // Verify output files exist
    const outputFiles = await fs.readdir(tempOutputDir);
    const webpFiles = outputFiles.filter(file => file.endsWith('.webp'));
    expect(webpFiles.length).toBeGreaterThan(0);
    
    // Clean up test images
    await fs.remove(testImagesDir);
  }, 30000);

  it('should handle empty directory gracefully', async () => {
    const emptyDir = path.join(__dirname, '../temp/empty-dir');
    await fs.ensureDir(emptyDir);

    const batchProcessor = new BatchProcessor();
    
    await expect(
      batchProcessor.processDirectory({
        sourceDirectory: emptyDir,
        outputDirectory: tempOutputDir
      })
    ).rejects.toThrow('No supported image files found');
    
    await fs.remove(emptyDir);
  });

  it('should continue processing when continueOnError is true', async () => {
    const testImagesDir = path.join(__dirname, '../temp/mixed-quality-images');
    await fs.ensureDir(testImagesDir);
    
    // Create one valid image and one invalid file
    await createTestImage(path.join(testImagesDir, 'valid.jpg'), 'jpeg');
    await fs.writeFile(path.join(testImagesDir, 'invalid.jpg'), 'not an image');
    
    const config: Partial<OptimizationConfig> = {
      processing: {
        concurrency: 1,
        enableProgressReporting: false,
        continueOnError: true
      }
    };

    const batchProcessor = new BatchProcessor(config);
    
    const result = await batchProcessor.processDirectory({
      sourceDirectory: testImagesDir,
      outputDirectory: tempOutputDir
    });

    // Should process the valid image and skip/fail the invalid one
    expect(result.totalImages).toBe(2);
    expect(result.successfulConversions).toBe(1);
    expect(result.failedConversions).toBe(1);
    
    await fs.remove(testImagesDir);
  }, 30000);

  it('should generate optimization report', async () => {
    const testImagesDir = path.join(__dirname, '../temp/report-test-images');
    await fs.ensureDir(testImagesDir);
    
    await createTestImage(path.join(testImagesDir, 'test.jpg'), 'jpeg');
    
    const config: Partial<OptimizationConfig> = {
      output: {
        generateReport: true,
        reportFormat: 'json',
        preserveFilenames: true
      },
      processing: {
        enableProgressReporting: false,
        continueOnError: true
      }
    };

    const batchProcessor = new BatchProcessor(config);
    
    await batchProcessor.processDirectory({
      sourceDirectory: testImagesDir,
      outputDirectory: tempOutputDir
    });

    // Check if report files were generated
    const reportExists = await fs.pathExists(path.join(tempOutputDir, 'optimization-report.json'));
    const mappingExists = await fs.pathExists(path.join(tempOutputDir, 'filename-mapping.json'));
    
    expect(reportExists).toBe(true);
    expect(mappingExists).toBe(true);
    
    // Verify report content
    const report = await fs.readJson(path.join(tempOutputDir, 'optimization-report.json'));
    expect(report).toHaveProperty('generatedAt');
    expect(report).toHaveProperty('summary');
    expect(report).toHaveProperty('results');
    expect(report.summary.totalImages).toBe(1);
    
    await fs.remove(testImagesDir);
  }, 30000);
});

/**
 * Create a minimal valid test image for testing purposes
 * @param filePath - Path where to create the test image
 * @param format - Image format to create
 */
async function createTestImage(filePath: string, format: 'jpeg' | 'png'): Promise<void> {
  const sharp = require('sharp');
  
  // Create a simple 100x100 colored square
  const image = sharp({
    create: {
      width: 100,
      height: 100,
      channels: 3,
      background: { r: 255, g: 0, b: 0 } // Red background
    }
  });

  if (format === 'jpeg') {
    await image.jpeg({ quality: 90 }).toFile(filePath);
  } else if (format === 'png') {
    await image.png().toFile(filePath);
  }
}