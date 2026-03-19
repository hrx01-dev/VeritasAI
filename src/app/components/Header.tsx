import { Moon, Sun, LogOut } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

export default function Header() {
  const [isDark, setIsDark] = useState(true);
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("veritasai_authenticated");
    localStorage.removeItem("veritasai_user");
    localStorage.removeItem("veritasai_token");
    navigate("/login");
  };

  const user = JSON.parse(localStorage.getItem("veritasai_user") || "{}");

  return (
    <header className="h-16 bg-gradient-to-r from-gray-900 to-black border-b border-gray-800/50 px-6 flex items-center justify-between shadow-xl backdrop-blur-sm">
      {/* Title */}
      <div>
        <h2 className="text-lg font-semibold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">VeritasAI Dashboard</h2>
        {user.name && <p className="text-xs text-gray-500">Welcome, {user.name}</p>}
      </div>

      {/* Status & Theme Toggle */}
      <div className="flex items-center gap-4">
        {/* Live Status Indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-950/30 border border-green-500/30 rounded-full">
          <div className="relative">
            <div className="size-3 bg-green-500 rounded-full animate-pulse"></div>
            <div className="absolute inset-0 size-3 bg-green-500 rounded-full animate-ping opacity-75"></div>
          </div>
          <span className="text-sm text-green-400 font-medium">System Active</span>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={() => setIsDark(!isDark)}
          className="p-2 rounded-xl bg-gray-800/50 hover:bg-gray-700/50 text-gray-400 hover:text-gray-200 transition-all border border-gray-700/50 hover:border-cyan-500/30 hover:shadow-lg hover:shadow-cyan-500/10"
          aria-label="Toggle theme"
        >
          {isDark ? <Moon className="size-5" /> : <Sun className="size-5" />}
        </button>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="p-2 rounded-xl bg-gray-800/50 hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-all border border-gray-700/50 hover:border-red-500/30"
          aria-label="Logout"
        >
          <LogOut className="size-5" />
        </button>
      </div>
    </header>
  );
}