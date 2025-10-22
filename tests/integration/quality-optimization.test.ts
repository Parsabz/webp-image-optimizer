/**
 * Integration tests for quality optimization functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import { DynamicQualityCalculator, QualityValidator } from '../../src/core/quality-optimizer';
import { WebPConverter, FormatDetector } from '../../src/core';

describe('Quality Optimization Integration Tests', () => {
  const tempDir = path.join(__dirname, '../temp/quality-test');
  const testImagesDir = path.join(tempDir, 'images');
  const outputDir = path.join(tempDir, 'output');

  beforeEach(async () => {
    await fs.ensureDir(testImagesDir);
    await fs.ensureDir(outputDir);
    await fs.emptyDir(testImagesDir);
    await fs.emptyDir(outputDir);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('Dynamic Quality Calculator', () => {
    it('should calculate optimal quality for different image types', async () => {
      // Create test images with different characteristics
      const photoPath = path.join(testImagesDir, 'photo.jpg');
      const graphicPath = path.join(testImagesDir, 'graphic.png');
      
      await createPhotoLikeImage(photoPath);
      await createGraphicLikeImage(graphicPath);

      const qualityCalculator = new DynamicQualityCalculator(70);

      // Test photo quality calculation
      const photoResult = await qualityCalculator.calculateOptimalQuality(photoPath);
      expect(photoResult.quality).toBeGreaterThanOrEqual(70);
      expect(photoResult.quality).toBeLessThanOrEqual(100);
      expect(photoResult.contentType).toBe('photo');
      expect(photoResult.reasoning).toContain('photo');

      // Test graphic quality calculation
      const graphicResult = await qualityCalculator.calculateOptimalQuality(graphicPath);
      expect(graphicResult.quality).toBeGreaterThanOrEqual(70);
      expect(graphicResult.quality).toBeLessThanOrEqual(100);
      expect(graphicResult.reasoning).toContain('Quality');
    });

    it('should respect minimum quality threshold', async () => {
      const testImagePath = path.join(testImagesDir, 'test.jpg');
      await createTestImage(testImagePath, 'jpeg');

      const qualityCalculator = new DynamicQualityCalculator(85);
      const result = await qualityCalculator.calculateOptimalQuality(testImagePath);

      expect(result.quality).toBeGreaterThanOrEqual(85);
    });

    it('should handle batch quality calculation', async () => {
      const imagePaths = [
        path.join(testImagesDir, 'image1.jpg'),
        path.join(testImagesDir, 'image2.png')
      ];

      await createTestImage(imagePaths[0], 'jpeg');
      await createTestImage(imagePaths[1], 'png');

      const qualityCalculator = new DynamicQualityCalculator(70);
      const results = await qualityCalculator.calculateBatchQuality(imagePaths);

      expect(results).toHaveLength(2);
      results.forEach(result => {
        expect(result.quality).toBeGreaterThanOrEqual(70);
        expect(result.quality).toBeLessThanOrEqual(100);
        expect(result.reasoning).toBeTruthy();
      });
    });
  });

  describe('Quality Validator', () => {
    it('should validate output quality against original', async () => {
      const originalPath = path.join(testImagesDir, 'original.jpg');
      const optimizedPath = path.join(outputDir, 'optimized.webp');
      
      await createTestImage(originalPath, 'jpeg');

      // Convert to WebP for validation
      const converter = new WebPConverter();
      await converter.convertToWebP(originalPath, optimizedPath, 85);

      const validator = new QualityValidator(70);
      const validation = await validator.validateOutputQuality(originalPath, optimizedPath, 85);

      expect(validation.isValid).toBe(true);
      expect(validation.qualityScore).toBeGreaterThan(0);
      expect(validation.sizeReduction).toBeGreaterThan(0);
      expect(validation.meetsThreshold).toBe(true);
      expect(validation.metrics.originalSize).toBeGreaterThan(0);
      expect(validation.metrics.optimizedSize).toBeGreaterThan(0);
      expect(validation.metrics.compressionRatio).toBeGreaterThan(1);
    });

    it('should detect quality issues', async () => {
      const originalPath = path.join(testImagesDir, 'original.jpg');
      const optimizedPath = path.join(outputDir, 'optimized.webp');
      
      await createTestImage(originalPath, 'jpeg');

      // Convert with very low quality to trigger validation issues
      const converter = new WebPConverter();
      await converter.convertToWebP(originalPath, optimizedPath, 10);

      const validator = new QualityValidator(80); // High threshold
      const validation = await validator.validateOutputQuality(originalPath, optimizedPath, 10);

      expect(validation.qualityScore).toBeLessThan(80);
      expect(validation.meetsThreshold).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
    });

    it('should generate quality report for multiple images', async () => {
      const validationResults = [
        {
          imagePath: 'test1.jpg',
          isValid: true,
          qualityScore: 85,
          sizeReduction: 30,
          meetsThreshold: true,
          issues: [],
          metrics: {
            originalSize: 1000,
            optimizedSize: 700,
            compressionRatio: 1.43,
            qualityLoss: 15,
            structuralSimilarity: 0.9
          }
        },
        {
          imagePath: 'test2.png',
          isValid: true,
          qualityScore: 90,
          sizeReduction: 50,
          meetsThreshold: true,
          issues: [],
          metrics: {
            originalSize: 2000,
            optimizedSize: 1000,
            compressionRatio: 2.0,
            qualityLoss: 10,
            structuralSimilarity: 0.95
          }
        }
      ];

      const validator = new QualityValidator(70);
      const report = validator.generateQualityReport(validationResults);

      expect(report.totalImages).toBe(2);
      expect(report.validImages).toBe(2);
      expect(report.averageQualityScore).toBe(87.5);
      expect(report.averageSizeReduction).toBe(40);
      expect(report.thresholdCompliance).toBe(100);
      expect(report.overallMetrics.totalOriginalSize).toBe(3000);
      expect(report.overallMetrics.totalOptimizedSize).toBe(1700);
    });
  });

  describe('End-to-End Quality Optimization', () => {
    it('should optimize image with quality validation', async () => {
      const originalPath = path.join(testImagesDir, 'test.jpg');
      const optimizedPath = path.join(outputDir, 'test.webp');
      
      await createTestImage(originalPath, 'jpeg');

      // Calculate optimal quality
      const qualityCalculator = new DynamicQualityCalculator(70);
      const qualityResult = await qualityCalculator.calculateOptimalQuality(originalPath);

      // Convert with calculated quality
      const converter = new WebPConverter();
      const conversionResult = await converter.convertToWebP(
        originalPath, 
        optimizedPath, 
        qualityResult.quality
      );

      expect(conversionResult.status).toBe('success');
      expect(conversionResult.qualityScore).toBe(qualityResult.quality);

      // Validate the result
      const validator = new QualityValidator(70);
      const validation = await validator.validateOutputQuality(
        originalPath, 
        optimizedPath, 
        qualityResult.quality
      );

      expect(validation.isValid).toBe(true);
      expect(validation.meetsThreshold).toBe(true);
      
      // Verify file exists and has reasonable size
      const outputExists = await fs.pathExists(optimizedPath);
      expect(outputExists).toBe(true);
      
      const outputStats = await fs.stat(optimizedPath);
      expect(outputStats.size).toBeGreaterThan(0);
    });

    it('should handle different image formats consistently', async () => {
      const formats = [
        { ext: 'jpg', format: 'jpeg' as const },
        { ext: 'png', format: 'png' as const }
      ];

      const qualityCalculator = new DynamicQualityCalculator(70);
      const converter = new WebPConverter();
      const validator = new QualityValidator(70);

      for (const { ext, format } of formats) {
        const originalPath = path.join(testImagesDir, `test.${ext}`);
        const optimizedPath = path.join(outputDir, `test-${ext}.webp`);
        
        await createTestImage(originalPath, format);

        // Full optimization pipeline
        const qualityResult = await qualityCalculator.calculateOptimalQuality(originalPath);
        const conversionResult = await converter.convertToWebP(
          originalPath, 
          optimizedPath, 
          qualityResult.quality
        );
        const validation = await validator.validateOutputQuality(
          originalPath, 
          optimizedPath, 
          qualityResult.quality
        );

        expect(conversionResult.status).toBe('success');
        expect(validation.isValid).toBe(true);
        expect(validation.meetsThreshold).toBe(true);
      }
    });
  });
});

/**
 * Create a test image that resembles a photograph
 */
