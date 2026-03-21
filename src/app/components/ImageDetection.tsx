import { useState } from "react";
import { motion } from "motion/react";
import { Upload, AlertTriangle, CheckCircle, Loader2, Image as ImageIcon, Layers, Share2, Twitter, Facebook, Linkedin, MessageCircle, Copy, Check } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { analyzeImage } from "../lib/api";

type AnalysisResult = {
  prediction: "FAKE" | "REAL";
  confidence: number;
  manipulationScore?: number;
  reasons: string[];
  visualization?: string;
};

type LegendSignal = "low" | "medium" | "high" | "boxes";

function getCuteImageReaction(
  prediction: "FAKE" | "REAL",
  confidence: number,
  manipulationScore: number,
): string {
  if (prediction === "FAKE") {
    if (confidence >= 90) return "Big yikes alert! This one looks heavily edited.";
    if (manipulationScore >= 70) return "Hmm... spicy pixels detected. Likely manipulated.";
    return "Tiny red flags are waving. This image may be altered.";
  }

  if (confidence >= 90) return "Looks clean and cozy. This image seems authentic.";
  if (manipulationScore <= 25) return "Green vibes only. Very low manipulation signals.";
  return "Pretty neat overall. No strong signs of tampering.";
}

export default function ImageDetection() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [activeLegendSignal, setActiveLegendSignal] = useState<LegendSignal | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const handleFileChange = (file: File) => {
    if (file && file.type.startsWith("image/")) {
      setSelectedFile(file);
      setResult(null);
      setError("");
      setShowHeatmap(false);
      setActiveLegendSignal(null);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileChange(file);
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;

    setIsAnalyzing(true);
    setResult(null);
    setError("");
    setActiveLegendSignal(null);

    try {
      const analysis = await analyzeImage(selectedFile);
      setResult(analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to analyze image");
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

  const cuteReaction = result
    ? getCuteImageReaction(
        result.prediction,
        result.confidence,
        result.manipulationScore ?? 0,
      )
    : "";

  const copyToClipboard = () => {
    const text = `Image Detection Result: ${result?.prediction} (${result?.confidence}%)`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const getShareMessage = () => {
    const source = selectedFile?.name ? `\nSource: ${selectedFile.name}` : "";
    return `VeritasAI Image Detection Result:\nPrediction: ${result?.prediction}\nConfidence: ${result?.confidence}%\nManipulation Score: ${result?.manipulationScore ?? 0}%${source}`;
  };

  const handlePlatformShare = (platform: "twitter" | "facebook" | "linkedin" | "email") => {
    if (!result) return;

    const message = getShareMessage();
    const encodedMessage = encodeURIComponent(message);
    const encodedSourceUrl = encodeURIComponent("https://example.com/image-detection");

    let shareUrl = "";
    if (platform === "twitter") {
      shareUrl = `https://twitter.com/intent/tweet?text=${encodedMessage}`;
    } else if (platform === "facebook") {
      shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedSourceUrl}&quote=${encodedMessage}`;
    } else if (platform === "linkedin") {
      shareUrl = `https://www.linkedin.com/shareArticle?mini=true&url=${encodedSourceUrl}&title=Image%20Detection%20Result&summary=${encodedMessage}`;
    } else {
      shareUrl = `mailto:?subject=Image%20Detection%20Result&body=${encodedMessage}`;
    }

    if (platform === "email") {
      window.location.href = shareUrl;
    } else {
      window.open(shareUrl, "_blank", "noopener,noreferrer");
    }

    navigator.clipboard.writeText(message).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Ignore clipboard errors while keeping the share action.
    });
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-2xl border border-gray-700/50 p-6 shadow-2xl shadow-black/20 backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-cyan-500/10 rounded-lg">
            <ImageIcon className="size-6 text-cyan-400" />
          </div>
          <h3 className="text-xl font-semibold text-white">Image Detection</h3>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300 ${
            isDragging
              ? "border-cyan-500 bg-cyan-500/10 scale-[1.02]"
              : "border-gray-600 bg-gray-900/50 hover:border-gray-500"
          }`}
        >
          {preview ? (
            <div className="space-y-4">
              <div className="relative inline-block">
                <img
                  src={preview}
                  alt="Preview"
                  className="max-h-64 mx-auto rounded-xl shadow-lg"
                />
                {result?.visualization && showHeatmap && (
                  <>
                    <img
                      src={result.visualization}
                      alt="ELA and edge visualization"
                      className={`absolute inset-0 size-full object-contain rounded-xl pointer-events-none transition-all duration-200 ${
                        activeLegendSignal === "low"
                          ? "brightness-110 saturate-125"
                          : activeLegendSignal === "medium"
                          ? "contrast-125 saturate-125"
                          : activeLegendSignal === "high"
                          ? "contrast-150 saturate-150"
                          : ""
                      }`}
                    />
                    {activeLegendSignal && (
                      <div
                        className={`absolute inset-0 rounded-xl pointer-events-none transition-all duration-200 ${
                          activeLegendSignal === "low"
                            ? "bg-cyan-400/15"
                            : activeLegendSignal === "medium"
                            ? "bg-amber-400/15"
                            : activeLegendSignal === "high"
                            ? "bg-red-500/20"
                            : "bg-red-500/10"
                        } ${activeLegendSignal === "boxes" ? "ring-2 ring-red-500/60" : ""}`}
                      />
                    )}
                  </>
                )}
              </div>
              <p className="text-sm text-gray-400">{selectedFile?.name}</p>
              {result && (
                <button
                  disabled={!result.visualization}
                  onClick={() => setShowHeatmap(!showHeatmap)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    showHeatmap
                      ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/30"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                >
                  <Layers className="size-4" />
                  {showHeatmap ? "Hide ELA + Edge Map" : "Show ELA + Edge Map"}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <Upload className="size-16 mx-auto text-gray-500" />
              <div>
                <p className="text-lg text-gray-300 mb-2">
                  Drag and drop an image here
                </p>
                <p className="text-sm text-gray-500">or</p>
              </div>
              <label className="inline-block px-6 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg cursor-pointer transition-colors">
                Browse Files
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    e.target.files && handleFileChange(e.target.files[0])
                  }
                  className="hidden"
                />
              </label>
            </div>
          )}
        </div>

        <button
          onClick={handleAnalyze}
          disabled={!selectedFile || isAnalyzing}
          className="mt-4 px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white font-medium rounded-xl transition-all shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:scale-[1.02] disabled:scale-100 disabled:shadow-none"
        >
          {isAnalyzing ? "Analyzing..." : "Analyze Image"}
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
              <p className="text-lg text-gray-200 mb-2">Analyzing image...</p>
              <p className="text-sm text-gray-400">
                Detecting AI artifacts, metadata analysis, and pixel inspection
              </p>
            </div>
            <div className="w-full max-w-md h-2 bg-gray-700 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 3, ease: "easeInOut" }}
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
                  <h4 className="text-sm text-gray-400">Detection Result</h4>
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

            {/* Manipulation Score */}
            <div className="mb-6 p-4 bg-black/20 rounded-xl border border-gray-700/30">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-400">Manipulation Score</span>
                <span className={`font-semibold ${
                  (result.manipulationScore ?? 0) > 50 ? "text-red-400" : "text-green-400"
                }`}>
                  {result.manipulationScore ?? 0}%
                </span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${result.manipulationScore ?? 0}%` }}
                  transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                  className={`h-full ${
                    (result.manipulationScore ?? 0) > 50
                      ? "bg-gradient-to-r from-orange-600 to-red-500"
                      : "bg-gradient-to-r from-green-600 to-emerald-500"
                  }`}
                />
              </div>
            </div>

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

            <div className="mt-5 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3">
              <p className="text-sm text-cyan-100">{cuteReaction}</p>
            </div>
          </div>

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

          {result.visualization && (
            <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-2xl border border-cyan-500/20 p-6 shadow-2xl shadow-black/20">
              <h4 className="text-lg font-semibold text-white mb-2">
                ELA + Edge Map Legend
              </h4>
              <p className="text-sm text-gray-400 mb-4">
                Use this guide while toggling the overlay on the uploaded image.
              </p>
              <p className="text-xs text-cyan-300 mb-4">
                Hover or click an item to emphasize that signal in the overlay preview.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onMouseEnter={() => setActiveLegendSignal("low")}
                  onMouseLeave={() => setActiveLegendSignal(null)}
                  onFocus={() => setActiveLegendSignal("low")}
                  onBlur={() => setActiveLegendSignal(null)}
                  onClick={() =>
                    setActiveLegendSignal((prev) => (prev === "low" ? null : "low"))
                  }
                  className={`w-full text-left flex items-center gap-3 p-3 rounded-lg bg-black/20 border transition-all ${
                    activeLegendSignal === "low"
                      ? "border-cyan-400/80 shadow-lg shadow-cyan-500/20"
                      : "border-gray-700/40 hover:border-cyan-500/60"
                  }`}
                >
                  <span className="size-4 rounded-full bg-gradient-to-r from-blue-600 to-cyan-400" />
                  <p className="text-sm text-gray-300">Low anomaly response (more consistent compression and edges)</p>
                </button>
                <button
                  type="button"
                  onMouseEnter={() => setActiveLegendSignal("medium")}
                  onMouseLeave={() => setActiveLegendSignal(null)}
                  onFocus={() => setActiveLegendSignal("medium")}
                  onBlur={() => setActiveLegendSignal(null)}
                  onClick={() =>
                    setActiveLegendSignal((prev) => (prev === "medium" ? null : "medium"))
                  }
                  className={`w-full text-left flex items-center gap-3 p-3 rounded-lg bg-black/20 border transition-all ${
                    activeLegendSignal === "medium"
                      ? "border-amber-400/80 shadow-lg shadow-amber-500/20"
                      : "border-gray-700/40 hover:border-amber-500/60"
                  }`}
                >
                  <span className="size-4 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500" />
                  <p className="text-sm text-gray-300">Medium anomaly response (possible local edits or texture mismatch)</p>
                </button>
                <button
                  type="button"
                  onMouseEnter={() => setActiveLegendSignal("high")}
                  onMouseLeave={() => setActiveLegendSignal(null)}
                  onFocus={() => setActiveLegendSignal("high")}
                  onBlur={() => setActiveLegendSignal(null)}
                  onClick={() =>
                    setActiveLegendSignal((prev) => (prev === "high" ? null : "high"))
                  }
                  className={`w-full text-left flex items-center gap-3 p-3 rounded-lg bg-black/20 border transition-all ${
                    activeLegendSignal === "high"
                      ? "border-red-400/80 shadow-lg shadow-red-500/20"
                      : "border-gray-700/40 hover:border-red-500/60"
                  }`}
                >
                  <span className="size-4 rounded-full bg-gradient-to-r from-red-500 to-rose-700" />
                  <p className="text-sm text-gray-300">High anomaly response (strong ELA spikes and irregular edge behavior)</p>
                </button>
                <button
                  type="button"
                  onMouseEnter={() => setActiveLegendSignal("boxes")}
                  onMouseLeave={() => setActiveLegendSignal(null)}
                  onFocus={() => setActiveLegendSignal("boxes")}
                  onBlur={() => setActiveLegendSignal(null)}
                  onClick={() =>
                    setActiveLegendSignal((prev) => (prev === "boxes" ? null : "boxes"))
                  }
                  className={`w-full text-left flex items-center gap-3 p-3 rounded-lg bg-black/20 border transition-all ${
                    activeLegendSignal === "boxes"
                      ? "border-red-500/80 shadow-lg shadow-red-600/20"
                      : "border-gray-700/40 hover:border-red-500/60"
                  }`}
                >
                  <span className="h-4 w-6 rounded-sm border-2 border-red-500 bg-red-500/10" />
                  <p className="text-sm text-gray-300">Highlighted boxes mark concentrated suspicious regions</p>
                </button>
              </div>
            </div>
          )}

          <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-2xl border border-gray-700/50 p-6 shadow-2xl shadow-black/20">
            <h4 className="text-lg font-semibold text-white mb-4">
              Share Results
            </h4>
            <div className="flex items-center gap-4">
              <button
                onClick={copyToClipboard}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-all bg-gray-700 text-gray-300 hover:bg-gray-600"
              >
                <Copy className="size-4" />
                {copied ? "Copied!" : "Copy"}
              </button>
              <button
                onClick={() => handlePlatformShare("twitter")}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-all bg-blue-500 text-white hover:bg-blue-600"
              >
                <Twitter className="size-4" />
                Twitter
              </button>
              <button
                onClick={() => handlePlatformShare("facebook")}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-all bg-blue-600 text-white hover:bg-blue-700"
              >
                <Facebook className="size-4" />
                Facebook
              </button>
              <button
                onClick={() => handlePlatformShare("linkedin")}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-all bg-blue-700 text-white hover:bg-blue-800"
              >
                <Linkedin className="size-4" />
                LinkedIn
              </button>
              <button
                onClick={() => handlePlatformShare("email")}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-all bg-gray-700 text-gray-300 hover:bg-gray-600"
              >
                <MessageCircle className="size-4" />
                Email
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}