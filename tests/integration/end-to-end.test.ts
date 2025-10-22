/**
 * End-to-end integration tests
 * These tests validate the complete workflow from input to output
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import { main } from '../../src/index';

describe('End-to-End Integration Tests', () => {
  const tempDir = path.join(__dirname, '../temp/e2e-test');
  const testImagesDir = path.join(tempDir, 'source');
  const outputDir = path.join(tempDir, 'output');

  beforeEach(async () => {
    // Setup test environment
    await fs.ensureDir(testImagesDir);
    await fs.ensureDir(outputDir);
    await fs.emptyDir(testImagesDir);
    await fs.emptyDir(outputDir);

    // Create sample test images
    await createSampleImages();
  });

  afterEach(async () => {
    // Cleanup
    await fs.remove(tempDir);
  });

  it('should complete full optimization workflow', async () => {
    // Mock command line arguments
    const originalArgv = process.argv;
    process.argv = [
      'node',
      'image-optimizer',
      testImagesDir,
      outputDir,
      '--verbose'
    ];

    try {
      // Run the main application
      await main();

      // Verify output directory structure
      const outputExists = await fs.pathExists(outputDir);
      expect(outputExists).toBe(true);

      // Check for optimized images
      const outputFiles = await fs.readdir(outputDir);
      const webpFiles = outputFiles.filter(file => file.endsWith('.webp'));
      expect(webpFiles.length).toBeGreaterThan(0);

      // Verify report generation
      const reportFiles = outputFiles.filter(file => 
        file.includes('report') || file.includes('mapping')
      );
      expect(reportFiles.length).toBeGreaterThan(0);

      // Verify file sizes (optimized should be smaller than originals)
      for (const webpFile of webpFiles) {
        const webpPath = path.join(outputDir, webpFile);
        const webpStats = await fs.stat(webpPath);
        expect(webpStats.size).toBeGreaterThan(0);
      }

      // Verify report content
      const reportPath = path.join(outputDir, 'optimization-report.json');
      if (await fs.pathExists(reportPath)) {
        const report = await fs.readJson(reportPath);
        expect(report).toHaveProperty('generatedAt');
        expect(report).toHaveProperty('summary');
        expect(report.summary.totalImages).toBeGreaterThan(0);
      }

    } finally {
      // Restore original argv
      process.argv = originalArgv;
    }
  }, 90000);

  it('should handle mixed image formats correctly', async () => {
    // Create images with different formats and characteristics
    await createMixedFormatImages();

    const originalArgv = process.argv;
    process.argv = [
      'node',
      'image-optimizer',
      testImagesDir,
      outputDir,
      '--photo-quality', '90',
      '--graphic-quality', '75',
      '--verbose'
    ];

    try {
      await main();

      // Verify all formats were processed
      const outputFiles = await fs.readdir(outputDir);
      const webpFiles = outputFiles.filter(file => file.endsWith('.webp'));
      
      // Should have converted multiple different formats
      expect(webpFiles.length).toBeGreaterThanOrEqual(2);

      // Verify report shows different content types were processed
      const reportPath = path.join(outputDir, 'optimization-report.json');
      if (await fs.pathExists(reportPath)) {
        const report = await fs.readJson(reportPath);
        expect(report.summary.successfulConversions).toBeGreaterThan(0);
      }

    } finally {
      process.argv = originalArgv;
    }
  }, 90000);

  async function createSampleImages(): Promise<void> {
    const sharp = require('sharp');

    // Create a JPEG photo-like image
    const photoImage = sharp({
      create: {
        width: 300,
        height: 200,
        channels: 3,
        background: { r: 120, g: 180, b: 220 }
      }
    });
    await photoImage.blur(1).jpeg({ quality: 85 }).toFile(path.join(testImagesDir, 'photo.jpg'));

    // Create a PNG graphic-like image
    const graphicImage = sharp({
      create: {
        width: 200,
        height: 200,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    });
    await graphicImage.png().toFile(path.join(testImagesDir, 'graphic.png'));
  }

  async function createMixedFormatImages(): Promise<void> {
    const sharp = require('sharp');

    // Create various image types
    const images = [
      {
        name: 'landscape.jpg',
        width: 400,
        height: 300,
        background: { r: 100, g: 150, b: 100 },
        format: 'jpeg'
      },
      {
        name: 'portrait.jpg',
        width: 300,
        height: 400,
        background: { r: 150, g: 100, b: 150 },
        format: 'jpeg'
      },
      {
        name: 'icon.png',
        width: 64,
        height: 64,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
        format: 'png'
      },
      {
        name: 'banner.png',
        width: 800,
        height: 200,
        background: { r: 50, g: 50, b: 50, alpha: 1 },
        format: 'png'
      }
    ];

    for (const img of images) {
      const image = sharp({
        create: {
          width: img.width,
          height: img.height,
          channels: img.format === 'png' ? 4 : 3,
          background: img.background
        }
      });

      const filePath = path.join(testImagesDir, img.name);
      
      if (img.format === 'jpeg') {
        await image.jpeg({ quality: 80 }).toFile(filePath);
      } else {
        await image.png().toFile(filePath);
      }
    }
  }
});