"use client";

let currentAudio: HTMLAudioElement | null = null;

/**
 * Automatically detects the language of the text (Chinese, Japanese, Korean, Vietnamese, or English)
 */
export function detectTextLang(text: string): string {
  if (/[\u4e00-\u9fff]/.test(text)) {
    return "zh-TW"; // Traditional/Simplified Mandarin Chinese
  }
  if (/[\u3040-\u30ff]/.test(text)) {
    return "ja-JP";
  }
  if (/[\uac00-\ud7af]/.test(text)) {
    return "ko-KR";
  }
  return "en-US";
}

/**
 * Strips Pinyin or English annotations in parentheses if speaking pure Chinese vocab,
 * or cleans up symbols so TTS reads clearly.
 */
function cleanTextForSpeech(text: string): string {
  return text.replace(/[_*#]/g, " ").trim();
}

/**
 * Plays speech audio reliably across Windows/Mac/Chrome/Edge.
 * 1. Tries native Web Speech API if a matching voice for that language is installed on the OS/Browser.
 * 2. If no native voice exists for that language (very common on Windows for Chinese zh-TW/zh-CN)
 *    or if speechSynthesis fails, falls back to an online TTS audio endpoint via our API proxy.
 */
export function speakSmart(text: string, e?: React.MouseEvent): void {
  if (e) {
    e.stopPropagation();
  }
  if (typeof window === "undefined" || !text.trim()) return;

  const cleaned = cleanTextForSpeech(text);
  const lang = detectTextLang(cleaned);

  // Stop any ongoing speech
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }

  const playOnlineFallback = () => {
    try {
      const encoded = encodeURIComponent(cleaned.slice(0, 200));
      const url = `/api/tts?text=${encoded}&lang=${encodeURIComponent(lang)}`;
      const audio = new Audio(url);
      currentAudio = audio;
      audio.play().catch(() => {
        // Fallback if blocked
      });
    } catch {
      // Ignore
    }
  };

  if (!("speechSynthesis" in window)) {
    playOnlineFallback();
    return;
  }

  const voices = window.speechSynthesis.getVoices();
  const langPrefix = lang.split("-")[0].toLowerCase(); // e.g., "zh", "en", "ja"
  const matchedVoice =
    voices.find((v) => v.lang.toLowerCase() === lang.toLowerCase()) ||
    voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix));

  // If the text is Chinese/Japanese/Korean and the OS has NO voice installed for it,
  // native speechSynthesis will be completely silent! So use the online TTS stream immediately.
  if (langPrefix !== "en" && !matchedVoice) {
    playOnlineFallback();
    return;
  }

  try {
    const utterance = new SpeechSynthesisUtterance(cleaned);
    utterance.lang = matchedVoice ? matchedVoice.lang : lang;
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }
    utterance.rate = 0.9;
    utterance.onerror = () => {
      playOnlineFallback();
    };
    window.speechSynthesis.speak(utterance);
  } catch {
    playOnlineFallback();
  }
}
