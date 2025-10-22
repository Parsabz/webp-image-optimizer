/**
 * Basic setup test to verify testing environment
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';

describe('Test Setup Verification', () => {
  it('should have access to required dependencies', () => {
    // Test that we can import required modules
    expect(fs).toBeDefined();
    expect(path).toBeDefined();
  });

  it('should be able to create and read files', async () => {
    const tempFile = path.join(__dirname, 'temp-test-file.txt');
    const testContent = 'Hello, test!';
    
    // Write file
    await fs.writeFile(tempFile, testContent);
    
    // Read file
    const readContent = await fs.readFile(tempFile, 'utf8');
    expect(readContent).toBe(testContent);
    
    // Cleanup
    await fs.remove(tempFile);
  });

  it('should have sharp available for image processing', async () => {
    const sharp = require('sharp');
    expect(sharp).toBeDefined();
    
    // Test basic sharp functionality
    const image = sharp({
      create: {
        width: 10,
        height: 10,
        channels: 3,
        background: { r: 255, g: 0, b: 0 }
      }
    });
    
    const metadata = await image.metadata();
    expect(metadata.width).toBe(10);
    expect(metadata.height).toBe(10);
  });
});