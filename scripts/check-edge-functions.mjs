#!/usr/bin/env node

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
};

const withoutTrailingSlash = (value) => value.replace(/\/+$/, "");

const supabaseUrl = withoutTrailingSlash(required("SUPABASE_URL"));
const previewOrigin = withoutTrailingSlash(required("PREVIEW_ORIGIN"));
const publishableKey = (
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  ""
).trim();
const accountToken = process.env.ACCOUNT_ACCESS_TOKEN?.trim();
const guestToken = process.env.GUEST_ACCESS_TOKEN?.trim();
const functionUrl = `${supabaseUrl}/functions/v1/transfer-guest-matches`;
const requestedHeaders = "authorization, x-client-info, apikey, content-type";

function hasTokenPair() {
  return Boolean(accountToken && guestToken && publishableKey);
}

function assertHeader(response, name, expected) {
  const actual = response.headers.get(name);
  if (actual !== expected) {
    throw new Error(
      `${name} mismatch: expected ${expected}, received ${actual ?? "<missing>"}.`,
    );
  }
}

function assertIncludesHeader(response, name, expected) {
  const actual = response.headers.get(name) ?? "";
  const values = actual.split(",").map((value) => value.trim().toLowerCase());
  if (!values.includes(expected.toLowerCase())) {
    throw new Error(
      `${name} does not include ${expected}; received ${actual || "<missing>"}.`,
    );
  }
}

async function main() {
  const preflight = await fetch(functionUrl, {
    method: "OPTIONS",
    headers: {
      Origin: previewOrigin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": requestedHeaders,
    },
  });

  if (!preflight.ok) {
    throw new Error(`OPTIONS returned HTTP ${preflight.status}.`);
  }
  assertHeader(preflight, "access-control-allow-origin", previewOrigin);
  assertIncludesHeader(preflight, "access-control-allow-methods", "POST");
  assertIncludesHeader(
    preflight,
    "access-control-allow-headers",
    "authorization",
  );
  console.log(`OPTIONS ${functionUrl} -> ${preflight.status}: CORS passed`);

  if (!hasTokenPair()) {
    throw new Error(
      "Authenticated POST not run. Set SUPABASE_PUBLISHABLE_KEY, ACCOUNT_ACCESS_TOKEN, and GUEST_ACCESS_TOKEN in the process environment; never pass them as command-line arguments.",
    );
  }

  const response = await fetch(functionUrl, {
    method: "POST",
    headers: {
      Origin: previewOrigin,
      Authorization: `Bearer ${accountToken}`,
      apikey: publishableKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ guestAccessToken: guestToken }),
  });

  assertHeader(response, "access-control-allow-origin", previewOrigin);
  if (!response.ok) {
    throw new Error(
      `Authenticated POST returned HTTP ${response.status}; inspect the Edge Function logs without printing token values.`,
    );
  }

  const body = await response.json().catch(() => null);
  if (!body || typeof body.transferred !== "number") {
    throw new Error(
      "Authenticated POST returned an unexpected response shape.",
    );
  }
  console.log(
    `POST ${functionUrl} -> ${response.status}: transfer response valid (transferred count redacted from logs)`,
  );
}

main().catch((error) => {
  console.error(`Edge Function smoke failed: ${error.message}`);
  process.exitCode = 1;
});
