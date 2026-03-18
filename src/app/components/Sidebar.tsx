import { NavLink } from "react-router";
import { FileText, Image, Video, Link, History, Shield } from "lucide-react";

const navItems = [
  { path: "/dashboard/text-analysis", label: "Text Analysis", icon: FileText },
  { path: "/dashboard/image-detection", label: "Image Detection", icon: Image },
  { path: "/dashboard/video-detection", label: "Video Detection", icon: Video },
  { path: "/dashboard/url-checker", label: "URL Checker", icon: Link },
  { path: "/dashboard/history", label: "History", icon: History },
];

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-gradient-to-b from-gray-900 to-black border-r border-gray-800/50 flex flex-col shadow-2xl">
      {/* Logo/Title */}
      <div className="p-6 border-b border-gray-800/50 bg-gradient-to-r from-cyan-500/5 to-blue-500/5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl shadow-lg shadow-cyan-500/30">
            <Shield className="size-8 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">VeritasAI</h1>
            <p className="text-xs text-gray-400">AI Detection System</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                      isActive
                        ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-500/30 shadow-lg shadow-cyan-500/20"
                        : "text-gray-400 hover:bg-gray-800/50 hover:text-gray-200 hover:border hover:border-gray-700/50"
                    }`
                  }
                >
                  <Icon className="size-5" />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-800/50 bg-gradient-to-r from-gray-900/50 to-black/50">
        <div className="text-xs text-gray-500 text-center">
          VeritasAI v1.0
          <br />
          Multi-Modal Detection
        </div>
      </div>
    </aside>
  );
}