/**
 * Smart Text-to-Speech (TTS) & Speech Recognition Utility
 * Đồng bộ 100% giọng đọc chuẩn xác giữa Laptop (Windows/Mac) và Điện thoại (iOS/Android)
 * bằng cách ưu tiên luồng Cloud Neural TTS (/api/tts) thống nhất trên mọi thiết bị,
 * và chỉ dùng Web Speech API của hệ điều hành làm phương án dự phòng khi mất mạng.
 */

const VIETNAMESE_DIACRITIC_REGEX =
  /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i;

/**
 * Nhận diện ngôn ngữ thông minh từ văn bản cần đọc:
 * - Tiếng Nhật (Hiragana / Katakana) -> ja-JP
 * - Tiếng Hàn (Hangul) -> ko-KR
 * - Tiếng Trung (Hán tự CJK) -> zh-CN (Phổ thông chuẩn)
 * - Tiếng Việt (có dấu thanh/chữ cái tiếng Việt) -> vi-VN
 * - Mặc định -> en-US (Tiếng Anh chuẩn)
 */
export function detectTextLang(text: string): string {
  if (!text) return "en-US";
  // Japanese Hiragana / Katakana
  if (/[\u3040-\u30ff]/.test(text)) return "ja-JP";
  // Korean Hangul
  if (/[\uac00-\ud7af\u1100-\u11ff]/.test(text)) return "ko-KR";
  // Chinese Hanzi (CJK Unified Ideographs)
  if (/[\u4e00-\u9fff]/.test(text)) return "zh-CN";
  // Vietnamese diacritics check
  if (VIETNAMESE_DIACRITIC_REGEX.test(text)) return "vi-VN";
  // Default English
  return "en-US";
}

/**
 * Làm sạch văn bản trước khi đọc:
 * - Loại bỏ ký tự Markdown (_ * # ` ~)
 * - Nếu chuỗi vừa có từ vựng vừa kèm phiên âm IPA trong cặp dấu gạch chéo /.../ (ví dụ: "abandon /əˈbændən/"),
 *   tự động lược bỏ phần /.../ để máy không đọc đánh vần từng ký hiệu phiên âm.
 */
export function cleanTextForSpeech(text: string): string {
  if (!text) return "";
  let cleaned = text
    // Xóa phiên âm IPA dạng /.../ nếu phía trước hoặc sau vẫn còn chữ cái
    .replace(/(?<=\S\s+)\/[^/\n]{1,40}\//g, " ")
    .replace(/[_*#`~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    cleaned = text.replace(/[_*#`~]/g, " ").replace(/\s+/g, " ").trim();
  }
  return cleaned;
}

/**
 * Khử lỗi lặp chữ cộng dồn (cumulative duplicate transcript) của Web Speech API trên Chrome Android.
 * Trên điện thoại Android, `event.results[i][0].transcript` thường chứa lại toàn bộ câu của các đoạn trước đó
 * (ví dụ: results[0]="hello", results[1]="hello world" -> nếu cộng chuỗi thường sẽ thành "hellohello world").
 */
export function extractCleanSpeechTranscript(results: any): string {
  if (!results || typeof results.length !== "number") return "";
  const pieces: string[] = [];

  for (let i = 0; i < results.length; i++) {
    const rawPiece = String(results[i]?.[0]?.transcript || "").trim();
    if (!rawPiece) continue;

    if (pieces.length === 0) {
      pieces.push(rawPiece);
      continue;
    }

    const prev = pieces[pieces.length - 1];
    const prevLower = prev.toLowerCase();
    const rawLower = rawPiece.toLowerCase();

    // Trường hợp 1: Đoạn mới đã bao hàm toàn bộ đoạn trước đó (Android Chrome cumulative bug)
    if (rawLower.startsWith(prevLower)) {
      pieces[pieces.length - 1] = rawPiece;
      continue;
    }

    // Trường hợp 2: Đoạn mới trùng hệt đoạn trước
    if (rawLower === prevLower) {
      continue;
    }

    // Trường hợp 3: Đoạn trước đã bao hàm đoạn mới (interim ngắn hơn) -> bỏ qua nếu không phải kết quả cuối
    if (prevLower.startsWith(rawLower) && !results[i]?.isFinal) {
      continue;
    }

    pieces.push(rawPiece);
  }

  return pieces.join(" ").replace(/\s+/g, " ").trim();
}

let activeAudioElement: HTMLAudioElement | null = null;
let currentPlayingText: string = "";
let currentPlaySessionId = 0;
let preferredEnglishVoiceAccent: "en-US" | "en-GB" = "en-US";
let preferredChineseVoiceAccent: "zh-CN" | "zh-TW" = "zh-CN";
let preferredPlaybackRate: number = 1.0;

export function setTtsVoiceConfig(config: {
  accent?: "en-US" | "en-GB";
  chineseAccent?: "zh-CN" | "zh-TW";
  rate?: number;
}) {
  if (config.accent) preferredEnglishVoiceAccent = config.accent;
  if (config.chineseAccent) preferredChineseVoiceAccent = config.chineseAccent;
  if (typeof config.rate === "number" && config.rate >= 0.6 && config.rate <= 1.5) {
    preferredPlaybackRate = config.rate;
  }
}

export function getTtsVoiceConfig() {
  return {
    accent: preferredEnglishVoiceAccent,
    chineseAccent: preferredChineseVoiceAccent,
    rate: preferredPlaybackRate,
  };
}

function emitTtsStatus(isPlaying: boolean, text: string = "") {
  currentPlayingText = isPlaying ? text : "";
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("bookmind-tts-status", {
        detail: { isPlaying, text: currentPlayingText },
      })
    );
  }
}

