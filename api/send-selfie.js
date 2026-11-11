// Vercel serverless function: emails a booth selfie to the address the visitor typed.
// Sends through a Gmail account: set GMAIL_USER and GMAIL_APP_PASSWORD in Vercel settings
// (an app password from myaccount.google.com/apppasswords, not the normal password).
// The photo and address are only used to send this one email; nothing is stored.
import nodemailer from "nodemailer";
import { readJpeg } from "./_selfie.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const transport = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST" });
  }

  const { image, email, lang } = req.body ?? {};
  const to = typeof email === "string" ? email.trim() : "";
  if (to.length > 254 || !EMAIL.test(to)) return res.status(400).json({ error: "Invalid email" });
  const photo = readJpeg(image);
  if (!photo) return res.status(400).json({ error: "Missing or invalid photo" });

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.error("GMAIL_USER / GMAIL_APP_PASSWORD not set");
    return res.status(503).json({ error: "Email not configured" });
  }

  const malay = lang === "ms";
  try {
    await transport.sendMail({
      from: `"Fiffy @ Reruai Perlindungan Sinaran" <${process.env.GMAIL_USER}>`,
      to,
      subject: malay ? "Swafoto anda bersama Fiffy 📸" : "Your selfie with Fiffy 📸",
      text: malay
        ? "Terima kasih kerana melawat Reruai Perlindungan Sinaran sempena Hari Radiologi Antarabangsa! Swafoto anda bersama Fiffy dilampirkan.\n\nIngat: masa, jarak dan pelindung memastikan kita selamat daripada sinaran.\n\n— Jabatan Radiologi, Hospital Tunku Azizah"
        : "Thank you for visiting the Radiation Protection Booth for International Day of Radiology! Your selfie with Fiffy is attached.\n\nRemember: time, distance and shielding keep us safe from radiation.\n\n— Radiology Department, Hospital Tunku Azizah",
      attachments: [{ filename: "selfie-with-bolt.jpg", content: photo, contentType: "image/jpeg" }],
    });
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Selfie email failed:", error.message);
    return res.status(502).json({ error: "Send failed" });
  }
}
