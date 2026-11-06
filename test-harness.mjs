// Run the worker test suite under plain Node:
//   node test-harness.mjs   (or: npm test)
// Upstream test.js imports `cloudflare:sockets`, which plain Node cannot
// load — this registers a stub for that import first, then runs the suite.
import { register } from "node:module";

register("./test/loader.mjs", import.meta.url);
await import("./test.js");
