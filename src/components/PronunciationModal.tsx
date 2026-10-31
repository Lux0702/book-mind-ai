"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  Mic,
  MicOff,
  Sparkles,
  Volume2,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Loader2,
  Flame,
  Award,
  ArrowRight,
} from "lucide-react";
import { PronunciationEvaluation } from "@/types/course";
import { getAppSettings } from "@/lib/storage";
import { detectTextLang, stopAllSpeech } from "@/lib/tts";
import AudioSpeakButton from "./AudioSpeakButton";

interface PronunciationModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetText: string;
  phonetic?: string;
  vietnameseMeaning?: string;
  contextHint?: string;
}

export default function PronunciationModal({
  isOpen,
  onClose,
  targetText,
  phonetic,
  vietnameseMeaning,
  contextHint,
}: PronunciationModalProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [spokenTranscript, setSpokenTranscript] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<PronunciationEvaluation | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const langCode = detectTextLang(targetText);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const startRecording = useCallback(() => {
    stopAllSpeech();
    setErrorMessage(null);
    setEvaluation(null);
    setSpokenTranscript("");

    const SpeechRecognition =
      typeof window !== "undefined"
        ? (window as any).SpeechRecognition ||
          (window as any).webkitSpeechRecognition
        : null;

    if (!SpeechRecognition) {
      setErrorMessage(
        "Trình duyệt hiện tại chưa hỗ trợ Web Speech API. Bạn có thể tự gõ văn bản bạn vừa đọc vào ô bên dưới để AI chấm điểm."
      );
      setIsRecording(true);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = langCode;

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript.trim()) {
          setSpokenTranscript(transcript.trim());
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error !== "no-speech") {
          setErrorMessage(
            `Lỗi micro: ${event.error}. Bạn vẫn có thể nhập trực tiếp câu bạn đã đọc bên dưới.`
          );
        }
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: unknown) {
      setErrorMessage("Không thể kích hoạt Microphone. Vui lòng cho phép quyền truy cập Micro.");
      setIsRecording(false);
    }
  }, [langCode]);

  useEffect(() => {
    if (isOpen) {
      setSpokenTranscript("");
      setEvaluation(null);
      setErrorMessage(null);
      setIsRecording(false);
      stopAllSpeech();
    } else {
      stopRecording();
      stopAllSpeech();
    }
    return () => {
      stopRecording();
      stopAllSpeech();
    };
  }, [isOpen, targetText, stopRecording]);

  if (!isOpen) return null;

  const handleEvaluate = async () => {
    stopRecording();
    if (!spokenTranscript.trim()) {
      setErrorMessage("Vui lòng bấm vào Microphone và đọc to rõ ràng trước khi chấm điểm.");
      return;
    }

    setIsEvaluating(true);
    setErrorMessage(null);

    const s = getAppSettings();
    try {
      const res = await fetch("/api/agent/evaluate-pronunciation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedText: targetText,
          spokenText: spokenTranscript,
          language: langCode,
          pinyinOrIpa: phonetic,
          apiKey: s.geminiApiKey,
          model: s.geminiModel,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Lỗi khi AI chấm điểm phát âm.");
      }
      setEvaluation(data.evaluation);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Không thể kết nối dịch vụ chấm phát âm AI."
      );
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-indigo-500/30 bg-slate-900/95 p-6 sm:p-8 shadow-2xl text-left">
        {/* Close Button */}
        <button
          type="button"
          onClick={() => {
            stopRecording();
            stopAllSpeech();
            onClose();
          }}
          className="absolute top-5 right-5 rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/30">
            <Mic className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              Gia Sư AI Chấm Điểm Phát Âm
              <span className="rounded-md bg-indigo-500/20 px-2 py-0.5 text-[10px] font-black text-indigo-300 border border-indigo-500/30">
                PRO
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Đọc to từ/câu để AI phân tích khẩu hình, thanh điệu, chấm % và chỉ ra sai chỗ nào
            </p>
          </div>
        </div>

        {/* Target Phrase Card */}
        <div className="rounded-2xl border border-indigo-500/20 bg-slate-950 p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 block mb-1">
                Văn bản mẫu cần đọc:
              </span>
              <p className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-serif">
                {targetText}
              </p>
            </div>
            <AudioSpeakButton
              text={targetText}
              label="Nghe mẫu"
              className="rounded-xl bg-slate-800 px-3 py-2 text-xs font-semibold text-indigo-300 hover:bg-slate-700 shrink-0"
            />
          </div>

          {phonetic && (
            <div className="text-sm font-mono text-indigo-300 font-semibold">
              Phiên âm: {phonetic}
            </div>
          )}

          {vietnameseMeaning && (
            <div className="text-xs text-slate-300 border-t border-slate-850 pt-2">
              Nghĩa tiếng Việt: <strong className="text-emerald-400">{vietnameseMeaning}</strong>
            </div>
          )}

          {contextHint && (
            <div className="text-[11px] text-amber-300/90 italic">
              💡 {contextHint}
            </div>
          )}
        </div>

        {/* Recording Section */}
        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/60 p-6 text-center space-y-4">
          <div className="relative mx-auto flex items-center justify-center h-20 w-20">
            {isRecording && (
              <>
                <div className="absolute inset-0 rounded-full bg-rose-500/25 animate-ping duration-1000" />
                <div className="absolute -inset-2 rounded-full border border-rose-500/40 animate-pulse" />
              </>
            )}

            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              className={`relative flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-xl transition-all transform active:scale-95 cursor-pointer ${
                isRecording
                  ? "bg-rose-600 hover:bg-rose-500 shadow-rose-600/30"
                  : "bg-gradient-to-br from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-indigo-600/30"
              }`}
            >
              {isRecording ? (
                <MicOff className="h-7 w-7 animate-pulse" />
              ) : (
                <Mic className="h-7 w-7" />
              )}
            </button>
          </div>

          <div>
            <p className="text-sm font-bold text-white">
              {isRecording
                ? "🔴 Đang lắng nghe giọng bạn... Hãy đọc to và rõ ràng!"
                : "Bấm vào Micro để bắt đầu đọc"}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Hỗ trợ tự động nhận dạng ngôn ngữ tương ứng
            </p>
          </div>

          {/* Live Transcript / Speech Input */}
          <div className="text-left">
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              Lời nói thu được từ bạn:
            </label>
            <div className="relative">
              <input
                type="text"
                value={spokenTranscript}
                onChange={(e) => setSpokenTranscript(e.target.value)}
                placeholder={
                  isRecording
                    ? "Đang nhận diện giọng nói của bạn..."
                    : "Giọng nói của bạn sẽ xuất hiện ở đây sau khi đọc..."
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
              {spokenTranscript && (
                <button
                  type="button"
                  onClick={() => setSpokenTranscript("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-white"
                >
                  Xóa
                </button>
              )}
            </div>
          </div>

          {/* Submit Action */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              disabled={isEvaluating || !spokenTranscript.trim()}
              onClick={handleEvaluate}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/25 transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isEvaluating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  AI đang chấm điểm phát âm & phân tích lỗi...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  AI Chấm Điểm Phát Âm & Chỉ Ra Chỗ Sai
                </>
              )}
            </button>
          </div>

          {errorMessage && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 text-xs text-rose-300">
              {errorMessage}
            </div>
          )}
        </div>

        {/* AI EVALUATION RESULT SHOWCASE */}
        {evaluation && (
          <div className="mt-6 rounded-3xl border border-indigo-500/30 bg-gradient-to-b from-slate-950 to-slate-900 p-6 space-y-6 animate-in fade-in zoom-in-95 duration-200">
            {/* Score Banner */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-800">
              <div className="flex items-center gap-4">
                <div
                  className={`flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-black shadow-lg ${
                    evaluation.overallScore >= 85
                      ? "bg-emerald-500/20 text-emerald-400 ring-2 ring-emerald-500/40"
                      : evaluation.overallScore >= 65
                      ? "bg-amber-500/20 text-amber-400 ring-2 ring-amber-500/40"
                      : "bg-rose-500/20 text-rose-400 ring-2 ring-rose-500/40"
                  }`}
                >
                  {evaluation.overallScore}%
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Độ chính xác phát âm
                  </span>
                  <h4 className="text-base font-extrabold text-white flex items-center gap-1.5">
                    {evaluation.accuracyGrade}
                    {evaluation.overallScore >= 85 && (
                      <Award className="h-4 w-4 text-amber-400" />
                    )}
                  </h4>
                </div>
              </div>

              {/* Sub Scores */}
              <div className="flex items-center gap-4 text-xs">
                <div className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-1.5 text-center">
                  <span className="text-slate-400 block text-[10px]">Độ lưu loát</span>
                  <strong className="text-indigo-300 font-bold">{evaluation.fluencyScore}%</strong>
                </div>
                <div className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-1.5 text-center">
                  <span className="text-slate-400 block text-[10px]">Đọc đủ từ</span>
                  <strong className="text-emerald-300 font-bold">{evaluation.completenessScore}%</strong>
                </div>
              </div>
            </div>

            {/* Word by Word Breakdown (Correct vs Mispronounced) */}
            <div className="space-y-3">
              <h5 className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                1. Chi tiết từng từ trong câu:
              </h5>
              <div className="flex flex-wrap gap-2">
                {evaluation.correctWords.map((word, i) => (
                  <span
                    key={`c-${i}`}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    {word} (Đúng)
                  </span>
                ))}
                {evaluation.mispronouncedWords.map((m, i) => (
                  <span
                    key={`m-${i}`}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold line-through"
                  >
                    <AlertCircle className="h-3 w-3" />
                    {m.word} (Sai)
                  </span>
                ))}
              </div>
            </div>

            {/* Mispronounced Words Breakdown: Sai chỗ nào & Cần cải thiện gì */}
            {evaluation.mispronouncedWords.length > 0 ? (
              <div className="space-y-3">
                <h5 className="text-xs font-bold uppercase tracking-wider text-rose-300">
                  2. Sai chỗ nào & Cách khắc phục:
                </h5>
                <div className="space-y-2.5">
                  {evaluation.mispronouncedWords.map((item, idx) => (
                    <div
                      key={idx}
                      className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-4 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <strong className="text-rose-200 text-sm">
                          ❌ Từ &ldquo;{item.word}&rdquo;
                          {item.expectedPhonetic && ` (${item.expectedPhonetic})`}
                        </strong>
                        <span className="text-[11px] text-rose-300 bg-rose-950/60 px-2 py-0.5 rounded-lg border border-rose-500/30">
                          {item.issue}
                        </span>
                      </div>
                      <div className="text-slate-300 bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
                        <strong className="text-amber-300">💡 Mẹo sửa khẩu hình: </strong>
                        {item.tip}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4 text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Bạn đã phát âm chính xác tất cả các từ trong văn bản mẫu! Quá xuất sắc!</span>
              </div>
            )}

            {/* General Feedback */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 space-y-1.5 text-xs leading-relaxed text-slate-200">
              <strong className="text-indigo-300 block">
                🎯 Nhận xét tổng quan từ Gia sư AI:
              </strong>
              <p>{evaluation.generalFeedback}</p>
            </div>

            {/* Try Again Button */}
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setEvaluation(null);
                  setSpokenTranscript("");
                  startRecording();
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 px-5 py-2.5 text-xs font-semibold text-white transition active:scale-95 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Luyện phát âm lại lần nữa</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

