/**
 * Utility functions for file management and processing
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { DEFAULT_CONFIG } from '../types';

/**
 * File management utilities for image optimization
 */
export class FileManager {
  private supportedExtensions: string[];

  constructor(supportedFormats?: string[]) {
    this.supportedExtensions = supportedFormats || DEFAULT_CONFIG.supportedFormats;
  }

  /**
   * Recursively scan source directory for supported image formats
   * @param sourcePath - Directory path to scan
   * @returns Array of image file paths
   */
  async scanDirectory(sourcePath: string): Promise<string[]> {
    const imageFiles: string[] = [];

    try {
      // Check if source path exists and is a directory
      const stats = await fs.stat(sourcePath);
      if (!stats.isDirectory()) {
        throw new Error(`Source path is not a directory: ${sourcePath}`);
      }

      // Read directory contents
      const entries = await fs.readdir(sourcePath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(sourcePath, entry.name);

        if (entry.isDirectory()) {
          // Recursively scan subdirectories
          const subDirectoryFiles = await this.scanDirectory(fullPath);
          imageFiles.push(...subDirectoryFiles);
        } else if (entry.isFile()) {
          // Check if file has supported extension
          if (this.isSupportedImageFile(entry.name)) {
            imageFiles.push(fullPath);
          }
        }
      }

      return imageFiles;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to scan directory ${sourcePath}: ${error.message}`);
      }
      throw new Error(`Failed to scan directory ${sourcePath}: Unknown error`);
    }
  }

  /**
   * Check if a file has a supported image extension
   * @param filename - Name of the file to check
   * @returns True if file has supported extension
   */
  private isSupportedImageFile(filename: string): boolean {
    const extension = path.extname(filename).toLowerCase().replace('.', '');
    return this.supportedExtensions.includes(extension);
  }

  /**
   * Get supported file extensions
   * @returns Array of supported extensions
   */
  getSupportedExtensions(): string[] {
    return [...this.supportedExtensions];
  }

  /**
   * Generate WebP filename while preserving original name structure
   * @param originalPath - Original image file path
   * @returns WebP filename with preserved structure
   */
  generateWebPFilename(originalPath: string): string {
    const parsedPath = path.parse(originalPath);
    
    // Preserve the original filename (including special characters and spaces)
    // Only replace the extension with .webp
    return parsedPath.name + '.webp';
  }

  /**
   * Generate full WebP output path
   * @param originalPath - Original image file path
   * @param outputDirectory - Target output directory
   * @returns Full path for WebP output file
   */
  generateWebPOutputPath(originalPath: string, outputDirectory: string): string {
    const webpFilename = this.generateWebPFilename(originalPath);
    return path.join(outputDirectory, webpFilename);
  }

  /**
   * Validate filename for special characters and ensure compatibility
   * @param filename - Filename to validate
   * @returns True if filename is valid for web use
   */
  validateFilename(filename: string): boolean {
    // Check for empty filename
    if (!filename || filename.trim().length === 0) {
      return false;
    }

    // Check for reserved characters that might cause issues on some systems
    const reservedChars = /[<>:"|?*]/;
    if (reservedChars.test(filename)) {
      return false;
    }

    // Check for control characters
    const controlChars = /[\x00-\x1f\x80-\x9f]/;
    if (controlChars.test(filename)) {
      return false;
    }

    return true;
  }

  /**
   * Sanitize filename while preserving as much of the original as possible
   * @param filename - Original filename
   * @returns Sanitized filename safe for web use
   */
  sanitizeFilename(filename: string): string {
    if (this.validateFilename(filename)) {
      return filename;
    }

    // Replace problematic characters with safe alternatives
    let sanitized = filename
      .replace(/[<>:"|?*]/g, '_')  // Replace reserved chars with underscore
      .replace(/[\x00-\x1f\x80-\x9f]/g, '')  // Remove control characters
      .trim();

    // Ensure we don't end up with an empty filename
    if (sanitized.length === 0) {
      sanitized = 'image';
    }

    return sanitized;
  }

  /**
   * Create and manage output directory structure
   * @param outputPath - Path where optimized images will be saved
   * @returns Promise that resolves when directory is ready
   */
  async createOutputDirectory(outputPath: string): Promise<void> {
    try {
      // Ensure the output directory exists
      await fs.ensureDir(outputPath);
      
      // Verify we can write to the directory
      await fs.access(outputPath, fs.constants.W_OK);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to create or access output directory ${outputPath}: ${error.message}`);
      }
      throw new Error(`Failed to create or access output directory ${outputPath}: Unknown error`);
    }
  }

  /**
   * Generate filename mapping for integration reference
   * @param originalFiles - Array of original file paths
   * @param outputDirectory - Output directory path
   * @returns Mapping object from original to optimized filenames
   */
  generateFilenameMapping(originalFiles: string[], outputDirectory: string): Record<string, string> {
    const mapping: Record<string, string> = {};

    for (const originalPath of originalFiles) {
      const originalFilename = path.basename(originalPath);
      const webpFilename = this.generateWebPFilename(originalPath);
      const webpPath = path.join(outputDirectory, webpFilename);

      mapping[originalFilename] = webpFilename;
    }

    return mapping;
  }

  /**
   * Save filename mapping to a JSON file for integration reference
   * @param mapping - Filename mapping object
   * @param outputDirectory - Directory to save the mapping file
   * @param filename - Name of the mapping file (default: 'filename-mapping.json')
   */
  async saveFilenameMapping(
    mapping: Record<string, string>, 
    outputDirectory: string, 
    filename: string = 'filename-mapping.json'
  ): Promise<void> {
    try {
      const mappingPath = path.join(outputDirectory, filename);
      const mappingData = {
        generatedAt: new Date().toISOString(),
        totalFiles: Object.keys(mapping).length,
        mapping: mapping
      };

      await fs.writeJson(mappingPath, mappingData, { spaces: 2 });
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to save filename mapping: ${error.message}`);
      }
      throw new Error('Failed to save filename mapping: Unknown error');
    }
  }

  /**
   * Check if output directory is empty or contains only mapping files
   * @param outputPath - Output directory path
   * @returns True if directory is safe to use for output
   */
  async isOutputDirectorySafe(outputPath: string): Promise<boolean> {
    try {
      const exists = await fs.pathExists(outputPath);
      if (!exists) {
        return true; // Directory doesn't exist, safe to create
      }

      const files = await fs.readdir(outputPath);
      
      // Consider directory safe if empty or contains only mapping/report files
      const safeFiles = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        const basename = path.basename(file, ext).toLowerCase();
        return ext === '.json' && (
          basename.includes('mapping') || 
          basename.includes('report') ||
          basename.includes('optimization')
        );
      });

      return files.length === safeFiles.length;
    } catch (error) {
      return false; // If we can't check, assume it's not safe
    }
  }
}