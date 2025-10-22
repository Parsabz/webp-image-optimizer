@echo off
setlocal enabledelayedexpansion

REM Image Optimizer - Windows Batch Script
REM This script provides a convenient way to run the image optimizer tool on Windows

REM Set script directory
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

REM Function to check if Node.js is installed
:check_node
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Please install Node.js to use this tool.
    echo [INFO] Visit https://nodejs.org/ to download and install Node.js
    exit /b 1
)

REM Check Node.js version (require v16 or higher)
for /f "tokens=1 delims=v" %%i in ('node -v') do set NODE_VERSION=%%i
for /f "tokens=1 delims=." %%i in ("%NODE_VERSION:v=%") do set MAJOR_VERSION=%%i
if %MAJOR_VERSION% lss 16 (
    echo [ERROR] Node.js version 16 or higher is required. Current version: %NODE_VERSION%
    exit /b 1
)
goto :eof

REM Function to check if npm is installed
:check_npm
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] npm is not installed. Please install npm to use this tool.
    exit /b 1
)
goto :eof

REM Function to install dependencies
:install_dependencies
echo [INFO] Installing dependencies...
if not exist "package.json" (
    echo [ERROR] package.json not found. Please run this script from the project directory.
    exit /b 1
)

call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies
    exit /b 1
)
echo [SUCCESS] Dependencies installed successfully
goto :eof

REM Function to build the project
:build_project
echo [INFO] Building the project...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Failed to build project
    exit /b 1
)
echo [SUCCESS] Project built successfully
goto :eof

REM Function to run the optimizer
:run_optimizer
REM Check if dist directory exists
if not exist "dist" (
    echo [WARNING] Project not built. Building now...
    call :build_project
    if %errorlevel% neq 0 exit /b 1
)

REM Check if main file exists
if not exist "dist\index.js" (
    echo [WARNING] Main executable not found. Building now...
    call :build_project
    if %errorlevel% neq 0 exit /b 1
)

REM Run the optimizer with all passed arguments
echo [INFO] Running Image Optimizer...
node dist\index.js %*
goto :eof

REM Function to show help
:show_help
echo Image Optimizer - Windows Batch Script
echo.
echo Usage:
echo   %~nx0 [options] ^<source^> [output]           Run image optimization
echo   %~nx0 --setup                               Install dependencies and build
echo   %~nx0 --build                               Build the project
echo   %~nx0 --help                                Show this help
echo   %~nx0 --version                             Show version information
echo.
echo Image Optimization Options:
echo   ^<source^>                                 Source directory containing images
echo   [output]                                 Output directory (default: ./optimized)
echo   -q, --quality ^<number^>                   Default quality (1-100)
echo   --photo-quality ^<number^>                 Photo quality (1-100)
echo   --graphic-quality ^<number^>               Graphic quality (1-100)
echo   --mixed-quality ^<number^>                 Mixed content quality (1-100)
echo   -c, --concurrency ^<number^>               Concurrent processing (default: 4)
echo   --continue-on-error                      Continue if individual images fail
echo   --no-progress                            Disable progress reporting
echo   --no-report                              Skip generating report
echo   --report-format ^<format^>                 Report format (json^|text)
echo   -v, --verbose                            Verbose output
echo.
echo Examples:
echo   %~nx0 .\images                              Optimize images in .\images
echo   %~nx0 .\photos .\web-photos                 Optimize .\photos to .\web-photos
echo   %~nx0 .\images -q 85 -v                     Optimize with 85%% quality, verbose
echo   %~nx0 .\images --photo-quality 90           Set photo quality to 90%%
echo.
echo Setup:
echo   %~nx0 --setup                               First-time setup (install ^& build)
echo.
goto :eof

REM Function to show version
:show_version
if exist "package.json" (
    for /f "tokens=*" %%i in ('node -p "require('./package.json').version" 2^>nul') do set VERSION=%%i
    if defined VERSION (
        echo Image Optimizer v!VERSION!
    ) else (
        echo Image Optimizer (version unknown)
    )
) else (
    echo Image Optimizer (version unknown)
)
goto :eof

REM Main script logic
:main
REM Handle special commands first
if "%1"=="--help" goto show_help_and_exit
if "%1"=="-h" goto show_help_and_exit
if "%1"=="--version" goto show_version_and_exit
if "%1"=="--setup" goto setup_and_exit
if "%1"=="--build" goto build_and_exit
if "%1"=="" goto no_args_error

REM Check prerequisites
call :check_node
if %errorlevel% neq 0 exit /b 1

REM Run the optimizer with all arguments
call :run_optimizer %*
exit /b %errorlevel%

:show_help_and_exit
call :show_help
exit /b 0

:show_version_and_exit
call :show_version
exit /b 0

:setup_and_exit
echo [INFO] Setting up Image Optimizer...
call :check_node
if %errorlevel% neq 0 exit /b 1
call :check_npm
if %errorlevel% neq 0 exit /b 1
call :install_dependencies
if %errorlevel% neq 0 exit /b 1
call :build_project
if %errorlevel% neq 0 exit /b 1
echo [SUCCESS] Setup complete! You can now use the image optimizer.
echo [INFO] Try: %~nx0 --help for usage information
exit /b 0

:build_and_exit
call :check_node
if %errorlevel% neq 0 exit /b 1
call :check_npm
if %errorlevel% neq 0 exit /b 1
call :build_project
exit /b %errorlevel%

:no_args_error
echo [ERROR] No arguments provided.
call :show_help
exit /b 1

REM Run main function
call :main %*