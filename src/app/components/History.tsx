import { useEffect, useMemo, useState } from "react";
import { History as HistoryIcon, AlertTriangle, CheckCircle, FileText, Image, Video, Link } from "lucide-react";
import { fetchHistory, type HistoryItem } from "../lib/api";

const typeIcons = {
  text: FileText,
  image: Image,
  video: Video,
  url: Link,
};

export default function History() {
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadHistory = async () => {
      setIsLoading(true);
      setError("");

      try {
        const items = await fetchHistory();
        setHistoryItems(items);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load history");
      } finally {
        setIsLoading(false);
      }
    };

    void loadHistory();
  }, []);

  const stats = useMemo(() => {
    const total = historyItems.length;
    const fake = historyItems.filter((item) => item.result === "FAKE").length;
    const real = historyItems.filter((item) => item.result === "REAL").length;
    return { total, fake, real };
  }, [historyItems]);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return timestamp;
    return date.toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-2xl border border-gray-700/50 p-6 shadow-2xl shadow-black/20 backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-cyan-500/10 rounded-lg">
            <HistoryIcon className="size-6 text-cyan-400" />
          </div>
          <h3 className="text-xl font-semibold text-white">Analysis History</h3>
        </div>

        <div className="space-y-3">
          {isLoading && <p className="text-sm text-gray-400">Loading history...</p>}

          {!isLoading && error && <p className="text-sm text-red-400">{error}</p>}

          {!isLoading && !error && historyItems.length === 0 && (
            <p className="text-sm text-gray-400">No analysis history yet. Run an analysis to populate this section.</p>
          )}

          {!isLoading && !error && historyItems.map((item) => {
            const Icon = typeIcons[item.type];
            return (
              <div
                key={item.id}
                className="bg-gray-900/50 border border-gray-700/50 rounded-xl p-4 hover:border-cyan-500/30 hover:bg-gray-800/50 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/10 group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="p-2 bg-gray-800 rounded-lg group-hover:bg-cyan-500/10 transition-colors">
                      <Icon className="size-5 text-gray-400 group-hover:text-cyan-400 transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-200 truncate mb-1">
                        {item.content}
                      </p>
                      <p className="text-xs text-gray-500">{formatTimestamp(item.timestamp)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Result Badge */}
                    <div
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-sm ${
                        item.result === "FAKE"
                          ? "bg-red-950/50 border border-red-500/30"
                          : "bg-green-950/50 border border-green-500/30"
                      }`}
                    >
                      {item.result === "FAKE" ? (
                        <AlertTriangle className="size-4 text-red-500" />
                      ) : (
                        <CheckCircle className="size-4 text-green-500" />
                      )}
                      <span
                        className={`text-sm font-medium ${
                          item.result === "FAKE"
                            ? "text-red-500"
                            : "text-green-500"
                        }`}
                      >
                        {item.result}
                      </span>
                    </div>

                    {/* Confidence Score */}
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Confidence</p>
                      <p className="text-lg font-semibold text-white">
                        {item.confidence}%
                      </p>
                    </div>
                  </div>
                </div>

                {/* Confidence Bar */}
                <div className="mt-3">
                  <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${item.confidence}%` }}
                      className={`h-full transition-all ${
                        item.result === "FAKE"
                          ? "bg-gradient-to-r from-red-600 to-red-500"
                          : "bg-gradient-to-r from-green-600 to-green-500"
                      }`}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats Card */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-2xl border border-blue-500/30 p-6 text-center shadow-xl shadow-blue-900/10 hover:shadow-blue-500/20 transition-all">
          <p className="text-3xl font-bold text-blue-400 mb-1">{stats.total}</p>
          <p className="text-sm text-gray-400">Total Analyses</p>
        </div>
        <div className="bg-gradient-to-br from-red-950/30 to-gray-900/50 rounded-2xl border border-red-500/30 p-6 text-center shadow-xl shadow-red-900/10 hover:shadow-red-500/20 transition-all">
          <p className="text-3xl font-bold text-red-500 mb-1">{stats.fake}</p>
          <p className="text-sm text-gray-400">Fake Detected</p>
        </div>
        <div className="bg-gradient-to-br from-green-950/30 to-gray-900/50 rounded-2xl border border-green-500/30 p-6 text-center shadow-xl shadow-green-900/10 hover:shadow-green-500/20 transition-all">
          <p className="text-3xl font-bold text-green-500 mb-1">{stats.real}</p>
          <p className="text-sm text-gray-400">Real Verified</p>
        </div>
      </div>
    </div>
  );
}