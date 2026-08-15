// Question images are stored inline as data URLs, the same way diagrams
// cropped out of an uploaded task sheet are. That keeps them in one place with
// no object storage to configure, so they must be shrunk before they are kept.

export const MAX_DIMENSION = 1600;
export const MAX_BYTES = 900_000; // per image, after compression
export const MAX_IMAGES_PER_QUESTION = 6;

export type PreparedImage = { dataUrl: string; bytes: number };

function dataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return Math.floor((base64.length * 3) / 4);
}

async function loadBitmap(file: File | Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) return createImageBitmap(file);
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not read that image"));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Scales an image down to fit MAX_DIMENSION and encodes it small enough to
 * store. PNG is kept where it stays compact, since diagrams often rely on a
 * transparent background; photographs fall back to JPEG on white.
 */
export async function prepareImage(file: File | Blob): Promise<PreparedImage> {
  if (!file.type.startsWith("image/")) throw new Error("That file is not an image");

  const source = await loadBitmap(file);
  const width = "width" in source ? source.width : 0;
  const height = "height" in source ? source.height : 0;
  if (!width || !height) throw new Error("That image could not be read");

  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("That image could not be processed");
  ctx.drawImage(source as CanvasImageSource, 0, 0, canvas.width, canvas.height);

  let dataUrl = canvas.toDataURL("image/png");
  if (dataUrlBytes(dataUrl) > MAX_BYTES) {
    // Flatten onto white first, because JPEG has no alpha channel.
    const flat = document.createElement("canvas");
    flat.width = canvas.width;
    flat.height = canvas.height;
    const flatCtx = flat.getContext("2d");
    if (flatCtx) {
      flatCtx.fillStyle = "#ffffff";
      flatCtx.fillRect(0, 0, flat.width, flat.height);
      flatCtx.drawImage(canvas, 0, 0);
      dataUrl = flat.toDataURL("image/jpeg", 0.85);
    }
  }

  const bytes = dataUrlBytes(dataUrl);
  if (bytes > MAX_BYTES)
    throw new Error("That image is too large even after compression. Try a smaller one.");

  return { dataUrl, bytes };
}

/** Pulls every image out of a clipboard paste, if there are any. */
export function imagesFromClipboard(event: ClipboardEvent): File[] {
  const items = event.clipboardData?.items;
  if (!items) return [];
  const files: File[] = [];
  for (const item of items) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }
  return files;
}
