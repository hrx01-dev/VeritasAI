import { useState, useRef, useEffect } from "react";
import { motion } from "motion/react";
import { Loader2, ShieldCheck, Zap, AlertCircle, Volume2, RotateCcw } from "lucide-react";

const ACTIONS = ["Blink twice", "Turn head left", "Nod slowly", "Smile", "Open mouth"] as const;
type SupportedAction = (typeof ACTIONS)[number];

type Landmark = { x: number; y: number; z?: number };
type Blendshape = { categoryName: string; score: number };

type DetectorState = {
  blinkCount: number;
  eyesWereClosed: boolean;
  minYawProxy: number;
  maxYawProxy: number;
  minPitchProxy: number;
  maxPitchProxy: number;
  smileFrames: number;
  mouthOpenFrames: number;
};

const LEFT_EYE_IDX = [33, 160, 158, 133, 153, 144] as const;
const RIGHT_EYE_IDX = [362, 385, 387, 263, 373, 380] as const;

function dist(a: Landmark, b: Landmark): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function computeEAR(landmarks: Landmark[], idx: readonly [number, number, number, number, number, number]): number {
  const [p1, p2, p3, p4, p5, p6] = idx;
  const vertical = dist(landmarks[p2], landmarks[p6]) + dist(landmarks[p3], landmarks[p5]);
  const horizontal = 2 * dist(landmarks[p1], landmarks[p4]);
  return horizontal > 0 ? vertical / horizontal : 0;
}

function blendshapeScore(blendshapes: Blendshape[] | undefined, name: string): number {
  if (!blendshapes) return 0;
  return blendshapes.find((b) => b.categoryName === name)?.score ?? 0;
}

interface BiometricVerificationProps {
  onVerificationComplete: () => void;
  onCancel: () => void;
}

