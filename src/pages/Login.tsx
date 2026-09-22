import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Home,
  LockKeyhole,
  Mail,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

const PENDING_EMAIL_KEY = "bikrikoro:email-signup-pending";

function authMessage(error: unknown, registering: boolean) {
  const code = (error as { code?: string }).code;
  if (code === "firebase/not-configured")
    return "Firebase configuration পাওয়া যায়নি। Vercel environment variables পরীক্ষা করুন।";
  if (code === "auth/invalid-email") return "সঠিক email address দিন।";
  if (
    code === "auth/invalid-credential" ||
    code === "auth/wrong-password" ||
    code === "auth/user-not-found"
  )
    return "ইমেইল বা পাসওয়ার্ড সঠিক নয়।";
  if (code === "auth/email-already-in-use")
    return "এই email দিয়ে আগে থেকেই account আছে। Login করুন।";
  if (code === "auth/weak-password")
    return "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।";
  if (code === "auth/too-many-requests")
    return "অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।";
  if (
    code === "auth/unauthorized-continue-uri" ||
    code === "auth/invalid-continue-uri"
  )
    return "Email verification link-এর domain Firebase-এ অনুমোদিত নয়।";
  if (code === "auth/expired-action-code")
    return "এই email link-এর মেয়াদ শেষ হয়েছে। নতুন link পাঠান।";
  if (code === "auth/invalid-action-code")
    return "Email link সঠিক নয় বা ইতিমধ্যে ব্যবহার করা হয়েছে। নতুন link পাঠান।";
  return registering
    ? "Email verification link পাঠানো যায়নি। আবার চেষ্টা করুন।"
    : "Login করা যায়নি। আবার চেষ্টা করুন।";
}

export default function Login() {
  const {
    user,
    loading: authLoading,
    sendEmailCode,
    completeEmailCode,
    loginWithEmail,
    changePassword,
  } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
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
  const [stage, setStage] = useState<"email" | "check-email" | "set-password">(
    "email",
  );
  const [email, setEmail] = useState(() =>
    typeof window !== "undefined"
      ? (window.localStorage.getItem(PENDING_EMAIL_KEY) ?? "")
      : "",
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [completingLink, setCompletingLink] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const pendingEmail = window.localStorage.getItem(PENDING_EMAIL_KEY);
    const isEmailLink =
      window.location.href.includes("oobCode=") &&
      window.location.href.includes("mode=signIn");
    if (!pendingEmail || !isEmailLink || user) return;
    setCompletingLink(true);
    void completeEmailCode(pendingEmail, window.location.href)
      .then(() => {
        window.history.replaceState({}, document.title, "/login");
        setStage("set-password");
        setIsRegistering(true);
      })
      .catch((linkError) => setError(authMessage(linkError, true)))
      .finally(() => setCompletingLink(false));
  }, [completeEmailCode, user]);

  if (authLoading || completingLink)
    return (
      <AuthShell>
        <div className="animate-pulse rounded-3xl border border-outline bg-surface p-8 text-center text-sm text-ink-500">
          আপনার account প্রস্তুত করা হচ্ছে…
        </div>
      </AuthShell>
    );

  if (user && stage !== "set-password") {
    if (typeof window !== "undefined")
      window.sessionStorage.removeItem("bikrikoro:auth-return-to");
    return <Navigate to={returnTo} replace />;
  }

  const handleLogin = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError("ইমেইল ও পাসওয়ার্ড দিন।");
      return;
    }
    setBusy(true);
    try {
      await loginWithEmail(email, password);
    } catch (loginError) {
      setError(authMessage(loginError, false));
    } finally {
      setBusy(false);
    }
  };

  const handleSendEmail = async () => {
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("সঠিক email address দিন।");
      return;
    }
    setBusy(true);
    try {
      await sendEmailCode(email);
      setStage("check-email");
    } catch (sendError) {
      setError(authMessage(sendError, true));
    } finally {
      setBusy(false);
    }
  };

  const handlePasswordSetup = async () => {
    setError(null);
    if (password.length < 6) {
      setError("পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।");
      return;
    }
    if (password !== confirmPassword) {
      setError("দুটি পাসওয়ার্ড এক নয়।");
      return;
    }
    setBusy(true);
    try {
      await changePassword(password);
      window.localStorage.removeItem(PENDING_EMAIL_KEY);
      navigate("/account/edit", { replace: true, state: { firstSetup: true } });
    } catch (setupError) {
      setError(authMessage(setupError, true));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <AuthCard>
        {stage === "set-password" ? (
          <PasswordSetup
            password={password}
            confirmPassword={confirmPassword}
            busy={busy}
            setPassword={setPassword}
            setConfirmPassword={setConfirmPassword}
            onSubmit={() => void handlePasswordSetup()}
          />
        ) : (
          <>
            <AuthTabs
              isRegistering={isRegistering}
              onLogin={() => {
                setIsRegistering(false);
                setStage("email");
                setError(null);
              }}
              onRegister={() => {
                setIsRegistering(true);
                setStage("email");
                setError(null);
              }}
            />
            {stage === "check-email" ? (
              <EmailSent
                email={email}
                busy={busy}
                onResend={() => void handleSendEmail()}
                onBack={() => {
                  setStage("email");
                  setError(null);
                }}
              />
            ) : (
              <EmailForm
                isRegistering={isRegistering}
                email={email}
                password={password}
                busy={busy}
                setEmail={setEmail}
                setPassword={setPassword}
                onSend={() => void handleSendEmail()}
                onLogin={() => void handleLogin()}
              />
            )}
          </>
        )}
        {error && (
          <p className="mt-4 rounded-xl border border-error/20 bg-error/5 p-3 text-center text-sm font-medium text-error">
            {error}
          </p>
        )}
      </AuthCard>
    </AuthShell>
  );
}

