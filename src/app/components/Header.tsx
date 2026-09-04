import { Moon, Sun, LogOut, LayoutGrid } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import VeritasLogo from "./VeritasLogo";

export default function Header() {
  const [isDark, setIsDark] = useState(() => localStorage.getItem("veritasai_theme") !== "light");
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("veritasai_theme", isDark ? "dark" : "light");
  }, [isDark]);

  const handleLogout = () => {
    localStorage.removeItem("veritasai_authenticated");
    localStorage.removeItem("veritasai_user");
    localStorage.removeItem("veritasai_token");
    navigate("/login");
  };

  const user = JSON.parse(localStorage.getItem("veritasai_user") || "{}");

  return (
    <header className="sticky top-0 z-50 h-16 border-b border-border bg-background/80 px-4 sm:px-6 backdrop-blur-xl">
      <div className="mx-auto flex h-full max-w-[1600px] items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <VeritasLogo />
          <div className="hidden h-7 w-px bg-border sm:block" />
          <div className="hidden sm:block">
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-foreground/80">Workspace</p>
            {user.name && <p className="truncate text-xs text-muted-foreground">Welcome, {user.name}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground md:flex">
            <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.65)]" />
            System active
          </div>
          <button onClick={() => navigate("/dashboard")} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground/80 transition hover:border-primary/40 hover:text-foreground" aria-label="Open features">
            <LayoutGrid className="size-4" />
            <span className="hidden sm:inline">Features</span>
          </button>
          <button onClick={() => setIsDark((value) => !value)} className="rounded-lg border border-border bg-card p-2 text-muted-foreground transition hover:text-foreground" aria-label="Toggle theme">
            {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
          <button onClick={handleLogout} className="rounded-lg border border-border bg-card p-2 text-muted-foreground transition hover:border-destructive/40 hover:text-destructive" aria-label="Logout">
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
