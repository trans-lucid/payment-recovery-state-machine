const baseUrl = process.env.GATEWAY_BASE_URL ?? "http://localhost:8091";

async function waitForWireMock() {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/__admin`);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw lastError instanceof Error ? lastError : new Error("WireMock not ready");
}

async function postAdmin(path: string, body?: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(`WireMock admin ${path} returned ${response.status}: ${await response.text()}`);
  }
}

function gatewayResult(idempotencyKey: string, status = "captured") {
  return {
    gatewayChargeId: `gw_${idempotencyKey}`,
    status,
    amountCents: idempotencyKey === "public-timeout-key" ? 9900 : 4200,
    currency: "USD",
    evidence: {
      source: "wiremock-gateway",
      idempotencyKey,
      gatewayRequestId: `req_${idempotencyKey}`
    }
  };
}

async function addMapping(mapping: unknown) {
  await postAdmin("/__admin/mappings", mapping);
}

async function main() {
  await waitForWireMock();
  await postAdmin("/__admin/mappings/reset");

  await addMapping({
    priority: 1,
    request: {
      method: "POST",
      url: "/gateway/charges",
      bodyPatterns: [{ matchesJsonPath: "$[?(@.idempotencyKey == 'public-timeout-key')]" }]
    },
    response: {
      status: 200,
      fixedDelayMilliseconds: 1200,
      headers: { "content-type": "application/json" },
      jsonBody: gatewayResult("public-timeout-key")
    }
  });

  await addMapping({
    priority: 1,
    request: { method: "GET", url: "/gateway/charges/by-key/public-timeout-key" },
    response: {
      status: 200,
      headers: { "content-type": "application/json" },
      jsonBody: gatewayResult("public-timeout-key")
    }
  });

  await addMapping({
    priority: 10,
    request: { method: "POST", url: "/gateway/charges" },
    response: {
      status: 200,
      headers: { "content-type": "application/json" },
      jsonBody: gatewayResult("public-success-key")
    }
  });

  await addMapping({
    priority: 10,
    request: { method: "GET", urlPattern: "/gateway/charges/by-key/.*" },
    response: { status: 404, headers: { "content-type": "application/json" }, jsonBody: { error: "not_found" } }
  });

  console.log("gateway scenarios ready");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
