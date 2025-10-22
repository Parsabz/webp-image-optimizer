# Image Optimizer - Executable Usage Guide

This document explains how to use the standalone executable scripts for the Image Optimizer tool.

## Quick Start

### First-time Setup

**Unix/Linux/macOS:**
```bash
./image-optimizer.sh --setup
```

**Windows:**
```cmd
image-optimizer.bat --setup
```

This will:
- Check Node.js installation (requires v16+)
- Install all dependencies
- Build the project
- Prepare the tool for use

### Basic Usage

**Optimize images in a directory:**
```bash
# Unix/Linux/macOS
./image-optimizer.sh ./images

# Windows
image-optimizer.bat .\images
```

**Specify output directory:**
```bash
# Unix/Linux/macOS
./image-optimizer.sh ./photos ./web-photos

# Windows
image-optimizer.bat .\photos .\web-photos
```

## Available Scripts

### NPM Scripts (package.json)

| Script | Description |
|--------|-------------|
| `npm run build` | Compile TypeScript to JavaScript |
| `npm start` | Run the compiled application |
| `npm run dev` | Run in development mode with ts-node |
| `npm run clean` | Remove compiled files |
| `npm run prepare` | Build before publishing |
| `npm run optimize` | Build and run optimizer |
| `npm run optimize:dev` | Run optimizer in development mode |
| `npm run test:sample` | Run with sample test images |
| `npm run help` | Show help information |

### Standalone Scripts

#### Unix/Linux/macOS (image-optimizer.sh)

**Setup and Build:**
```bash
./image-optimizer.sh --setup     # First-time setup
./image-optimizer.sh --build     # Build project only
./image-optimizer.sh --version   # Show version
./image-optimizer.sh --help      # Show help
```

**Image Optimization:**
```bash
# Basic optimization
./image-optimizer.sh ./images

# With custom output directory
./image-optimizer.sh ./images ./optimized

# With quality settings
./image-optimizer.sh ./images -q 85 --verbose

# Photo-specific quality
./image-optimizer.sh ./images --photo-quality 90

# Multiple options
./image-optimizer.sh ./images ./output \
  --photo-quality 90 \
  --graphic-quality 80 \
  --concurrency 8 \
  --verbose
```

#### Windows (image-optimizer.bat)

**Setup and Build:**
```cmd
image-optimizer.bat --setup     # First-time setup
image-optimizer.bat --build     # Build project only
image-optimizer.bat --version   # Show version
image-optimizer.bat --help      # Show help
```

**Image Optimization:**
```cmd
# Basic optimization
image-optimizer.bat .\images

# With custom output directory
image-optimizer.bat .\images .\optimized

# With quality settings
image-optimizer.bat .\images -q 85 --verbose

# Photo-specific quality
image-optimizer.bat .\images --photo-quality 90

# Multiple options
image-optimizer.bat .\images .\output --photo-quality 90 --graphic-quality 80 --concurrency 8 --verbose
```

## Command Line Options

| Option | Description | Default |
|--------|-------------|---------|
| `<source>` | Source directory containing images | Required |
| `[output]` | Output directory for optimized images | `./optimized` |
| `-q, --quality <number>` | Default quality for all images (1-100) | Content-aware |
| `--photo-quality <number>` | Quality for photographs (1-100) | 87 |
| `--graphic-quality <number>` | Quality for graphics/screenshots (1-100) | 80 |
| `--mixed-quality <number>` | Quality for mixed content (1-100) | 83 |
| `-c, --concurrency <number>` | Number of concurrent processes | 4 |
| `--continue-on-error` | Continue processing if individual images fail | false |
| `--no-progress` | Disable progress reporting | false |
| `--no-report` | Skip generating optimization report | false |
| `--report-format <format>` | Report format: `json` or `text` | `json` |
| `-v, --verbose` | Enable verbose output | false |

## Examples

### Basic Optimization
```bash
# Optimize all images in ./photos directory
./image-optimizer.sh ./photos
```

### Custom Output Directory
```bash
# Optimize images and save to ./web-images
./image-optimizer.sh ./photos ./web-images
```

### Quality Control
```bash
# Set different quality levels for different content types
./image-optimizer.sh ./images \
  --photo-quality 90 \
  --graphic-quality 75 \
  --mixed-quality 80
```

### Performance Tuning
```bash
# Process 8 images concurrently with verbose output
./image-optimizer.sh ./images \
  --concurrency 8 \
  --verbose
```

### Error Handling
```bash
# Continue processing even if some images fail
./image-optimizer.sh ./images \
  --continue-on-error \
  --verbose
```

### Report Generation
```bash
# Generate a text report instead of JSON
./image-optimizer.sh ./images \
  --report-format text
```

## Prerequisites

- **Node.js**: Version 16 or higher
- **npm**: Comes with Node.js
- **Operating System**: 
  - Unix/Linux/macOS for `.sh` script
  - Windows for `.bat` script

## Installation Methods

### Method 1: Direct Usage (Recommended)
1. Clone or download the project
2. Run setup: `./image-optimizer.sh --setup` (Unix) or `image-optimizer.bat --setup` (Windows)
3. Start optimizing: `./image-optimizer.sh ./your-images`

### Method 2: Global Installation
```bash
# Install globally via npm
npm install -g .

# Use anywhere
image-optimizer ./images
```

### Method 3: NPM Scripts
```bash
# Install dependencies
npm install

# Build project
npm run build

# Run optimizer
npm run optimize -- ./images ./output
```

## Troubleshooting

### Common Issues

**"Node.js is not installed"**
- Install Node.js from https://nodejs.org/
- Ensure version 16 or higher

**"npm is not installed"**
- npm comes with Node.js
- Reinstall Node.js if npm is missing

**"package.json not found"**
- Run the script from the project root directory
- Ensure all project files are present

**"Failed to build project"**
- Check Node.js and npm versions
- Run `npm install` manually
- Check for TypeScript compilation errors

**Permission denied (Unix/Linux/macOS)**
```bash
chmod +x image-optimizer.sh
```

### Getting Help

- Run `./image-optimizer.sh --help` for usage information
- Check the main README.md for detailed documentation
- Review error messages for specific issues

## Output

The tool will:
1. Process all supported images in the source directory
2. Convert them to WebP format with optimal quality
3. Save optimized images to the output directory
4. Generate a detailed optimization report
5. Display progress and statistics

Supported input formats: JPEG, PNG, DNG
Output format: WebP

## Performance Notes

- Default concurrency is 4 (adjust based on your system)
- Processing time depends on image size and quantity
- Memory usage scales with concurrency and image size
- Large images (>4000px) receive additional processing