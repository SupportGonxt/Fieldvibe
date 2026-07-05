import { defineConfig } from 'vitest/config'
// ponytail: node-env config for pure-function unit tests; bypasses the workers pool
export default defineConfig({ test: { environment: 'node', include: ['tests/unit/incentiveService.test.js'] } })
