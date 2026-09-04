import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Shield, Mail, Lock, User, ArrowRight, AlertCircle, CheckCircle2, Chrome, Info, ScanLine, Sparkles } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { signup as signupRequest, login as loginRequest } from "../lib/api";
import { consumeGoogleRedirectResult, signInWithGoogle } from "../lib/firebase";
import BiometricVerification from "./BiometricVerification";

export default function Signup() {
  const [formData, setFormData] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showBiometricVerification, setShowBiometricVerification] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [googleUnavailable, setGoogleUnavailable] = useState(false);
  const navigate = useNavigate();

  const saveLocalSession = (name: string, userEmail: string, token: string) => {
    localStorage.setItem("veritasai_authenticated", "true");
    localStorage.setItem("veritasai_user", JSON.stringify({ name, email: userEmail }));
    localStorage.setItem("veritasai_token", token);
  };
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    if (!formData.name || !formData.email || !formData.password || !formData.confirmPassword) return setError("Please fill in all fields");
    if (formData.password.length < 8) return setError("Password must be at least 8 characters");
    if (formData.password !== formData.confirmPassword) return setError("Passwords do not match");
    if (!acceptTerms) return setError("Please accept the Terms of Service and Privacy Policy");
    setIsLoading(true);
    try {
      const auth = await signupRequest({ name: formData.name, email: formData.email, password: formData.password, confirm_password: formData.confirmPassword, accept_terms: acceptTerms });
      saveLocalSession(auth.user.name, auth.user.email, auth.token); setShowBiometricVerification(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to create account"); } finally { setIsLoading(false); }
  };
  const handleVerificationComplete = () => { setIsVerified(true); setTimeout(() => navigate("/dashboard"), 1500); };
  const handleVerificationCancel = () => {
    setShowBiometricVerification(false); localStorage.removeItem("veritasai_authenticated"); localStorage.removeItem("veritasai_user"); localStorage.removeItem("veritasai_token");
    setFormData({ name: "", email: "", password: "", confirmPassword: "" }); setError("Verification cancelled. Please try again.");
  };
  const completeGoogleSignup = async (user: { email: string | null; displayName: string | null; getIdToken: () => Promise<string> }) => {
    const firebaseToken = await user.getIdToken();
    try {
      const auth = await signupRequest({ name: user.displayName || user.email?.split("@")[0] || "Google User", email: user.email || "", password: firebaseToken, confirm_password: firebaseToken, accept_terms: true });
      saveLocalSession(auth.user.name, auth.user.email, auth.token); setShowBiometricVerification(true);
    } catch (signupErr) {
      const errorMsg = signupErr instanceof Error ? signupErr.message : "";
      if (errorMsg.includes("already exists")) {
        const auth = await loginRequest({ email: user.email || "", password: firebaseToken, remember_me: false });
        saveLocalSession(auth.user.name, auth.user.email, auth.token); setShowBiometricVerification(true); return;
      }
      if (errorMsg.includes("Invalid Firebase token") || errorMsg.includes("token verification")) throw new Error("Backend cannot validate your Google account. Please ensure backend is running and reachable at VITE_API_BASE_URL.");
      throw signupErr;
    }
  };
  useEffect(() => {
    const consumeRedirect = async () => {
      try { const credential = await consumeGoogleRedirectResult(); if (!credential) return; setIsGoogleLoading(true); setError(""); await completeGoogleSignup(credential.user); }
      catch (err) { setError(err instanceof Error ? err.message : "Google sign-up failed"); }
      finally { setIsGoogleLoading(false); }
    }; void consumeRedirect();
  }, []);
  const handleGoogleSignup = async () => {
    setError(""); setIsGoogleLoading(true);
    try { const credential = await signInWithGoogle(); if (!credential) { setError("Continuing Google sign-up..."); return; } await completeGoogleSignup(credential.user); }
    catch (err) {
      const errorDetails = err instanceof Error ? err.message : "";
      const isFirebaseIssue = ["temporarily unavailable", "timed out", "timeout", "email/password instead", "ERR_NAME_NOT_RESOLVED"].some((value) => errorDetails.includes(value));
      if (isFirebaseIssue) { setGoogleUnavailable(true); setError("Google sign-up is temporarily unavailable. Please use email and password to sign up instead."); }
      else setError(errorDetails || "Google sign-up failed");
    } finally { setIsGoogleLoading(false); }
  };
  const passwordStrength = () => { const length = formData.password.length; if (!length) return { label: "", color: "" }; if (length < 6) return { label: "Weak", color: "text-red-500" }; if (length < 10) return { label: "Medium", color: "text-yellow-500" }; return { label: "Strong", color: "text-green-500" }; };
  const strength = passwordStrength();

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#070b12] dark:text-slate-100">
      {showBiometricVerification && <BiometricVerification onVerificationComplete={handleVerificationComplete} onCancel={handleVerificationCancel} />}
      <div className="pointer-events-none absolute inset-0"><div className="absolute -left-32 -top-32 size-[30rem] rounded-full bg-sky-200/40 blur-3xl dark:bg-sky-500/10" /><div className="absolute -bottom-40 -right-24 size-[32rem] rounded-full bg-indigo-200/30 blur-3xl dark:bg-indigo-500/10" /><div className="tech-grid absolute inset-0 opacity-20 dark:opacity-30" /></div>
      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl items-center px-4 py-8 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} className="grid w-full overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/80 shadow-[0_30px_100px_rgba(30,55,90,0.12)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/80 dark:shadow-[0_30px_100px_rgba(0,0,0,0.35)] lg:grid-cols-[0.82fr_1.18fr]">
          <section className="relative hidden min-h-[760px] overflow-hidden bg-slate-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.2),transparent_35%),radial-gradient(circle_at_85%_75%,rgba(99,102,241,0.2),transparent_35%)]" /><div className="tech-grid absolute inset-0 opacity-30" />
            <div className="relative flex items-center gap-3"><div className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 shadow-lg shadow-cyan-500/20"><Shield className="size-6" /></div><div><p className="text-lg font-semibold">VeritasAI</p><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Trust intelligence</p></div></div>
            <div className="relative max-w-md"><div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300"><Sparkles className="size-3.5 text-cyan-300" /> Built for trustworthy decisions</div><h1 className="text-4xl font-semibold leading-[1.05] tracking-[-0.04em] xl:text-5xl">Build your trust layer.</h1><p className="mt-5 text-sm leading-6 text-slate-400">Create a verification workspace for analyzing claims, media, sources and suspicious signals.</p><div className="mt-8 space-y-3 text-sm text-slate-300"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl border border-white/10 bg-white/5"><ScanLine className="size-4 text-cyan-300" /></span> Multimodal verification tools</div><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl border border-white/10 bg-white/5"><Shield className="size-4 text-cyan-300" /></span> Secure personal workspace</div></div></div>
            <p className="relative text-xs text-slate-500">Evidence first. Decisions second.</p>
          </section>
          <section className="flex items-center p-6 sm:p-10 lg:p-12"><div className="mx-auto w-full max-w-lg">
            <div className="mb-7 lg:hidden"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 text-white"><Shield className="size-5" /></div><span className="font-semibold">VeritasAI</span></div></div>
            <div className="mb-7"><p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-sky-600 dark:text-sky-300">Get started</p><h2 className="text-3xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">Create your workspace.</h2><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Set up your account and start verifying information.</p></div>
            {error && <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-5 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"><AlertCircle className="size-4 shrink-0" />{error}</motion.div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Full Name</label><div className="relative"><User className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="John Doe" className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-3.5 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-800/70 dark:text-white dark:focus:border-sky-500 dark:focus:bg-slate-800 dark:focus:ring-sky-500/10" /></div></div>
              <div><label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Email</label><div className="relative"><Mail className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="you@example.com" className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-3.5 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-800/70 dark:text-white dark:focus:border-sky-500 dark:focus:bg-slate-800 dark:focus:ring-sky-500/10" /></div></div>
              <div><label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Password</label><div className="relative"><Lock className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input type="password" name="password" value={formData.password} onChange={handleChange} placeholder="••••••••" className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-3.5 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-800/70 dark:text-white dark:focus:border-sky-500 dark:focus:bg-slate-800 dark:focus:ring-sky-500/10" /></div>{formData.password && <p className={`mt-1.5 text-xs ${strength.color}`}>Password strength: {strength.label}</p>}</div>
              <div><label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Confirm Password</label><div className="relative"><Lock className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} placeholder="••••••••" className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-3.5 pl-11 pr-11 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-800/70 dark:text-white dark:focus:border-sky-500 dark:focus:bg-slate-800 dark:focus:ring-sky-500/10" />{formData.confirmPassword && formData.password === formData.confirmPassword && <CheckCircle2 className="absolute right-4 top-1/2 size-4 -translate-y-1/2 text-emerald-500" />}</div></div>
              <label className="flex cursor-pointer items-start gap-2 text-xs leading-5 text-slate-500 dark:text-slate-400"><input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} className="mt-1 size-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500" required /><span>I agree to the <a href="#" className="font-medium text-sky-600 hover:text-sky-500 dark:text-sky-300">Terms of Service</a> and <a href="#" className="font-medium text-sky-600 hover:text-sky-500 dark:text-sky-300">Privacy Policy</a>.</span></label>
              <button type="submit" disabled={isLoading || isGoogleLoading} className="group flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 py-3.5 text-sm font-semibold text-white shadow-lg shadow-slate-950/10 transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100">{isLoading ? <><span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white dark:border-slate-900/30 dark:border-t-slate-900" />Creating account...</> : <>Create Account<ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" /></>}</button>
              <div className="relative py-1"><div className="h-px bg-slate-200 dark:bg-slate-800" /><span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-3 text-[10px] font-semibold tracking-widest text-slate-400 dark:bg-slate-900">OR</span></div>
              <button type="button" onClick={handleGoogleSignup} disabled={isGoogleLoading || isLoading || googleUnavailable} className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3.5 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">{isGoogleLoading ? <><span className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700 dark:border-slate-600 dark:border-t-white" />Connecting Google...</> : <><Chrome className="size-4" />Sign up with Google</>}</button>
              {googleUnavailable && <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300"><Info className="size-4 shrink-0" />Google auth is temporarily unavailable. Use email/password instead.</motion.div>}
            </form>
            <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">Already have an account? <Link to="/login" className="font-semibold text-sky-600 hover:text-sky-500 dark:text-sky-300">Sign in</Link></p>
          </div></section>
        </motion.div>
      </div>
    </main>
  );
}
