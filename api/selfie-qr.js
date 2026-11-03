// Vercel serverless function: stores a booth selfie (and a small thumbnail for the
// gallery) in Vercel Blob and returns the photo's public link, which the page shows
// as a QR code. Needs BLOB_READ_WRITE_TOKEN (added when a Blob store is connected).
// api/selfies.js lists the photos; api/cleanup-selfies.js deletes them after a day.
import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { readJpeg } from "./_selfie.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST" });
  }

  const photo = readJpeg(req.body?.image);
  const thumb = readJpeg(req.body?.thumb);
  if (!photo || !thumb) return res.status(400).json({ error: "Missing or invalid photo" });

  // The photo and its thumbnail share a random name so the gallery can pair them up.
  const name = `${randomUUID()}.jpg`;
  const options = { access: "public", addRandomSuffix: false, contentType: "image/jpeg" };
  try {
    const [blob] = await Promise.all([
      put(`selfies/${name}`, photo, options),
      put(`thumbs/${name}`, thumb, options),
    ]);
    return res.status(200).json({ url: blob.url });
  } catch (error) {
    console.error("Selfie upload failed:", error);
    return res.status(502).json({ error: "Upload failed" });
  }
}
