import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const UDDOKTAPAY_API_KEY = Deno.env.get("UDDOKTAPAY_API_KEY");
const UDDOKTAPAY_BASE_URL = (Deno.env.get("UDDOKTAPAY_BASE_URL") ?? "https://sandbox.uddoktapay.com")
  .replace(/\/+$/, "")
  .replace(/\/api$/, "");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!UDDOKTAPAY_API_KEY) return json({ error: "Payment service configuration is missing" }, 500);

  try {
    const input = await req.json() as { orderId?: string; invoiceId?: string };
    const orderId = input.orderId?.trim() ?? "";
    let invoiceId = input.invoiceId?.trim() ?? "";
    if (!orderId) return json({ error: "Order ID is required" }, 400);

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: order, error: orderError } = await db
      .from("orders")
      .select("id, status, payment_expires_at, price, escrow_fee, buyer_id, seller_id, payment_method")
      .eq("id", orderId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return json({ error: "Order not found" }, 404);

    if (!invoiceId) {
      const { data: storedPayment, error: paymentLookupError } = await db
        .from("payments")
        .select("invoice_id")
        .eq("order_id", orderId)
        .not("invoice_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (paymentLookupError) throw paymentLookupError;
      invoiceId = storedPayment?.invoice_id ?? "";
    }
    if (!invoiceId) return json({ status: order.status, error: "Payment invoice is not available yet" }, 202);

    const verifyResponse = await fetch(`${UDDOKTAPAY_BASE_URL}/api/verify-payment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "RT-UDDOKTAPAY-API-KEY": UDDOKTAPAY_API_KEY,
      },
      body: JSON.stringify({ invoice_id: invoiceId }),
    });
    if (!verifyResponse.ok) return json({ status: order.status, error: "Payment verification service unavailable" }, 502);

    const verified = await verifyResponse.json() as Record<string, unknown>;
    const metadata = verified.metadata && typeof verified.metadata === "object"
      ? verified.metadata as Record<string, unknown>
      : {};
    if (metadata.order_id !== orderId) return json({ status: order.status, error: "Payment invoice is not linked to this order" }, 409);

    const providerStatus = String(verified.status ?? "PENDING").toUpperCase();
    const paymentStatus = providerStatus === "COMPLETED" ? "COMPLETED" : providerStatus === "PENDING" ? "PENDING" : "INVALID";
    const providerAmount = money(verified.charged_amount ?? verified.amount);
    const expectedAmount = money(Number(order.price) + Number(order.escrow_fee));
    if (paymentStatus === "COMPLETED" && providerAmount !== expectedAmount) {
      return json({ status: order.status, error: "Payment amount mismatch" }, 409);
    }

    const { error: paymentError } = await db.from("payments").upsert({
      order_id: orderId,
      invoice_id: invoiceId,
      amount: providerAmount,
      fee: money(verified.fee),
      payment_method: typeof verified.payment_method === "string" ? verified.payment_method.toUpperCase() : null,
      sender_number: verified.sender_number ?? null,
      transaction_id: verified.transaction_id ?? null,
      status: paymentStatus,
      raw_payload: verified,
    }, { onConflict: "invoice_id" });
    if (paymentError) throw paymentError;

    if (paymentStatus !== "COMPLETED") return json({ status: order.status, paymentStatus });

    const transition = {
      status: "ESCROW_HELD",
      payment_method: typeof verified.payment_method === "string" ? verified.payment_method.toUpperCase() : order.payment_method,
      updated_at: new Date().toISOString(),
    };
    const { data: transitioned, error: transitionError } = await db
      .from("orders")
      .update(transition)
      .eq("id", orderId)
      .eq("status", "PENDING_PAYMENT")
      .select("id, status")
      .maybeSingle();
    if (transitionError) throw transitionError;

    if (transitioned?.id) return json({ status: transitioned.status, paymentStatus });
    if (order.status === "ESCROW_HELD" || order.status === "DIGITAL_DELIVERED" || order.status === "COMPLETED") {
      return json({ status: order.status, paymentStatus });
    }

    if (order.status === "CANCELLED" && order.payment_expires_at && new Date(order.payment_expires_at) <= new Date()) {
      const { data: recovered, error: recoveryError } = await db
        .from("orders")
        .update(transition)
        .eq("id", orderId)
        .eq("status", "CANCELLED")
        .select("id, status")
        .maybeSingle();
      if (recoveryError) throw recoveryError;
      if (recovered?.id) return json({ status: recovered.status, paymentStatus, recovered: true });
    }

    return json({ status: order.status, paymentStatus, error: "Payment verified but order state was not transitioned" }, 409);
  } catch (error) {
    console.error("UddoktaPay reconciliation failed:", error);
    return json({ error: error instanceof Error ? error.message : "Payment reconciliation failed" }, 500);
  }
});

function money(value: unknown) {
  return Math.round(Number(value ?? 0) * 100) / 100;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
