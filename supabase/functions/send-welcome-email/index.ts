// supabase/functions/send-welcome-email/index.ts
//
// Sends a branded confirmation/welcome email via Resend (https://resend.com)
// right after a buyer or seller registers with email on BikriKoro.
//
// Why an Edge Function instead of calling Resend from the Android app
// directly: the RESEND_API_KEY must never ship inside the APK — anyone
// could decompile it and send email as "BikriKoro" from your domain.
// This function holds the key as a server-side secret instead.
//
// Deploy:
//   supabase functions deploy send-welcome-email
//   supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxx
//
// Called from the app via:
//   supabaseClient.functions.invoke("send-welcome-email", body = ...)
// (see PushNotificationManager.kt sibling — AuthRepositoryImpl.registerWithEmail)

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") ?? "BikriKoro <no-reply@bikrikoro.com>";

interface WelcomeEmailPayload {
  email: string;
  name?: string;
}

function renderHtml(name: string): string {
  const displayName = name.trim().length > 0 ? name.trim() : "প্রিয় ব্যবহারকারী";
  return `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color:#179D72;">স্বাগতম, ${displayName}!</h2>
      <p style="color:#333; font-size:15px; line-height:1.6;">
        BikriKoro-তে অ্যাকাউন্ট তৈরি করার জন্য ধন্যবাদ। আপনার প্রতিটি কেনাকাটা এসক্রো
        সুরক্ষিত থাকবে — পণ্য হাতে না পাওয়া পর্যন্ত টাকা নিরাপদে জমা থাকবে।
      </p>
      <p style="color:#333; font-size:15px; line-height:1.6;">
        অ্যাকাউন্ট ভেরিফাই করতে অ্যাপে পাঠানো OTP/ভেরিফিকেশন লিংকটি ব্যবহার করুন।
      </p>
      <p style="color:#888; font-size:12px; margin-top:32px;">Nasah Group Ltd. — BikriKoro</p>
    </div>
  `;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  if (!RESEND_API_KEY) {
    return new Response(
      JSON.stringify({ error: "RESEND_API_KEY secret not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const { email, name }: WelcomeEmailPayload = await req.json();
    if (!email) {
      return new Response(JSON.stringify({ error: "email is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [email],
        subject: "BikriKoro-তে স্বাগতম!",
        html: renderHtml(name ?? ""),
      }),
    });

    if (!resendResponse.ok) {
      const errorBody = await resendResponse.text();
      return new Response(JSON.stringify({ error: "Resend API error", details: errorBody }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
