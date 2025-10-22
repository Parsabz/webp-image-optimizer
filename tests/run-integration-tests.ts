#!/usr/bin/env ts-node

/**
 * Integration test runner script
 * This script runs comprehensive integration tests to validate the entire system
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { spawn } from 'child_process';

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

class IntegrationTestRunner {
  private testResults: TestResult[] = [];
  private tempDir = path.join(__dirname, 'temp');

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Integration Test Suite');
    console.log('=' .repeat(50));

    try {
      // Ensure clean environment
      await this.setupTestEnvironment();

      // Run test suites
      await this.runTestSuite('Batch Processing', 'tests/integration/batch-processing.test.ts');
      await this.runTestSuite('CLI Integration', 'tests/integration/cli-integration.test.ts');
      await this.runTestSuite('Quality Optimization', 'tests/integration/quality-optimization.test.ts');

      // Generate summary
      this.generateSummary();

    } catch (error) {
      console.error('❌ Test suite failed:', error);
      process.exit(1);
    } finally {
      // Cleanup
      await this.cleanup();
    }
  }

  private async setupTestEnvironment(): Promise<void> {
    console.log('🔧 Setting up test environment...');
    
    // Ensure temp directory exists and is clean
    await fs.ensureDir(this.tempDir);
    await fs.emptyDir(this.tempDir);
    
    // Build the project first
    console.log('📦 Building project...');
    await this.runCommand('npm', ['run', 'build']);
    
    console.log('✅ Test environment ready\n');
  }

  private async runTestSuite(name: string, testFile: string): Promise<void> {
    console.log(`🧪 Running ${name} Tests...`);
    const startTime = Date.now();

    try {
      await this.runCommand('npx', ['vitest', '--run', testFile]);
      
      const duration = Date.now() - startTime;
      this.testResults.push({
        name,
        passed: true,
        duration
      });
      
      console.log(`✅ ${name} Tests: PASSED (${duration}ms)\n`);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testResults.push({
        name,
        passed: false,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      console.log(`❌ ${name} Tests: FAILED (${duration}ms)`);
      console.log(`   Error: ${error}\n`);
    }
  }

  private async runCommand(command: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: 'inherit',
        shell: true
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Command failed with exit code ${code}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  private generateSummary(): void {
    console.log('📊 Test Results Summary');
    console.log('=' .repeat(50));

    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    const totalDuration = this.testResults.reduce((sum, r) => sum + r.duration, 0);

    console.log(`Total Test Suites: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${failedTests}`);
    console.log(`Total Duration: ${totalDuration}ms`);
    console.log('');

    // Detailed results
    this.testResults.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${result.name}: ${result.duration}ms`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });

    console.log('');

    if (failedTests === 0) {
      console.log('🎉 All integration tests passed!');
      console.log('✨ The image optimization system is working correctly.');
    } else {
      console.log(`⚠️  ${failedTests} test suite(s) failed.`);
      console.log('🔍 Please review the errors above and fix the issues.');
      process.exit(1);
    }
  }

  private async cleanup(): Promise<void> {
    try {
      await fs.remove(this.tempDir);
      console.log('🧹 Cleanup completed');
    } catch (error) {
      console.warn('⚠️  Cleanup warning:', error);
    }
  }
}

// Run the test suite if this script is executed directly
if (require.main === module) {
  const runner = new IntegrationTestRunner();
  runner.runAllTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { IntegrationTestRunner };