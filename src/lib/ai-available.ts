// Deliberately free of imports. Reading this one flag used to pull in the
// whole AI module, and with it sharp and the PDF engine, which meant any page
// asking "is AI configured?" also had to load native binaries at import time.
export function aiAvailable(): boolean {
  return !!process.env.GEMINI_API_KEY;
}
