// Downloads every booth selfie (full size) from the live site's gallery list into a folder.
// Usage: node scripts/download-selfies.mjs [folder] [site]
//   folder  where to save (default: ~/Downloads/IDoR2026-selfies)
//   site    the deployed booth (default: https://idor2026.vercel.app)
// Files are named by when they were taken. Photos already in the folder are skipped,
// so it can be run again later to fetch only the new ones.
import { mkdir, writeFile, access } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const dir = process.argv[2] || join(homedir(), "Downloads", "IDoR2026-selfies");
const site = (process.argv[3] || "https://idor2026.vercel.app").replace(/\/$/, "");

const res = await fetch(`${site}/api/selfies`);
if (!res.ok) throw new Error(`Gallery list failed: HTTP ${res.status}`);
const { photos } = await res.json();
await mkdir(dir, { recursive: true });

let saved = 0, skipped = 0, failed = 0;
for (const p of photos) {
  // e.g. 2026-11-20_12-10-17_ab12cd.jpg (local time, plus part of the original name so names never clash)
  const t = new Date(p.uploadedAt), pad = (n) => String(n).padStart(2, "0");
  const stamp = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}_${pad(t.getHours())}-${pad(t.getMinutes())}-${pad(t.getSeconds())}`;
  const base = decodeURIComponent(new URL(p.url).pathname.split("/").pop()).replace(/\.[a-z]+$/i, "").replace(/[^\w-]/g, "").slice(-6);
  const file = join(dir, `${stamp}_${base}.jpg`);
  if (await access(file).then(() => true, () => false)) { skipped++; continue; }
  try {
    const r = await fetch(p.url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    await writeFile(file, Buffer.from(await r.arrayBuffer()));
    saved++;
  } catch (e) {
    failed++;
    console.error(`Could not download ${p.url}: ${e.message}`);
  }
}
console.log(`${photos.length} photos: ${saved} saved, ${skipped} already there, ${failed} failed -> ${dir}`);
