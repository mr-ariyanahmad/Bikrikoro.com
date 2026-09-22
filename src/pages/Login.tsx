import { useEffect, useState } from "react";
import { Eye, EyeOff, Home, ShoppingBag } from "lucide-react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

const SOCIAL_AUTH_TIMEOUT_MS = 20_000;

function socialAuthMessage(error: unknown, provider = "Google") {
  const code = (error as { code?: string }).code;
  if (code === "auth/unauthorized-domain")
    return "এই website Firebase Authorized Domains-এ যোগ করা নেই।";
  if (code === "auth/operation-not-allowed")
    return `Firebase Console-এ ${provider} login চালু করা নেই।`;
  if (code === "auth/account-exists-with-different-credential")
    return "এই email দিয়ে আগে অন্য পদ্ধতিতে account খোলা আছে।";
  if (code === "auth/popup-closed-by-user")
    return `${provider} login window বন্ধ হয়ে গেছে। আবার চেষ্টা করুন।`;
  if (code === "auth/popup-blocked")
    return "Browser popup বন্ধ করেছে। Popup permission চালু করে আবার চেষ্টা করুন।";
  if (code === "auth/network-request-failed")
    return "ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।";
  return `${provider} login করা যায়নি। আবার চেষ্টা করুন।`;
}

function waitForSocialAuth<T>(promise: Promise<T>): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      const error = new Error("Social authentication timed out") as Error & {
        code?: string;
      };
      error.code = "auth/timeout";
      reject(error);
    }, SOCIAL_AUTH_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

