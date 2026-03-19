import { useState } from "react";
import { motion } from "motion/react";
import { Shield, Mail, Lock, ArrowRight, AlertCircle, Chrome } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { login as loginRequest } from "../lib/api";
import { signInWithGooglePopup } from "../lib/firebase";

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }

    setIsLoading(true);

    try {
      const auth = await loginRequest({
        email,
        password,
        remember_me: rememberMe,
      });

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
      const credential = await signInWithGooglePopup();
      const user = credential.user;
      const token = await user.getIdToken();

      saveLocalSession(user.displayName || user.email?.split("@")[0] || "Google User", user.email || "", token);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 size-96 bg-cyan-500/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 size-96 bg-blue-500/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Login card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-2xl border border-gray-700/50 p-8 shadow-2xl shadow-black/20 backdrop-blur-sm">
          {/* Logo and title */}
          <div className="flex flex-col items-center mb-8">
            <motion.div
              initial={{ scale: 0.5, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ duration: 0.5 }}
              className="p-4 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl shadow-lg shadow-cyan-500/30 mb-4"
            >
              <Shield className="size-12 text-white" />
            </motion.div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              VeritasAI
            </h1>
            <p className="text-gray-400 text-sm mt-1">Sign in to your account</p>
          </div>

          {/* Error message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-3 bg-red-950/30 border border-red-500/30 rounded-xl flex items-center gap-2"
            >
              <AlertCircle className="size-5 text-red-500" />
              <p className="text-sm text-red-400">{error}</p>
            </motion.div>
          )}

          {/* Login form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-12 pr-4 py-3 bg-gray-900/50 border border-gray-700 rounded-xl text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 py-3 bg-gray-900/50 border border-gray-700 rounded-xl text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-gray-700 bg-gray-900"
                />
                Remember me
              </label>
              <a href="#" className="text-cyan-400 hover:text-cyan-300 transition-colors">
                Forgot password?
              </a>
            </div>

            <button
              type="submit"
              disabled={isLoading || isGoogleLoading}
              className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:from-gray-700 disabled:to-gray-700 text-white font-medium rounded-xl transition-all shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:scale-[1.02] disabled:scale-100 disabled:shadow-none flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="size-5" />
                </>
              )}
            </button>

            <div className="relative py-1">
              <div className="h-px bg-gray-700/60" />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-900 px-2 text-xs text-gray-500">
                OR
              </span>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isGoogleLoading || isLoading}
              className="w-full py-3 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-700 disabled:text-gray-500 text-gray-200 font-medium rounded-xl transition-all border border-gray-600 hover:border-gray-500 flex items-center justify-center gap-2"
            >
              {isGoogleLoading ? (
                <>
                  <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Connecting Google...
                </>
              ) : (
                <>
                  <Chrome className="size-5" />
                  Continue with Google
                </>
              )}
            </button>
          </form>

          {/* Sign up link */}
          <div className="mt-6 text-center">
            <p className="text-gray-400 text-sm">
              Don't have an account?{" "}
              <Link to="/signup" className="text-cyan-400 hover:text-cyan-300 transition-colors font-medium">
                Sign up
              </Link>
            </p>
          </div>
        </div>

        {/* Footer text */}
        <p className="text-center text-gray-500 text-xs mt-6">
          Secure authentication powered by VeritasAI
        </p>
      </motion.div>
    </div>
  );
}