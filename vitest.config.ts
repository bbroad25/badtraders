import { readFileSync } from 'fs'
import path from 'path'
import { defineConfig } from 'vitest/config'

// Load environment variables from .env file
try {
  const envFile = readFileSync('.env', 'utf-8')
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^#][^=]*)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim()
      if (key && !process.env[key]) {
        process.env[key] = value
      }
    }
  })
} catch (e) {
  // .env file not found, that's ok
}

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', '.next'],
    testTimeout: 120000, // 2 minutes for real API calls and database
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Force sequential execution - one test at a time
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '*.config.*',
        'next.config.*',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})

