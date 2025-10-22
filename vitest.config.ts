import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',
    
    // Test patterns
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**'],
    
    // Timeout settings
    testTimeout: 60000, // 60 seconds for integration tests
    hookTimeout: 30000, // 30 seconds for setup/teardown
    
    // Coverage settings
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'tests/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/coverage/**'
      ]
    },
    
    // Global setup
    globals: true,
    
    // Reporter settings
    reporter: ['verbose'],
    
    // Retry failed tests
    retry: 1,
    
    // Run tests in sequence for integration tests to avoid conflicts
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    }
  }
});