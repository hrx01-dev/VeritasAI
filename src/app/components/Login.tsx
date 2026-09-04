import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Shield, Mail, Lock, ArrowRight, AlertCircle, Chrome, ScanLine, Sparkles } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { login as loginRequest } from "../lib/api";
import { consumeGoogleRedirectResult, signInWithGoogle } from "../lib/firebase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const navigate = useNavigate();

  const saveLocalSession = (name: string, userEmail: string, token: string) => {
    localStorage.setItem("veritasai_authenticated", "true");
    localStorage.setItem("veritasai_user", JSON.stringify({ name, email: userEmail }));
    localStorage.setItem("veritasai_token", token);
  };

  const completeGoogleLogin = async (user: { email: string | null; getIdToken: () => Promise<string> }) => {
    const firebaseToken = await user.getIdToken();
    const auth = await loginRequest({ email: user.email || "", password: firebaseToken, remember_me: rememberMe });
    saveLocalSession(auth.user.name, auth.user.email, auth.token);
    navigate("/dashboard");
  };

  useEffect(() => {
    const consumeRedirect = async () => {
      try {
        const credential = await consumeGoogleRedirectResult();
        if (!credential) return;
        setIsGoogleLoading(true);
        setError("");
        await completeGoogleLogin(credential.user);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Google sign-in failed");
      } finally {
        setIsGoogleLoading(false);
      }
    };
    void consumeRedirect();
  }, [rememberMe]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }
    setIsLoading(true);
    try {
      const auth = await loginRequest({ email, password, remember_me: rememberMe });
      saveLocalSession(auth.user.name, auth.user.email, auth.token);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setIsGoogleLoading(true);
    try {
      const credential = await signInWithGoogle();
      if (!credential) {
        setError("Continuing Google sign-in...");
        return;
      }
      await completeGoogleLogin(credential.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#070b12] dark:text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 size-[30rem] rounded-full bg-sky-200/40 blur-3xl dark:bg-sky-500/10" />
        <div className="absolute -bottom-40 -right-24 size-[32rem] rounded-full bg-indigo-200/30 blur-3xl dark:bg-indigo-500/10" />
        <div className="tech-grid absolute inset-0 opacity-20 dark:opacity-30" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl items-center px-4 py-8 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} className="grid w-full overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/80 shadow-[0_30px_100px_rgba(30,55,90,0.12)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/80 dark:shadow-[0_30px_100px_rgba(0,0,0,0.35)] lg:grid-cols-[0.9fr_1.1fr]">
          <section className="relative hidden min-h-[680px] overflow-hidden bg-slate-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.2),transparent_35%),radial-gradient(circle_at_85%_75%,rgba(99,102,241,0.2),transparent_35%)]" /><div className="tech-grid absolute inset-0 opacity-30" />
            <div className="relative"><div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 shadow-lg shadow-cyan-500/20"><Shield className="size-6" /></div><div><p className="text-lg font-semibold tracking-tight">VeritasAI</p><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Trust intelligence</p></div></div></div>
            <div className="relative max-w-md"><div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 backdrop-blur"><Sparkles className="size-3.5 text-cyan-300" /> Secure verification workspace</div><h1 className="text-4xl font-semibold leading-[1.05] tracking-[-0.04em] xl:text-5xl">Question the noise. Trust the signal.</h1><p className="mt-5 text-sm leading-6 text-slate-400">Verify text, media and sources with a focused intelligence workspace built for clarity.</p><div className="mt-8 flex items-center gap-3 text-xs text-slate-400"><span className="grid size-9 place-items-center rounded-xl border border-white/10 bg-white/5"><ScanLine className="size-4 text-cyan-300" /></span>Multimodal analysis · Private workspace</div></div><p className="relative text-xs text-slate-500">Evidence first. Decisions second.</p>
          </section>
          <section className="flex items-center p-6 sm:p-10 lg:p-14"><div className="mx-auto w-full max-w-md"><div className="mb-8 lg:hidden"><div className="mb-5 flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 text-white"><Shield className="size-5" /></div><span className="font-semibold">VeritasAI</span></div></div><div className="mb-8"><p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-sky-600 dark:text-sky-300">Welcome back</p><h2 className="text-3xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">Sign in to continue.</h2><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Access your verification workspace.</p></div>{error && <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-5 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"><AlertCircle className="size-4 shrink-0" />{error}</motion.div>}<form onSubmit={handleSubmit} className="space-y-5"><div><label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Email</label><div className="relative"><Mail className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-3.5 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-800/70 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-sky-500 dark:focus:bg-slate-800 dark:focus:ring-sky-500/10" /></div></div><div><div className="mb-2 flex items-center justify-between"><label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Password</label><a href="#" className="text-xs font-medium text-sky-600 hover:text-sky-500 dark:text-sky-300">Forgot password?</a></div><div className="relative"><Lock className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-3.5 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-800/70 dark:text-white dark:focus:border-sky-500 dark:focus:bg-slate-800 dark:focus:ring-sky-500/10" /></div></div><label className="flex cursor-pointer items-center gap-2 text-sm text-slate-500 dark:text-slate-400"><input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="size-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500" />Remember me</label><button type="submit" disabled={isLoading || isGoogleLoading} className="group flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 py-3.5 text-sm font-semibold text-white shadow-lg shadow-slate-950/10 transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100">{isLoading ? <><span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white dark:border-slate-900/30 dark:border-t-slate-900" />Signing in...</> : <>Sign In<ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" /></>}</button><div className="relative py-1"><div className="h-px bg-slate-200 dark:bg-slate-800" /><span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-3 text-[10px] font-semibold tracking-widest text-slate-400 dark:bg-slate-900">OR</span></div><button type="button" onClick={handleGoogleSignIn} disabled={isGoogleLoading || isLoading} className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3.5 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">{isGoogleLoading ? <><span className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700 dark:border-slate-600 dark:border-t-white" />Connecting Google...</> : <><Chrome className="size-4" />Continue with Google</>}</button></form><p className="mt-7 text-center text-sm text-slate-500 dark:text-slate-400">Don't have an account? <Link to="/signup" className="font-semibold text-sky-600 hover:text-sky-500 dark:text-sky-300">Create one</Link></p></div></section>
        </motion.div>
      </div>
    </main>
  );
}
