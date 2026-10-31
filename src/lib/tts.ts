"use client";

let currentAudio: HTMLAudioElement | null = null;
let currentSessionId = 0;
let currentlyPlayingText: string | null = null;

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
 * Completely stops all audio & speech synthesis immediately.
 */
export function stopAllSpeech(): void {
  currentSessionId++;
  currentlyPlayingText = null;

  if (typeof window !== "undefined") {
    // 1. Cancel native browser SpeechSynthesis
    if ("speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore
      }
    }

    // 2. Pause and completely unload HTML5 Audio element
    if (currentAudio) {
      try {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio.src = "";
        currentAudio.load();
      } catch {
        // Ignore
      }
      currentAudio = null;
    }

    // Notify UI components
    window.dispatchEvent(
      new CustomEvent("bookmind-tts-status", {
        detail: { isPlaying: false, text: "" },
      })
    );
  }
}

// Automatically terminate audio whenever user switches browser tabs or hides page
if (typeof window !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopAllSpeech();
    }
  });
  window.addEventListener("pagehide", () => {
    stopAllSpeech();
  });
}

/**
 * Returns whether speech is currently playing, and for what text.
 */
export function getSpeechStatus(): { isPlaying: boolean; text: string | null } {
  return {
    isPlaying: Boolean(currentlyPlayingText),
    text: currentlyPlayingText,
  };
}

/**
 * Plays speech audio reliably across Windows/Mac/Chrome/Edge.
 * Fixed behavior:
 * - When clicking a second time, immediately terminates the 1st playback and restarts cleanly.
 * - Prevents SpeechSynthesis cancellation from mistakenly triggering fallback audio, eliminating overlapping voices.
 */
export function speakSmart(text: string, e?: React.MouseEvent): void {
  if (e) {
    e.stopPropagation();
  }
  if (typeof window === "undefined" || !text.trim()) return;

  const cleaned = cleanTextForSpeech(text);
  const lang = detectTextLang(cleaned);

  // Stop any ongoing speech immediately before starting new one
  stopAllSpeech();

  // Create unique session token for this playback request
  const sessionId = ++currentSessionId;
  currentlyPlayingText = cleaned;

  // Broadcast that speech has started
  window.dispatchEvent(
    new CustomEvent("bookmind-tts-status", {
      detail: { isPlaying: true, text: cleaned },
    })
  );

  const notifyStopped = () => {
    if (sessionId === currentSessionId) {
      currentlyPlayingText = null;
      window.dispatchEvent(
        new CustomEvent("bookmind-tts-status", {
          detail: { isPlaying: false, text: "" },
        })
      );
    }
  };

  const playOnlineFallback = () => {
    if (sessionId !== currentSessionId) return; // Superseded by a newer click

    try {
      const encoded = encodeURIComponent(cleaned.slice(0, 200));
      const url = `/api/tts?text=${encoded}&lang=${encodeURIComponent(lang)}`;
      const audio = new Audio(url);
      currentAudio = audio;

      audio.onended = () => {
        if (sessionId === currentSessionId) {
          notifyStopped();
          currentAudio = null;
        }
      };

      audio.onerror = () => {
        if (sessionId === currentSessionId) {
          notifyStopped();
          currentAudio = null;
        }
      };

      audio.play().catch(() => {
        if (sessionId === currentSessionId) {
          notifyStopped();
          currentAudio = null;
        }
      });
    } catch {
      notifyStopped();
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

  // If text is Chinese/Japanese/Korean and OS has NO voice installed for it,
  // native speechSynthesis will stay completely silent on Windows, so stream online TTS immediately.
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

    utterance.onend = () => {
      if (sessionId === currentSessionId) {
        notifyStopped();
      }
    };

    utterance.onerror = (ev) => {
      // CRITICAL FIX: If cancelled/interrupted by a second user click, DO NOT trigger fallback!
      // This was the exact bug causing audio to overlap and play on top of each other.
      if (
        ev.error === "canceled" ||
        ev.error === "interrupted" ||
        sessionId !== currentSessionId
      ) {
        return;
      }
      playOnlineFallback();
    };

    window.speechSynthesis.speak(utterance);
  } catch {
    playOnlineFallback();
  }
}
