// Shared check for the selfie endpoints: the page sends the photo as a JPEG data URL.
// Files starting with "_" in api/ are not exposed as their own endpoints on Vercel.
const MAX_BYTES = 3 * 1024 * 1024; // Vercel caps request bodies at 4.5 MB; base64 adds a third

export function readJpeg(image) {
  if (typeof image !== "string" || !image.startsWith("data:image/jpeg;base64,")) return null;
  const buffer = Buffer.from(image.slice("data:image/jpeg;base64,".length), "base64");
  // Every JPEG starts with FF D8 FF; this rejects anything that is not a photo.
  if (buffer.length < 1000 || buffer.length > MAX_BYTES) return null;
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[2] !== 0xff) return null;
  return buffer;
}
