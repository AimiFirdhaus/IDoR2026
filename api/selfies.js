// Vercel serverless function: lists the booth selfies, newest first, for the
// "All photos" gallery so visitors can find their photo again and get its QR code.
import { list } from "@vercel/blob";

async function listAll(prefix) {
  const blobs = [];
  let cursor;
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return blobs;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Use GET" });
  }

  try {
    const [photos, thumbs] = await Promise.all([listAll("selfies/"), listAll("thumbs/")]);
    const thumbByName = new Map(thumbs.map((b) => [b.pathname.slice("thumbs/".length), b.url]));
    const out = photos
      .map((b) => ({
        url: b.url,
        thumb: thumbByName.get(b.pathname.slice("selfies/".length)) ?? b.url,
        uploadedAt: b.uploadedAt,
      }))
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ photos: out });
  } catch (error) {
    console.error("Listing selfies failed:", error);
    return res.status(502).json({ error: "List failed" });
  }
}
