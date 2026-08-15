import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Feature softball/about, Slice 3 — board-member photo uploads to Supabase Storage.
//
// SERVER ONLY. The upload runs inside the board Server Actions through the editor SESSION
// client, so the 0009 storage RLS (editor-only write, public read) is the real boundary —
// there is NO service-key path here. Object keys are server-generated randoms (never the
// client filename → no path traversal). We validate BOTH the declared content-type AND the
// file's MAGIC BYTES (content-type is client-controlled and spoofable), reject anything
// that is not a real JPEG/PNG/WebP (so SVG — the stored-XSS vector — can never land), and
// cap the size. next.config images.remotePatterns is the paired render-side change.
// ---------------------------------------------------------------------------

export const BOARD_PHOTOS_BUCKET = "board-photos";
export const BOARD_PHOTO_MAX_BYTES = 2 * 1024 * 1024; // 2 MB

// The only accepted image types, mapped to their canonical file extension. SVG is
// deliberately absent (it can carry script — stored XSS) and next/image keeps
// dangerouslyAllowSVG off, so an SVG is rejected at BOTH ends.
const ALLOWED: Record<string, "jpg" | "png" | "webp"> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Thrown when the file fails validation (type/size/magic-bytes). A distinct type so the
// Server Action maps it to a friendly form error instead of a 500.
export class BoardPhotoUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BoardPhotoUploadError";
  }
}

// Sniff the real image type from the leading bytes. Returns the canonical extension, or
// null if the bytes are not a JPEG/PNG/WebP — regardless of what content-type was claimed.
function sniffImage(buf: Uint8Array): "jpg" | "png" | "webp" | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
    return "jpg";
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  )
    return "png";
  // RIFF....WEBP
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  )
    return "webp";
  return null;
}

// The public URL base for the bucket, derived from the (browser-safe) project URL.
export function boardPhotoPublicBase(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  return `${url.replace(/\/$/, "")}/storage/v1/object/public/${BOARD_PHOTOS_BUCKET}/`;
}

// True if `photoUrl` is a public URL for an object in our board-photos bucket.
export function isBoardPhotoStorageUrl(
  photoUrl: string | null | undefined,
): boolean {
  return !!photoUrl && photoUrl.startsWith(boardPhotoPublicBase());
}

// Validate + upload one image File through the given (editor session) client. Returns the
// object's public URL to store in board_members.photo_url. Throws BoardPhotoUploadError on
// a bad file; storage/RLS errors (e.g. a non-editor) propagate as the client's error.
export async function uploadBoardPhoto(
  file: File,
  supabase: SupabaseClient,
): Promise<string> {
  if (!(file instanceof File) || file.size === 0) {
    throw new BoardPhotoUploadError("Choose an image file to upload.");
  }
  if (file.size > BOARD_PHOTO_MAX_BYTES) {
    throw new BoardPhotoUploadError("Image must be 2 MB or smaller.");
  }
  // Declared type must be allowed AND the bytes must actually be that kind of image.
  if (!ALLOWED[file.type]) {
    throw new BoardPhotoUploadError("Image must be a JPEG, PNG, or WebP.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length > BOARD_PHOTO_MAX_BYTES) {
    throw new BoardPhotoUploadError("Image must be 2 MB or smaller.");
  }
  const sniffed = sniffImage(bytes);
  if (!sniffed) {
    throw new BoardPhotoUploadError(
      "That file is not a valid JPEG, PNG, or WebP image.",
    );
  }
  const contentType =
    sniffed === "jpg" ? "image/jpeg" : sniffed === "png" ? "image/png" : "image/webp";
  const key = `${randomUUID()}.${sniffed}`;

  const { error } = await supabase.storage
    .from(BOARD_PHOTOS_BUCKET)
    .upload(key, bytes, { contentType, upsert: false });
  if (error) throw error; // RLS denial (non-editor) or transport error → caller handles.

  const { data } = supabase.storage.from(BOARD_PHOTOS_BUCKET).getPublicUrl(key);
  return data.publicUrl;
}

// Best-effort delete of a previously-stored board photo when it is replaced or cleared.
// Only touches our own bucket URLs; never throws (an orphaned object is not worth failing
// the member write over — worst case it is a stray file, cleaned up later).
export async function deleteBoardPhotoByUrl(
  photoUrl: string | null | undefined,
  supabase: SupabaseClient,
): Promise<void> {
  if (!isBoardPhotoStorageUrl(photoUrl)) return;
  const key = photoUrl!.slice(boardPhotoPublicBase().length);
  if (!key) return;
  try {
    await supabase.storage.from(BOARD_PHOTOS_BUCKET).remove([key]);
  } catch {
    // swallow — best effort
  }
}
