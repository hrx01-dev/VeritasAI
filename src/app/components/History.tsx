import { History as HistoryIcon, AlertTriangle, CheckCircle, FileText, Image, Video, Link } from "lucide-react";

type HistoryItem = {
  id: string;
  type: "text" | "image" | "video" | "url";
  content: string;
  result: "FAKE" | "REAL";
  confidence: number;
  timestamp: string;
};

const mockHistory: HistoryItem[] = [
  {
    id: "1",
    type: "text",
    content: "Breaking: Major political announcement...",
    result: "FAKE",
    confidence: 87,
    timestamp: "2 hours ago",
  },
  {
    id: "2",
    type: "image",
    content: "celebrity_photo.jpg",
    result: "FAKE",
    confidence: 92,
    timestamp: "5 hours ago",
  },
  {
    id: "3",
    type: "url",
    content: "https://newssite.com/article",
    result: "REAL",
    confidence: 78,
    timestamp: "1 day ago",
  },
  {
    id: "4",
    type: "video",
    content: "interview_clip.mp4",
    result: "FAKE",
    confidence: 95,
    timestamp: "2 days ago",
  },
  {
    id: "5",
    type: "text",
    content: "Scientific study reveals new findings...",
    result: "REAL",
    confidence: 83,
    timestamp: "3 days ago",
  },
];

const typeIcons = {
  text: FileText,
  image: Image,
  video: Video,
  url: Link,
};

export default function History() {
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
          {mockHistory.map((item) => {
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
                      <p className="text-xs text-gray-500">{item.timestamp}</p>
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
          <p className="text-3xl font-bold text-blue-400 mb-1">5</p>
          <p className="text-sm text-gray-400">Total Analyses</p>
        </div>
        <div className="bg-gradient-to-br from-red-950/30 to-gray-900/50 rounded-2xl border border-red-500/30 p-6 text-center shadow-xl shadow-red-900/10 hover:shadow-red-500/20 transition-all">
          <p className="text-3xl font-bold text-red-500 mb-1">3</p>
          <p className="text-sm text-gray-400">Fake Detected</p>
        </div>
        <div className="bg-gradient-to-br from-green-950/30 to-gray-900/50 rounded-2xl border border-green-500/30 p-6 text-center shadow-xl shadow-green-900/10 hover:shadow-green-500/20 transition-all">
          <p className="text-3xl font-bold text-green-500 mb-1">2</p>
          <p className="text-sm text-gray-400">Real Verified</p>
        </div>
      </div>
    </div>
  );
}