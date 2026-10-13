import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: corsHeaders,
    status,
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST")
    return json({ error: "Method not allowed." }, 405);

  const authorization = request.headers.get("Authorization");
  const accountToken = authorization?.replace(/^Bearer\s+/i, "").trim();
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!accountToken || !supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "Guest match transfer is not configured." }, 500);
  }

  let body: { guestAccessToken?: unknown } = {};
  try {
    body = (await request.json()) as { guestAccessToken?: unknown };
  } catch {
    return json({ error: "A guest session token is required." }, 400);
  }

  if (typeof body.guestAccessToken !== "string" || !body.guestAccessToken) {
    return json({ error: "A guest session token is required." }, 400);
  }

  const accountClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accountToken}` } },
  });
  const {
    data: { user: accountUser },
    error: accountError,
  } = await accountClient.auth.getUser(accountToken);

  if (accountError || !accountUser)
    return json({ error: "Authentication is required." }, 401);
  if (
    accountUser.is_anonymous ||
    !accountUser.identities?.some((identity) => identity.provider === "google")
  ) {
    return json({ error: "A Google-linked account is required." }, 403);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const {
    data: { user: guestUser },
    error: guestError,
  } = await adminClient.auth.getUser(body.guestAccessToken);

  if (guestError || !guestUser)
    return json({ error: "The guest session is no longer available." }, 400);
  if (!guestUser.is_anonymous) {
    // Supabase may upgrade the anonymous user in place when Google is linked.
    // The matches already belong to the account, so no transfer is needed.
    if (guestUser.id === accountUser.id) return json({ transferred: 0 });
    return json(
      { error: "The source session is not an anonymous guest." },
      400,
    );
  }

  const { data, error: transferError } = await adminClient.rpc(
    "transfer_guest_matches",
    {
      p_guest_owner_id: guestUser.id,
      p_account_owner_id: accountUser.id,
    },
  );

  if (transferError) return json({ error: transferError.message }, 500);
  return json({ transferred: data ?? 0 });
});
