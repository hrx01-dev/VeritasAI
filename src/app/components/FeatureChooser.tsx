import { FileText, Image, Video, Link as LinkIcon, History, ArrowRight, Users } from "lucide-react";
import { motion } from "motion/react";
import { useNavigate } from "react-router";

const features = [
  {
    title: "Text Analysis",
    description: "Analyze articles and statements for misinformation patterns.",
    path: "/dashboard/text-analysis",
    icon: FileText,
    accent: "from-cyan-500 to-blue-600",
  },
  {
    title: "Image Detection",
    description: "Detect manipulated or synthetic image content.",
    path: "/dashboard/image-detection",
    icon: Image,
    accent: "from-emerald-500 to-teal-600",
  },
  {
    title: "Video Detection",
    description: "Run face-based deepfake checks on sampled video frames.",
    path: "/dashboard/video-detection",
    icon: Video,
    accent: "from-orange-500 to-amber-600",
  },
  {
    title: "URL Checker",
    description: "Evaluate source credibility and suspicious URL signals.",
    path: "/dashboard/url-checker",
    icon: LinkIcon,
    accent: "from-violet-500 to-fuchsia-600",
  },
  {
    title: "History",
    description: "Review previous analyses and confidence trends.",
    path: "/dashboard/history",
    icon: History,
    accent: "from-rose-500 to-pink-600",
  },
  {
    title: "VeritasConnect",
    description: "Share suspicious content so the community can react and comment.",
    path: "/dashboard/veritas-connect",
    icon: Users,
    accent: "from-sky-500 to-cyan-600",
  },
];

export default function FeatureChooser() {
  const navigate = useNavigate();

  return (
    <section className="min-h-[calc(100vh-6rem)] px-4 py-10 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mx-auto max-w-6xl"
      >
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold text-white sm:text-5xl">Choose Analysis Type</h1>
          <p className="mx-auto mt-3 max-w-2xl text-gray-400">
            Select one module to start. You will be navigated directly to the selected analysis workspace.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.button
                key={feature.path}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
                onClick={() => navigate(feature.path)}
                className="group rounded-2xl border border-gray-700/60 bg-gradient-to-br from-gray-900/70 to-gray-800/30 p-6 text-left shadow-xl transition-all hover:-translate-y-1 hover:border-cyan-500/40 hover:shadow-cyan-500/10"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className={`rounded-xl bg-gradient-to-br ${feature.accent} p-3 shadow-lg`}>
                    <Icon className="size-6 text-white" />
                  </div>
                  <ArrowRight className="size-5 text-gray-500 transition-colors group-hover:text-cyan-400" />
                </div>
                <h2 className="text-xl font-semibold text-white">{feature.title}</h2>
                <p className="mt-2 text-sm text-gray-400">{feature.description}</p>
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    </section>
  );
}
