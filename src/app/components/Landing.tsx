import { motion } from "motion/react";
import { ArrowRight, Check, ChevronRight, FileText, Image, Link as LinkIcon, Shield, Terminal, Video } from "lucide-react";
import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router";

const features = [
  { icon: FileText, title: "Text analysis", copy: "Trace claims, detect misleading narratives, and understand confidence." },
  { icon: Image, title: "Image detection", copy: "Inspect visual content for synthetic or manipulated media." },
  { icon: Video, title: "Video verification", copy: "Surface deepfake signals across moving and synthetic media." },
  { icon: LinkIcon, title: "URL intelligence", copy: "Check source reputation and credibility before you trust a link." },
];

const terminalLines = [
  ["$ veritas verify --url example.com", "Analyzing source…", "✓ credibility signals mapped"],
  ["$ veritas inspect --image upload.jpg", "Scanning visual artifacts…", "✓ no synthetic pattern detected"],
  ["$ veritas analyze --text claim.txt", "Cross-checking evidence…", "✓ confidence: 94.2%"],
];

export default function Landing() {
  const [terminalIndex, setTerminalIndex] = useState(0);
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setVisible(0);
      setTerminalIndex((current) => (current + 1) % terminalLines.length);
    }, 4200);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    setVisible(1);
    const id = window.setTimeout(() => setVisible(2), 650);
    return () => window.clearTimeout(id);
  }, [terminalIndex]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 tech-grid opacity-70" />
      <div className="pointer-events-none absolute left-1/2 top-[-220px] h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />

      <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
            <Shield className="size-5" />
          </div>
          <span className="text-sm font-semibold tracking-tight">VeritasAI</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-5">
          <a href="#features" className="hidden text-sm text-muted-foreground transition hover:text-foreground sm:block">Capabilities</a>
          <RouterLink to="/login" className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:text-foreground">Sign in</RouterLink>
          <RouterLink to="/signup" className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-85">Get started</RouterLink>
        </div>
      </nav>

      <main className="relative z-10 mx-auto max-w-7xl px-5 pb-20 pt-12 sm:px-8 sm:pt-20">
        <section className="grid items-center gap-12 lg:grid-cols-[1.05fr_.95fr] lg:gap-16">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .7 }}>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary">
              <span className="size-1.5 rounded-full bg-primary" />
              Multimodal verification engine
            </div>
            <h1 className="max-w-3xl text-5xl font-semibold leading-[1.02] tracking-[-.045em] sm:text-7xl">
              Trust the signal.<br />
              <span className="text-primary">Question the noise.</span>
            </h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              VeritasAI helps you verify text, images, video, and sources with clear AI-powered analysis instead of guesswork.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <RouterLink to="/signup" className="group inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-3 text-sm font-medium text-background transition hover:-translate-y-0.5">
                Start verifying <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
              </RouterLink>
              <a href="#features" className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-5 py-3 text-sm font-medium transition hover:border-primary/30">Explore capabilities <ChevronRight className="size-4" /></a>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
              {['Text', 'Image', 'Video', 'URL'].map((item) => <span key={item} className="flex items-center gap-1.5"><Check className="size-3.5 text-primary" />{item} verification</span>)}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: .97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .8, delay: .15 }} className="terminal-glow">
            <div className="terminal-window overflow-hidden rounded-2xl">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div className="flex gap-1.5"><span className="size-2.5 rounded-full bg-white/20" /><span className="size-2.5 rounded-full bg-white/20" /><span className="size-2.5 rounded-full bg-white/20" /></div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500"><Terminal className="size-3" /> veritas-cli</div>
              </div>
              <div className="min-h-[300px] p-5 font-mono text-xs leading-7 sm:p-7 sm:text-sm">
                <div className="text-slate-400">VeritasAI verification shell <span className="text-slate-600">v1.0</span></div>
                <div className="mt-5 text-sky-300">{terminalLines[terminalIndex][0]}</div>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: visible >= 1 ? 1 : 0 }} className="text-slate-400">{terminalLines[terminalIndex][1]}</motion.div>
                <motion.div initial={{ opacity: 0, x: -5 }} animate={{ opacity: visible >= 2 ? 1 : 0, x: visible >= 2 ? 0 : -5 }} className="text-emerald-300">{terminalLines[terminalIndex][2]}</motion.div>
                <div className="mt-8 border-t border-white/10 pt-4 text-slate-600">{'> '}awaiting next verification<span className="ml-1 animate-pulse text-sky-300">▋</span></div>
              </div>
            </div>
          </motion.div>
        </section>

        <section id="features" className="mt-28 sm:mt-36">
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: .6 }}>
            <p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">One workspace</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">Verification tools that stay out of your way.</h2>
          </motion.div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, copy }, index) => (
              <motion.div key={title} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * .07 }} className="ui-card group p-5 transition duration-300 hover:-translate-y-1 hover:border-primary/30">
                <div className="mb-10 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></div>
                <h3 className="font-medium">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="mt-24 border-y border-border py-12 sm:mt-32 sm:py-16">
          <div className="grid gap-8 sm:grid-cols-3">
            {[['94%', 'confidence-first'], ['4', 'verification modes'], ['1', 'focused workspace']].map(([value, label]) => (
              <div key={label}><div className="text-3xl font-semibold tracking-tight">{value}</div><div className="mt-1 text-sm text-muted-foreground">{label}</div></div>
            ))}
          </div>
        </section>

        <section className="mt-24 text-center sm:mt-32">
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">Make verification a habit</p>
          <h2 className="mx-auto mt-3 max-w-2xl text-4xl font-semibold tracking-[-.03em] sm:text-5xl">Before you share it, verify it.</h2>
          <p className="mx-auto mt-5 max-w-lg text-sm leading-6 text-muted-foreground">A calmer, clearer way to navigate synthetic media and misinformation.</p>
          <RouterLink to="/signup" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-foreground px-6 py-3 text-sm font-medium text-background transition hover:-translate-y-0.5">Create your workspace <ArrowRight className="size-4" /></RouterLink>
        </section>
      </main>

      <footer className="relative z-10 mx-auto flex max-w-7xl items-center justify-between border-t border-border px-5 py-7 text-xs text-muted-foreground sm:px-8">
        <span>© {new Date().getFullYear()} VeritasAI</span>
        <span>Built for clearer information.</span>
      </footer>
    </div>
  );
}
