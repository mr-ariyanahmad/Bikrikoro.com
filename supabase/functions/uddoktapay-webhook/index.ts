// supabase/functions/uddoktapay-webhook/index.ts
//
// Website checkout step 2: UddoktaPay calls this URL when a payment
// finishes (see webhook_url in uddoktapay-create-charge). This is the
// ONLY place an order actually moves PENDING_PAYMENT -> ESCROW_HELD —
// never trust the browser redirect alone (a closed tab, a slow network,
// or someone just hand-typing the redirect_url would otherwise let
// anyone "confirm" a payment that never happened).
//
// Two independent checks before trusting anything in the request body:
//   1. The RT-UDDOKTAPAY-API-KEY header must match our own secret key —
//      UddoktaPay echoes it back on every webhook call.
//   2. We then call UddoktaPay's own Verify Payment API with the
//      invoice_id and trust THAT response's status, not the webhook
//      body's status field, in case the body itself was tampered with
//      in transit by anything other than UddoktaPay's servers.
//
// Deploy:
//   supabase functions deploy uddoktapay-webhook --no-verify-jwt
//   (--no-verify-jwt because UddoktaPay's servers call this directly,
//   with no Supabase anon/service key — the checks above are what
//   authenticate the request instead)
//   supabase secrets set UDDOKTAPAY_API_KEY=xxxxx UDDOKTAPAY_BASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
//
// Set this function's URL as the "Webhook URL" in your UddoktaPay panel
// too — uddoktapay-create-charge already passes it per-request, but some
// UddoktaPay setups also require it configured in the dashboard.

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const UDDOKTAPAY_API_KEY = Deno.env.get("UDDOKTAPAY_API_KEY");
const UDDOKTAPAY_BASE_URL = Deno.env.get("UDDOKTAPAY_BASE_URL") ?? "https://sandbox.uddoktapay.com";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!UDDOKTAPAY_API_KEY) return new Response("UDDOKTAPAY_API_KEY not configured", { status: 500 });

  // Check 1: header must match our own key.
  const headerKey = req.headers.get("RT-UDDOKTAPAY-API-KEY");
  if (headerKey !== UDDOKTAPAY_API_KEY) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const invoiceId = body.invoice_id as string | undefined;
  const metadata = body.metadata as { order_id?: string } | undefined;
  const orderId = metadata?.order_id;

  if (!invoiceId || !orderId) {
    return new Response("Missing invoice_id or metadata.order_id", { status: 400 });
  }

  // Check 2: verify with UddoktaPay directly rather than trusting body.status.
  const verifyResponse = await fetch(`${UDDOKTAPAY_BASE_URL}/api/verify-payment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "RT-UDDOKTAPAY-API-KEY": UDDOKTAPAY_API_KEY,
    },
    body: JSON.stringify({ invoice_id: invoiceId }),
  });
  const verified = await verifyResponse.json();

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Record the attempt regardless of outcome — upsert on invoice_id so a
  // retried webhook delivery (UddoktaPay retries on non-2xx) doesn't
  // create duplicate rows.
  await supabaseAdmin.from("payments").upsert(
    {
      order_id: orderId,
      invoice_id: invoiceId,
      amount: Number(verified.amount ?? 0),
      fee: Number(verified.fee ?? 0),
      payment_method: (verified.payment_method as string | undefined)?.toUpperCase() ?? null,
      sender_number: verified.sender_number ?? null,
      transaction_id: verified.transaction_id ?? null,
      status: verified.status ?? "PENDING",
      raw_payload: verified,
    },
    { onConflict: "invoice_id" }
  );

  if (verified.status !== "COMPLETED") {
    // PENDING or INVALID — nothing more to do; the order stays at
    // PENDING_PAYMENT and the buyer can retry from /orders/payment-callback.
    return new Response("ok", { status: 200 });
  }

  // Idempotent: only flips orders that are still actually awaiting
  // payment, so a duplicate COMPLETED webhook delivery is a no-op.
  const { error: updateError } = await supabaseAdmin
    .from("orders")
    .update({
      status: "ESCROW_HELD",
      payment_method: (verified.payment_method as string | undefined)?.toUpperCase() ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("status", "PENDING_PAYMENT");

  if (updateError) {
    return new Response(JSON.stringify({ error: updateError.message }), { status: 500 });
  }

  return new Response("ok", { status: 200 });
});
