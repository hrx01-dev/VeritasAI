import { createBrowserRouter, Navigate } from "react-router";
import Root from "./Root";
import TextAnalysis from "./components/TextAnalysis";
import ImageDetection from "./components/ImageDetection";
import VideoDetection from "./components/VideoDetection";
import URLChecker from "./components/URLChecker";
import History from "./components/History";
import Login from "./components/Login";
import Signup from "./components/Signup";
import Landing from "./components/Landing";
import ProtectedRoute from "./components/ProtectedRoute";
import FeatureChooser from "./components/FeatureChooser";
import VeritasConnect from "./components/VeritasConnect";

export const router = createBrowserRouter([
  {
    path: "/welcome",
    Component: Landing,
  },
  {
    path: "/login",
    Component: Login,
  },
  {
    path: "/signup",
    Component: Signup,
  },
  {
    path: "/dashboard",
    element: (
      <ProtectedRoute>
        <Root />
      </ProtectedRoute>
    ),
    children: [
      { index: true, Component: FeatureChooser },
      { path: "text-analysis", Component: TextAnalysis },
      { path: "image-detection", Component: ImageDetection },
      { path: "video-detection", Component: VideoDetection },
      { path: "url-checker", Component: URLChecker },
      { path: "history", Component: History },
      { path: "veritas-connect", Component: VeritasConnect },
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