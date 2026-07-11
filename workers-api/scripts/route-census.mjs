// Prints every registered route/middleware as "METHOD PATH" in Hono
// registration order. Byte-identical output across a refactor proves the
// route table (and therefore matching order) is unchanged.
import { app } from '../src/index.js';

for (const r of app.routes) {
  console.log(`${r.method} ${r.path}`);
}
