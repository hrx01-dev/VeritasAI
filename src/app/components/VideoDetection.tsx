import { useState } from "react";
import { motion } from "motion/react";
import { Upload, AlertTriangle, CheckCircle, Loader2, Video, Layers, Link as LinkIcon, Twitter, Facebook, Linkedin, MessageCircle, Copy } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { analyzeVideo, analyzeVideoUrl } from "../lib/api";

type AnalysisResult = {
  prediction: "FAKE" | "REAL" | "UNCERTAIN";
  confidence: number;
  deepfakeScore?: number;
  reasons: string[];
};

export default function VideoDetection() {
  const [inputMode, setInputMode] = useState<"file" | "link">("file");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareNotice, setShareNotice] = useState("");
  const [error, setError] = useState("");

  const handleFileChange = (file: File) => {
    if (file && file.type.startsWith("video/")) {
      setSelectedFile(file);
      setVideoUrl("");
      setResult(null);
      setError("");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileChange(file);
  };

  const handleAnalyze = async () => {
    if (inputMode === "file" && !selectedFile) return;
    if (inputMode === "link" && !videoUrl.trim()) return;

    setIsAnalyzing(true);
    setResult(null);
    setError("");

    try {
      const analysis =
        inputMode === "file"
          ? await analyzeVideo(selectedFile as File)
          : await analyzeVideoUrl(videoUrl.trim());
      setResult(analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to analyze video");
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

  const copyToClipboard = () => {
    const text = `Video Detection Result: ${result?.prediction} with ${result?.confidence}% confidence and ${result?.deepfakeScore ?? 0}% deepfake score.`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getShareMessage = () => {
    const source = inputMode === "link" && videoUrl.trim() ? "\nSource: User-provided video link" : "";
    return `VeritasAI Video Detection Result:\nPrediction: ${result?.prediction}\nConfidence: ${result?.confidence}%\nDeepfake Score: ${result?.deepfakeScore ?? 0}%${source}`;
  };

  const handlePlatformShare = (platform: "twitter" | "facebook" | "linkedin" | "email") => {
    if (!result) return;

    const message = getShareMessage();
    const sourceUrl = "https://example.com/video-detection-result";

    const encodedMessage = encodeURIComponent(message);
    const encodedSourceUrl = encodeURIComponent(sourceUrl);

    let shareUrl = "";
    if (platform === "twitter") {
      shareUrl = `https://twitter.com/intent/tweet?text=${encodedMessage}`;
    } else if (platform === "facebook") {
      shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedSourceUrl}&quote=${encodedMessage}`;
    } else if (platform === "linkedin") {
      shareUrl = `https://www.linkedin.com/feed/?shareActive=true&text=${encodedMessage}`;
    } else {
      shareUrl = `mailto:?subject=Video%20Detection%20Result&body=${encodedMessage}`;
    }

    if (platform === "email") {
      window.location.href = shareUrl;
    } else {
      window.open(shareUrl, "_blank", "noopener,noreferrer");
    }

    navigator.clipboard.writeText(message).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);

      if (platform === "facebook" || platform === "linkedin") {
        setShareNotice("This platform may block auto-filled text. Your preset message was copied; paste it in the share box.");
      } else {
        setShareNotice("Preset message drafted and copied to clipboard.");
      }

      setTimeout(() => setShareNotice(""), 5000);
    }).catch(() => {
      setShareNotice("Share draft opened. Clipboard permission was denied, so copy manually if needed.");
      setTimeout(() => setShareNotice(""), 5000);
    });
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-2xl border border-gray-700/50 p-6 shadow-2xl shadow-black/20 backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-cyan-500/10 rounded-lg">
            <Video className="size-6 text-cyan-400" />
          </div>
          <h3 className="text-xl font-semibold text-white">Video Detection</h3>
        </div>

        <div className="mb-4 inline-flex rounded-xl border border-gray-700/60 bg-gray-900/60 p-1">
          <button
            onClick={() => {
              setInputMode("file");
              setVideoUrl("");
              setResult(null);
              setError("");
            }}
            className={`px-4 py-2 text-sm rounded-lg transition-all ${
              inputMode === "file"
                ? "bg-cyan-600 text-white"
                : "text-gray-300 hover:bg-gray-800"
            }`}
          >
            Upload File
          </button>
          <button
            onClick={() => {
              setInputMode("link");
              setSelectedFile(null);
              setResult(null);
              setError("");
            }}
            className={`px-4 py-2 text-sm rounded-lg transition-all ${
              inputMode === "link"
                ? "bg-cyan-600 text-white"
                : "text-gray-300 hover:bg-gray-800"
            }`}
          >
            Video Link
          </button>
        </div>

        {inputMode === "file" ? (
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
            {selectedFile ? (
              <div className="space-y-4">
                <div className="relative inline-block">
                  <div className="p-8 bg-gray-800/50 rounded-xl border border-gray-700">
                    <Video className="size-16 mx-auto text-cyan-400" />
                  </div>
                  {result && showHeatmap && (
                    <div className="absolute inset-0 bg-gradient-to-br from-red-500/40 via-yellow-500/30 to-transparent rounded-xl mix-blend-multiply pointer-events-none">
                      <div className="absolute top-1/4 right-1/3 size-16 bg-red-500/60 blur-2xl rounded-full"></div>
                      <div className="absolute bottom-1/3 left-1/4 size-20 bg-orange-500/50 blur-2xl rounded-full"></div>
                    </div>
                  )}
                </div>
                <p className="text-lg text-gray-300">{selectedFile.name}</p>
                <p className="text-sm text-gray-500">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </p>
                {result && (
                  <button
                    onClick={() => setShowHeatmap(!showHeatmap)}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                      showHeatmap
                        ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/30"
                        : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    }`}
                  >
                    <Layers className="size-4" />
                    {showHeatmap ? "Hide Heatmap" : "Show Heatmap"}
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <Upload className="size-16 mx-auto text-gray-500" />
                <div>
                  <p className="text-lg text-gray-300 mb-2">
                    Drag and drop a video here
                  </p>
                  <p className="text-sm text-gray-500">or</p>
                </div>
                <label className="inline-block px-6 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg cursor-pointer transition-colors">
                  Browse Files
                  <input
                    type="file"
                    accept="video/*"
                    onChange={(e) =>
                      e.target.files && handleFileChange(e.target.files[0])
                    }
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </div>
        ) : (
          <div className="border border-gray-700 bg-gray-900/50 rounded-xl p-6 space-y-4">
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-500" />
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=... or direct .mp4 link"
                className="w-full pl-11 pr-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>
            <p className="text-sm text-gray-500">
              Supports YouTube links and direct public video files (for example .mp4/.mov/.webm).
            </p>
          </div>
        )}

        <button
          onClick={handleAnalyze}
          disabled={(inputMode === "file" ? !selectedFile : !videoUrl.trim()) || isAnalyzing}
          className="mt-4 px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white font-medium rounded-xl transition-all shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:scale-[1.02] disabled:scale-100 disabled:shadow-none"
        >
          {isAnalyzing ? "Analyzing..." : "Analyze Video"}
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
              <p className="text-lg text-gray-200 mb-2">Analyzing video...</p>
              <p className="text-sm text-gray-400">
                Processing frames, detecting deepfakes, and analyzing audio patterns
              </p>
            </div>
            <div className="w-full max-w-md h-2 bg-gray-700 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 4, ease: "easeInOut" }}
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
                : result.prediction === "UNCERTAIN"
                ? "bg-gradient-to-br from-amber-950/40 to-amber-900/20 border-amber-500/50 shadow-amber-900/20"
                : "bg-gradient-to-br from-green-950/40 to-green-900/20 border-green-500/50 shadow-green-900/20"
            }`}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl ${
                  result.prediction === "FAKE" ? "bg-red-500/20" : result.prediction === "UNCERTAIN" ? "bg-amber-500/20" : "bg-green-500/20"
                }`}>
                  {result.prediction === "FAKE" ? (
                    <AlertTriangle className="size-8 text-red-500" />
                  ) : result.prediction === "UNCERTAIN" ? (
                    <AlertTriangle className="size-8 text-amber-500" />
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
                        : result.prediction === "UNCERTAIN"
                        ? "text-amber-500"
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
                          result.prediction === "FAKE" ? "#ef4444" : result.prediction === "UNCERTAIN" ? "#f59e0b" : "#22c55e"
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

            {/* Deepfake Score */}
            <div className="mb-6 p-4 bg-black/20 rounded-xl border border-gray-700/30">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-400">Deepfake Score</span>
                <span className={`font-semibold ${
                  (result.deepfakeScore ?? 0) > 50 ? "text-red-400" : "text-green-400"
                }`}>
                  {result.deepfakeScore ?? 0}%
                </span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${result.deepfakeScore ?? 0}%` }}
                  transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                  className={`h-full ${
                    (result.deepfakeScore ?? 0) > 50
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
                      : result.prediction === "UNCERTAIN"
                      ? "bg-gradient-to-r from-amber-600 to-amber-500"
                      : "bg-gradient-to-r from-green-600 to-green-500"
                  }`}
                />
              </div>
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
                        : result.prediction === "UNCERTAIN"
                        ? "bg-amber-500"
                        : "bg-green-500"
                    }`}
                  />
                  <p className="text-gray-300">{reason}</p>
                </motion.li>
              ))}
            </ul>
          </div>

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
                {copied ? "Copied!" : "Copy to Clipboard"}
              </button>
              <button
                onClick={() => handlePlatformShare("twitter")}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-all bg-blue-500 text-white hover:bg-blue-600"
              >
                <Twitter className="size-4" />
                Share on Twitter
              </button>
              <button
                onClick={() => handlePlatformShare("facebook")}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-all bg-blue-600 text-white hover:bg-blue-700"
              >
                <Facebook className="size-4" />
                Share on Facebook
              </button>
              <button
                onClick={() => handlePlatformShare("linkedin")}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-all bg-blue-700 text-white hover:bg-blue-800"
              >
                <Linkedin className="size-4" />
                Share on LinkedIn
              </button>
              <button
                onClick={() => handlePlatformShare("email")}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-all bg-gray-500 text-white hover:bg-gray-600"
              >
                <MessageCircle className="size-4" />
                Share via Email
              </button>
            </div>
            {shareNotice && (
              <p className="mt-3 text-sm text-cyan-300">{shareNotice}</p>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}