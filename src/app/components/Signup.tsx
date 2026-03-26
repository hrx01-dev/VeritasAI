import { useState } from "react";
import { motion } from "motion/react";
import { Shield, Mail, Lock, User, ArrowRight, AlertCircle, CheckCircle2, Chrome, Info } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { signup as signupRequest, login as loginRequest } from "../lib/api";
import { signInWithGooglePopup } from "../lib/firebase";
import BiometricVerification from "./BiometricVerification";

export default function Signup() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.name || !formData.email || !formData.password || !formData.confirmPassword) {
      setError("Please fill in all fields");
      return;
    }

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!acceptTerms) {
      setError("Please accept the Terms of Service and Privacy Policy");
      return;
    }

    setIsLoading(true);

    try {
      const auth = await signupRequest({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        confirm_password: formData.confirmPassword,
        accept_terms: acceptTerms,
      });

      saveLocalSession(auth.user.name, auth.user.email, auth.token);
      // Show biometric verification before navigating to dashboard
      setShowBiometricVerification(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create account");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerificationComplete = () => {
    setIsVerified(true);
    // Navigate to dashboard after verification
    setTimeout(() => {
      navigate("/dashboard");
    }, 1500);
  };

  const handleVerificationCancel = () => {
    setShowBiometricVerification(false);
    // Clear local session on cancel
    localStorage.removeItem("veritasai_authenticated");
    localStorage.removeItem("veritasai_user");
    localStorage.removeItem("veritasai_token");
    setFormData({ name: "", email: "", password: "", confirmPassword: "" });
    setError("Verification cancelled. Please try again.");
  };

  const handleGoogleSignup = async () => {
    setError("");
    setIsGoogleLoading(true);

    try {
      const credential = await signInWithGooglePopup();
      const user = credential.user;
      const firebaseToken = await user.getIdToken();

      try {
        // Try to register the user with the backend
        const auth = await signupRequest({
          name: user.displayName || user.email?.split("@")[0] || "Google User",
          email: user.email || "",
          password: firebaseToken,
          confirm_password: firebaseToken,
          accept_terms: true,
        });

        saveLocalSession(auth.user.name, auth.user.email, auth.token);
        setShowBiometricVerification(true);
      } catch (signupErr) {
        // If user already exists, try to login instead
        const errorMsg = signupErr instanceof Error ? signupErr.message : "";
        if (errorMsg.includes("already exists")) {
          try {
            const auth = await loginRequest({
              email: user.email || "",
              password: firebaseToken,
              remember_me: false,
            });
            saveLocalSession(auth.user.name, auth.user.email, auth.token);
            setShowBiometricVerification(true);
          } catch (loginErr) {
            throw loginErr;
          }
        } else if (errorMsg.includes("Invalid Firebase token") || errorMsg.includes("token verification")) {
          throw new Error(
            "Backend cannot validate your Google account. Please ensure Firebase Admin SDK is properly configured on the server."
          );
        } else {
          throw signupErr;
        }
      }
    } catch (err) {
      let errorMessage = "Google sign-up failed";
      const errorDetails = err instanceof Error ? err.message : "";
      
      // Check if this is a Firebase availability issue
      const isFirebaseIssue = 
        errorDetails.includes("temporarily unavailable") ||
        errorDetails.includes("timed out") ||
        errorDetails.includes("timeout") ||
        errorDetails.includes("email/password instead") ||
        errorDetails.includes("ERR_NAME_NOT_RESOLVED");

      if (isFirebaseIssue) {
        setGoogleUnavailable(true);
        errorMessage = "Google sign-up is temporarily unavailable. Please use email and password to sign up instead.";
      } else {
        errorMessage = errorDetails || errorMessage;
      }
      
      setError(errorMessage);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const passwordStrength = () => {
    const length = formData.password.length;
    if (length === 0) return { label: "", color: "" };
    if (length < 6) return { label: "Weak", color: "text-red-500" };
    if (length < 10) return { label: "Medium", color: "text-yellow-500" };
    return { label: "Strong", color: "text-green-500" };
  };

  const strength = passwordStrength();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Show biometric verification when needed */}
      {showBiometricVerification && (
        <BiometricVerification
          onVerificationComplete={handleVerificationComplete}
          onCancel={handleVerificationCancel}
        />
      )}

      {/* Animated background */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 size-96 bg-cyan-500/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 size-96 bg-blue-500/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Signup card */}
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
            <p className="text-gray-400 text-sm mt-1">Create your account</p>
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

          {/* Signup form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-500" />
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="John Doe"
                  className="w-full pl-12 pr-4 py-3 bg-gray-900/50 border border-gray-700 rounded-xl text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-500" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
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
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 py-3 bg-gray-900/50 border border-gray-700 rounded-xl text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                />
              </div>
              {formData.password && (
                <p className={`text-xs mt-1 ${strength.color}`}>
                  Password strength: {strength.label}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-500" />
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 py-3 bg-gray-900/50 border border-gray-700 rounded-xl text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                />
                {formData.confirmPassword && formData.password === formData.confirmPassword && (
                  <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 size-5 text-green-500" />
                )}
              </div>
            </div>

            <div className="text-sm">
              <label className="flex items-start gap-2 text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="mt-1 rounded border-gray-700 bg-gray-900"
                  required
                />
                <span>
                  I agree to the{" "}
                  <a href="#" className="text-cyan-400 hover:text-cyan-300">Terms of Service</a>
                  {" "}and{" "}
                  <a href="#" className="text-cyan-400 hover:text-cyan-300">Privacy Policy</a>
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading || isGoogleLoading}
              className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:from-gray-700 disabled:to-gray-700 text-white font-medium rounded-xl transition-all shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:scale-[1.02] disabled:scale-100 disabled:shadow-none flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating account...
                </>
              ) : (
                <>
                  Create Account
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

            <div className="space-y-2">
              <button
                type="button"
                onClick={handleGoogleSignup}
                disabled={isGoogleLoading || isLoading || googleUnavailable}
                className="w-full py-3 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-700 disabled:text-gray-500 text-gray-200 font-medium rounded-xl transition-all border border-gray-600 hover:border-gray-500 disabled:border-gray-600 flex items-center justify-center gap-2"
              >
                {isGoogleLoading ? (
                  <>
                    <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Connecting Google...
                  </>
                ) : (
                  <>
                    <Chrome className="size-5" />
                    Sign up with Google
                  </>
                )}
              </button>
              {googleUnavailable && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 p-2 bg-yellow-950/30 border border-yellow-600/30 rounded-lg"
                >
                  <Info className="size-4 text-yellow-500 flex-shrink-0" />
                  <p className="text-xs text-yellow-400">Google auth temporarily unavailable. Use email/password instead.</p>
                </motion.div>
              )}
            </div>
          </form>

          {/* Sign in link */}
          <div className="mt-6 text-center">
            <p className="text-gray-400 text-sm">
              Already have an account?{" "}
              <Link to="/login" className="text-cyan-400 hover:text-cyan-300 transition-colors font-medium">
                Sign in
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