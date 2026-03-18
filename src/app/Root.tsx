import { Outlet } from "react-router";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";

export default function Root() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-900">
      <Sidebar />
      <Header />
      <main className="ml-64 mt-16 p-8">
        <Outlet />
      </main>
    </div>
  );
}