import { Outlet, useLocation } from "react-router";
import Header from "./components/Header";

export default function Root() {
  const location = useLocation();
  const isLanding = location.pathname === "/";

  return (
    <div className="app-surface min-h-screen">
      {!isLanding && <Header />}
      <main className={isLanding ? "min-h-screen" : "min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8"}>
        <Outlet />
      </main>
    </div>
  );
}
