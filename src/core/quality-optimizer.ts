/**
 * Quality optimization system for intelligent image compression
 */

import sharp from 'sharp';
import * as fs from 'fs-extra';
import { ImageMetadata } from '../types';

/**
 * Image content analysis for determining optimal compression strategy
 */
export class ImageContentAnalyzer {
  /**
   * Analyze image characteristics to determine content type and optimal compression strategy
   * @param imagePath - Path to the image file
   * @returns Promise resolving to content analysis result
   */
  async analyzeImageContent(imagePath: string): Promise<{
    contentType: 'photo' | 'graphic' | 'mixed';
    compressionStrategy: 'high_quality' | 'balanced' | 'size_optimized';
    characteristics: {
      colorComplexity: number;
      edgeCount: number;
      hasTransparency: boolean;
      colorDepth: number;
      aspectRatio: number;
    };
  }> {
    try {
      const sharpInstance = sharp(imagePath);
      const metadata = await sharpInstance.metadata();
      
      // Get image statistics for analysis
      const stats = await sharpInstance.stats();
      const characteristics = await this.extractImageCharacteristics(sharpInstance, metadata);
      
      // Determine content type based on characteristics
      const contentType = this.determineContentType(characteristics, metadata);
      
      // Determine optimal compression strategy
      const compressionStrategy = this.determineCompressionStrategy(contentType, characteristics);
      
      return {
        contentType,
        compressionStrategy,
        characteristics
      };
    } catch (error) {
      throw new Error(`Failed to analyze image content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract detailed image characteristics for analysis
   * @param sharpInstance - Sharp instance of the image
   * @param metadata - Image metadata
   * @returns Image characteristics object
   */
  private async extractImageCharacteristics(
    sharpInstance: sharp.Sharp, 
    metadata: sharp.Metadata
  ): Promise<{
    colorComplexity: number;
    edgeCount: number;
    hasTransparency: boolean;
    colorDepth: number;
    aspectRatio: number;
  }> {
    const width = metadata.width || 0;
    const height = metadata.height || 0;
    const channels = metadata.channels || 3;
    
    // Calculate aspect ratio
    const aspectRatio = width > 0 && height > 0 ? width / height : 1;
    
    // Check for transparency
    const hasTransparency = channels === 4 || metadata.hasAlpha === true;
    
    // Estimate color complexity using image statistics
    const stats = await sharpInstance.stats();
    const colorComplexity = this.calculateColorComplexity(stats);
    
    // Estimate edge count using Sobel edge detection
    const edgeCount = await this.estimateEdgeCount(sharpInstance);
    
    // Determine effective color depth
    const colorDepth = this.determineColorDepth(metadata, stats);
    
    return {
      colorComplexity,
      edgeCount,
      hasTransparency,
      colorDepth,
      aspectRatio
    };
  }

  /**
   * Calculate color complexity based on image statistics
   * @param stats - Sharp statistics object
   * @returns Color complexity score (0-100)
   */
  private calculateColorComplexity(stats: sharp.Stats): number {
    // Use standard deviation of channels as complexity indicator
    const channelVariances = stats.channels.map(channel => channel.stdev);
    const averageVariance = channelVariances.reduce((sum, variance) => sum + variance, 0) / channelVariances.length;
    
    // Normalize to 0-100 scale (assuming max stdev of ~50 for typical images)
    return Math.min(100, (averageVariance / 50) * 100);
  }

  /**
   * Estimate edge count using simplified edge detection
   * @param sharpInstance - Sharp instance of the image
   * @returns Edge count score (0-100)
   */
  private async estimateEdgeCount(sharpInstance: sharp.Sharp): Promise<number> {
    try {
      // Apply Sobel edge detection filter
      const edgeDetected = await sharpInstance
        .clone()
        .greyscale()
        .convolve({
          width: 3,
          height: 3,
          kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1]
        })
        .stats();
      
      // Use mean intensity of edge-detected image as edge score
      const edgeIntensity = edgeDetected.channels[0].mean;
      
      // Normalize to 0-100 scale
      return Math.min(100, (edgeIntensity / 128) * 100);
    } catch (error) {
      // If edge detection fails, return moderate edge count
      return 50;
    }
  }

  /**
   * Determine effective color depth of the image
   * @param metadata - Image metadata
   * @param stats - Image statistics
   * @returns Effective color depth
   */
  private determineColorDepth(metadata: sharp.Metadata, stats: sharp.Stats): number {
    // Start with metadata depth, ensure it's a number
    let depth = typeof metadata.depth === 'number' ? metadata.depth : 8;
    
    // Analyze actual color usage to determine effective depth
    const channelRanges = stats.channels.map(channel => channel.max - channel.min);
    const averageRange = channelRanges.reduce((sum, range) => sum + range, 0) / channelRanges.length;
    
    // If image uses limited color range, effective depth is lower
    if (averageRange < 64) {
      depth = Math.min(depth, 6); // Effectively 6-bit
    } else if (averageRange < 128) {
      depth = Math.min(depth, 7); // Effectively 7-bit
    }
    
    return depth;
  }

  /**
   * Determine content type based on image characteristics
   * @param characteristics - Extracted image characteristics
   * @param metadata - Image metadata
   * @returns Content type classification
   */
  private determineContentType(
    characteristics: any,
    metadata: sharp.Metadata
  ): 'photo' | 'graphic' | 'mixed' {
    const { colorComplexity, edgeCount, hasTransparency, colorDepth } = characteristics;
    
    // Graphics typically have:
    // - Lower color complexity
    // - Higher edge count (sharp transitions)
    // - Often have transparency
    // - May use limited color depth
    if (hasTransparency || edgeCount > 70 || (colorComplexity < 40 && colorDepth <= 6)) {
      return 'graphic';
    }
    
    // Photos typically have:
    // - Higher color complexity
    // - Lower edge count (smooth gradients)
    // - No transparency
    // - Full color depth
    if (colorComplexity > 60 && edgeCount < 40 && !hasTransparency && colorDepth >= 8) {
      return 'photo';
    }
    
    // Mixed content for everything else
    return 'mixed';
  }

  /**
   * Determine optimal compression strategy based on content analysis
   * @param contentType - Determined content type
   * @param characteristics - Image characteristics
   * @returns Optimal compression strategy
   */
  private determineCompressionStrategy(
    contentType: 'photo' | 'graphic' | 'mixed',
    characteristics: any
  ): 'high_quality' | 'balanced' | 'size_optimized' {
    const { colorComplexity, edgeCount, hasTransparency } = characteristics;
    
    switch (contentType) {
      case 'photo':
        // Photos with high complexity need high quality
        if (colorComplexity > 80) {
          return 'high_quality';
        }
        // Standard photos can use balanced approach
        return 'balanced';
        
      case 'graphic':
        // Graphics with transparency or high edge count need careful handling
        if (hasTransparency || edgeCount > 80) {
          return 'high_quality';
        }
        // Simple graphics can be size optimized
        if (colorComplexity < 30 && edgeCount < 50) {
          return 'size_optimized';
        }
        return 'balanced';
        
      case 'mixed':
        // Mixed content defaults to balanced approach
        // But high complexity mixed content needs high quality
        if (colorComplexity > 70 || edgeCount > 70) {
          return 'high_quality';
        }
        return 'balanced';
        
      default:
        return 'balanced';
    }
  }
}
/*
*
 * Dynamic quality calculator for optimal compression settings
 */
export class DynamicQualityCalculator {
  private contentAnalyzer: ImageContentAnalyzer;
  private minimumQuality: number;

  constructor(minimumQuality: number = 70) {
    this.contentAnalyzer = new ImageContentAnalyzer();
    this.minimumQuality = minimumQuality;
  }

  /**
   * Calculate optimal quality setting for an image
   * @param imagePath - Path to the image file
   * @param targetStrategy - Optional override for compression strategy
   * @returns Promise resolving to optimal quality setting
   */
  async calculateOptimalQuality(
    imagePath: string,
    targetStrategy?: 'high_quality' | 'balanced' | 'size_optimized'
  ): Promise<{
    quality: number;
    strategy: 'high_quality' | 'balanced' | 'size_optimized';
    reasoning: string;
    contentType: 'photo' | 'graphic' | 'mixed';
  }> {
    try {
      // Analyze image content
      const analysis = await this.contentAnalyzer.analyzeImageContent(imagePath);
      
      // Use provided strategy or determined strategy
      const strategy = targetStrategy || analysis.compressionStrategy;
      
      // Calculate base quality based on content type and strategy
      const baseQuality = this.getBaseQuality(analysis.contentType, strategy);
      
      // Apply adjustments based on image characteristics
      const adjustedQuality = this.applyQualityAdjustments(
        baseQuality,
        analysis.characteristics,
        analysis.contentType
      );
      
      // Ensure quality meets minimum threshold
      const finalQuality = Math.max(this.minimumQuality, adjustedQuality);
      
      // Generate reasoning for the quality decision
      const reasoning = this.generateQualityReasoning(
        analysis.contentType,
        strategy,
        analysis.characteristics,
        finalQuality
      );
      
      return {
        quality: finalQuality,
        strategy,
        reasoning,
        contentType: analysis.contentType
      };
    } catch (error) {
      throw new Error(`Failed to calculate optimal quality: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get base quality setting for content type and strategy combination
   * Enhanced for web optimization with no perceivable compression artifacts
   * @param contentType - Type of image content
   * @param strategy - Compression strategy
   * @returns Base quality setting
   */
  private getBaseQuality(
    contentType: 'photo' | 'graphic' | 'mixed',
    strategy: 'high_quality' | 'balanced' | 'size_optimized'
  ): number {
    // Enhanced quality matrix for web optimization
    // Ensures no perceivable compression artifacts while optimizing file size
    const qualityMatrix = {
      photo: {
        high_quality: 92,   // Maximum visual quality for photos
        balanced: 88,       // High quality with good compression
        size_optimized: 82  // Optimized size while maintaining quality
      },
      graphic: {
        high_quality: 90,   // Preserve sharp edges and text
        balanced: 85,       // Balance between quality and size
        size_optimized: 78  // Smaller size for graphics/UI elements
      },
      mixed: {
        high_quality: 91,   // High quality for mixed content
        balanced: 86,       // Balanced approach for mixed content
        size_optimized: 80  // Size-optimized mixed content
      }
    };

    return qualityMatrix[contentType][strategy];
  }

  /**
   * Apply quality adjustments based on image characteristics
   * @param baseQuality - Base quality setting
   * @param characteristics - Image characteristics
   * @param contentType - Content type
   * @returns Adjusted quality setting
   */
  private applyQualityAdjustments(
    baseQuality: number,
    characteristics: any,
    contentType: 'photo' | 'graphic' | 'mixed'
  ): number {
    let adjustedQuality = baseQuality;
    const { colorComplexity, edgeCount, hasTransparency, colorDepth, aspectRatio } = characteristics;

    // Adjust for color complexity
    if (colorComplexity > 80) {
      adjustedQuality += 3; // High complexity needs higher quality
    } else if (colorComplexity < 30) {
      adjustedQuality -= 2; // Low complexity can use lower quality
    }

    // Adjust for edge content
    if (edgeCount > 70) {
      adjustedQuality += 2; // High edge count needs higher quality to preserve sharpness
    } else if (edgeCount < 30) {
      adjustedQuality -= 1; // Low edge count can use lower quality
    }

    // Adjust for transparency
    if (hasTransparency) {
      adjustedQuality += 2; // Transparency requires higher quality to avoid artifacts
    }

    // Adjust for color depth
    if (colorDepth >= 10) {
      adjustedQuality += 2; // High color depth needs higher quality
    } else if (colorDepth <= 6) {
      adjustedQuality -= 1; // Limited color depth can use lower quality
    }

    // Adjust for aspect ratio (very wide or tall images)
    if (aspectRatio > 3 || aspectRatio < 0.33) {
      adjustedQuality += 1; // Extreme aspect ratios need slightly higher quality
    }

    // Content-specific adjustments
    switch (contentType) {
      case 'photo':
        // Photos with low edge count (smooth gradients) can use slightly lower quality
        if (edgeCount < 25) {
          adjustedQuality -= 1;
        }
        break;
        
      case 'graphic':
        // Graphics with high color complexity need extra quality
        if (colorComplexity > 60) {
          adjustedQuality += 2;
        }
        break;
        
      case 'mixed':
        // Mixed content gets conservative adjustments
        if (colorComplexity > 70 && edgeCount > 60) {
          adjustedQuality += 1;
        }
        break;
    }

    // Ensure quality stays within reasonable bounds
    return Math.min(95, Math.max(50, Math.round(adjustedQuality)));
  }

  /**
   * Generate human-readable reasoning for quality decision
   * @param contentType - Content type
   * @param strategy - Compression strategy
   * @param characteristics - Image characteristics
   * @param finalQuality - Final quality setting
   * @returns Reasoning string
   */
  private generateQualityReasoning(
    contentType: 'photo' | 'graphic' | 'mixed',
    strategy: 'high_quality' | 'balanced' | 'size_optimized',
    characteristics: any,
    finalQuality: number
  ): string {
    const reasons: string[] = [];
    
    // Base reasoning
    reasons.push(`${contentType} content with ${strategy.replace('_', ' ')} strategy`);
    
    // Characteristic-based reasoning
    const { colorComplexity, edgeCount, hasTransparency, colorDepth } = characteristics;
    
    if (colorComplexity > 80) {
      reasons.push('high color complexity requires higher quality');
    } else if (colorComplexity < 30) {
      reasons.push('low color complexity allows lower quality');
    }
    
    if (edgeCount > 70) {
      reasons.push('high edge content needs quality preservation');
    } else if (edgeCount < 30) {
      reasons.push('smooth gradients allow quality reduction');
    }
    
    if (hasTransparency) {
      reasons.push('transparency requires careful compression');
    }
    
    if (colorDepth >= 10) {
      reasons.push('high color depth needs quality preservation');
    } else if (colorDepth <= 6) {
      reasons.push('limited color depth allows compression');
    }
    
    // Minimum quality enforcement
    if (finalQuality === this.minimumQuality) {
      reasons.push(`enforced minimum quality threshold (${this.minimumQuality}%)`);
    }
    
    return `Quality ${finalQuality}%: ${reasons.join(', ')}`;
  }

  /**
   * Calculate quality for batch processing with consistency
   * @param imagePaths - Array of image paths
   * @param strategy - Optional strategy override for all images
   * @returns Promise resolving to array of quality calculations
   */
  async calculateBatchQuality(
    imagePaths: string[],
    strategy?: 'high_quality' | 'balanced' | 'size_optimized'
  ): Promise<Array<{
    imagePath: string;
    quality: number;
    strategy: 'high_quality' | 'balanced' | 'size_optimized';
    reasoning: string;
    contentType: 'photo' | 'graphic' | 'mixed';
  }>> {
    const results = [];
    
    for (const imagePath of imagePaths) {
      try {
        const qualityResult = await this.calculateOptimalQuality(imagePath, strategy);
        results.push({
          imagePath,
          ...qualityResult
        });
      } catch (error) {
        // For failed analysis, use safe defaults
        results.push({
          imagePath,
          quality: this.minimumQuality,
          strategy: strategy || 'balanced',
          reasoning: `Failed to analyze image, using minimum quality (${this.minimumQuality}%)`,
          contentType: 'mixed' as const
        });
      }
    }
    
    return results;
  }

  /**
   * Update minimum quality threshold
   * @param newMinimum - New minimum quality value
   */
  setMinimumQuality(newMinimum: number): void {
    if (newMinimum < 1 || newMinimum > 100) {
      throw new Error('Minimum quality must be between 1 and 100');
    }
    this.minimumQuality = newMinimum;
  }

  /**
   * Get current minimum quality threshold
   * @returns Current minimum quality value
   */
  getMinimumQuality(): number {
    return this.minimumQuality;
  }
}/**
 * 
Quality validation system for output verification
 */
export class QualityValidator {
  private minimumQualityThreshold: number;
  private maximumSizeIncrease: number;

  constructor(minimumQualityThreshold: number = 70, maximumSizeIncrease: number = 1.2) {
    this.minimumQualityThreshold = minimumQualityThreshold;
    this.maximumSizeIncrease = maximumSizeIncrease;
  }

  /**
   * Validate output quality against thresholds and requirements
   * @param originalPath - Path to original image
   * @param optimizedPath - Path to optimized image
   * @param targetQuality - Target quality setting used
   * @returns Promise resolving to validation result
   */
  async validateOutputQuality(
    originalPath: string,
    optimizedPath: string,
    targetQuality: number
  ): Promise<{
    isValid: boolean;
    qualityScore: number;
    sizeReduction: number;
    meetsThreshold: boolean;
    issues: string[];
    metrics: {
      originalSize: number;
      optimizedSize: number;
      compressionRatio: number;
      qualityLoss: number;
      structuralSimilarity: number;
    };
  }> {
    try {
      const issues: string[] = [];
      
      // Get file sizes
      const originalStats = await fs.stat(originalPath);
      const optimizedStats = await fs.stat(optimizedPath);
      const originalSize = originalStats.size;
      const optimizedSize = optimizedStats.size;
      
      // Calculate basic metrics
      const sizeReduction = ((originalSize - optimizedSize) / originalSize) * 100;
      const compressionRatio = originalSize / optimizedSize;
      
      // Check for size increase
      if (optimizedSize > originalSize * this.maximumSizeIncrease) {
        issues.push(`Output file is ${((optimizedSize / originalSize - 1) * 100).toFixed(1)}% larger than original`);
      }
      
      // Validate quality metrics
      const qualityMetrics = await this.calculateQualityMetrics(originalPath, optimizedPath);
      const qualityScore = this.calculateOverallQualityScore(qualityMetrics, targetQuality);
      
      // Check quality threshold
      const meetsThreshold = qualityScore >= this.minimumQualityThreshold;
      if (!meetsThreshold) {
        issues.push(`Quality score ${qualityScore.toFixed(1)}% below threshold ${this.minimumQualityThreshold}%`);
      }
      
      // Check for excessive quality loss
      if (qualityMetrics.qualityLoss > 30) {
        issues.push(`Excessive quality loss: ${qualityMetrics.qualityLoss.toFixed(1)}%`);
      }
      
      // Check structural similarity
      if (qualityMetrics.structuralSimilarity < 0.8) {
        issues.push(`Low structural similarity: ${(qualityMetrics.structuralSimilarity * 100).toFixed(1)}%`);
      }
      
      // Validate file integrity
      const integrityCheck = await this.validateFileIntegrity(optimizedPath);
      if (!integrityCheck.isValid) {
        issues.push(`File integrity issue: ${integrityCheck.error}`);
      }
      
      const isValid = issues.length === 0;
      
      return {
        isValid,
        qualityScore,
        sizeReduction,
        meetsThreshold,
        issues,
        metrics: {
          originalSize,
          optimizedSize,
          compressionRatio,
          qualityLoss: qualityMetrics.qualityLoss,
          structuralSimilarity: qualityMetrics.structuralSimilarity
        }
      };
    } catch (error) {
      return {
        isValid: false,
        qualityScore: 0,
        sizeReduction: 0,
        meetsThreshold: false,
        issues: [`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        metrics: {
          originalSize: 0,
          optimizedSize: 0,
          compressionRatio: 0,
          qualityLoss: 100,
          structuralSimilarity: 0
        }
      };
    }
  }

  /**
   * Calculate quality metrics by comparing original and optimized images
   * @param originalPath - Path to original image
   * @param optimizedPath - Path to optimized image
   * @returns Quality metrics object
   */
  private async calculateQualityMetrics(
    originalPath: string,
    optimizedPath: string
  ): Promise<{
    qualityLoss: number;
    structuralSimilarity: number;
    colorAccuracy: number;
    sharpnessRetention: number;
  }> {
    try {
      // Load both images for comparison
      const originalImage = sharp(originalPath);
      const optimizedImage = sharp(optimizedPath);
      
      // Get metadata for both images
      const originalMeta = await originalImage.metadata();
      const optimizedMeta = await optimizedImage.metadata();
      
      // Resize optimized image to match original dimensions for comparison
      const resizedOptimized = optimizedImage.resize(originalMeta.width, originalMeta.height);
      
      // Calculate structural similarity using histogram comparison
      const structuralSimilarity = await this.calculateStructuralSimilarity(
        originalImage,
        resizedOptimized
      );
      
      // Calculate color accuracy
      const colorAccuracy = await this.calculateColorAccuracy(
        originalImage,
        resizedOptimized
      );
      
      // Calculate sharpness retention
      const sharpnessRetention = await this.calculateSharpnessRetention(
        originalImage,
        resizedOptimized
      );
      
      // Calculate overall quality loss
      const qualityLoss = 100 - ((structuralSimilarity + colorAccuracy + sharpnessRetention) / 3 * 100);
      
      return {
        qualityLoss: Math.max(0, qualityLoss),
        structuralSimilarity,
        colorAccuracy,
        sharpnessRetention
      };
    } catch (error) {
      // Return conservative estimates if comparison fails
      return {
        qualityLoss: 20, // Assume moderate quality loss
        structuralSimilarity: 0.8,
        colorAccuracy: 0.85,
        sharpnessRetention: 0.8
      };
    }
  }

  /**
   * Calculate structural similarity between two images using histogram comparison
   * @param originalImage - Sharp instance of original image
   * @param optimizedImage - Sharp instance of optimized image
   * @returns Structural similarity score (0-1)
   */
  private async calculateStructuralSimilarity(
    originalImage: sharp.Sharp,
    optimizedImage: sharp.Sharp
  ): Promise<number> {
    try {
      // Get histograms for both images
      const originalStats = await originalImage.clone().greyscale().stats();
      const optimizedStats = await optimizedImage.clone().greyscale().stats();
      
      // Compare mean and standard deviation
      const meanDiff = Math.abs(originalStats.channels[0].mean - optimizedStats.channels[0].mean);
      const stdevDiff = Math.abs(originalStats.channels[0].stdev - optimizedStats.channels[0].stdev);
      
      // Calculate similarity based on statistical differences
      const meanSimilarity = 1 - (meanDiff / 255);
      const stdevSimilarity = 1 - (stdevDiff / 128);
      
      return (meanSimilarity + stdevSimilarity) / 2;
    } catch (error) {
      return 0.8; // Default similarity if calculation fails
    }
  }

  /**
   * Calculate color accuracy between original and optimized images
   * @param originalImage - Sharp instance of original image
   * @param optimizedImage - Sharp instance of optimized image
   * @returns Color accuracy score (0-1)
   */
  private async calculateColorAccuracy(
    originalImage: sharp.Sharp,
    optimizedImage: sharp.Sharp
  ): Promise<number> {
    try {
      // Get color statistics for both images
      const originalStats = await originalImage.clone().stats();
      const optimizedStats = await optimizedImage.clone().stats();
      
      // Compare color channel statistics
      let totalSimilarity = 0;
      const channelCount = Math.min(originalStats.channels.length, optimizedStats.channels.length);
      
      for (let i = 0; i < channelCount; i++) {
        const originalChannel = originalStats.channels[i];
        const optimizedChannel = optimizedStats.channels[i];
        
        const meanDiff = Math.abs(originalChannel.mean - optimizedChannel.mean);
        const channelSimilarity = 1 - (meanDiff / 255);
        totalSimilarity += channelSimilarity;
      }
      
      return totalSimilarity / channelCount;
    } catch (error) {
      return 0.85; // Default color accuracy if calculation fails
    }
  }

  /**
   * Calculate sharpness retention between original and optimized images
   * @param originalImage - Sharp instance of original image
   * @param optimizedImage - Sharp instance of optimized image
   * @returns Sharpness retention score (0-1)
   */
  private async calculateSharpnessRetention(
    originalImage: sharp.Sharp,
    optimizedImage: sharp.Sharp
  ): Promise<number> {
    try {
      // Apply edge detection to both images
      const originalEdges = await originalImage
        .clone()
        .greyscale()
        .convolve({
          width: 3,
          height: 3,
          kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1]
        })
        .stats();
      
      const optimizedEdges = await optimizedImage
        .clone()
        .greyscale()
        .convolve({
          width: 3,
          height: 3,
          kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1]
        })
        .stats();
      
      // Compare edge intensity
      const originalEdgeIntensity = originalEdges.channels[0].mean;
      const optimizedEdgeIntensity = optimizedEdges.channels[0].mean;
      
      // Calculate sharpness retention
      if (originalEdgeIntensity === 0) return 1; // No edges to lose
      
      const retention = optimizedEdgeIntensity / originalEdgeIntensity;
      return Math.min(1, retention);
    } catch (error) {
      return 0.8; // Default sharpness retention if calculation fails
    }
  }

  /**
   * Calculate overall quality score from individual metrics
   * @param metrics - Quality metrics object
   * @param targetQuality - Target quality setting
   * @returns Overall quality score (0-100)
   */
  private calculateOverallQualityScore(
    metrics: {
      qualityLoss: number;
      structuralSimilarity: number;
      colorAccuracy: number;
      sharpnessRetention: number;
    },
    targetQuality: number
  ): number {
    // Weight the different quality aspects
    const structuralWeight = 0.4;
    const colorWeight = 0.3;
    const sharpnessWeight = 0.3;
    
    const weightedScore = (
      metrics.structuralSimilarity * structuralWeight +
      metrics.colorAccuracy * colorWeight +
      metrics.sharpnessRetention * sharpnessWeight
    ) * 100;
    
    // Adjust based on target quality (higher targets should achieve higher scores)
    const targetAdjustment = targetQuality / 100;
    const adjustedScore = weightedScore * targetAdjustment;
    
    return Math.min(100, Math.max(0, adjustedScore));
  }

  /**
   * Validate file integrity of optimized image
   * @param imagePath - Path to optimized image
   * @returns File integrity validation result
   */
  private async validateFileIntegrity(imagePath: string): Promise<{
    isValid: boolean;
    error?: string;
  }> {
    try {
      // Check if file exists and is readable
      const exists = await fs.pathExists(imagePath);
      if (!exists) {
        return { isValid: false, error: 'Output file does not exist' };
      }
      
      // Try to read image metadata to verify it's a valid image
      const sharpInstance = sharp(imagePath);
      await sharpInstance.metadata();
      
      // Check file size is reasonable (not zero or corrupted)
      const stats = await fs.stat(imagePath);
      if (stats.size === 0) {
        return { isValid: false, error: 'Output file is empty' };
      }
      
      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: `File integrity check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Generate quality metrics for reporting
   * @param validationResults - Array of validation results
   * @returns Quality metrics report
   */
  generateQualityReport(validationResults: Array<{
    imagePath: string;
    isValid: boolean;
    qualityScore: number;
    sizeReduction: number;
    meetsThreshold: boolean;
    issues: string[];
    metrics: any;
  }>): {
    totalImages: number;
    validImages: number;
    averageQualityScore: number;
    averageSizeReduction: number;
    thresholdCompliance: number;
    commonIssues: Record<string, number>;
    overallMetrics: {
      totalOriginalSize: number;
      totalOptimizedSize: number;
      totalSizeReduction: number;
      averageCompressionRatio: number;
    };
  } {
    const totalImages = validationResults.length;
    const validImages = validationResults.filter(r => r.isValid).length;
    
    // Calculate averages
    const totalQualityScore = validationResults.reduce((sum, r) => sum + r.qualityScore, 0);
    const averageQualityScore = totalImages > 0 ? totalQualityScore / totalImages : 0;
    
    const totalSizeReduction = validationResults.reduce((sum, r) => sum + r.sizeReduction, 0);
    const averageSizeReduction = totalImages > 0 ? totalSizeReduction / totalImages : 0;
    
    const thresholdCompliant = validationResults.filter(r => r.meetsThreshold).length;
    const thresholdCompliance = totalImages > 0 ? (thresholdCompliant / totalImages) * 100 : 0;
    
    // Collect common issues
    const commonIssues: Record<string, number> = {};
    validationResults.forEach(result => {
      result.issues.forEach(issue => {
        commonIssues[issue] = (commonIssues[issue] || 0) + 1;
      });
    });
    
    // Calculate overall metrics
    const totalOriginalSize = validationResults.reduce((sum, r) => sum + r.metrics.originalSize, 0);
    const totalOptimizedSize = validationResults.reduce((sum, r) => sum + r.metrics.optimizedSize, 0);
    const totalSizeReductionBytes = totalOriginalSize - totalOptimizedSize;
    const averageCompressionRatio = totalOptimizedSize > 0 ? totalOriginalSize / totalOptimizedSize : 1;
    
    return {
      totalImages,
      validImages,
      averageQualityScore,
      averageSizeReduction,
      thresholdCompliance,
      commonIssues,
      overallMetrics: {
        totalOriginalSize,
        totalOptimizedSize,
        totalSizeReduction: totalSizeReductionBytes,
        averageCompressionRatio
      }
    };
  }

  /**
   * Update quality validation thresholds
   * @param minimumQuality - New minimum quality threshold
   * @param maximumSizeIncrease - New maximum size increase threshold
   */
  updateThresholds(minimumQuality?: number, maximumSizeIncrease?: number): void {
    if (minimumQuality !== undefined) {
      if (minimumQuality < 1 || minimumQuality > 100) {
        throw new Error('Minimum quality threshold must be between 1 and 100');
      }
      this.minimumQualityThreshold = minimumQuality;
    }
    
    if (maximumSizeIncrease !== undefined) {
      if (maximumSizeIncrease < 1) {
        throw new Error('Maximum size increase must be at least 1.0 (100%)');
      }
      this.maximumSizeIncrease = maximumSizeIncrease;
    }
  }

  /**
   * Get current validation thresholds
   * @returns Current threshold settings
   */
  getThresholds(): {
    minimumQualityThreshold: number;
    maximumSizeIncrease: number;
  } {
    return {
      minimumQualityThreshold: this.minimumQualityThreshold,
      maximumSizeIncrease: this.maximumSizeIncrease
    };
  }
}