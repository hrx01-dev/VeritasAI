import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ImagePlus, Loader2, MessageCircle, Send, ThumbsDown, ThumbsUp, Upload, Video } from "lucide-react";
import {
  addVeritasConnectComment,
  createVeritasConnectPost,
  setVeritasConnectReaction,
  subscribeToVeritasConnectPosts,
  type VeritasConnectPost,
  type VeritasConnectUser,
} from "../lib/veritasConnect";

function getCurrentUser(): VeritasConnectUser {
  const fallback = { name: "Community Member", email: "anonymous@veritas.ai" };

  try {
    const raw = localStorage.getItem("veritasai_user");
    if (!raw) return fallback;

    const parsed = JSON.parse(raw) as { name?: string; email?: string };
    const name = (parsed.name || "").trim() || fallback.name;
    const email = (parsed.email || "").trim().toLowerCase() || fallback.email;
    return { name, email };
  } catch {
    return fallback;
  }
}

function formatTime(isoTime: string): string {
  const date = new Date(isoTime);
  if (Number.isNaN(date.getTime())) {
    return "Just now";
  }

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return date.toLocaleDateString();
}

export default function VeritasConnect() {
  const user = useMemo(() => getCurrentUser(), []);
  const [posts, setPosts] = useState<VeritasConnectPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedError, setFeedError] = useState("");

  const [message, setMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [pendingReactionId, setPendingReactionId] = useState<string | null>(null);
  const [pendingCommentId, setPendingCommentId] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    const unsubscribe = subscribeToVeritasConnectPosts(
      (nextPosts) => {
        setPosts(nextPosts);
        setFeedError("");
        setIsLoading(false);
      },
      (err) => {
        setFeedError(err.message || "Unable to load VeritasConnect right now.");
        setIsLoading(false);
      },
    );

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl("");
      return;
    }

    const nextPreview = URL.createObjectURL(selectedFile);
    setPreviewUrl(nextPreview);

    return () => {
      URL.revokeObjectURL(nextPreview);
    };
  }, [selectedFile]);

  const onSelectFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      setFeedError("Only image and video files are supported.");
      setSelectedFile(null);
      return;
    }

    setFeedError("");
    setSelectedFile(file);
  };

  const handleCreatePost = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!message.trim() && !selectedFile) {
      setFeedError("Add a description or attach a suspicious image/video before posting.");
      return;
    }

    setFeedError("");
    setIsSubmitting(true);

    try {
      await createVeritasConnectPost({ text: message, file: selectedFile, user });
      setMessage("");
      setSelectedFile(null);
      setPreviewUrl("");
    } catch (err) {
      setFeedError(err instanceof Error ? err.message : "Unable to publish this post.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReaction = async (postId: string, reaction: "like" | "dislike") => {
    setPendingReactionId(postId);

    try {
      await setVeritasConnectReaction({ postId, reaction, userEmail: user.email });
    } catch (err) {
      setFeedError(err instanceof Error ? err.message : "Unable to save your reaction.");
    } finally {
      setPendingReactionId(null);
    }
  };

  const handleComment = async (postId: string) => {
    const draft = (commentDrafts[postId] || "").trim();
    if (!draft) return;

    setPendingCommentId(postId);

    try {
      await addVeritasConnectComment({ postId, text: draft, user });
      setCommentDrafts((previous) => ({ ...previous, [postId]: "" }));
    } catch (err) {
      setFeedError(err instanceof Error ? err.message : "Unable to add comment.");
    } finally {
      setPendingCommentId(null);
    }
  };

  return (
    <section className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 via-blue-500/10 to-transparent p-6 shadow-lg shadow-cyan-500/10">
        <h1 className="text-3xl font-bold text-white">VeritasConnect</h1>
        <p className="mt-2 text-sm text-gray-300">
          Upload suspicious content to alert the community. People can react and discuss in one shared awareness feed.
        </p>
      </div>

      <form
        onSubmit={handleCreatePost}
        className="rounded-2xl border border-gray-700/70 bg-gray-900/50 p-5 shadow-xl backdrop-blur-sm"
      >
        <label className="mb-2 block text-sm font-medium text-gray-300">What feels suspicious?</label>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Describe why this content may be fake, misleading, or manipulated..."
          className="min-h-24 w-full rounded-xl border border-gray-700 bg-gray-950/70 px-4 py-3 text-sm text-gray-100 outline-none transition focus:border-cyan-500/60"
        />

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-700 bg-gray-800/60 px-4 py-2 text-sm text-gray-200 transition hover:border-cyan-500/50">
            <Upload className="size-4" />
            Attach image/video
            <input type="file" accept="image/*,video/*" className="hidden" onChange={onSelectFile} />
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:from-cyan-500 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Publish Alert
          </button>
        </div>

        {selectedFile && (
          <p className="mt-3 text-xs text-cyan-300">
            Attached: {selectedFile.name}
          </p>
        )}

        {previewUrl && (
          <div className="mt-4 overflow-hidden rounded-xl border border-gray-700">
            {selectedFile?.type.startsWith("image/") ? (
              <img src={previewUrl} alt="Selected content preview" className="max-h-72 w-full object-contain bg-black" />
            ) : (
              <video src={previewUrl} controls className="max-h-80 w-full bg-black" />
            )}
          </div>
        )}
      </form>

      {feedError && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-950/40 p-3 text-sm text-red-200">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{feedError}</span>
        </div>
      )}

      <div className="space-y-4">
        {isLoading && (
          <div className="rounded-2xl border border-gray-700 bg-gray-900/40 p-5 text-sm text-gray-300">
            Loading community feed...
          </div>
        )}

        {!isLoading && posts.length === 0 && (
          <div className="rounded-2xl border border-gray-700 bg-gray-900/40 p-6 text-center text-sm text-gray-300">
            No community alerts yet. Be the first to share suspicious content.
          </div>
        )}

        {posts.map((post) => {
          const likedByMe = post.likes.includes(user.email);
          const dislikedByMe = post.dislikes.includes(user.email);

          return (
            <article key={post.id} className="rounded-2xl border border-gray-700/70 bg-gradient-to-br from-gray-900/80 to-gray-950/70 p-5 shadow-lg">
              <header className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{post.authorName}</p>
                  <p className="text-xs text-gray-500">{formatTime(post.createdAt)}</p>
                </div>
                <span className="rounded-full border border-gray-700 px-2 py-1 text-xs text-gray-400">Awareness Post</span>
              </header>

              {post.text && <p className="whitespace-pre-wrap text-sm leading-6 text-gray-100">{post.text}</p>}

              {post.mediaUrl && (
                <div className="mt-4 overflow-hidden rounded-xl border border-gray-700 bg-black/70">
                  {post.mediaType === "image" ? (
                    <img src={post.mediaUrl} alt={post.mediaName || "Suspicious upload"} className="max-h-96 w-full object-contain" />
                  ) : (
                    <video src={post.mediaUrl} controls className="max-h-96 w-full" />
                  )}
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleReaction(post.id, "like")}
                  disabled={pendingReactionId === post.id}
                  className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs transition ${
                    likedByMe
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                  }`}
                >
                  <ThumbsUp className="size-4" /> {post.likes.length}
                </button>

                <button
                  onClick={() => handleReaction(post.id, "dislike")}
                  disabled={pendingReactionId === post.id}
                  className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs transition ${
                    dislikedByMe
                      ? "bg-rose-500/20 text-rose-300"
                      : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                  }`}
                >
                  <ThumbsDown className="size-4" /> {post.dislikes.length}
                </button>

                <span className="inline-flex items-center gap-1 rounded-lg bg-gray-800 px-3 py-1.5 text-xs text-gray-300">
                  <MessageCircle className="size-4" /> {post.comments.length}
                </span>

                {post.mediaType === "image" && <ImagePlus className="size-4 text-cyan-400" />}
                {post.mediaType === "video" && <Video className="size-4 text-blue-400" />}
              </div>

              <div className="mt-4 space-y-3 border-t border-gray-800 pt-4">
                {post.comments.map((comment) => (
                  <div key={comment.id} className="rounded-lg bg-gray-900/70 p-3">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-cyan-300">{comment.authorName}</p>
                      <p className="text-xs text-gray-500">{formatTime(comment.createdAt)}</p>
                    </div>
                    <p className="text-sm text-gray-100">{comment.text}</p>
                  </div>
                ))}

                <div className="flex gap-2">
                  <input
                    value={commentDrafts[post.id] || ""}
                    onChange={(event) =>
                      setCommentDrafts((previous) => ({
                        ...previous,
                        [post.id]: event.target.value,
                      }))
                    }
                    placeholder="Add a comment"
                    className="flex-1 rounded-lg border border-gray-700 bg-gray-950/60 px-3 py-2 text-sm text-gray-100 outline-none transition focus:border-cyan-500/50"
                  />
                  <button
                    type="button"
                    onClick={() => handleComment(post.id)}
                    disabled={pendingCommentId === post.id}
                    className="inline-flex items-center rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {pendingCommentId === post.id ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
