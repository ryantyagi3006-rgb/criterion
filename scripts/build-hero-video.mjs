/**
 * Builds public/hero.mp4, the scrub-optimised clip behind the login hero.
 *
 * The source is 3840x2160 with sparse keyframes. Scrubbing that in a browser
 * is hopeless: every backward seek re-decodes an 8.3 megapixel frame starting
 * from a distant keyframe, which measured at roughly 1.5 to 9 seeks a second.
 *
 * This downscales to display size and re-encodes with `-g 1`, so every frame
 * is a keyframe and any seek decodes exactly one independent frame.
 *
 * Usage: node scripts/build-hero-video.mjs [sourceUrlOrPath]
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpeg from "ffmpeg-static";

const SOURCE =
  process.argv[2] ??
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260601_110537_3a579fa0-7bbc-4d94-9d25-0e816c7840f5.mp4";

const OUT = new URL("../public/hero.mp4", import.meta.url).pathname;

let input = SOURCE;
if (/^https?:\/\//.test(SOURCE)) {
  const res = await fetch(SOURCE);
  if (!res.ok) throw new Error(`Could not download source: ${res.status}`);
  input = join(mkdtempSync(join(tmpdir(), "hero-")), "source.mp4");
  writeFileSync(input, Buffer.from(await res.arrayBuffer()));
  console.log("Downloaded source clip");
}

execFileSync(
  ffmpeg,
  [
    "-y",
    "-i", input,
    "-vf", "scale=1440:810",
    "-c:v", "libx264",
    "-profile:v", "high",
    "-pix_fmt", "yuv420p",
    // Every frame a keyframe. This is the whole point of the re-encode.
    "-g", "1",
    "-keyint_min", "1",
    "-sc_threshold", "0",
    "-crf", "28",
    "-preset", "slow",
    // The hero is muted, so drop audio entirely.
    "-an",
    "-movflags", "+faststart",
    OUT,
    "-hide_banner",
    "-loglevel", "error",
  ],
  { stdio: "inherit" }
);

console.log(`Wrote ${OUT}`);
