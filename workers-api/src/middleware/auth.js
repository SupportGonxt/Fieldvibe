// Consolidated: the previous local authMiddleware here decoded JWTs WITHOUT
// verifying the signature. The verified implementations live in lib/middleware.js;
// this shim only preserves existing '../../middleware/auth.js' import paths.
export { authMiddleware, requireRole } from '../lib/middleware.js';
