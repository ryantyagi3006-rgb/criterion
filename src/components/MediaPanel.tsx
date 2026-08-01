import { embedUrl, parseMedia, watchUrl, type MediaItem } from "@/lib/youtube";

/** Embedded YouTube players for the videos a question depends on. */
export default function MediaPanel({
  media,
  compact = false,
}: {
  media: string | MediaItem[];
  compact?: boolean;
}) {
  const items = typeof media === "string" ? parseMedia(media) : media;
  if (items.length === 0) return null;

  return (
    <div className={`mt-4 space-y-3 ${compact ? "max-w-md" : ""}`}>
      {items.map((item) => (
        <figure
          key={item.videoId}
          className="rounded-xl border border-line bg-paper overflow-hidden"
        >
          <div className="relative w-full aspect-video bg-black">
            <iframe
              src={embedUrl(item)}
              title={item.title || "Video for this question"}
              className="absolute inset-0 w-full h-full"
              // youtube-nocookie plus a tight allow list: no autoplay, no camera.
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
          <figcaption className="flex items-center justify-between gap-3 px-3 py-2 text-[11px] text-soft">
            <span className="truncate">{item.title || "Watch before answering"}</span>
            <a
              href={watchUrl(item)}
              target="_blank"
              rel="noreferrer noopener"
              className="shrink-0 font-semibold text-teal hover:opacity-70 transition-opacity"
            >
              Open on YouTube
            </a>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
