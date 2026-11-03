// Vercel serverless function: stores a booth selfie in Vercel Blob and returns its
// public link, which the page shows as a QR code for the visitor to scan.
// Needs BLOB_READ_WRITE_TOKEN (added automatically when a Blob store is connected).
// api/cleanup-selfies.js deletes the photos again after a day.
import { put } from "@vercel/blob";
import { readJpeg } from "./_selfie.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST" });
  }

  const photo = readJpeg(req.body?.image);
  if (!photo) return res.status(400).json({ error: "Missing or invalid photo" });

  try {
    const blob = await put("selfies/bolt-selfie.jpg", photo, {
      access: "public",
      addRandomSuffix: true, // unguessable link, so one visitor cannot find another's photo
      contentType: "image/jpeg",
    });
    return res.status(200).json({ url: blob.url });
  } catch (error) {
    console.error("Selfie upload failed:", error);
    return res.status(502).json({ error: "Upload failed" });
  }
}
