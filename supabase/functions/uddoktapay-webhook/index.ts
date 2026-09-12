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
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL");

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function shortOrderNumber(orderNumber: number | null | undefined, fallbackId: string) {
  return typeof orderNumber === 'number' && Number.isFinite(orderNumber) ? `BKCOM${Math.trunc(orderNumber)}` : `BKCOM${fallbackId.replaceAll('-', '').slice(0, 6).toUpperCase()}`;
}

async function sendPaidOrderEmail(to: string, role: 'BUYER' | 'SELLER', order: Record<string, unknown>) {
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL || !to) return;
  const orderNumber = shortOrderNumber(Number(order.order_number), String(order.id));
  const title = escapeHtml(String(order.product_title ?? 'BikriKoro product'));
  const name = escapeHtml(String(role === 'BUYER' ? order.buyer_name ?? 'প্রিয় ক্রেতা' : order.seller_name ?? 'প্রিয় সেলার'));
  const orderLink = `https://bikrikoro.com/orders/${encodeURIComponent(String(order.id))}`;
  const html = `<!doctype html><html lang="bn"><body style="margin:0;background:#f5faf7;padding:24px;font-family:Arial,sans-serif;color:#17231f"><div style="max-width:620px;margin:auto;background:#fff;border:1px solid #dce8e2;border-radius:20px;padding:28px"><h1 style="margin:0 0 12px;color:#087f5b">${role === 'BUYER' ? 'পেমেন্ট সফল হয়েছে' : 'নতুন পেইড অর্ডার এসেছে'}</h1><p>হ্যালো ${name}, ${role === 'BUYER' ? 'আপনার পেমেন্ট সফলভাবে যাচাই হয়েছে।' : 'আপনার listing-এর জন্য পেমেন্ট সম্পন্ন একটি অর্ডার এসেছে।'}</p><div style="margin:20px 0;padding:16px;border-radius:12px;background:#f0faf5"><p style="margin:0 0 8px"><strong>পণ্য:</strong> ${title}</p><p style="margin:0 0 8px"><strong>অর্ডার:</strong> ${escapeHtml(orderNumber)}</p><p style="margin:0"><strong>স্ট্যাটাস:</strong> পেমেন্ট যাচাই হয়েছে</p></div><a href="${orderLink}" style="display:inline-block;background:#087f5b;color:#fff;text-decoration:none;border-radius:10px;padding:12px 18px">অর্ডার দেখুন</a><p style="margin-top:28px;color:#66756e;font-size:12px">এই emailটি BikriKoro.Com থেকে স্বয়ংক্রিয়ভাবে পাঠানো হয়েছে।</p></div></body></html>`;
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `bikrikoro-paid-order-${order.id}-${role.toLowerCase()}` }, body: JSON.stringify({ from: RESEND_FROM_EMAIL, to: [to], subject: `${role === 'BUYER' ? 'পেমেন্ট সফল' : 'নতুন পেইড অর্ডার'} — ${orderNumber}`, html, text: `${role === 'BUYER' ? 'পেমেন্ট সফল হয়েছে' : 'নতুন পেইড অর্ডার এসেছে'}\n\nপণ্য: ${order.product_title}\nঅর্ডার: ${orderNumber}\nঅর্ডার দেখুন: ${orderLink}` }) });
  if (!response.ok) console.error('Paid order email failed:', await response.text());
}

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
  if (!verifyResponse.ok) {
    return new Response("Payment verification failed", { status: 502 });
  }
  const verified = await verifyResponse.json();

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select("id, price, escrow_fee, buyer_id, seller_id, delivery_email, order_number, product_title")
    .eq("id", orderId)
    .maybeSingle();
  if (orderError || !order) return new Response("Order not found", { status: 404 });
  const verifiedMetadata = verified.metadata as { order_id?: string } | undefined;
  if (verifiedMetadata?.order_id !== orderId) {
    return new Response("Invoice is not linked to this order", { status: 409 });
  }
  const providerAmount = Number(verified.charged_amount ?? verified.amount ?? 0);
  const expectedAmount = Number(order.price ?? 0) + Number(order.escrow_fee ?? 0);
  if (verified.status === "COMPLETED" && Math.round(providerAmount * 100) !== Math.round(expectedAmount * 100)) {
    return new Response("Payment amount mismatch", { status: 409 });
  }

  // Record the attempt regardless of outcome — upsert on invoice_id so a
  // retried webhook delivery (UddoktaPay retries on non-2xx) doesn't
  // create duplicate rows.
  const { error: paymentError } = await supabaseAdmin.from("payments").upsert(
    {
      order_id: orderId,
      invoice_id: invoiceId,
      amount: providerAmount,
      fee: Number(verified.fee ?? 0),
      payment_method: (verified.payment_method as string | undefined)?.toUpperCase() ?? null,
      sender_number: verified.sender_number ?? null,
      transaction_id: verified.transaction_id ?? null,
      status: verified.status ?? "PENDING",
      raw_payload: verified,
    },
    { onConflict: "invoice_id" }
  );
  if (paymentError) {
    return new Response(JSON.stringify({ error: paymentError.message }), { status: 500 });
  }

  if (verified.status !== "COMPLETED") {
    // PENDING or INVALID — nothing more to do; the order stays at
    // PENDING_PAYMENT and the buyer can retry from /orders/payment-callback.
    return new Response("ok", { status: 200 });
  }

  // Idempotent: only flips orders that are still awaiting payment. The provider
  // verification above is authoritative, so a delayed webhook is not rejected
  // merely because the local 30-minute browser deadline has passed.
  const { data: transitionedOrder, error: updateError } = await supabaseAdmin
    .from("orders")
    .update({
      status: "ESCROW_HELD",
      payment_method: (verified.payment_method as string | undefined)?.toUpperCase() ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("status", "PENDING_PAYMENT")
    .select("id")
    .maybeSingle();


  if (updateError) {
    return new Response(JSON.stringify({ error: updateError.message }), { status: 500 });
  }

  if (transitionedOrder?.id) {
    if (order) {
      const participantIds = [order.buyer_id, order.seller_id].filter(Boolean);
      const { data: profiles } = participantIds.length ? await supabaseAdmin.from("profiles").select("id, name, email").in("id", participantIds) : { data: [] };
      const buyer = profiles?.find((profile) => profile.id === order.buyer_id);
      const seller = profiles?.find((profile) => profile.id === order.seller_id);
      await Promise.allSettled([
        buyer?.email ? sendPaidOrderEmail(order.delivery_email ?? buyer.email, 'BUYER', { ...order, buyer_name: buyer.name }) : Promise.resolve(),
        seller?.email ? sendPaidOrderEmail(seller.email, 'SELLER', { ...order, seller_name: seller.name }) : Promise.resolve(),
      ]);
    }
  }

  return new Response("ok", { status: 200 });
});
