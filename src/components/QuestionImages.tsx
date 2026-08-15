"use client";
import { useRef, useState } from "react";
import { imagesFromClipboard, prepareImage, MAX_IMAGES_PER_QUESTION } from "@/lib/images";

/**
 * Images attached to a question. Accepts a file picker, drag and drop, or a
 * clipboard paste, which is the quickest route when a diagram is being copied
 * out of another document.
 */
export default function QuestionImages({
  images,
  onChange,
}: {
  images: string[];
  onChange: (next: string[]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  async function addFiles(files: File[]) {
    if (files.length === 0) return;
    setError("");
    setBusy(true);
    try {
      const room = MAX_IMAGES_PER_QUESTION - images.length;
      if (room <= 0) {
        setError(`A question can hold ${MAX_IMAGES_PER_QUESTION} images.`);
        return;
      }
      const accepted: string[] = [];
      for (const file of files.slice(0, room)) {
        try {
          const { dataUrl } = await prepareImage(file);
          accepted.push(dataUrl);
        } catch (e) {
          setError(e instanceof Error ? e.message : "That image could not be added");
        }
      }
      if (accepted.length) onChange([...images, ...accepted]);
      if (files.length > room)
        setError(`Only the first ${room} were added. A question holds ${MAX_IMAGES_PER_QUESTION}.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onPaste={(e) => {
        const pasted = imagesFromClipboard(e.nativeEvent);
        if (pasted.length) {
          e.preventDefault();
          addFiles(pasted);
        }
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        addFiles([...e.dataTransfer.files].filter((f) => f.type.startsWith("image/")));
      }}
      // tabIndex makes the area focusable, so a paste can land on it.
      tabIndex={0}
      className={`rounded-lg border border-dashed p-3 transition-colors outline-none focus:border-teal ${
        dragging ? "border-teal bg-tealwash" : "border-line"
      }`}
    >
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {images.map((src, i) => (
            <div key={i} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`Question image ${i + 1}`}
                className="h-24 w-auto rounded-md border border-line bg-white"
              />
              <button
                type="button"
                aria-label={`Remove image ${i + 1}`}
                onClick={() => onChange(images.filter((_, index) => index !== i))}
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-ink text-paper text-xs font-bold shadow hover:opacity-80"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:border-teal disabled:opacity-50 transition-colors"
        >
          {busy ? "Adding" : "Upload image"}
        </button>
        <span className="text-[11px] text-soft">
          or paste with {navigatorIsMac() ? "Cmd" : "Ctrl"} V, or drop a file here
        </span>
      </div>

      <input
        ref={fileRef}
        type="file"
        hidden
        accept="image/*"
        multiple
        onChange={(e) => {
          addFiles([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />

      {error && <p className="mt-2 text-[11px] text-amber">{error}</p>}
    </div>
  );
}

function navigatorIsMac() {
  if (typeof navigator === "undefined") return false;
  return /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);
}
