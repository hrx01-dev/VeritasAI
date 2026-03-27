const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
const API_BASE_URL = (viteEnv?.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

export type VeritasConnectUser = {
  name: string;
  email: string;
};

export type VeritasConnectComment = {
  id: string;
  authorName: string;
  authorEmail: string;
  text: string;
  createdAt: string;
};

export type VeritasConnectPost = {
  id: string;
  authorName: string;
  authorEmail: string;
  text: string;
  mediaUrl: string | null;
  mediaType: "image" | "video" | null;
  mediaName: string | null;
  likes: string[];
  dislikes: string[];
  comments: VeritasConnectComment[];
  createdAt: string;
};

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function parseError(response: Response, fallback: string): Promise<never> {
  let message = fallback;
  try {
    const payload = (await response.json()) as { detail?: string; message?: string };
    message = payload.detail || payload.message || message;
  } catch {
    // Keep fallback message
  }

  throw new Error(message);
}

async function uploadMediaViaBackend(file: File): Promise<{ url: string; mediaType: "image" | "video"; mediaName: string }> {
  const formData = new FormData();
  formData.append("file", file, sanitizeFileName(file.name || "upload"));

  const response = await fetch(`${API_BASE_URL}/api/veritasconnect/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    let message = "Unable to upload media file.";
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload.detail) {
        message = payload.detail;
      }
    } catch {
      // Keep fallback message
    }
    throw new Error(message);
  }

  return response.json() as Promise<{ url: string; mediaType: "image" | "video"; mediaName: string }>;
}

export function subscribeToVeritasConnectPosts(
  onData: (posts: VeritasConnectPost[]) => void,
  onError: (error: Error) => void,
): () => void {
  let active = true;

  const load = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/veritasconnect/posts`);
      if (!response.ok) {
        await parseError(response, "Unable to load VeritasConnect posts.");
      }

      const posts = (await response.json()) as VeritasConnectPost[];
      if (active) {
        onData(posts);
      }
    } catch (err) {
      if (active) {
        onError(err instanceof Error ? err : new Error("Unable to load VeritasConnect posts."));
      }
    }
  };

  void load();
  const timer = setInterval(() => {
    void load();
  }, 3000);

  return () => {
    active = false;
    clearInterval(timer);
  };
}

export async function createVeritasConnectPost(payload: {
  text: string;
  file: File | null;
  user: VeritasConnectUser;
}): Promise<void> {
  const message = payload.text.trim();

  if (!message && !payload.file) {
    throw new Error("Please add a description or upload a file.");
  }

  let mediaUrl: string | null = null;
  let mediaType: "image" | "video" | null = null;
  let mediaName: string | null = null;

  if (payload.file) {
    if (!payload.file.type.startsWith("image/") && !payload.file.type.startsWith("video/")) {
      throw new Error("Only image and video uploads are supported.");
    }

    const uploaded = await uploadMediaViaBackend(payload.file);
    mediaUrl = uploaded.url;
    mediaType = uploaded.mediaType;
    mediaName = uploaded.mediaName;
  }

  const response = await fetch(`${API_BASE_URL}/api/veritasconnect/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      authorName: payload.user.name.trim() || "Anonymous",
      authorEmail: payload.user.email.trim().toLowerCase(),
      text: message,
      mediaUrl,
      mediaType,
      mediaName,
    }),
  });

  if (!response.ok) {
    await parseError(response, "Unable to publish post.");
  }

  await response.json();
}

export async function setVeritasConnectReaction(payload: {
  postId: string;
  reaction: "like" | "dislike";
  userEmail: string;
}): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/veritasconnect/posts/${payload.postId}/reaction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userEmail: payload.userEmail.trim().toLowerCase(),
      reaction: payload.reaction,
    }),
  });

  if (!response.ok) {
    await parseError(response, "Unable to save reaction.");
  }

  await response.json();
}

export async function addVeritasConnectComment(payload: {
  postId: string;
  text: string;
  user: VeritasConnectUser;
}): Promise<void> {
  const trimmed = payload.text.trim();
  if (!trimmed) {
    throw new Error("Comment cannot be empty.");
  }

  const response = await fetch(`${API_BASE_URL}/api/veritasconnect/posts/${payload.postId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      authorName: payload.user.name.trim() || "Anonymous",
      authorEmail: payload.user.email.trim().toLowerCase(),
      text: trimmed,
    }),
  });

  if (!response.ok) {
    await parseError(response, "Unable to add comment.");
  }

  await response.json();
}
