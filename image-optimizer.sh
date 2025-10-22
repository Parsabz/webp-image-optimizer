#!/bin/bash

# Image Optimizer - Standalone Executable Script
# This script provides a convenient way to run the image optimizer tool

# Set script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to check if Node.js is installed
check_node() {
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js to use this tool."
        print_info "Visit https://nodejs.org/ to download and install Node.js"
        exit 1
    fi
    
    # Check Node.js version (require v16 or higher)
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 16 ]; then
        print_error "Node.js version 16 or higher is required. Current version: $(node -v)"
        exit 1
    fi
}

# Function to check if npm is installed
check_npm() {
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm to use this tool."
        exit 1
    fi
}

# Function to install dependencies
install_dependencies() {
    print_info "Installing dependencies..."
    cd "$SCRIPT_DIR"
    
    if [ ! -f "package.json" ]; then
        print_error "package.json not found. Please run this script from the project directory."
        exit 1
    fi
    
    if npm install; then
        print_success "Dependencies installed successfully"
    else
        print_error "Failed to install dependencies"
        exit 1
    fi
}

# Function to build the project
build_project() {
    print_info "Building the project..."
    cd "$SCRIPT_DIR"
    
    if npm run build; then
        print_success "Project built successfully"
    else
        print_error "Failed to build project"
        exit 1
    fi
}

# Function to run the optimizer
run_optimizer() {
    cd "$SCRIPT_DIR"
    
    # Check if dist directory exists
    if [ ! -d "dist" ]; then
        print_warning "Project not built. Building now..."
        build_project
    fi
    
    # Check if main file exists
    if [ ! -f "dist/index.js" ]; then
        print_warning "Main executable not found. Building now..."
        build_project
    fi
    
    # Run the optimizer with all passed arguments
    print_info "Running Image Optimizer..."
    node dist/index.js "$@"
}

# Function to show help
show_help() {
    echo "Image Optimizer - Standalone Executable Script"
    echo ""
    echo "Usage:"
    echo "  $0 [options] <source> [output]           Run image optimization"
    echo "  $0 --setup                               Install dependencies and build"
    echo "  $0 --build                               Build the project"
    echo "  $0 --help                                Show this help"
    echo "  $0 --version                             Show version information"
    echo ""
    echo "Image Optimization Options:"
    echo "  <source>                                 Source directory containing images"
    echo "  [output]                                 Output directory (default: ./optimized)"
    echo "  -q, --quality <number>                   Default quality (1-100)"
    echo "  --photo-quality <number>                 Photo quality (1-100)"
    echo "  --graphic-quality <number>               Graphic quality (1-100)"
    echo "  --mixed-quality <number>                 Mixed content quality (1-100)"
    echo "  -c, --concurrency <number>               Concurrent processing (default: 4)"
    echo "  --continue-on-error                      Continue if individual images fail"
    echo "  --no-progress                            Disable progress reporting"
    echo "  --no-report                              Skip generating report"
    echo "  --report-format <format>                 Report format (json|text)"
    echo "  -v, --verbose                            Verbose output"
    echo ""
    echo "Examples:"
    echo "  $0 ./images                              Optimize images in ./images"
    echo "  $0 ./photos ./web-photos                 Optimize ./photos to ./web-photos"
    echo "  $0 ./images -q 85 -v                     Optimize with 85% quality, verbose"
    echo "  $0 ./images --photo-quality 90           Set photo quality to 90%"
    echo ""
    echo "Setup:"
    echo "  $0 --setup                               First-time setup (install & build)"
    echo ""
}

# Function to show version
show_version() {
    cd "$SCRIPT_DIR"
    if [ -f "package.json" ]; then
        VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "unknown")
        echo "Image Optimizer v$VERSION"
    else
        echo "Image Optimizer (version unknown)"
    fi
}

# Main script logic
main() {
    # Handle special commands first
    case "$1" in
        --help|-h)
            show_help
            exit 0
            ;;
        --version)
            show_version
            exit 0
            ;;
        --setup)
            print_info "Setting up Image Optimizer..."
            check_node
            check_npm
            install_dependencies
            build_project
            print_success "Setup complete! You can now use the image optimizer."
            print_info "Try: $0 --help for usage information"
            exit 0
            ;;
        --build)
            check_node
            check_npm
            build_project
            exit 0
            ;;
        "")
            print_error "No arguments provided."
            show_help
            exit 1
            ;;
    esac
    
    # Check prerequisites
    check_node
    
    # Run the optimizer with all arguments
    run_optimizer "$@"
}

# Run main function with all arguments
main "$@"