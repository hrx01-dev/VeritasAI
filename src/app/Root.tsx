import { Outlet } from "react-router";
import Header from "./components/Header";

export default function Root() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-900">
      <Header />
      <main className="mt-16 p-6 sm:p-8">
        <Outlet />
      </main>
    </div>
  );
}