function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[2rem] border border-brand-100 bg-surface shadow-[0_24px_70px_rgba(15,23,42,0.1)]">
      <div className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-emerald-400 px-6 pb-9 pt-7 text-white sm:px-9">
        <div className="absolute -right-10 -top-14 h-44 w-44 animate-pulse rounded-full bg-white/10" />
        <div className="absolute -bottom-20 -left-12 h-48 w-48 rounded-full bg-emerald-200/15" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <div className="flex h-12 w-12 animate-bounce items-center justify-center rounded-2xl bg-white/15 shadow-inner">
              <Sparkles size={25} />
            </div>
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">
              নিরাপদ account
            </span>
          </div>
          <h1 className="mt-7 text-2xl font-extrabold tracking-tight sm:text-3xl">
            আপনার ডিজিটাল যাত্রা শুরু হোক
          </h1>
          <p className="mt-2 max-w-md text-sm leading-6 text-white/85">
            BikriKoro-তে নিরাপদে কিনুন, বিক্রি করুন এবং আপনার পছন্দের digital
            product এক জায়গায় রাখুন।
          </p>
          <div className="mt-6 flex items-center gap-3 text-xs font-semibold text-white/85">
            <span className="rounded-xl bg-white/15 px-3 py-2">
              সুরক্ষিত login
            </span>
            <span className="rounded-xl bg-white/15 px-3 py-2">সহজ setup</span>
          </div>
        </div>
      </div>
      <div className="p-6 sm:p-9">{children}</div>
    </div>
  );
}

function AuthTabs({
  isRegistering,
  onLogin,
  onRegister,
}: {
  isRegistering: boolean;
  onLogin: () => void;
  onRegister: () => void;
}) {
  return (
    <div className="flex rounded-xl border border-outline bg-bg p-1">
      <button
        type="button"
        onClick={onLogin}
        className={`flex-1 rounded-lg py-2.5 text-sm font-bold ${!isRegistering ? "bg-surface text-brand-700 shadow-sm" : "text-ink-500"}`}
      >
        Login
      </button>
      <button
        type="button"
        onClick={onRegister}
        className={`flex-1 rounded-lg py-2.5 text-sm font-bold ${isRegistering ? "bg-surface text-brand-700 shadow-sm" : "text-ink-500"}`}
      >
        নতুন account
      </button>
    </div>
  );
}

function EmailSent({
  email,
  busy,
  onResend,
  onBack,
}: {
  email: string;
  busy: boolean;
  onResend: () => void;
  onBack: () => void;
}) {
  return (
    <div className="mt-7 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
        <Mail size={30} />
      </div>
      <h2 className="mt-5 text-xl font-extrabold text-ink-900">
        ইমেইল inbox দেখুন
      </h2>
      <p className="mt-2 text-sm leading-6 text-ink-600">
        <strong className="text-ink-900">{email}</strong>-এ verification link
        পাঠানো হয়েছে। Link-এ click করলেই account verify হবে এবং password সেট
        করার ধাপে যাবেন।
      </p>
      <button
        type="button"
        onClick={onResend}
        disabled={busy}
        className="mt-5 text-sm font-bold text-brand-700 hover:underline"
      >
        {busy ? "আবার পাঠানো হচ্ছে…" : "আবার verification link পাঠান"}
      </button>
      <button
        type="button"
        onClick={onBack}
        className="mt-3 block w-full text-sm font-semibold text-ink-500 hover:text-brand-700"
      >
        অন্য email ব্যবহার করুন
      </button>
    </div>
  );
}

