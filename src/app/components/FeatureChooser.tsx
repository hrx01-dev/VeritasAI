import { FileText, Image, Video, Link as LinkIcon, History, ArrowRight, Users, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { useNavigate } from "react-router";

const features = [
  {
    title: "Text Analysis",
    description: "Analyze articles and statements for misinformation patterns.",
    path: "/dashboard/text-analysis",
    icon: FileText,
    iconShell: "bg-sky-50 text-sky-600 ring-sky-100 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/20",
    hover: "hover:border-sky-200 hover:shadow-sky-100/80 dark:hover:border-sky-500/30 dark:hover:shadow-sky-950/30",
  },
  {
    title: "Image Detection",
    description: "Detect manipulated or synthetic image content.",
    path: "/dashboard/image-detection",
    icon: Image,
    iconShell: "bg-emerald-50 text-emerald-600 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20",
    hover: "hover:border-emerald-200 hover:shadow-emerald-100/80 dark:hover:border-emerald-500/30 dark:hover:shadow-emerald-950/30",
  },
  {
    title: "Video Detection",
    description: "Run face-based deepfake checks on sampled video frames.",
    path: "/dashboard/video-detection",
    icon: Video,
    iconShell: "bg-amber-50 text-amber-600 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20",
    hover: "hover:border-amber-200 hover:shadow-amber-100/80 dark:hover:border-amber-500/30 dark:hover:shadow-amber-950/30",
  },
  {
    title: "URL Checker",
    description: "Evaluate source credibility and suspicious URL signals.",
    path: "/dashboard/url-checker",
    icon: LinkIcon,
    iconShell: "bg-violet-50 text-violet-600 ring-violet-100 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/20",
    hover: "hover:border-violet-200 hover:shadow-violet-100/80 dark:hover:border-violet-500/30 dark:hover:shadow-violet-950/30",
  },
  {
    title: "History",
    description: "Review previous analyses and confidence trends.",
    path: "/dashboard/history",
    icon: History,
    iconShell: "bg-rose-50 text-rose-600 ring-rose-100 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20",
    hover: "hover:border-rose-200 hover:shadow-rose-100/80 dark:hover:border-rose-500/30 dark:hover:shadow-rose-950/30",
  },
  {
    title: "VeritasConnect",
    description: "Share suspicious content so the community can react and comment.",
    path: "/dashboard/veritas-connect",
    icon: Users,
    iconShell: "bg-cyan-50 text-cyan-600 ring-cyan-100 dark:bg-cyan-500/10 dark:text-cyan-300 dark:ring-cyan-500/20",
    hover: "hover:border-cyan-200 hover:shadow-cyan-100/80 dark:hover:border-cyan-500/30 dark:hover:shadow-cyan-950/30",
  },
];

export default function FeatureChooser() {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-[calc(100vh-4rem)] overflow-hidden px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[8%] top-[-12%] size-72 rounded-full bg-sky-200/30 blur-3xl dark:bg-sky-500/5" />
        <div className="absolute right-[5%] top-[18%] size-80 rounded-full bg-violet-200/25 blur-3xl dark:bg-violet-500/5" />
        <div className="tech-grid absolute inset-0 opacity-60 dark:opacity-40" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="mx-auto max-w-6xl"
      >
        <header className="mx-auto mb-10 max-w-3xl text-center sm:mb-12">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/75 px-3.5 py-1.5 text-xs font-medium tracking-wide text-slate-600 shadow-sm backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-slate-300">
            <Sparkles className="size-3.5 text-sky-500 dark:text-sky-300" />
            VERIFICATION WORKSPACE
          </div>
          <h1 className="text-4xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-5xl dark:text-white">
            Choose your analysis.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base dark:text-slate-400">
            Six focused tools for checking text, media, links, and the signals behind them.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.button
                key={feature.path}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.06, duration: 0.35, ease: "easeOut" }}
                onClick={() => navigate(feature.path)}
                className={`group relative min-h-52 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/85 p-6 text-left shadow-[0_12px_40px_rgba(30,55,90,0.06)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:bg-white hover:shadow-[0_20px_50px_rgba(30,55,90,0.11)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 dark:border-slate-800/80 dark:bg-slate-900/70 dark:shadow-[0_18px_60px_rgba(0,0,0,0.22)] dark:hover:bg-slate-900/90 ${feature.hover}`}
              >
                <div className="absolute right-0 top-0 size-32 translate-x-1/3 -translate-y-1/3 rounded-full bg-slate-100/70 blur-2xl transition-transform duration-500 group-hover:scale-150 dark:bg-white/[0.03]" />

                <div className="relative flex items-start justify-between">
                  <div className={`grid size-12 place-items-center rounded-xl ring-1 transition-transform duration-300 group-hover:scale-105 ${feature.iconShell}`}>
                    <Icon className="size-5" strokeWidth={1.9} />
                  </div>
                  <span className="grid size-9 place-items-center rounded-full border border-slate-200 bg-slate-50 text-slate-400 transition-all duration-300 group-hover:translate-x-0.5 group-hover:border-slate-300 group-hover:bg-slate-100 group-hover:text-slate-700 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-500 dark:group-hover:border-slate-600 dark:group-hover:bg-slate-800 dark:group-hover:text-slate-200">
                    <ArrowRight className="size-4" />
                  </span>
                </div>

                <div className="relative mt-7">
                  <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                    {feature.title}
                  </h2>
                  <p className="mt-2 max-w-sm text-sm leading-5 text-slate-500 dark:text-slate-400">
                    {feature.description}
                  </p>
                </div>
              </motion.button>
            );
          })}
        </div>

        <p className="mt-8 text-center text-xs text-slate-400 dark:text-slate-500">
          Select a workspace to begin a verification session.
        </p>
      </motion.div>
    </section>
  );
}
