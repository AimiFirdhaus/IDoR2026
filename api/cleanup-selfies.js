// Vercel cron job (see vercel.json): deletes QR selfies older than a day, so visitors'
// photos are not kept after the event. Vercel calls it with CRON_SECRET as a bearer token.
import { list, del } from "@vercel/blob";

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export default async function handler(req, res) {
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const cutoff = Date.now() - MAX_AGE_MS;
  let deleted = 0;
  for (const prefix of ["selfies/", "thumbs/"]) {
    let cursor;
    do {
      const page = await list({ prefix, cursor, limit: 1000 });
      const old = page.blobs.filter((b) => new Date(b.uploadedAt).getTime() < cutoff).map((b) => b.url);
      if (old.length) await del(old);
      deleted += old.length;
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
  }

  return res.status(200).json({ deleted });
}