function EmailForm({
  isRegistering,
  email,
  password,
  busy,
  setEmail,
  setPassword,
  onSend,
  onLogin,
}: {
  isRegistering: boolean;
  email: string;
  password: string;
  busy: boolean;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  onSend: () => void;
  onLogin: () => void;
}) {
  return (
    <>
      <label className="mt-7 block">
        <span className="mb-1.5 block text-sm font-bold text-ink-900">
          ইমেইল
        </span>
        <div className="relative">
          <Mail size={18} className="absolute left-3 top-3.5 text-ink-400" />
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-outline py-3 pl-10 pr-3 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10"
          />
        </div>
      </label>
      {isRegistering ? (
        <>
          <p className="mt-3 rounded-xl bg-brand-50 p-3 text-xs leading-5 text-brand-800">
            প্রথমে email-এ verification link পাঠানো হবে। Verify করার পর
            password, নাম ও মোবাইল নম্বর পূরণ করতে পারবেন।
          </p>
          <button
            type="button"
            onClick={onSend}
            disabled={busy}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-3.5 text-sm font-extrabold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {busy ? (
              "লিংক পাঠানো হচ্ছে…"
            ) : (
              <>
                Send verification link <ArrowRight size={17} />
              </>
            )}
          </button>
        </>
      ) : (
        <>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-sm font-bold text-ink-900">
              পাসওয়ার্ড
            </span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="আপনার পাসওয়ার্ড"
              className="w-full rounded-xl border border-outline px-3 py-3 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10"
            />
          </label>
          <button
            type="button"
            onClick={onLogin}
            disabled={busy}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-3.5 text-sm font-extrabold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {busy ? (
              "Login হচ্ছে…"
            ) : (
              <>
                Login করুন <ArrowRight size={17} />
              </>
            )}
          </button>
          <Link
            to="/forgot-password"
            className="mt-4 block text-center text-sm font-semibold text-brand-700 hover:underline"
          >
            পাসওয়ার্ড ভুলে গেছেন?
          </Link>
        </>
      )}
    </>
  );
}

function PasswordSetup({
  password,
  confirmPassword,
  busy,
  setPassword,
  setConfirmPassword,
  onSubmit,
}: {
  password: string;
  confirmPassword: string;
  busy: boolean;
  setPassword: (value: string) => void;
  setConfirmPassword: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">
          শেষ ধাপ
        </p>
        <h2 className="mt-1 text-2xl font-extrabold text-ink-900">
          পাসওয়ার্ড সেট করুন
        </h2>
        <p className="mt-2 text-sm leading-6 text-ink-600">
          আপনার email যাচাই হয়েছে। এখন account নিরাপদ রাখতে একটি পাসওয়ার্ড
          দিন, তারপর নাম ও মোবাইল নম্বর পূরণ করুন।
        </p>
      </div>
      <label className="mt-6 block">
        <span className="mb-1.5 block text-sm font-bold text-ink-900">
          নতুন পাসওয়ার্ড
        </span>
        <div className="relative">
          <LockKeyhole
            size={18}
            className="absolute left-3 top-3.5 text-ink-400"
          />
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="কমপক্ষে ৬ অক্ষর"
            className="w-full rounded-xl border border-outline py-3 pl-10 pr-3 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10"
          />
        </div>
      </label>
      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-bold text-ink-900">
          পাসওয়ার্ড আবার লিখুন
        </span>
        <input
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="পাসওয়ার্ড নিশ্চিত করুন"
          className="w-full rounded-xl border border-outline px-3 py-3 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10"
        />
      </label>
      <button
        type="button"
        onClick={onSubmit}
        disabled={busy}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-3.5 text-sm font-extrabold text-white hover:bg-brand-600 disabled:opacity-60"
      >
        {busy ? (
          "সেভ হচ্ছে…"
        ) : (
          <>
            পাসওয়ার্ড সেভ করে profile পূরণ করুন <ArrowRight size={17} />
          </>
        )}
      </button>
    </>
  );
}

function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg px-4 py-16 sm:px-5">
      <div className="absolute inset-x-4 top-4 mx-auto flex max-w-2xl items-center justify-between sm:inset-x-5">
        <div className="flex items-center gap-2">
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
        <img
          src="/icon-512.png"
          alt="BikriKoro"
          className="h-10 w-10 rounded-xl"
        />
      </div>
      <div className="w-full max-w-2xl">{children}</div>
    </div>
  );
}
