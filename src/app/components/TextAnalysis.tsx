import { useState } from "react";
import { motion } from "motion/react";
import { AlertTriangle, CheckCircle, Loader2, FileText, Share2, Twitter, Facebook, Linkedin, MessageCircle, Copy, Check } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { analyzeText } from "../lib/api";

type AnalysisResult = {
  prediction: "FAKE" | "REAL";
  confidence: number;
  reasons: string[];
};

export default function TextAnalysis() {
  const [inputText, setInputText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const handleAnalyze = async () => {
    if (!inputText.trim()) return;

    setIsAnalyzing(true);
    setResult(null);
    setError("");

    try {
      const analysis = await analyzeText(inputText);
      setResult(analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to analyze text");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const chartData = result
    ? [
        { name: "Confidence", value: result.confidence },
        { name: "Uncertainty", value: 100 - result.confidence },
      ]
    : [];

  const handleCopy = () => {
    navigator.clipboard.writeText(
      `Prediction: ${result?.prediction}\nConfidence: ${result?.confidence}%\nReasons:\n${result?.reasons.join('\n')}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-2xl border border-gray-700/50 p-6 shadow-2xl shadow-black/20 backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-cyan-500/10 rounded-lg">
            <FileText className="size-6 text-cyan-400" />
          </div>
          <h3 className="text-xl font-semibold text-white">Text Analysis</h3>
        </div>

        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Paste article, news content, or any text to analyze for misinformation..."
          className="w-full h-48 bg-gray-900 border border-gray-700 rounded-xl p-4 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none transition-all"
        />

        <button
          onClick={handleAnalyze}
          disabled={!inputText.trim() || isAnalyzing}
          className="mt-4 px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white font-medium rounded-xl transition-all shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:scale-[1.02] disabled:scale-100 disabled:shadow-none"
        >
          {isAnalyzing ? "Analyzing..." : "Analyze Content"}
        </button>

        {error && (
          <p className="mt-3 text-sm text-red-400">{error}</p>
        )}
      </div>

      {/* Loading State */}
      {isAnalyzing && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-2xl border border-gray-700/50 p-8 shadow-2xl shadow-black/20"
        >
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="size-12 text-cyan-400 animate-spin" />
            <div className="text-center">
              <p className="text-lg text-gray-200 mb-2">Analyzing content...</p>
              <p className="text-sm text-gray-400">
                Processing text patterns, fact-checking, and validating sources
              </p>
            </div>
            <div className="w-full max-w-md h-2 bg-gray-700 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 2.5, ease: "easeInOut" }}
              />
            </div>
          </div>
        </motion.div>
      )}

      {/* Results Section */}
      {result && !isAnalyzing && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Prediction Card */}
          <div
            className={`rounded-2xl border p-6 shadow-2xl backdrop-blur-sm ${
              result.prediction === "FAKE"
                ? "bg-gradient-to-br from-red-950/40 to-red-900/20 border-red-500/50 shadow-red-900/20"
                : "bg-gradient-to-br from-green-950/40 to-green-900/20 border-green-500/50 shadow-green-900/20"
            }`}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl ${
                  result.prediction === "FAKE" ? "bg-red-500/20" : "bg-green-500/20"
                }`}>
                  {result.prediction === "FAKE" ? (
                    <AlertTriangle className="size-8 text-red-500" />
                  ) : (
                    <CheckCircle className="size-8 text-green-500" />
                  )}
                </div>
                <div>
                  <h4 className="text-sm text-gray-400">Prediction Result</h4>
                  <p
                    className={`text-3xl font-bold ${
                      result.prediction === "FAKE"
                        ? "text-red-500"
                        : "text-green-500"
                    }`}
                  >
                    {result.prediction}
                  </p>
                </div>
              </div>

              {/* Circular Gauge */}
              <div className="relative size-32">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={60}
                      startAngle={90}
                      endAngle={-270}
                      dataKey="value"
                    >
                      <Cell
                        fill={
                          result.prediction === "FAKE" ? "#ef4444" : "#22c55e"
                        }
                      />
                      <Cell fill="#374151" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white">
                      {result.confidence}%
                    </p>
                    <p className="text-xs text-gray-400">Confidence</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Confidence Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Confidence Score</span>
                <span className="text-white font-semibold">
                  {result.confidence}%
                </span>
              </div>
              <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${result.confidence}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className={`h-full ${
                    result.prediction === "FAKE"
                      ? "bg-gradient-to-r from-red-600 to-red-500"
                      : "bg-gradient-to-r from-green-600 to-green-500"
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Explanation Box */}
          <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-2xl border border-gray-700/50 p-6 shadow-2xl shadow-black/20">
            <h4 className="text-lg font-semibold text-white mb-4">
              Analysis Explanation
            </h4>
            <ul className="space-y-3">
              {result.reasons.map((reason, index) => (
                <motion.li
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-start gap-3 group"
                >
                  <div
                    className={`size-2 rounded-full mt-2 transition-all group-hover:scale-150 ${
                      result.prediction === "FAKE"
                        ? "bg-red-500"
                        : "bg-green-500"
                    }`}
                  />
                  <p className="text-gray-300">{reason}</p>
                </motion.li>
              ))}
            </ul>
          </div>

          {/* Share Buttons */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700/50 rounded-xl text-gray-300 hover:bg-gray-700 hover:text-white transition-all"
            >
              {copied ? (
                <Check className="size-4" />
              ) : (
                <Copy className="size-4" />
              )}
              Copy
            </button>
            <button
              onClick={() =>
                window.open(
                  `https://twitter.com/intent/tweet?text=Prediction:%20${result?.prediction}%0AConfidence:%20${result?.confidence}%25%0AReasons:%0A${result?.reasons.join(
                    "%0A"
                  )}`,
                  "_blank"
                )
              }
              className="flex items-center gap-2 px-4 py-2 bg-blue-500/50 rounded-xl text-blue-300 hover:bg-blue-500 hover:text-white transition-all"
            >
              <Twitter className="size-4" />
              Twitter
            </button>
            <button
              onClick={() =>
                window.open(
                  `https://www.facebook.com/sharer/sharer.php?u=https://example.com&quote=Prediction:%20${result?.prediction}%0AConfidence:%20${result?.confidence}%25%0AReasons:%0A${result?.reasons.join(
                    "%0A"
                  )}`,
                  "_blank"
                )
              }
              className="flex items-center gap-2 px-4 py-2 bg-blue-600/50 rounded-xl text-blue-300 hover:bg-blue-600 hover:text-white transition-all"
            >
              <Facebook className="size-4" />
              Facebook
            </button>
            <button
              onClick={() =>
                window.open(
                  `https://www.linkedin.com/shareArticle?mini=true&url=https://example.com&title=Prediction:%20${result?.prediction}%0AConfidence:%20${result?.confidence}%25%0AReasons:%0A${result?.reasons.join(
                    "%0A"
                  )}`,
                  "_blank"
                )
              }
              className="flex items-center gap-2 px-4 py-2 bg-blue-700/50 rounded-xl text-blue-300 hover:bg-blue-700 hover:text-white transition-all"
            >
              <Linkedin className="size-4" />
              LinkedIn
            </button>
            <button
              onClick={() =>
                window.open(
                  `mailto:?subject=Text%20Analysis%20Result&body=Prediction:%20${result?.prediction}%0AConfidence:%20${result?.confidence}%25%0AReasons:%0A${result?.reasons.join(
                    "%0A"
                  )}`,
                  "_blank"
                )
              }
              className="flex items-center gap-2 px-4 py-2 bg-gray-500/50 rounded-xl text-gray-300 hover:bg-gray-500 hover:text-white transition-all"
            >
              <MessageCircle className="size-4" />
              Email
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}