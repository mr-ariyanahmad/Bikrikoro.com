// supabase/functions/uddoktapay-create-charge/index.ts
//
// Website checkout step 1: given an orderId already sitting at
// PENDING_PAYMENT (see create_order_pending_payment in
// supabase/migrations/010_uddoktapay_payments.sql), asks UddoktaPay for a
// hosted payment_url and returns it so the browser can redirect there.
//
// The UDDOKTAPAY_API_KEY must never reach the browser — that's the whole
// reason this is an Edge Function instead of a client-side fetch. Same
// reasoning as send-welcome-email's RESEND_API_KEY.
//
// Deploy:
//   supabase functions deploy uddoktapay-create-charge
//   supabase secrets set UDDOKTAPAY_API_KEY=xxxxx UDDOKTAPAY_BASE_URL=https://sandbox.uddoktapay.com SITE_URL=https://bikrikoro.com SUPABASE_SERVICE_ROLE_KEY=xxxxx
//
// Called from the website via:
//   supabase.functions.invoke("uddoktapay-create-charge", { body: { orderId } })
// (see src/lib/payments.ts)

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const UDDOKTAPAY_API_KEY = Deno.env.get("UDDOKTAPAY_API_KEY");
const UDDOKTAPAY_BASE_URL = Deno.env.get("UDDOKTAPAY_BASE_URL") ?? "https://sandbox.uddoktapay.com";
const SITE_URL = Deno.env.get("SITE_URL") ?? "http://localhost:5173";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }
  if (!UDDOKTAPAY_API_KEY) {
    return json({ error: "UDDOKTAPAY_API_KEY secret not configured" }, 500);
  }

  try {
    const { orderId } = await req.json();
    if (!orderId) return json({ error: "orderId is required" }, 400);

    // service_role — reads the order's real amount server-side. Never
    // trust an amount passed in from the client; that's how someone
    // pays ৳10 for a ৳10,000 order.
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, price, escrow_fee, status, buyer_id, product_title")
      .eq("id", orderId)
      .single();

    if (orderError || !order) return json({ error: "Order not found" }, 404);
    if (order.status !== "PENDING_PAYMENT") {
      return json({ error: "Order is not awaiting payment" }, 409);
    }

    const { data: buyer } = await supabaseAdmin
      .from("profiles")
      .select("name, email, phone")
      .eq("id", order.buyer_id)
      .maybeSingle();

    const totalAmount = Number(order.price) + Number(order.escrow_fee);

    const chargeResponse = await fetch(`${UDDOKTAPAY_BASE_URL}/api/checkout-v2`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "RT-UDDOKTAPAY-API-KEY": UDDOKTAPAY_API_KEY,
      },
      body: JSON.stringify({
        full_name: buyer?.name || "BikriKoro Customer",
        email: buyer?.email || "no-reply@bikrikoro.com",
        amount: totalAmount.toString(),
        metadata: { order_id: order.id },
        redirect_url: `${SITE_URL}/orders/payment-callback?order_id=${order.id}`,
        cancel_url: `${SITE_URL}/orders/payment-callback?order_id=${order.id}&cancelled=1`,
        webhook_url: `${SUPABASE_URL}/functions/v1/uddoktapay-webhook`,
      }),
    });

    const chargeData = await chargeResponse.json();
    if (!chargeResponse.ok || chargeData.status !== "true" || !chargeData.payment_url) {
      return json({ error: "UddoktaPay charge creation failed", details: chargeData }, 502);
    }

    return json({ payment_url: chargeData.payment_url });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}