async function createPhotoLikeImage(filePath: string): Promise<void> {
  const sharp = require('sharp');
  
  // Create an image with gradients and smooth transitions (photo-like)
  const image = sharp({
    create: {
      width: 200,
      height: 150,
      channels: 3,
      background: { r: 100, g: 150, b: 200 }
    }
  });

  await image
    .blur(2) // Add slight blur for photo-like quality
    .jpeg({ quality: 90 })
    .toFile(filePath);
}

/**
 * Create a test image that resembles a graphic/screenshot
 */
async function createGraphicLikeImage(filePath: string): Promise<void> {
  const sharp = require('sharp');
  
  // Create an image with sharp edges and solid colors (graphic-like)
  const image = sharp({
    create: {
      width: 200,
      height: 150,
      channels: 4, // Include alpha channel
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  });

  await image
    .png({ compressionLevel: 6 })
    .toFile(filePath);
}

/**
 * Create a basic test image
 */
async function createTestImage(filePath: string, format: 'jpeg' | 'png'): Promise<void> {
  const sharp = require('sharp');
  
  const image = sharp({
    create: {
      width: 100,
      height: 100,
      channels: 3,
      background: { r: 128, g: 128, b: 128 }
    }
  });

  if (format === 'jpeg') {
    await image.jpeg({ quality: 85 }).toFile(filePath);
  } else {
    await image.png().toFile(filePath);
  }
}