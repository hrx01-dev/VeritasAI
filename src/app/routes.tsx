import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router";
import Root from "./Root";
import ProtectedRoute from "./components/ProtectedRoute";

const Landing = lazy(() => import("./components/Landing"));
const Login = lazy(() => import("./components/Login"));
const Signup = lazy(() => import("./components/Signup"));
const FeatureChooser = lazy(() => import("./components/FeatureChooser"));
const TextAnalysis = lazy(() => import("./components/TextAnalysis"));
const ImageDetection = lazy(() => import("./components/ImageDetection"));
const VideoDetection = lazy(() => import("./components/VideoDetection"));
const URLChecker = lazy(() => import("./components/URLChecker"));
const History = lazy(() => import("./components/History"));
const VeritasConnect = lazy(() => import("./components/VeritasConnect"));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh] w-full">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
      <p className="text-sm text-gray-400 font-medium animate-pulse">Loading...</p>
    </div>
  </div>
);

const withSuspense = (Component: React.ComponentType) => (
  <Suspense fallback={<PageLoader />}>
    <Component />
  </Suspense>
);

export const router = createBrowserRouter([
  {
    path: "/welcome",
    element: withSuspense(Landing),
  },
  {
    path: "/login",
    element: withSuspense(Login),
  },
  {
    path: "/signup",
    element: withSuspense(Signup),
  },
  {
    path: "/dashboard",
    element: (
      <ProtectedRoute>
        <Root />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: withSuspense(FeatureChooser) },
      { path: "text-analysis", element: withSuspense(TextAnalysis) },
      { path: "image-detection", element: withSuspense(ImageDetection) },
      { path: "video-detection", element: withSuspense(VideoDetection) },
      { path: "url-checker", element: withSuspense(URLChecker) },
      { path: "history", element: withSuspense(History) },
      { path: "veritas-connect", element: withSuspense(VeritasConnect) },
    ],
  },
  {
    path: "/",
    element: <Navigate to="/welcome" replace />,
  },
  // Catch old routes and redirect to dashboard equivalents
  {
    path: "/text-analysis",
    element: <Navigate to="/dashboard/text-analysis" replace />,
  },
  {
    path: "/image-detection",
    element: <Navigate to="/dashboard/image-detection" replace />,
  },
  {
    path: "/video-detection",
    element: <Navigate to="/dashboard/video-detection" replace />,
  },
  {
    path: "/url-checker",
    element: <Navigate to="/dashboard/url-checker" replace />,
  },
  {
    path: "/history",
    element: <Navigate to="/dashboard/history" replace />,
  },
]);