export default function Login() {
  const {
    user,
    authError,
    loginWithEmail,
    registerWithEmail,
    loginWithGoogle,
    loginWithFacebook,
  } = useAuth();
  const location = useLocation();
  const requestedPath =
    typeof location.state?.from === "string" ? location.state.from : null;
  const storedPath =
    typeof window !== "undefined"
      ? window.sessionStorage.getItem("bikrikoro:auth-return-to")
      : null;
  const returnTo =
    [requestedPath, storedPath].find((path) =>
      Boolean(path && path.startsWith("/") && !path.startsWith("//")),
    ) ?? "/";
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [socialBusy, setSocialBusy] = useState<"google" | "facebook" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const emailIsValid = /^\S+@\S+\.\S+$/.test(email.trim());

  useEffect(() => {
    if (authError) setError(socialAuthMessage({ code: authError }));
  }, [authError]);

  if (user) {
    if (typeof window !== "undefined")
      window.sessionStorage.removeItem("bikrikoro:auth-return-to");
    return <Navigate to={returnTo} replace />;
  }

  const handleSubmit = async () => {
    setError(null);
    if (!emailIsValid) {
      setError("সঠিক email address দিন।");
      return;
    }
    if (!password) {
      setError("পাসওয়ার্ড দিন।");
      return;
    }
    if (isRegistering && !name.trim()) {
      setError("আপনার নাম দিন।");
      return;
    }
    if (isRegistering && password.length < 6) {
      setError("পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।");
      return;
    }
    setBusy(true);
    try {
      if (isRegistering)
        await registerWithEmail(name.trim(), email.trim(), password);
      else await loginWithEmail(email.trim(), password);
    } catch (authFailure) {
      const code = (authFailure as { code?: string }).code;
      if (code === "auth/email-already-in-use")
        setError("এই email দিয়ে আগে থেকেই account আছে। Login করুন।");
      else if (
        code === "auth/invalid-credential" ||
        code === "auth/wrong-password" ||
        code === "auth/user-not-found"
      )
        setError("ইমেইল বা পাসওয়ার্ড সঠিক নয়।");
      else if (code === "auth/weak-password")
        setError("পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।");
      else
        setError(
          isRegistering ? "Account তৈরি করা যায়নি।" : "Login করা যায়নি।",
        );
    } finally {
      setBusy(false);
    }
  };

  const handleSocial = async (provider: "google" | "facebook") => {
    setError(null);
    setSocialBusy(provider);
    try {
      await waitForSocialAuth(
        provider === "google" ? loginWithGoogle() : loginWithFacebook(),
      );
    } catch (socialFailure) {
      setError(
        socialAuthMessage(
          socialFailure,
          provider === "google" ? "Google" : "Facebook",
        ),
      );
    } finally {
      setSocialBusy(null);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-bg px-4 py-16 sm:px-5">
      <div className="absolute inset-x-4 top-4 mx-auto flex max-w-md items-center justify-between sm:inset-x-5">
        <Link
          to="/products"
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-outline bg-surface px-3 py-2 text-sm font-semibold text-ink-700 shadow-sm hover:border-brand-500 hover:text-brand-700"
        >
          <ShoppingBag size={16} />
          প্রোডাক্ট
        </Link>
        <Link
          to="/"
          aria-label="হোমে যান"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-outline bg-surface text-ink-700 shadow-sm hover:border-brand-500 hover:text-brand-700"
        >
          <Home size={17} />
        </Link>
      </div>

      <main className="w-full max-w-md rounded-2xl border border-outline bg-surface p-6 shadow-sm sm:p-8">
        <div className="mb-6 text-center">
          <img
            src="/icon-512.png"
            alt="BikriKoro"
            className="mx-auto mb-3 h-14 w-14 rounded-2xl"
          />
          <h1 className="text-2xl font-bold text-ink-900">
            {isRegistering
              ? "নতুন account তৈরি করুন"
              : "BikriKoro-তে Login করুন"}
          </h1>
          <p className="mt-1 text-sm text-ink-600">
            {isRegistering
              ? "আপনার তথ্য দিয়ে account খুলুন"
              : "আপনার account-এ প্রবেশ করুন"}
          </p>
        </div>

        <div className="mb-5 grid grid-cols-2 rounded-xl border border-outline bg-bg p-1">
          <button
            type="button"
            onClick={() => {
              setIsRegistering(false);
              setError(null);
              setPassword("");
              setShowPassword(false);
            }}
            className={`rounded-lg py-2.5 text-sm font-bold transition ${!isRegistering ? "bg-surface text-brand-700 shadow-sm" : "text-ink-500 hover:text-ink-700"}`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => {
              setIsRegistering(true);
              setError(null);
              setPassword("");
              setShowPassword(false);
            }}
            className={`rounded-lg py-2.5 text-sm font-bold transition ${isRegistering ? "bg-surface text-brand-700 shadow-sm" : "text-ink-500 hover:text-ink-700"}`}
          >
            নতুন account
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => void handleSocial("google")}
            disabled={Boolean(socialBusy) || busy}
            className="flex items-center justify-center gap-2 rounded-xl border border-outline bg-surface py-3 text-sm font-semibold text-ink-800 transition hover:bg-bg disabled:cursor-not-allowed disabled:opacity-60"
          >
            <GoogleMark />
            {socialBusy === "google" ? "অপেক্ষা করুন…" : "Google"}
          </button>
          <button
            type="button"
            onClick={() => void handleSocial("facebook")}
            disabled={Boolean(socialBusy) || busy}
            className="flex items-center justify-center gap-2 rounded-xl border border-outline bg-surface py-3 text-sm font-semibold text-ink-800 transition hover:bg-bg disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#1877F2] text-sm font-bold leading-none text-white">
              f
            </span>
            {socialBusy === "facebook" ? "অপেক্ষা করুন…" : "Facebook"}
          </button>
        </div>

        <div className="my-5 flex items-center gap-3 text-xs text-ink-400">
          <div className="h-px flex-1 bg-outline" />
          অথবা
          <div className="h-px flex-1 bg-outline" />
        </div>

        {isRegistering && (
          <label className="mb-3 block">
            <span className="mb-1.5 block text-sm font-semibold text-ink-800">
              আপনার নাম
            </span>
            <input
              type="text"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="যেমন: আরিয়ান আহমেদ"
              className="w-full rounded-xl border border-outline px-3 py-3 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10"
            />
          </label>
        )}
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-ink-800">
            ইমেইল
          </span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className={`w-full rounded-xl border px-3 py-3 text-base outline-none focus:ring-2 focus:ring-brand-500/10 ${email && !emailIsValid ? "border-error focus:border-error" : "border-outline focus:border-brand-500"}`}
          />
          {email && !emailIsValid && (
            <span className="mt-1.5 block text-xs text-error">
              একটি সঠিক email address দিন
            </span>
          )}
        </label>
        <label className="mt-3 block">
          <span className="mb-1.5 block text-sm font-semibold text-ink-800">
            পাসওয়ার্ড
          </span>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              autoComplete={isRegistering ? "new-password" : "current-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="পাসওয়ার্ড"
              className="w-full rounded-xl border border-outline px-3 py-3 pr-11 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10"
            />
            <button
              type="button"
              aria-label={
                showPassword ? "পাসওয়ার্ড লুকান" : "পাসওয়ার্ড দেখুন"
              }
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-ink-400 hover:bg-bg hover:text-brand-700"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {isRegistering && (
            <span
              className={`mt-1.5 block text-xs ${password && password.length < 6 ? "text-error" : "text-ink-500"}`}
            >
              কমপক্ষে ৬ অক্ষর
            </span>
          )}
        </label>
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={busy || Boolean(socialBusy)}
          className="mt-4 w-full rounded-xl bg-brand-500 py-3.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy
            ? "অপেক্ষা করুন…"
            : isRegistering
              ? "Account তৈরি করুন"
              : "Login করুন"}
        </button>
        {!isRegistering && (
          <Link
            to="/forgot-password"
            className="mt-4 block text-center text-sm font-semibold text-brand-700 hover:underline"
          >
            পাসওয়ার্ড ভুলে গেছেন?
          </Link>
        )}
        <p className="mt-5 text-center text-sm text-ink-600">
          {isRegistering ? "আগে account আছে?" : "নতুন account দরকার?"}{" "}
          <button
            type="button"
            onClick={() => {
              setIsRegistering((value) => !value);
              setError(null);
            }}
            className="font-bold text-brand-700 hover:underline"
          >
            {isRegistering ? "Login করুন" : "Register করুন"}
          </button>
        </p>
        {error && (
          <p className="mt-4 rounded-xl border border-error/20 bg-error/5 p-3 text-center text-sm font-medium text-error">
            {error}
          </p>
        )}
      </main>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.56 2.7-3.87 2.7-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.81.54-1.85.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.98v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.95 10.7A5.4 5.4 0 0 1 3.66 9c0-.59.1-1.16.29-1.7V4.97H.98A9 9 0 0 0 0 9c0 1.45.35 2.83.98 4.03z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .98 4.97L3.95 7.3C4.66 5.17 6.65 3.58 9 3.58z"
      />
    </svg>
  );
}
