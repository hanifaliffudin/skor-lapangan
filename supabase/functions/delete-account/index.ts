import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.3";
import { corsHeaders } from "../_shared/cors.ts";

function json(
  request: Request,
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    headers: corsHeaders(request),
    status,
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST")
    return json(request, { error: "Method not allowed." }, 405);

  const authorization = request.headers.get("Authorization");
  const token = authorization?.replace(/^Bearer\s+/i, "").trim();
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!token || !supabaseUrl || !anonKey || !serviceRoleKey) {
    return json(request, { error: "Account deletion is not configured." }, 500);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser(token);

  if (userError || !user)
    return json(request, { error: "Authentication is required." }, 401);
  if (user.is_anonymous)
    return json(request, { error: "A durable account is required." }, 403);

  const { error: dataError } = await userClient.rpc("delete_my_account_data");
  if (dataError) return json(request, { error: dataError.message }, 500);

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(
    user.id,
  );
  if (deleteError) return json(request, { error: deleteError.message }, 500);

  return json(request, { deleted: true });
});
