import { useEffect, useMemo, useState } from "react";
import { History as HistoryIcon, AlertTriangle, CheckCircle, FileText, Image, Video, Link, Download } from "lucide-react";
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

  const downloadFile = (filename: string, content: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const buildReportRows = () =>
    historyItems.map((item, index) => ({
      index: index + 1,
      id: item.id,
      type: item.type,
      result: item.result,
      confidence: item.confidence,
      timestamp: item.timestamp,
      displayTimestamp: formatTimestamp(item.timestamp),
      content: item.content,
      reasons: item.reasons ?? [],
      manipulationScore: item.manipulationScore,
      deepfakeScore: item.deepfakeScore,
      trustScore: item.trustScore,
      domainQualityScore: item.domainQualityScore,
      keywordRiskScore: item.keywordRiskScore,
      shortExplanation: item.shortExplanation,
      badge: item.badge,
      visualization: item.visualization,
    }));

  const handleDownloadPdfReport = async () => {
    if (historyItems.length === 0) return;

    const { jsPDF } = await import("jspdf");
    const rows = buildReportRows();
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const drawScoreBar = (x: number, y: number, width: number, score: number, label: string) => {
      const normalized = Math.max(0, Math.min(score, 100));
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(110, 118, 129);
      doc.text(`${label}: ${normalized}%`, x, y - 6);
      doc.setFillColor(228, 232, 240);
      doc.roundedRect(x, y, width, 10, 4, 4, "F");

      const fillW = (normalized / 100) * width;
      if (normalized >= 60) {
        doc.setFillColor(34, 197, 94);
      } else if (normalized >= 40) {
        doc.setFillColor(245, 158, 11);
      } else {
        doc.setFillColor(239, 68, 68);
      }
      doc.roundedRect(x, y, fillW, 10, 4, 4, "F");
    };

    const generatedAt = new Date().toLocaleString();

    const drawCoverPage = () => {
      const centerX = pageWidth / 2;
      const centerY = pageHeight / 2;

      doc.setFillColor(239, 246, 255);
      doc.rect(0, 0, pageWidth, pageHeight, "F");

      doc.setFillColor(14, 116, 144);
      doc.circle(centerX, centerY - 80, 40, "F");
      doc.setFillColor(255, 255, 255);
      doc.circle(centerX, centerY - 80, 28, "F");
      doc.setDrawColor(14, 116, 144);
      doc.setLineWidth(4);
      doc.line(centerX - 12, centerY - 80, centerX - 2, centerY - 68);
      doc.line(centerX - 2, centerY - 68, centerX + 16, centerY - 92);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(38);
      doc.setTextColor(14, 116, 144);
      doc.text("VeritasAI", centerX, centerY + 8, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(14);
      doc.setTextColor(51, 65, 85);
      doc.text("Comprehensive Detection Analysis Report", centerX, centerY + 34, { align: "center" });
      doc.text(`Generated on ${generatedAt}`, centerX, centerY + 56, { align: "center" });
    };

    const drawPrimaryHeader = (row: (typeof rows)[number], cursorY: number) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(15, 23, 42);
      doc.text("VeritasAI Detection Report", 40, cursorY);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated: ${generatedAt}`, pageWidth - 210, cursorY);

      cursorY += 26;
      doc.setDrawColor(226, 232, 240);
      doc.line(40, cursorY, pageWidth - 40, cursorY);

      cursorY += 26;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59);
      doc.text(`Analysis #${row.index} (${row.type.toUpperCase()})`, 40, cursorY);

      const badgeText = row.badge ?? (row.result === "REAL" ? "SAFE" : "NOT SAFE");
      const badgeWidth = doc.getTextWidth(badgeText) + 22;
      if (badgeText === "SAFE") {
        doc.setFillColor(220, 252, 231);
        doc.setTextColor(22, 101, 52);
      } else {
        doc.setFillColor(254, 226, 226);
        doc.setTextColor(153, 27, 27);
      }
      doc.roundedRect(pageWidth - 40 - badgeWidth, cursorY - 14, badgeWidth, 20, 8, 8, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(badgeText, pageWidth - 32 - badgeWidth, cursorY);

      cursorY += 24;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text(`Result: ${row.result}`, 40, cursorY);
      doc.text(`Confidence: ${row.confidence}%`, 180, cursorY);
      doc.text(`Timestamp: ${row.displayTimestamp}`, 300, cursorY);

      return cursorY + 20;
    };

    const drawContinuationHeader = (row: (typeof rows)[number], cursorY: number) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      doc.text(`Analysis #${row.index} Continued`, 40, cursorY);
      doc.setDrawColor(226, 232, 240);
      doc.line(40, cursorY + 8, pageWidth - 40, cursorY + 8);
      return cursorY + 26;
    };

    const writeWrappedLines = (
      row: (typeof rows)[number],
      cursorY: number,
      lines: string[],
      x: number,
      lineHeight: number,
      minBottomPadding: number,
    ) => {
      lines.forEach((line) => {
        if (cursorY + lineHeight > pageHeight - minBottomPadding) {
          doc.addPage();
          cursorY = drawContinuationHeader(row, 52);
        }
        doc.text(line, x, cursorY);
        cursorY += lineHeight;
      });
      return cursorY;
    };

    drawCoverPage();

    rows.forEach((row) => {
      if (doc.getNumberOfPages() >= 1) {
        doc.addPage();
      }

      let cursorY = drawPrimaryHeader(row, 52);

      if (cursorY + 24 > pageHeight - 48) {
        doc.addPage();
        cursorY = drawContinuationHeader(row, 52);
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      doc.text("Input Information", 40, cursorY);
      cursorY += 16;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);

      if (row.type === "text") {
        const inputLines = doc.splitTextToSize(`Input Text: ${row.content}`, pageWidth - 80);
        cursorY = writeWrappedLines(row, cursorY, inputLines, 40, 12, 48) + 12;
      } else if (row.type === "url") {
        const inputLines = doc.splitTextToSize(`Input URL: ${row.content}`, pageWidth - 80);
        cursorY = writeWrappedLines(row, cursorY, inputLines, 40, 12, 48) + 12;
      } else if (row.type === "image") {
        const inputLines = doc.splitTextToSize(`Input Image: ${row.content}`, pageWidth - 80);
        cursorY = writeWrappedLines(row, cursorY, inputLines, 40, 12, 48) + 8;

        if (row.visualization && cursorY + 230 < pageHeight - 48) {
          doc.setDrawColor(203, 213, 225);
          doc.roundedRect(40, cursorY, 220, 180, 8, 8);
          doc.addImage(row.visualization, "PNG", 44, cursorY + 4, 212, 172);
          cursorY += 192;
        } else {
          const fallbackLines = doc.splitTextToSize(
            "Image preview is unavailable for this record. Run a new image analysis to include preview data.",
            pageWidth - 80,
          );
          cursorY = writeWrappedLines(row, cursorY, fallbackLines, 40, 12, 48) + 12;
        }
      } else {
        const inputLines = doc.splitTextToSize(`Input Video: ${row.content}`, pageWidth - 80);
        cursorY = writeWrappedLines(row, cursorY, inputLines, 40, 12, 48) + 8;

        if (cursorY + 100 < pageHeight - 48) {
          doc.setDrawColor(148, 163, 184);
          doc.roundedRect(40, cursorY, 220, 90, 8, 8);
          doc.setFillColor(226, 232, 240);
          doc.roundedRect(44, cursorY + 4, 212, 82, 6, 6, "F");
          doc.setFillColor(71, 85, 105);
          doc.triangle(132, cursorY + 28, 132, cursorY + 62, 166, cursorY + 45, "F");
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.setTextColor(71, 85, 105);
          doc.text("Video preview placeholder", 270, cursorY + 50);
          cursorY += 102;
        }
      }

      if (cursorY + 24 > pageHeight - 48) {
        doc.addPage();
        cursorY = drawContinuationHeader(row, 52);
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      doc.text("Detected Content", 40, cursorY);
      cursorY += 16;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      const contentLines = doc.splitTextToSize(`Content: ${row.content}`, pageWidth - 80);
      cursorY = writeWrappedLines(row, cursorY, contentLines, 40, 12, 48) + 14;

      if (cursorY + 40 > pageHeight - 48) {
        doc.addPage();
        cursorY = drawContinuationHeader(row, 52);
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      doc.text("Graph Summary", 40, cursorY);
      cursorY += 18;

      const ensureBarSpace = () => {
        if (cursorY + 30 > pageHeight - 48) {
          doc.addPage();
          cursorY = drawContinuationHeader(row, 52);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(12);
          doc.setTextColor(30, 41, 59);
          doc.text("Graph Summary (continued)", 40, cursorY);
          cursorY += 18;
        }
      };

      ensureBarSpace();
      drawScoreBar(40, cursorY, pageWidth - 80, row.confidence, "Confidence");
      cursorY += 28;

      if (row.trustScore !== undefined) {
        ensureBarSpace();
        drawScoreBar(40, cursorY, pageWidth - 80, row.trustScore, "Trust Score");
        cursorY += 22;
      }
      if (row.domainQualityScore !== undefined) {
        ensureBarSpace();
        drawScoreBar(40, cursorY, pageWidth - 80, row.domainQualityScore, "Domain Quality");
        cursorY += 22;
      }
      if (row.keywordRiskScore !== undefined) {
        ensureBarSpace();
        drawScoreBar(40, cursorY, pageWidth - 80, row.keywordRiskScore, "Keyword Risk");
        cursorY += 22;
      }
      if (row.manipulationScore !== undefined) {
        ensureBarSpace();
        drawScoreBar(40, cursorY, pageWidth - 80, row.manipulationScore, "Manipulation Score");
        cursorY += 22;
      }
      if (row.deepfakeScore !== undefined) {
        ensureBarSpace();
        drawScoreBar(40, cursorY, pageWidth - 80, row.deepfakeScore, "Deepfake Score");
        cursorY += 22;
      }

      cursorY += 8;
      if (cursorY + 24 > pageHeight - 48) {
        doc.addPage();
        cursorY = drawContinuationHeader(row, 52);
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      doc.text("Explanation", 40, cursorY);
      cursorY += 16;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);

      const explanationLines = row.shortExplanation
        ? doc.splitTextToSize(row.shortExplanation, pageWidth - 80)
        : ["No short explanation available for this entry."];
      cursorY = writeWrappedLines(row, cursorY, explanationLines, 40, 12, 48) + 12;

      if (cursorY + 20 > pageHeight - 48) {
        doc.addPage();
        cursorY = drawContinuationHeader(row, 52);
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.text("Detailed Reasons", 40, cursorY);
      cursorY += 16;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);

      const reasons = row.reasons.length > 0 ? row.reasons : ["No detailed reasons stored for this entry."];
      reasons.forEach((reason) => {
        const reasonLines = doc.splitTextToSize(`- ${reason}`, pageWidth - 88);
        cursorY = writeWrappedLines(row, cursorY, reasonLines, 48, 12, 48) + 6;
      });
    });

    doc.save(`veritasai-report-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.pdf`);
  };

  const handleDownloadJsonReport = () => {
    const report = {
      reportName: "VeritasAI Detection Report",
      generatedAt: new Date().toISOString(),
      summary: {
        total: stats.total,
        fake: stats.fake,
        real: stats.real,
      },
      detections: buildReportRows(),
    };

    downloadFile(
      `veritasai-report-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`,
      JSON.stringify(report, null, 2),
      "application/json",
    );
  };

  const handleDownloadTextReport = () => {
    const lines: string[] = [];
    lines.push("VERITASAI DETECTION REPORT");
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push("");
    lines.push("SUMMARY");
    lines.push(`- Total analyses: ${stats.total}`);
    lines.push(`- Fake detected: ${stats.fake}`);
    lines.push(`- Real verified: ${stats.real}`);
    lines.push("");
    lines.push("DETAILED RESULTS");

    buildReportRows().forEach((row) => {
      lines.push(`\n#${row.index} | ${row.type.toUpperCase()} | ${row.result} | ${row.confidence}% confidence`);
      lines.push(`Time: ${row.displayTimestamp}`);
      lines.push(`Content: ${row.content}`);
      lines.push(`ID: ${row.id}`);
    });

    downloadFile(
      `veritasai-report-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.txt`,
      lines.join("\n"),
      "text/plain;charset=utf-8",
    );
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

      <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-2xl border border-cyan-500/20 p-6 shadow-2xl shadow-black/20 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h4 className="text-lg font-semibold text-white">Download Full Report</h4>
            <p className="text-sm text-gray-400">
              Export the complete detection history with summary and detailed entries.
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Records included</p>
            <p className="text-2xl font-bold text-cyan-400">{stats.total}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleDownloadJsonReport}
            disabled={historyItems.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white font-medium rounded-xl transition-all shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 disabled:shadow-none"
          >
            <Download className="size-4" />
            Download JSON Report
          </button>

          <button
            onClick={handleDownloadTextReport}
            disabled={historyItems.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-700/60 disabled:text-gray-500 text-gray-200 font-medium rounded-xl transition-all"
          >
            <Download className="size-4" />
            Download Text Report
          </button>

          <button
            onClick={handleDownloadPdfReport}
            disabled={historyItems.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white font-medium rounded-xl transition-all shadow-lg shadow-rose-500/20 hover:shadow-rose-500/40 disabled:shadow-none"
          >
            <Download className="size-4" />
            Download PDF Report
          </button>
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