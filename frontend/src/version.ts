/**
 * Frontend Version Information
 * Auto-generated on build
 */

export const VERSION = {
  version: '1.0.0',
  buildDate: new Date().toISOString(),
  gitCommit: process.env.VITE_GIT_COMMIT || 'unknown',
  environment: import.meta.env.MODE || 'production'
};

export function getVersionString(): string {
  return `v${VERSION.version} (${VERSION.buildDate.split('T')[0]})`;
}

export function logVersion(): void {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                    FieldVibe Frontend                      ║
║                                                            ║
║  Version:     ${VERSION.version.padEnd(44)} ║
║  Build Date:  ${VERSION.buildDate.split('T')[0].padEnd(44)} ║
║  Git Commit:  ${VERSION.gitCommit.substring(0, 44).padEnd(44)} ║
║  Environment: ${VERSION.environment.padEnd(44)} ║
╚════════════════════════════════════════════════════════════╝
  `);
}