export default function BiometricVerification({ onVerificationComplete, onCancel }: BiometricVerificationProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const faceLandmarkerRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);
  const detectorStateRef = useRef<DetectorState>({
    blinkCount: 0,
    eyesWereClosed: false,
    minYawProxy: Number.POSITIVE_INFINITY,
    maxYawProxy: Number.NEGATIVE_INFINITY,
    minPitchProxy: Number.POSITIVE_INFINITY,
    maxPitchProxy: Number.NEGATIVE_INFINITY,
    smileFrames: 0,
    mouthOpenFrames: 0,
  });

  const [cameraActive, setCameraActive] = useState(false);
  const [currentAction, setCurrentAction] = useState<SupportedAction>("Blink twice");
  const [detectedAction, setDetectedAction] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationProgress, setVerificationProgress] = useState(0);
  const [error, setError] = useState("");
  const [cameraPermission, setCameraPermission] = useState<"pending" | "granted" | "denied">("pending");
  const [isDetecting, setIsDetecting] = useState(false);
  const [modelReady, setModelReady] = useState(false);

  const resetDetectorState = () => {
    detectorStateRef.current = {
      blinkCount: 0,
      eyesWereClosed: false,
      minYawProxy: Number.POSITIVE_INFINITY,
      maxYawProxy: Number.NEGATIVE_INFINITY,
      minPitchProxy: Number.POSITIVE_INFINITY,
      maxPitchProxy: Number.NEGATIVE_INFINITY,
      smileFrames: 0,
      mouthOpenFrames: 0,
    };
  };

  // Stop camera and detection tracks
  const stopCameraAndDetection = () => {
    // Stop all video tracks immediately
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((track) => {
        track.stop();
        console.log("Video track stopped");
      });
      videoRef.current.srcObject = null;
    }
    
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    setCameraActive(false);
  };

  // Initialize camera
  useEffect(() => {
    let mounted = true;

    const loadFaceModel = async () => {
      try {
        const vision = await import("@mediapipe/tasks-vision");
        const filesetResolver = await vision.FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        faceLandmarkerRef.current = await vision.FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: true,
        });

        if (mounted) {
          setModelReady(true);
        }
      } catch (modelErr) {
        console.error("Unable to initialize face model:", modelErr);
        if (mounted) {
          setError("Could not load face detection model. Please refresh and try again.");
        }
      }
    };

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setCameraActive(true);
          setCameraPermission("granted");
          const randomAction = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
          setCurrentAction(randomAction);
          setIsDetecting(true);
        }
      } catch (err) {
        console.error("Camera access denied:", err);
        setCameraPermission("denied");
        setError("Camera permission denied. Please allow camera access to continue.");
      }
    };

    loadFaceModel();
    startCamera();

    return () => {
      mounted = false;
      // Cleanup: stop camera when component unmounts
      stopCameraAndDetection();
    };
  }, []);

  useEffect(() => {
    if (!modelReady || !cameraActive || !isDetecting || detectedAction || !videoRef.current || !faceLandmarkerRef.current) {
      return;
    }

    resetDetectorState();
    setVerificationProgress(5);
    setError("");

    const detectFrame = () => {
      const video = videoRef.current;
      const detector = faceLandmarkerRef.current;

      if (!video || !detector || !isDetecting || detectedAction) {
        return;
      }

      if (video.readyState < 2) {
        animationFrameRef.current = requestAnimationFrame(detectFrame);
        return;
      }

      const result = detector.detectForVideo(video, performance.now());
      const landmarks: Landmark[] | undefined = result?.faceLandmarks?.[0];
      const blendshapes: Blendshape[] | undefined = result?.faceBlendshapes?.[0]?.categories;

      if (!landmarks || landmarks.length < 388) {
        setVerificationProgress(10);
        setError("Face not detected clearly. Center your face and improve lighting.");
        animationFrameRef.current = requestAnimationFrame(detectFrame);
        return;
      }

      setError("");
      const state = detectorStateRef.current;

      const leftEAR = computeEAR(landmarks, LEFT_EYE_IDX);
      const rightEAR = computeEAR(landmarks, RIGHT_EYE_IDX);
      const avgEAR = (leftEAR + rightEAR) / 2;

      const leftEye = landmarks[33];
      const rightEye = landmarks[263];
      const noseTip = landmarks[1];
      const eyeCenterX = (leftEye.x + rightEye.x) / 2;
      const eyeCenterY = (leftEye.y + rightEye.y) / 2;

      const yawProxy = noseTip.x - eyeCenterX;
      const pitchProxy = noseTip.y - eyeCenterY;

      state.minYawProxy = Math.min(state.minYawProxy, yawProxy);
      state.maxYawProxy = Math.max(state.maxYawProxy, yawProxy);
      state.minPitchProxy = Math.min(state.minPitchProxy, pitchProxy);
      state.maxPitchProxy = Math.max(state.maxPitchProxy, pitchProxy);

      const closedEyes = avgEAR < 0.21;
      if (closedEyes && !state.eyesWereClosed) {
        state.eyesWereClosed = true;
      } else if (!closedEyes && state.eyesWereClosed) {
        state.eyesWereClosed = false;
        state.blinkCount += 1;
      }

      const smileLeft = blendshapeScore(blendshapes, "mouthSmileLeft");
      const smileRight = blendshapeScore(blendshapes, "mouthSmileRight");
      if (smileLeft > 0.45 && smileRight > 0.45) {
        state.smileFrames += 1;
      } else {
        state.smileFrames = Math.max(0, state.smileFrames - 1);
      }

      const jawOpen = blendshapeScore(blendshapes, "jawOpen");
      if (jawOpen > 0.55) {
        state.mouthOpenFrames += 1;
      } else {
        state.mouthOpenFrames = Math.max(0, state.mouthOpenFrames - 1);
      }

      let actionComplete = false;
      let progress = 30;

      if (currentAction === "Blink twice") {
        progress = Math.min(95, 20 + state.blinkCount * 35);
        actionComplete = state.blinkCount >= 2;
      } else if (currentAction === "Turn head left") {
        progress = Math.min(95, 20 + Math.abs(state.maxYawProxy - state.minYawProxy) * 1200);
        actionComplete = Math.abs(state.maxYawProxy - state.minYawProxy) > 0.08;
      } else if (currentAction === "Nod slowly") {
        progress = Math.min(95, 20 + Math.abs(state.maxPitchProxy - state.minPitchProxy) * 1400);
        actionComplete = Math.abs(state.maxPitchProxy - state.minPitchProxy) > 0.07;
      } else if (currentAction === "Smile") {
        progress = Math.min(95, 20 + state.smileFrames * 8);
        actionComplete = state.smileFrames >= 10;
      } else if (currentAction === "Open mouth") {
        progress = Math.min(95, 20 + state.mouthOpenFrames * 8);
        actionComplete = state.mouthOpenFrames >= 10;
      }

      setVerificationProgress(Math.max(10, Math.floor(progress)));

      if (actionComplete) {
        setDetectedAction(currentAction);
        setIsDetecting(false);
        setVerificationProgress(100);
        setTimeout(() => {
          completeVerification();
        }, 1200);
        return;
      }

      animationFrameRef.current = requestAnimationFrame(detectFrame);
    };

    animationFrameRef.current = requestAnimationFrame(detectFrame);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [modelReady, cameraActive, isDetecting, detectedAction, currentAction]);

  const completeVerification = () => {
    // Stop camera and detection immediately
    stopCameraAndDetection();
    
    setIsVerifying(true);
    setVerificationProgress(100);

    // Navigate after brief delay for success animation
    setTimeout(() => {
      onVerificationComplete();
    }, 1500);
  };

  const handleRetry = () => {
    const randomAction = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
    setCurrentAction(randomAction);
    setDetectedAction("");
    setVerificationProgress(0);
    setError("");
    setIsDetecting(true);
  };

  const handleRequestCameraPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
        setCameraPermission("granted");
        setCurrentAction(ACTIONS[Math.floor(Math.random() * ACTIONS.length)]);
        setDetectedAction("");
        setVerificationProgress(0);
        setIsDetecting(true);
      }
    } catch (err) {
      console.error("Camera access failed:", err);
      setCameraPermission("denied");
      setError("Could not access camera. Please check your permissions and try again.");
    }
  };

  const speakAction = (action: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(`Please perform: ${action}`);
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Speak the action when it changes
  useEffect(() => {
    if (currentAction && cameraActive && cameraPermission === "granted" && !detectedAction) {
      speakAction(currentAction);
    }
  }, [currentAction, cameraActive, cameraPermission, detectedAction]);

  if (isVerifying && verificationProgress === 100) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="fixed inset-0 z-50 bg-gradient-to-br from-gray-950 via-black to-gray-900 flex items-center justify-center"
      >
        <div className="text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
            className="p-6 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full mx-auto mb-6 w-24 h-24 flex items-center justify-center"
          >
            <ShieldCheck className="size-12 text-white" />
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-3xl font-bold text-white mb-2"
          >
            Verification Complete!
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="text-gray-400 mb-8"
          >
            You are verified and ready to use VeritasAI
          </motion.p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed inset-0 z-50 bg-gradient-to-br from-gray-950 via-black to-gray-900 flex items-center justify-center p-4"
    >
      <div className="w-full max-w-2xl">
        <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-2xl border border-gray-700/50 shadow-2xl shadow-black/20 backdrop-blur-sm overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border-b border-gray-700/50 p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-500/20 rounded-lg">
                <ShieldCheck className="size-6 text-cyan-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Identity Verification</h2>
                <p className="text-sm text-gray-400">Prove you're not a robot</p>
              </div>
            </div>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="p-8">
            {cameraPermission === "denied" ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-12"
              >
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg mb-6 inline-block">
                  <AlertCircle className="size-8 text-red-500" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Camera Permission Required</h3>
                <p className="text-gray-400 mb-6">
                  We need camera access for identity verification. Please allow camera access and try again.
                </p>
                <button
                  onClick={handleRequestCameraPermission}
                  className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium rounded-xl transition-all"
                >
                  Allow Camera Access
                </button>
              </motion.div>
            ) : (
              <>
                {/* Camera Feed */}
                <div className="relative mb-8 rounded-xl overflow-hidden bg-black border border-gray-700">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-80 object-cover"
                  />
                  {/* Camera overlay */}
                  <div className="absolute inset-0 border-4 border-cyan-500/30 rounded-xl pointer-events-none">
                    <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded-full">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      <span className="text-xs text-gray-300">Recording</span>
                    </div>
                  </div>

                  {/* Action status */}
                  {detectedAction && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm"
                    >
                      <div className="text-center">
                        <Zap className="size-12 text-yellow-400 mx-auto mb-2 animate-pulse" />
                        <p className="text-white font-bold">Action detected!</p>
                        <p className="text-cyan-300 text-sm">{detectedAction}</p>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Action Instructions */}
                <div className="mb-6 p-6 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-cyan-500/30 rounded-xl">
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0">
                      <Volume2 className="size-6 text-cyan-400 animate-pulse" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 mb-2">Perform this action:</p>
                      <motion.p
                        key={currentAction}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-2xl font-bold text-white"
                      >
                        {currentAction}
                      </motion.p>
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-6">
                  <div className="flex justify-between mb-2">
                    <span className="text-xs text-gray-400">Complete the action</span>
                    <span className="text-xs text-cyan-400 font-medium">
                      {verificationProgress > 0 ? "1/1" : "0/1"}
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${verificationProgress}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>

                {/* Error message */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 p-4 bg-red-950/30 border border-red-500/30 rounded-lg flex items-center gap-3"
                  >
                    <AlertCircle className="size-5 text-red-500 flex-shrink-0" />
                    <p className="text-sm text-red-400">{error}</p>
                  </motion.div>
                )}

                {/* Instructions */}
                <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700 mb-6">
                  <h4 className="text-sm font-medium text-gray-300 mb-2">Tips for success:</h4>
                  <ul className="text-xs text-gray-400 space-y-1">
                    <li>✓ Ensure good lighting and clear face visibility</li>
                    <li>✓ Perform the action clearly and naturally</li>
                    <li>✓ Keep your face inside the frame while detection runs</li>
                  </ul>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  {isDetecting ? (
                    <>
                      <button
                        type="button"
                        disabled
                        className="flex-1 py-3 px-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-medium rounded-xl transition-all border border-green-500/30 flex items-center justify-center gap-2"
                      >
                        <Loader2 className="size-4 animate-spin" />
                        Detecting action...
                      </button>
                      <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 py-3 px-4 bg-gray-700 hover:bg-gray-600 text-gray-200 font-medium rounded-xl transition-all border border-gray-600"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleRetry}
                        disabled={detectedAction !== ""}
                        className="flex-1 py-3 px-4 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-gray-200 font-medium rounded-xl transition-all border border-gray-600 flex items-center justify-center gap-2"
                      >
                        <RotateCcw className="size-4" />
                        Retry
                      </button>
                      <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 py-3 px-4 bg-gray-700 hover:bg-gray-600 text-gray-200 font-medium rounded-xl transition-all border border-gray-600"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
