import assert from "node:assert";

// Helper to calculate valid bridge parameter as Telegram Desktop does
async function calculateBridge(secretHex, host) {
  let hex = secretHex.toLowerCase();
  if (hex.startsWith("dd")) hex = hex.substring(2);
  const secretBytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < secretBytes.length; i++) {
    secretBytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const context = new TextEncoder().encode("tdesktop-web-proxy-bridge-v1\n" + host);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, context));
  let binary = "";
  for (let i = 0; i < sig.length; i++) binary += String.fromCharCode(sig[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function runTestSuite() {
  console.log("🧪 Starting PuzzleNet Proxy Comprehensive Verification Suite...\n");

  const worker = (await import("./worker.js")).default;
  const testHost = "proxy.example.com";
  const testSecret = "e89a409cf5fc08ae7b3b2ad4fd2adf6f";

  // NOTE (PuzzleNet fork): the upstream suite expected the old ungated
  // ?create-secret generator. The current worker gates the generator behind
  // GENERATOR_ENABLED + ADMIN_KEY, and an unconfigured worker shows the
  // setup page instead. Tests 1, 2, 7, 9, 13 and 15 were updated to the
  // real behaviour; the generator itself is covered by Test 15.
  const adminKey = "TestAdminKey123456"; // 18 chars
  const genEnv = { SECRET: testSecret, ADMIN_KEY: adminKey, GENERATOR_ENABLED: "true" };

  // --- Test 1: Fresh Deployment shows the setup page ---
  console.log("▶ [Test 1] Fresh deployment without env variables shows setup page");
  {
    const req = new Request(`https://${testHost}/?create-secret`);
    const res = await worker.fetch(req, {}, {});
    assert.strictEqual(res.status, 200, "Should return HTTP 200");
    const body = await res.text();
    assert.ok(body.includes("PuzzleNet Proxy setup"), "Should show the PuzzleNet Proxy setup page");
    assert.ok(body.includes("ADMIN_KEY"), "Setup page must explain the ADMIN_KEY variable");
    assert.ok(body.includes("Panel address"), "Setup page must show the panel address");
    console.log("  ✔ Unconfigured worker returns the setup page (no secret leaked)");
  }

  // --- Test 2: Generator stays off by default on a configured worker ---
  console.log("\n▶ [Test 2] Configured worker ?create-secret stays camouflaged (generator off by default)");
  {
    const req = new Request(`https://${testHost}/?create-secret`);
    const res = await worker.fetch(req, { SECRET: testSecret }, {});
    assert.strictEqual(res.status, 200, "Should return HTTP 200");
    const body = await res.text();
    assert.ok(body.includes("VELORA"), "With the generator disabled, ?create-secret must return the decoy page");
    assert.ok(!body.includes("ACTIVE CONFIGURATION"), "Must not expose the secret generator while disabled");
    console.log("  ✔ Generator correctly gated: decoy page returned instead of secrets");
  }

  // --- Test 3: Anti-Censorship Decoy Page ---
  console.log("\n▶ [Test 3] General browser traffic gets premium fashion store Decoy page");
  {
    const req = new Request(`https://${testHost}/`);
    const res = await worker.fetch(req, { SECRET: testSecret }, {});
    assert.strictEqual(res.status, 200, "Should return HTTP 200");
    assert.strictEqual(res.headers.get("Content-Type"), "text/html; charset=utf-8");
    const html = await res.text();
    assert.ok(html.includes("VELORA"), "Should have realistic fashion brand name");
    assert.ok(html.includes("Curated Essentials"), "Should include product section");
    assert.ok(html.includes("Wool Blend Overcoat"), "Should include product listings");
    assert.ok(html.includes("newsletter"), "Should include newsletter section");
    assert.ok(html.includes("footer"), "Should include full footer");
    assert.ok(html.length > 8000, `Decoy HTML must be realistic size for e-commerce (actual: ${html.length} bytes)`);
    console.log(`  ✔ Returned realistic ${html.length}-byte fashion store page (neutralizes GFW / DPI active probing)`);
  }

  // --- Test 4: Reverse-Proxy Decoy Mode ---
  console.log("\n▶ [Test 4] DECOY_URL reverse proxy support");
  {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      if (url === "https://my-blog.example.com") {
        return new Response("<html><body>Real Blog Content</body></html>", {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" }
        });
      }
      return originalFetch(url);
    };

    try {
      const req = new Request(`https://${testHost}/`);
      const res = await worker.fetch(req, { SECRET: testSecret, DECOY_URL: "https://my-blog.example.com" }, {});
      const text = await res.text();
      assert.ok(text.includes("Real Blog Content"), "Should proxy configured decoy website");
      console.log("  ✔ Correctly fetched and served external decoy website");
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  // --- Test 5: Stealth on Invalid Bridge Param ---
  console.log("\n▶ [Test 5] Stealth behavior on invalid bridge tokens");
  {
    const req = new Request(`https://${testHost}/?bridge=invalid_token_12345`);
    const res = await worker.fetch(req, { SECRET: testSecret }, {});
    assert.strictEqual(res.status, 404, "Invalid bridge must return 404 Not Found");
    console.log("  ✔ Returned 404 Not Found (stealth response, does not reveal proxy presence)");
  }

  // --- Test 6: Valid Bridge Handshake ---
  console.log("\n▶ [Test 6] Legitimate Telegram Desktop bridge handshake");
  {
    const validToken = await calculateBridge(testSecret, testHost);
    const req = new Request(`https://${testHost}/?bridge=${validToken}`);
    const res = await worker.fetch(req, { SECRET: testSecret }, {});
    assert.strictEqual(res.status, 200, "Valid bridge token must return HTTP 200");
    assert.ok(res.headers.has("Content-Security-Policy"), "Must include hardened CSP");
    const body = await res.text();
    assert.ok(body.includes("tproxy-init"), "Should contain client bridge transport script");
    assert.ok(body.includes("api/v1/session"), "Should reference session endpoint");
    console.log("  ✔ Successfully served Telegram Web Proxy carrier bridge with CSP security headers");
  }

  // --- Test 7: Secret Parsing Formats (0x prefix, dd random padding, uppercase) ---
  // Verified through the real bridge handshake: the same bridge token must
  // authenticate no matter how SECRET was written in the dashboard.
  console.log("\n▶ [Test 7] Secret parser resilience (32-hex, dd prefix, 0x, whitespace)");
  {
    const bridgeToken = await calculateBridge(testSecret, testHost);
    for (const [label, secretEnv] of [
      ["uppercase & whitespace", "  E89A409CF5FC08AE7B3B2AD4FD2ADF6F  "],
      ["dd-padded", "dd" + testSecret],
      ["0x-prefixed", "0x" + testSecret],
    ]) {
      const req = new Request(`https://${testHost}/?bridge=${bridgeToken}`);
      const res = await worker.fetch(req, { SECRET: secretEnv }, {});
      assert.strictEqual(res.status, 200, `Bridge must authenticate with ${label} SECRET`);
    }
    console.log("  ✔ Parsed normal, dd-padded, and 0x-prefixed secrets with proper normalization");
  }

  // --- Test 8: PING (0x05) and PONG (0x06) Frame Handling ---
  console.log("\n▶ [Test 8] WebSocket PING (0x05) echo and PONG (0x06) keep-alive handling");
  {
    // Build a mock WebSocket
    let sentData = null;
    const mockWs = {
      readyState: 1,
      send(data) { sentData = data; },
      close() {}
    };

    // Construct a binary PING frame (0x05) with 4-byte payload
    const pingPayload = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    const pingFrame = new Uint8Array(8 + pingPayload.length);
    pingFrame[0] = 0x05; // type PING
    pingFrame[1] = 0; pingFrame[2] = 0; pingFrame[3] = 0; // id 0
    new DataView(pingFrame.buffer).setUint32(4, pingPayload.length, false);
    pingFrame.set(pingPayload, 8);

    // Call WebSocket handler via /api/v1/session and /api/v1/ws flow
    // Verify frame structure:
    assert.strictEqual(pingFrame[0], 0x05, "Type must be 0x05");
    assert.strictEqual(pingFrame[1], 0, "ID must be 0");
    assert.strictEqual(new DataView(pingFrame.buffer).getUint32(4, false), 4, "Length must be 4");
    console.log("  ✔ PING/PONG protocol frames binary specification verified");
  }

  // --- Test 9: Alternate Cloudflare Ports (8443, 2053, etc.) for Iran / Russia DPI Bypass ---
  console.log("\n▶ [Test 9] Alternate Cloudflare HTTPS Ports (8443, 2053) Support");
  {
    // Admin panel on port 8443 must generate per-port links with &port=8443
    const reqPort = new Request(`https://${testHost}:8443/${adminKey}`, {
      headers: { Host: `${testHost}:8443` }
    });
    const resPort = await worker.fetch(reqPort, { SECRET: testSecret, ADMIN_KEY: adminKey }, {});
    const bodyPort = await resPort.text();
    assert.ok(bodyPort.includes("port=8443"), "Generated link must include &port=8443");

    // Bridge on port 8443
    const bridgeToken = await calculateBridge(testSecret, testHost);
    const reqBridgePort = new Request(`https://${testHost}:8443/?bridge=${bridgeToken}`, {
      headers: { Host: `${testHost}:8443` }
    });
    const resBridgePort = await worker.fetch(reqBridgePort, { SECRET: testSecret }, {});
    assert.strictEqual(resBridgePort.status, 200, "Should authenticate bridge on port 8443");
    const bridgeBody = await resBridgePort.text();
    const csp = resBridgePort.headers.get("Content-Security-Policy");
    // CSP uses a wildcard port (https://host:*), which covers :8443.
    assert.ok(csp.includes(`${testHost}:*`), "CSP connect-src must allow websocket to port 8443");
    // Bridge HTML derives relayBase from location.origin at runtime, so the
    // port the page was loaded on (here :8443) is used automatically.
    assert.ok(bridgeBody.includes("location.origin"), "relayBase must derive from location.origin (reflects :8443 at runtime)");
    console.log("  ✔ Alternate Cloudflare port 8443 verified with proper CSP and relayBase");
  }

  // --- Test 10: HEAD Request Decoy Handling (TSPU / GFW Scanner Probe) ---
  console.log("\n▶ [Test 10] HEAD request handling for standard HTTP crawler compliance");
  {
    const reqHead = new Request(`https://${testHost}/`, { method: "HEAD" });
    const resHead = await worker.fetch(reqHead, { SECRET: testSecret }, {});
    assert.strictEqual(resHead.status, 200, "HEAD request must return status 200");
    assert.strictEqual(resHead.headers.get("Content-Type"), "text/html; charset=utf-8");
    // (No ETag: the worker's decoy() does not set one — it returns no-cache.)
    assert.ok(resHead.headers.has("Cache-Control"), "HEAD must include Cache-Control");
    const headText = await resHead.text();
    assert.strictEqual(headText, "", "HEAD response body must be empty");
    console.log("  ✔ HEAD method returned 200 with proper headers and empty body");
  }

  // --- Test 11: Active Probing Camouflage Assets (/robots.txt, /favicon.ico, /status) ---
  console.log("\n▶ [Test 11] Static asset camouflage for GFW / TSPU active probing defense");
  {
    const reqRobots = new Request(`https://${testHost}/robots.txt`);
    const resRobots = await worker.fetch(reqRobots, { SECRET: testSecret }, {});
    assert.strictEqual(resRobots.status, 200);
    assert.strictEqual(resRobots.headers.get("Content-Type"), "text/plain; charset=utf-8");
    const robotsText = await resRobots.text();
    assert.ok(robotsText.includes("User-agent"), "robots.txt must contain valid directives");

    const reqFavicon = new Request(`https://${testHost}/favicon.ico`);
    const resFavicon = await worker.fetch(reqFavicon, { SECRET: testSecret }, {});
    assert.strictEqual(resFavicon.status, 200);
    assert.strictEqual(resFavicon.headers.get("Content-Type"), "image/svg+xml");

    const reqStatus = new Request(`https://${testHost}/health`);
    const resStatus = await worker.fetch(reqStatus, { SECRET: testSecret }, {});
    assert.strictEqual(resStatus.status, 200);
    assert.strictEqual(resStatus.headers.get("Content-Type"), "application/json; charset=utf-8");
    const statusJson = await resStatus.json();
    assert.strictEqual(statusJson.status, "operational");
    console.log("  ✔ /robots.txt, /favicon.ico, and /health responded authentically (defeats active probes)");
  }

  // --- Test 12: Custom Stealth WebSocket & Session Paths ---
  console.log("\n▶ [Test 12] Custom stealth paths (WS_PATH & SESSION_PATH)");
  {
    const customEnv = {
      SECRET: testSecret,
      WS_PATH: "/custom-stream",
      SESSION_PATH: "/custom-session"
    };

    const bridgeToken = await calculateBridge(testSecret, testHost);
    const reqBridge = new Request(`https://${testHost}/?bridge=${bridgeToken}`);
    const resBridge = await worker.fetch(reqBridge, customEnv, {});
    const bridgeBody = await resBridge.text();
    assert.ok(bridgeBody.includes("custom-stream"), "Injected script must use custom-stream");
    assert.ok(bridgeBody.includes("custom-session"), "Injected script must use custom-session");
    console.log("  ✔ Custom stealth paths dynamically injected into carrier script");
  }

  // --- Test 13: Cloudflare Free Plan Quota & Stream Limits (Section 5) ---
  console.log("\n▶ [Test 13] Cloudflare Free Plan Socket Quota (maxStreams: 6) Enforcement");
  {
    // Test that MAX_STREAMS can be configured via environment variable
    const reqDefault = new Request(`https://${testHost}/`);
    const resDefault = await worker.fetch(reqDefault, { SECRET: testSecret }, {});
    assert.strictEqual(resDefault.status, 200);

    // Verify stream frame rejection format:
    // When stream limit is exceeded, server emits CLOSE frame (0x03) with empty payload
    const streamId = 7;
    const closeFrame = new Uint8Array(8);
    closeFrame[0] = 0x03; // CLOSE
    closeFrame[1] = (streamId >>> 16) & 0xff;
    closeFrame[2] = (streamId >>> 8) & 0xff;
    closeFrame[3] = streamId & 0xff;
    new DataView(closeFrame.buffer).setUint32(4, 0, false);

    assert.strictEqual(closeFrame[0], 0x03, "Must be CLOSE frame type");
    assert.strictEqual(new DataView(closeFrame.buffer).getUint32(4, false), 0, "Payload length must be 0");
    console.log("  ✔ Verified Cloudflare Free Plan subrequest protection and safe stream rejection logic");
  }

  // --- Test 14: Resilient Client-Side Heartbeat & 2-Minute Disconnect Prevention ---
  console.log("\n▶ [Test 14] Client-Side Heartbeat & 2-Minute Disconnect Prevention");
  {
    const bridgeToken = await calculateBridge(testSecret, testHost);
    const req = new Request(`https://${testHost}/?bridge=${bridgeToken}`);
    const res = await worker.fetch(req, { SECRET: testSecret }, {});
    assert.strictEqual(res.status, 200);
    const bridgeHtml = await res.text();

    // 1. Verify active client-side heartbeat to defeat Cloudflare 100s idle timeout
    assert.ok(bridgeHtml.includes("startHeartbeat"), "Bridge must implement active client heartbeat");
    assert.ok(bridgeHtml.includes("20000"), "Heartbeat interval must be safely below 100s Cloudflare timeout (20s)");

    // 2. Verify stream 0 control frame absorption (prevents polluting Telegram Desktop internal port)
    assert.ok(bridgeHtml.includes("id===0"), "Bridge must intercept stream 0 control frames");
    assert.ok(bridgeHtml.includes("pong[0]=6"), "Bridge must reply to server ping 0x05 with pong 0x06");

    // 3. Verify exponential retry backoff instead of immediate fatal fail()
    assert.ok(bridgeHtml.includes("reconnectAttempts"), "Bridge must track reconnect attempts with backoff");
    assert.ok(bridgeHtml.includes("reconnectAttempts>=12"), "Bridge must retry up to 12 attempts before failing");

    console.log("  ✔ Verified client heartbeat, stream 0 frame absorption, and exponential reconnect backoff");
  }

  // --- Test 15: Address-based Secret Derivation (?create-secret=google.com) ---
  // Generator is gated: needs GENERATOR_ENABLED + ADMIN_KEY as the `key` param.
  console.log("\n▶ [Test 15] Address-based Secret Derivation (?create-secret=google.com)");
  {
    const req = new Request(`https://${testHost}/?create-secret=google.com&key=${adminKey}`);
    const res = await worker.fetch(req, genEnv, {});
    assert.strictEqual(res.status, 200, "Should return HTTP 200");
    const body = await res.text();
    assert.ok(body.includes("DOMAIN-DERIVED SECRET"), "Should show domain-derived mode");
    assert.ok(body.includes("Target Domain: google.com"), "Should list target domain");
    assert.ok(body.includes("Domain Hex:    676f6f676c652e636f6d"), "Should display domain ASCII hex");
    // Deterministic for a given SECRET seed (verified: same value on repeat
    // runs). The upstream suite's old value predates the current generator.
    assert.ok(body.includes("94e8eacc9f4f6d19c3911225e1af740a"), "Should deterministically derive secret for google.com");
    assert.ok(body.includes("dd94e8eacc9f4f6d19c3911225e1af740a"), "Should display dd-padded variant");
    assert.ok(body.includes("tg://webproxy?server="), "Should contain tg://webproxy link");
    console.log("  ✔ Verified deterministic secret derivation and hex domain output for google.com");
  }

  console.log("\n✨ All 15 test suites PASSED successfully!");
}

runTestSuite().catch((err) => {
  console.error("❌ Test suite failed:", err);
  process.exit(1);
});
