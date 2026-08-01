import sharp from "sharp";

export type RenderedPage = {
  png: Buffer; // full-quality page, used for cropping diagrams
  jpeg: Buffer; // compressed copy, sent to Gemini
  width: number;
  height: number;
  // Embedded text is exact where OCR only guesses, which matters for long
  // stimulus passages. Link URIs are invisible once a page is rasterised, so
  // a hyperlinked video would otherwise be lost entirely.
  text: string;
  links: string[];
};

const MAX_PAGES = 15;
const SCALE = 2; // ~144 DPI, keeps diagram crops sharp

// Renders a PDF (via mupdf, WASM) or a single image into page bitmaps.
// Returns null for formats we cannot rasterise (docx, txt, ...).
export async function renderPages(buffer: Buffer, mimeType: string): Promise<RenderedPage[] | null> {
  if (mimeType === "application/pdf") {
    const mupdf = await import("mupdf");
    const doc = mupdf.Document.openDocument(buffer, "application/pdf");
    const count = Math.min(doc.countPages(), MAX_PAGES);
    const pages: RenderedPage[] = [];
    for (let i = 0; i < count; i++) {
      const page = doc.loadPage(i);
      const pixmap = page.toPixmap(
        mupdf.Matrix.scale(SCALE, SCALE),
        mupdf.ColorSpace.DeviceRGB,
        false,
        true
      );
      const png = Buffer.from(pixmap.asPNG());
      const jpeg = await sharp(png).jpeg({ quality: 70 }).toBuffer();

      let text = "";
      try {
        text = page.toStructuredText("preserve-whitespace").asText();
      } catch {
        // Scanned pages have no embedded text; the vision model handles those.
      }

      let links: string[] = [];
      try {
        links = page
          .getLinks()
          .map((link) => (typeof link.getURI === "function" ? link.getURI() : ""))
          .filter(Boolean);
      } catch {
        // Not all documents carry link annotations.
      }

      pages.push({
        png,
        jpeg,
        width: pixmap.getWidth(),
        height: pixmap.getHeight(),
        text,
        links,
      });
      pixmap.destroy();
      page.destroy();
    }
    doc.destroy();
    return pages;
  }

  if (mimeType.startsWith("image/")) {
    const img = sharp(buffer);
    const meta = await img.metadata();
    const png = await img.png().toBuffer();
    const jpeg = await sharp(buffer).jpeg({ quality: 75 }).toBuffer();
    return [
      { png, jpeg, width: meta.width ?? 0, height: meta.height ?? 0, text: "", links: [] },
    ];
  }

  return null;
}

export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// Gemini cannot ingest .docx directly, so convert it to HTML text plus a list
// of the embedded images (each re-encoded as JPEG, capped in size).
export async function docxToParts(buffer: Buffer): Promise<{ html: string; images: string[] }> {
  const mammoth = (await import("mammoth")).default;
  const raw: { mime: string; base64: string }[] = [];

  const result = await mammoth.convertToHtml(
    { buffer },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const base64 = await image.read("base64");
        raw.push({ mime: image.contentType ?? "image/png", base64 });
        return { src: `[embedded image ${raw.length - 1}]` };
      }),
    }
  );

  const images: string[] = [];
  for (const r of raw) {
    try {
      const jpeg = await sharp(Buffer.from(r.base64, "base64"))
        .resize({ width: 1600, withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
      images.push(jpeg.toString("base64"));
    } catch {
      // skip images sharp cannot decode (e.g. EMF/WMF vector clips)
    }
  }
  return { html: result.value, images };
}

// Crops a diagram from a rendered page. Box is [ymin, xmin, ymax, xmax]
// normalised to 0-1000, as Gemini returns. Adds a little padding.
export async function cropDiagram(page: RenderedPage, box: number[]): Promise<string | null> {
  const [ymin, xmin, ymax, xmax] = box;
  if (!(ymax > ymin && xmax > xmin)) return null;

  const pad = 8; // in 0-1000 space
  const y0 = Math.max(0, ymin - pad) / 1000;
  const x0 = Math.max(0, xmin - pad) / 1000;
  const y1 = Math.min(1000, ymax + pad) / 1000;
  const x1 = Math.min(1000, xmax + pad) / 1000;

  const left = Math.round(x0 * page.width);
  const top = Math.round(y0 * page.height);
  const width = Math.round((x1 - x0) * page.width);
  const height = Math.round((y1 - y0) * page.height);
  if (width < 20 || height < 20) return null;

  const out = await sharp(page.png)
    .extract({ left, top, width, height })
    .png()
    .toBuffer();
  return `data:image/png;base64,${out.toString("base64")}`;
}
