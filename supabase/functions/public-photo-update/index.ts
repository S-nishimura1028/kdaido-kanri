/**
 * Retired anonymous photo update endpoint.
 * This endpoint is kept as an explicit tombstone to ensure that callers of
 * the old public QR interface cannot upload or modify photos.
 *
 * The admin-only photo editor uses Storage RLS + update_asset_photos RPC.
 * Deployment of this file is a separate, reviewed production operation.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const headers = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "apikey, authorization, content-type, x-client-info",
};

Deno.serve((request: Request): Response => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }
  return new Response(
    JSON.stringify({ error: "旧QR写真更新は終了しました。管理者としてログインしてください。" }),
    { status: 410, headers },
  );
});