/**
 * Dừng toàn bộ âm thanh TTS đang phát (cả Cloud Audio lẫn Browser SpeechSynthesis).
 */
export function stopAllSpeech(): void {
  currentPlaySessionId += 1;
  if (typeof window === "undefined") return;

  try {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  } catch {
    // ignore
  }

  if (activeAudioElement) {
    try {
      activeAudioElement.onended = null;
      activeAudioElement.onerror = null;
      activeAudioElement.pause();
      activeAudioElement.currentTime = 0;
      activeAudioElement.removeAttribute("src");
    } catch {
      // ignore
    }
    activeAudioElement = null;
  }

  emitTtsStatus(false, "");
}

/**
 * Phương án dự phòng Offline bằng giọng đọc của trình duyệt (chỉ kích hoạt khi mất kết nối tới /api/tts).
 */
function playBrowserOfflineFallback(
  text: string,
  lang: string,
  sessionId: number
): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    emitTtsStatus(false, "");
    return;
  }

  const runSynthesis = () => {
    if (sessionId !== currentPlaySessionId) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = lang.startsWith("zh") || lang.startsWith("ja") ? 0.92 : 0.96;

      const voices = window.speechSynthesis.getVoices() || [];
      const prefix = lang.split("-")[0].toLowerCase();
      const matchingVoices = voices.filter((v) =>
        v.lang.toLowerCase().replace("_", "-").startsWith(prefix)
      );

      // Ưu tiên giọng Google / Natural / Online / Microsoft / Apple đúng ngôn ngữ
      const preferredVoice =
        matchingVoices.find((v) =>
          /natural|online|google|siri|samantha|aria|jenny|guy|xiaoxiao|yunxi|hoaimy|namminh/i.test(
            v.name
          )
        ) || matchingVoices[0];

      if (preferredVoice) {
        utterance.voice = preferredVoice;
        utterance.lang = preferredVoice.lang;
      }

      utterance.onstart = () => {
        if (sessionId === currentPlaySessionId) {
          emitTtsStatus(true, text);
        }
      };

      utterance.onend = () => {
        if (sessionId === currentPlaySessionId) {
          emitTtsStatus(false, "");
        }
      };

      utterance.onerror = () => {
        if (sessionId === currentPlaySessionId) {
          emitTtsStatus(false, "");
        }
      };

      emitTtsStatus(true, text);
      window.speechSynthesis.speak(utterance);
    } catch {
      emitTtsStatus(false, "");
    }
  };

  const existingVoices = window.speechSynthesis.getVoices();
  if (existingVoices && existingVoices.length > 0) {
    runSynthesis();
  } else {
    let handled = false;
    const onVoicesChanged = () => {
      if (handled) return;
      handled = true;
      window.speechSynthesis.removeEventListener("voiceschanged", onVoicesChanged);
      runSynthesis();
    };
    window.speechSynthesis.addEventListener("voiceschanged", onVoicesChanged);
    setTimeout(() => {
      if (!handled) {
        handled = true;
        window.speechSynthesis.removeEventListener("voiceschanged", onVoicesChanged);
        runSynthesis();
      }
    }, 250);
  }
}

/**
 * Phát âm văn bản chuẩn xác, đồng nhất 100% giữa Laptop và Điện thoại:
 * - Luôn ưu tiên phát qua luồng âm thanh chuẩn `/api/tts` để cả Laptop và Mobile
 *   đều phát ra cùng một giọng đọc chuẩn bản xứ (không bị phụ thuộc vào bộ giọng đọc nội bộ của điện thoại).
 * - Nếu bấm lại khi đang đọc: dừng câu hiện tại và đọc lại từ đầu.
 */
export function speakSmart(
  text: string,
  event?: { stopPropagation?: () => void },
  preferredLang?: string
): void {
  if (event?.stopPropagation) {
    event.stopPropagation();
  }
  if (typeof window === "undefined") return;

  const cleaned = cleanTextForSpeech(text);
  if (!cleaned) return;

  // Dừng mọi âm thanh đang phát trước khi bắt đầu lượt mới
  stopAllSpeech();

  const sessionId = currentPlaySessionId;
  const detectedLang = detectTextLang(cleaned);
  const langCode =
    preferredLang ||
    (detectedLang === "en-US"
      ? preferredEnglishVoiceAccent
      : detectedLang === "zh-CN"
      ? preferredChineseVoiceAccent
      : detectedLang);

  try {
    const audioUrl = `/api/tts?text=${encodeURIComponent(
      cleaned.slice(0, 1800)
    )}&lang=${encodeURIComponent(langCode)}`;

    const audio = new Audio(audioUrl);
    (audio as any).playsInline = true;
    audio.preload = "auto";
    audio.playbackRate = preferredPlaybackRate;
    activeAudioElement = audio;

    emitTtsStatus(true, cleaned);

    audio.onended = () => {
      if (sessionId === currentPlaySessionId) {
        activeAudioElement = null;
        emitTtsStatus(false, "");
      }
    };

    audio.onerror = () => {
      if (sessionId === currentPlaySessionId) {
        activeAudioElement = null;
        playBrowserOfflineFallback(cleaned, langCode, sessionId);
      }
    };

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        if (sessionId === currentPlaySessionId) {
          activeAudioElement = null;
          playBrowserOfflineFallback(cleaned, langCode, sessionId);
        }
      });
    }
  } catch {
    playBrowserOfflineFallback(cleaned, langCode, sessionId);
  }
}
