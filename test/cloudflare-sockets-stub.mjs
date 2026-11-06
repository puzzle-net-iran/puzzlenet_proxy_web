// Test-only stub for the `cloudflare:sockets` import in worker.js.
// Plain Node cannot load the `cloudflare:` scheme; the test suite only
// exercises HTTP/bridge/panel paths, never a real DC socket.
export function connect() {
  throw new Error("cloudflare:sockets is not available in plain Node (test stub)");
}
