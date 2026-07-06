import { defineConfig } from 'vitest/config'
// ponytail: node-env config for pure-function unit tests; bypasses the workers pool
export default defineConfig({ test: { environment: 'node', include: ['tests/unit/incentiveService.test.js', 'tests/unit/callsFinalize.test.js', 'tests/unit/gmOverview.test.js', 'tests/unit/gmDigest.test.js', 'tests/unit/webPushVapid.test.js', 'tests/unit/callRoomRelay.test.js'] } })
