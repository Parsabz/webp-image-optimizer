/**
 * Integration tests for CLI functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import { spawn } from 'child_process';
import { promisify } from 'util';

describe('CLI Integration Tests', () => {
  const tempDir = path.join(__dirname, '../temp/cli-test');
  const testImagesDir = path.join(tempDir, 'images');
  const outputDir = path.join(tempDir, 'output');
  const cliPath = path.join(__dirname, '../../dist/index.js');

  beforeEach(async () => {
    // Ensure directories exist and are clean
    await fs.ensureDir(testImagesDir);
    await fs.ensureDir(outputDir);
    await fs.emptyDir(testImagesDir);
    await fs.emptyDir(outputDir);
    
    // Create test images
    await createTestImage(path.join(testImagesDir, 'photo.jpg'), 'jpeg');
    await createTestImage(path.join(testImagesDir, 'graphic.png'), 'png');
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.remove(tempDir);
  });

  it('should display help information', async () => {
    const result = await runCLI(['--help']);
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Usage: image-optimizer');
    expect(result.stdout).toContain('Convert and optimize images to WebP format');
    expect(result.stdout).toContain('Examples:');
  });

  it('should display version information', async () => {
    const result = await runCLI(['--version']);
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/\d+\.\d+\.\d+/); // Version pattern
  });

  it('should process images with basic command', async () => {
    const result = await runCLI([testImagesDir, outputDir]);
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Image Optimizer');
    expect(result.stdout).toContain('OPTIMIZATION COMPLETE');
    
    // Verify output files were created
    const outputFiles = await fs.readdir(outputDir);
    const webpFiles = outputFiles.filter(file => file.endsWith('.webp'));
    expect(webpFiles.length).toBeGreaterThan(0);
    
    // Verify report was generated
    const reportExists = await fs.pathExists(path.join(outputDir, 'optimization-report.json'));
    expect(reportExists).toBe(true);
  }, 60000);

  it('should process images with quality settings', async () => {
    const result = await runCLI([
      testImagesDir, 
      outputDir, 
      '--photo-quality', '90',
      '--graphic-quality', '75'
    ]);
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('OPTIMIZATION COMPLETE');
    
    // Verify output files
    const outputFiles = await fs.readdir(outputDir);
    const webpFiles = outputFiles.filter(file => file.endsWith('.webp'));
    expect(webpFiles.length).toBe(2);
  }, 60000);

  it('should handle verbose output', async () => {
    const result = await runCLI([testImagesDir, outputDir, '--verbose']);
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Configuration:');
    expect(result.stdout).toContain('Starting batch processing');
  }, 60000);

  it('should generate text report when requested', async () => {
    const result = await runCLI([
      testImagesDir, 
      outputDir, 
      '--report-format', 'text'
    ]);
    
    expect(result.exitCode).toBe(0);
    
    // Check for text report file
    const outputFiles = await fs.readdir(outputDir);
    const textReports = outputFiles.filter(file => file.includes('report') && file.endsWith('.text'));
    expect(textReports.length).toBeGreaterThan(0);
  }, 60000);

  it('should handle non-existent source directory', async () => {
    const nonExistentDir = path.join(tempDir, 'does-not-exist');
    const result = await runCLI([nonExistentDir, outputDir]);
    
    expect(result.exitCode).toBe(2); // Configuration error exit code
    expect(result.stderr).toContain('does not exist');
  });

  it('should handle invalid quality values', async () => {
    const result = await runCLI([
      testImagesDir, 
      outputDir, 
      '--quality', '150' // Invalid quality > 100
    ]);
    
    expect(result.exitCode).toBe(2); // Configuration error exit code
    expect(result.stderr).toContain('Quality must be');
  });

  it('should process with concurrency setting', async () => {
    const result = await runCLI([
      testImagesDir, 
      outputDir, 
      '--concurrency', '1',
      '--verbose'
    ]);
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Concurrency: 1');
  }, 60000);

  it('should skip progress reporting when requested', async () => {
    const result = await runCLI([
      testImagesDir, 
      outputDir, 
      '--no-progress'
    ]);
    
    expect(result.exitCode).toBe(0);
    // Should not contain progress bars or percentage indicators
    expect(result.stdout).not.toMatch(/\d+%/);
  }, 60000);
});

/**
 * Run CLI command and return result
 * @param args - Command line arguments
 * @returns Promise resolving to command result
 */
async function runCLI(args: string[]): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolve) => {
    const child = spawn('node', [cliPath, ...args], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({
        exitCode: code || 0,
        stdout,
        stderr
      });
    });

    // Set timeout to prevent hanging tests
    setTimeout(() => {
      child.kill();
      resolve({
        exitCode: -1,
        stdout,
        stderr: stderr + '\nTest timeout'
      });
    }, 30000);
  });
}

/**
 * Create a minimal valid test image for testing purposes
 * @param filePath - Path where to create the test image
 * @param format - Image format to create
 */
async function createTestImage(filePath: string, format: 'jpeg' | 'png'): Promise<void> {
  const sharp = require('sharp');
  
  // Create a simple 50x50 colored square for faster processing
  const image = sharp({
    create: {
      width: 50,
      height: 50,
      channels: 3,
      background: { r: 100, g: 150, b: 200 } // Blue background
    }
  });

  if (format === 'jpeg') {
    await image.jpeg({ quality: 85 }).toFile(filePath);
  } else if (format === 'png') {
    await image.png().toFile(filePath);
  }
}