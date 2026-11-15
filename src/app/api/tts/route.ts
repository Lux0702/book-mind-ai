import { NextRequest, NextResponse } from "next/server";

function normalizeTtsLang(rawLang: string): string {
  const lower = (rawLang || "en-US").toLowerCase();
  if (lower.startsWith("zh")) return "zh-CN";
  if (lower.startsWith("ja")) return "ja";
  if (lower.startsWith("ko")) return "ko";
  if (lower.startsWith("vi")) return "vi";
  if (lower.startsWith("fr")) return "fr";
  if (lower.startsWith("de")) return "de";
  if (lower.startsWith("es")) return "es";
  return "en";
}

/**
 * Chia văn bản dài thành các đoạn <= 180 ký tự theo dấu câu tự nhiên
 * để ghép nối MP3 mượt mà trên cả Laptop lẫn Mobile (iOS Safari / Android Chrome).
 */
function splitTextIntoChunks(input: string, maxLen = 180): string[] {
  const cleaned = input.replace(/\s+/g, " ").trim().slice(0, 1800);
  if (!cleaned) return [];
  if (cleaned.length <= maxLen) return [cleaned];

  const sentences = cleaned.split(/(?<=[.!?。！？；;:\n])\s+/);
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (!sentence) continue;
    if ((current + " " + sentence).trim().length <= maxLen) {
      current = (current + " " + sentence).trim();
    } else {
      if (current) chunks.push(current);
      if (sentence.length <= maxLen) {
        current = sentence.trim();
      } else {
        // Nếu 1 câu quá dài, tách tiếp theo dấu phẩy hoặc khoảng trắng
        const words = sentence.split(/\s+/);
        let sub = "";
        for (const w of words) {
          if ((sub + " " + w).trim().length <= maxLen) {
            sub = (sub + " " + w).trim();
          } else {
            if (sub) chunks.push(sub);
            sub = w.slice(0, maxLen);
          }
        }
        current = sub;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

async function fetchSingleTtsChunk(chunk: string, tl: string): Promise<Uint8Array> {
  const endpoints = [
    `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(tl)}&q=${encodeURIComponent(chunk)}`,
    `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(chunk)}`,
  ];

  for (const url of endpoints) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
          Referer: "https://translate.google.com/",
        },
      });
      if (response.ok) {
        const buf = await response.arrayBuffer();
        if (buf.byteLength > 0) {
          return new Uint8Array(buf);
        }
      }
    } catch {
      // Thử endpoint dự phòng tiếp theo
    }
  }
  throw new Error("TTS upstream error");
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const text = searchParams.get("text") || "";
  const lang = searchParams.get("lang") || "en-US";

  if (!text.trim()) {
    return new NextResponse("Missing text", { status: 400 });
  }

  try {
    const tl = normalizeTtsLang(lang);
    const chunks = splitTextIntoChunks(text, 180);
    if (chunks.length === 0) {
      return new NextResponse("Empty text", { status: 400 });
    }

    const buffers: Uint8Array[] = [];
    let totalLength = 0;

    for (const chunk of chunks) {
      const buf = await fetchSingleTtsChunk(chunk, tl);
      buffers.push(buf);
      totalLength += buf.byteLength;
    }

    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const buf of buffers) {
      combined.set(buf, offset);
      offset += buf.byteLength;
    }

    return new NextResponse(combined.buffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(combined.byteLength),
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new NextResponse("TTS failed", { status: 502 });
  }
}
