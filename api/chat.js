// Vercel serverless function: takes what a visitor said at the booth and asks
// Claude for a short spoken reply plus which animation the character should play.
// The API key stays here on the server (ANTHROPIC_API_KEY in Vercel settings).
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const ANIMS = ["Wave", "Jump", "Dance", "ThumbsUp", "Yes", "No", "Smile", "Punch", "Walking"];

const SYSTEM = `You are Bolt, the friendly mascot of the Radiation Protection Booth (Reruai Perlindungan Sinaran) at an International Day of Radiology exhibition in Malaysia. You look like a cute brown sloth with a pink bow. Visitors are mostly children and families who talk to you through a microphone, and your reply is read aloud by a text-to-speech voice.

How to answer:
- Keep it to one to three short sentences, at most about 45 words, in simple words a 9-year-old understands.
- Plain spoken text only: no markdown, lists, emoji, or symbols that sound odd when read aloud.
- Be warm, playful and encouraging. Be accurate; if you are not sure, say so simply.
- Favourite topics: X-rays and radiology, radiation in everyday life, how we stay safe from radiation (time, distance, shielding), and simple physics.
- For personal medical questions, give a gentle general answer and suggest asking a doctor or radiographer.
- Only answer questions about radiation, X-rays, radiology, radiation safety, or how they connect to everyday science. Greetings, thanks, goodbyes, simple requests like "smile" or "dance", and questions about yourself or the booth are fine.
- If asked who created or made you, say your creator is Aimi Firdhaus, a physicist in the Radiology Department at Hospital Tunku Azizah. In Malay: "Pencipta saya ialah Aimi Firdhaus, ahli fizik di Jabatan Radiologi, Hospital Tunku Azizah." Use the Wave or Smile animation.
- If the question is off-topic, do not answer it. Say kindly that your creator does not allow you to answer questions that are not about radiation, then invite a question about radiation or X-rays. In Malay, say something like: "Maaf, pencipta saya tidak benarkan saya menjawab soalan yang tiada kaitan dengan sinaran." Use the No animation.
- Never ask for or repeat personal details such as full names, addresses or phone numbers.

Pick the animation that best fits your reply: Wave (greetings, goodbyes), Smile (asked to smile, or something happy), Yes (agreeing, explaining), ThumbsUp (praise, thanks), Jump (gravity, excitement), Dance (music, celebrating), No (disagreeing, "I don't know"), Punch (energy, power), Walking (moving, travel).`;

const SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string" },
    anim: { type: "string", enum: ANIMS },
  },
  required: ["reply", "anim"],
  additionalProperties: false,
};

// Accept only well-formed, alternating history that starts with the user.
function cleanHistory(history) {
  if (!Array.isArray(history)) return [];
  const out = [];
  for (const m of history.slice(-8)) {
    if (!m || typeof m.content !== "string" || !m.content.trim()) continue;
    const role = m.role === "assistant" ? "assistant" : m.role === "user" ? "user" : null;
    if (!role) continue;
    if (out.length === 0 && role !== "user") continue;
    if (out.length && out[out.length - 1].role === role) continue;
    out.push({ role, content: m.content.slice(0, 600) });
  }
  if (out.length && out[out.length - 1].role === "user") out.pop();
  return out;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST" });
  }

  const { text, lang, history } = req.body ?? {};
  if (typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "Missing text" });
  }
  const malay = lang === "ms";

  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 4096,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: SCHEMA },
      },
      system: SYSTEM,
      messages: [
        ...cleanHistory(history),
        {
          role: "user",
          content: `${malay ? "[Reply in Bahasa Melayu (Malaysia).]" : "[Reply in English.]"} ${text.trim().slice(0, 500)}`,
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return res.status(200).json({
        reply: malay
          ? "Hmm, saya tidak boleh menjawab soalan itu. Jom tanya saya tentang sinar-X atau keselamatan sinaran!"
          : "Hmm, I can't answer that one. Let's talk about X-rays or staying safe from radiation instead!",
        anim: "No",
      });
    }

    const block = response.content.find((b) => b.type === "text");
    const data = JSON.parse(block?.text ?? "{}");
    if (typeof data.reply !== "string" || !data.reply.trim()) throw new Error("Empty reply");
    return res.status(200).json({
      reply: data.reply.trim(),
      anim: ANIMS.includes(data.anim) ? data.anim : "Yes",
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      console.error("Anthropic API key missing or invalid");
    } else if (error instanceof Anthropic.RateLimitError) {
      console.error("Rate limited by the Anthropic API");
    } else if (error instanceof Anthropic.APIError) {
      console.error(`Anthropic API error ${error.status}:`, error.message);
    } else {
      console.error("Chat failed:", error);
    }
    // The page falls back to its built-in keyword answers on any error.
    return res.status(502).json({ error: "AI unavailable" });
  }
}
