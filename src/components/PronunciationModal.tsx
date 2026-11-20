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
  Lightbulb,
  XCircle,
  Target,
} from "lucide-react";
import { PronunciationEvaluation } from "@/types/course";
import { getAppSettings } from "@/lib/storage";
import { fetchAiAgent } from "@/lib/quotaManager";
import {
  detectTextLang,
  stopAllSpeech,
  extractCleanSpeechTranscript,
} from "@/lib/tts";
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
  const [audioBase64, setAudioBase64] = useState("");
  const [audioMimeType, setAudioMimeType] = useState("audio/webm");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<PronunciationEvaluation | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const spokenTranscriptRef = useRef("");
  const audioBase64Ref = useRef("");
  const audioMimeTypeRef = useRef("audio/webm");
  const recorderReadyPromiseRef = useRef<Promise<void> | null>(null);

  const langCode = detectTextLang(targetText);

  const stopRecording = useCallback(async () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
      mediaRecorderRef.current = null;
    }
    if (recorderReadyPromiseRef.current) {
      try {
        await Promise.race([
          recorderReadyPromiseRef.current,
          new Promise<void>((r) => setTimeout(r, 800)),
        ]);
      } catch {
        // ignore
      }
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const startRecording = useCallback(async () => {
    stopAllSpeech();
    setErrorMessage(null);
    setEvaluation(null);
    setSpokenTranscript("");
    setAudioBase64("");
    spokenTranscriptRef.current = "";
    audioBase64Ref.current = "";
    recorderReadyPromiseRef.current = null;

    // 1. Thu sóng âm giọng nói thực tế bằng MediaRecorder để gửi cho Gemini Multimodal Audio
    if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        const candidates = [
          "audio/webm;codecs=opus",
          "audio/webm",
          "audio/mp4",
          "audio/aac",
          "audio/ogg;codecs=opus",
        ];
        const supportedMime =
          typeof MediaRecorder !== "undefined" &&
          typeof MediaRecorder.isTypeSupported === "function"
            ? candidates.find((c) => MediaRecorder.isTypeSupported(c)) || ""
            : "";
        const cleanMime = (supportedMime || "audio/mp4").split(";")[0];
        setAudioMimeType(cleanMime);
        audioMimeTypeRef.current = cleanMime;
        const recorder = supportedMime
          ? new MediaRecorder(stream, { mimeType: supportedMime })
          : new MediaRecorder(stream);
        const chunks: BlobPart[] = [];
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };
        recorderReadyPromiseRef.current = new Promise<void>((resolve) => {
          recorder.onstop = () => {
            const finalMime = (recorder.mimeType || supportedMime || cleanMime).split(";")[0] || "audio/mp4";
            setAudioMimeType(finalMime);
            audioMimeTypeRef.current = finalMime;
            const blob = new Blob(chunks, { type: finalMime });
            const reader = new FileReader();
            reader.onloadend = () => {
              const resStr = String(reader.result || "");
              const b64 = resStr.includes(",") ? resStr.split(",")[1] : "";
              if (b64) {
                audioBase64Ref.current = b64;
                setAudioBase64(b64);
              }
              resolve();
            };
            reader.onerror = () => resolve();
            reader.readAsDataURL(blob);
            stream.getTracks().forEach((t) => t.stop());
          };
        });
        mediaRecorderRef.current = recorder;
        recorder.start();
        setIsRecording(true);
      } catch {
        // Fallback sang SpeechRecognition
      }
    }

    // 2. Chạy song song Web Speech API để hiển thị chữ trực tiếp lên khung Read-Only
    const SpeechRecognition =
      typeof window !== "undefined"
        ? (window as any).SpeechRecognition ||
          (window as any).webkitSpeechRecognition
        : null;

    if (!SpeechRecognition) {
      if (!mediaRecorderRef.current) {
        setErrorMessage(
          "Trình duyệt hiện tại chưa hỗ trợ thu âm trực tiếp. Vui lòng sử dụng Chrome, Safari hoặc Edge và cấp quyền Micro."
        );
      }
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
        const cleanTranscript = extractCleanSpeechTranscript(event.results);
        if (cleanTranscript) {
          spokenTranscriptRef.current = cleanTranscript;
          setSpokenTranscript(cleanTranscript);
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error !== "no-speech" && event.error !== "aborted") {
          setErrorMessage(`Lỗi micro: ${event.error}. Vui lòng kiểm tra quyền Micro.`);
        }
      };

      recognition.onend = () => {
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") {
          setIsRecording(false);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      if (!mediaRecorderRef.current) {
        setErrorMessage("Không thể kích hoạt Microphone. Vui lòng cho phép quyền truy cập Micro.");
        setIsRecording(false);
      }
    }
  }, [langCode]);

  useEffect(() => {
    if (isOpen) {
      setSpokenTranscript("");
      setAudioBase64("");
      spokenTranscriptRef.current = "";
      audioBase64Ref.current = "";
      setEvaluation(null);
      setErrorMessage(null);
      setIsRecording(false);
      stopAllSpeech();
    } else {
      void stopRecording();
      stopAllSpeech();
    }
    return () => {
      void stopRecording();
      stopAllSpeech();
    };
  }, [isOpen, targetText, stopRecording]);

  if (!isOpen) return null;

  const handleEvaluate = async () => {
    await stopRecording();
    const finalTranscript = (spokenTranscriptRef.current || spokenTranscript).trim();
    const finalAudioBase64 = audioBase64Ref.current || audioBase64;
    const finalMimeType = audioMimeTypeRef.current || audioMimeType;

    if (!finalTranscript && !finalAudioBase64) {
      setErrorMessage("Vui lòng bấm vào Microphone và đọc to rõ ràng trước khi chấm điểm.");
      return;
    }

    setIsEvaluating(true);
    setErrorMessage(null);

    const s = getAppSettings();
    try {
      const res = await fetchAiAgent("/api/agent/evaluate-pronunciation", {
        expectedText: targetText,
        spokenText: finalTranscript,
        audioBase64: finalAudioBase64 || undefined,
        audioMimeType: finalMimeType,
        language: langCode,
        pinyinOrIpa: phonetic,
        apiKey: s.geminiApiKey,
        model: s.geminiModel,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141413]/85">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-6 sm:p-8 shadow-[6px_6px_0_0_#F5EFE6] text-left">
        {/* Close Button */}
        <button
          type="button"
          onClick={() => {
            stopRecording();
            stopAllSpeech();
            onClose();
          }}
          className="absolute top-5 right-5 rounded-xl border-2 border-[#F5EFE6] bg-[#141413] p-2 text-[#F5EFE6] hover:bg-[#FF8A8A] hover:text-[#141413] transition-colors cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-[#F5EFE6] bg-[#A7D7A9] text-[#141413] shadow-[2px_2px_0_0_#F5EFE6]">
            <Mic className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-[#F5EFE6] flex items-center gap-2">
              Gia Sư AI Chấm Điểm Phát Âm
              <span className="rounded-full border-2 border-[#F5EFE6] bg-[#F3C969] px-2 py-0.5 text-[10px] font-black text-[#141413]">
                PRO
              </span>
            </h3>
            <p className="text-xs text-[#B8B2A6]">
              Đọc to từ/câu để AI phân tích khẩu hình, thanh điệu, chấm % và chỉ ra sai chỗ nào
            </p>
          </div>
        </div>

        {/* Target Phrase Card */}
        <div className="rounded-xl border-2 border-[#3A3832] bg-[#141413] p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#B8D8F8] block mb-1">
                Văn bản mẫu cần đọc:
              </span>
              <p className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#F5EFE6] font-serif">
                {targetText}
              </p>
            </div>
            <AudioSpeakButton
              text={targetText}
              label="Nghe mẫu"
              className="rounded-xl border-2 border-[#F5EFE6] bg-[#B8D8F8] px-3 py-2 text-xs font-extrabold text-[#141413] shadow-[2px_2px_0_0_#F5EFE6] shrink-0"
            />
          </div>

          {phonetic && (
            <div className="text-sm font-mono text-[#F3C969] font-bold">
              Phiên âm: {phonetic}
            </div>
          )}

          {vietnameseMeaning && (
            <div className="text-xs text-[#B8B2A6] border-t-2 border-[#3A3832] pt-2">
              Nghĩa tiếng Việt: <strong className="text-[#A7D7A9]">{vietnameseMeaning}</strong>
            </div>
          )}

          {contextHint && (
            <div className="flex items-center gap-1.5 text-[11px] text-[#F3C969] italic">
              <Lightbulb className="h-3.5 w-3.5 text-[#F3C969] shrink-0" />
              <span>{contextHint}</span>
            </div>
          )}
        </div>

        {/* Recording Section */}
        <div className="mt-6 rounded-xl border-2 border-[#3A3832] bg-[#141413] p-6 text-center space-y-4">
          <div className="relative mx-auto flex items-center justify-center h-20 w-20">
            {isRecording && (
              <div className="absolute inset-0 rounded-xl bg-[#FF8A8A]/35 animate-ping duration-1000" />
            )}

            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              className={`relative flex h-16 w-16 items-center justify-center rounded-xl border-2 border-[#F5EFE6] text-[#141413] shadow-[4px_4px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6] cursor-pointer ${
                isRecording ? "bg-[#FF8A8A]" : "bg-[#F3C969]"
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
            <p className="flex items-center justify-center gap-2 text-sm font-extrabold text-[#F5EFE6]">
              {isRecording ? (
                <>
                  <span className="h-2.5 w-2.5 rounded-full bg-[#FF8A8A] animate-ping" />
                  <span>Đang lắng nghe giọng bạn... Hãy đọc to và rõ ràng!</span>
                </>
              ) : (
                "Bấm vào Micro để bắt đầu đọc"
              )}
            </p>
            <p className="text-xs text-[#B8B2A6] mt-0.5">
              Hỗ trợ tự động nhận dạng ngôn ngữ tương ứng
            </p>
          </div>

          {/* Live Transcript / Speech Display */}
          <div className="text-left">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-[#B8B2A6] mb-1.5">
              <span className="flex flex-wrap items-center gap-2">
                <span>Âm thanh ghi nhận được từ micro của bạn:</span>
                <span className="rounded-md border border-[#3A3832] bg-[#1D1C19] px-2 py-0.5 text-[10px] font-semibold text-[#B8B2A6]">
                  Chỉ nhận giọng đọc từ Micro • Không cho gõ phím
                </span>
              </span>
              {(spokenTranscript || audioBase64) && (
                <button
                  type="button"
                  onClick={() => {
                    setSpokenTranscript("");
                    setAudioBase64("");
                  }}
                  className="text-xs font-bold text-[#F3C969] hover:underline cursor-pointer"
                >
                  Thu âm lại
                </button>
              )}
            </div>
            <div
              aria-readonly="true"
              className={`min-h-[52px] w-full rounded-lg border-2 px-4 py-3 text-sm select-none cursor-default ${
                isRecording
                  ? "border-[#A7D7A9] bg-[#1D1C19] text-[#F5EFE6]"
                  : spokenTranscript
                  ? "border-[#F5EFE6] bg-[#1D1C19] text-[#F5EFE6]"
                  : "border-[#3A3832] bg-[#1D1C19] text-[#B8B2A6]"
              }`}
            >
              {spokenTranscript ? (
                <p className="font-semibold leading-relaxed text-[#F5EFE6]">
                  {spokenTranscript}
                </p>
              ) : isRecording ? (
                <p className="italic text-[#A7D7A9] animate-pulse">
                  Đang thu sóng âm giọng đọc của bạn qua Micro... Hãy đọc to và rõ ràng!
                </p>
              ) : (
                <p className="text-[#B8B2A6]">
                  Bấm nút micro ở trên và đọc to rõ ràng. Lời đọc của bạn sẽ tự động chạy chữ tại đây (không cho phép gõ văn bản thủ công)...
                </p>
              )}
            </div>
          </div>

          {/* Submit Action */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              disabled={isEvaluating || (!spokenTranscript.trim() && !audioBase64)}
              onClick={handleEvaluate}
              className="inline-flex items-center gap-2 rounded-xl border-2 border-[#F5EFE6] bg-[#A7D7A9] px-6 py-2.5 text-xs font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6] disabled:opacity-50 cursor-pointer"
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
            <div className="rounded-lg border-2 border-[#FF8A8A] bg-[#1D1C19] p-3 text-xs font-bold text-[#FF8A8A]">
              {errorMessage}
            </div>
          )}
        </div>

        {/* AI EVALUATION RESULT SHOWCASE */}
        {evaluation && (
          <div className="mt-6 rounded-xl border-2 border-[#F5EFE6] bg-[#141413] p-6 space-y-6">
            {/* Score Banner */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b-2 border-[#3A3832]">
              <div className="flex items-center gap-4">
                <div
                  className={`flex h-16 w-16 items-center justify-center rounded-xl border-2 border-[#F5EFE6] text-2xl font-black text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] ${
                    evaluation.overallScore >= 85
                      ? "bg-[#A7D7A9]"
                      : evaluation.overallScore >= 65
                      ? "bg-[#F3C969]"
                      : "bg-[#FF8A8A]"
                  }`}
                >
                  {evaluation.overallScore}%
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#B8B2A6]">
                    Độ chính xác phát âm
                  </span>
                  <h4 className="text-base font-extrabold text-[#F5EFE6] flex items-center gap-1.5">
                    {evaluation.accuracyGrade}
                    {evaluation.overallScore >= 85 && (
                      <Award className="h-4 w-4 text-[#F3C969]" />
                    )}
                  </h4>
                </div>
              </div>

              {/* Sub Scores */}
              <div className="flex items-center gap-3 text-xs">
                <div className="rounded-lg bg-[#1D1C19] border-2 border-[#3A3832] px-3 py-1.5 text-center">
                  <span className="text-[#B8B2A6] block text-[10px]">Độ lưu loát</span>
                  <strong className="text-[#B8D8F8] font-extrabold">{evaluation.fluencyScore}%</strong>
                </div>
                <div className="rounded-lg bg-[#1D1C19] border-2 border-[#3A3832] px-3 py-1.5 text-center">
                  <span className="text-[#B8B2A6] block text-[10px]">Đọc đủ từ</span>
                  <strong className="text-[#A7D7A9] font-extrabold">{evaluation.completenessScore}%</strong>
                </div>
              </div>
            </div>

            {/* Word by Word Breakdown */}
            <div className="space-y-3">
              <h5 className="text-xs font-extrabold uppercase tracking-wider text-[#B8D8F8]">
                1. Chi tiết từng từ trong câu:
              </h5>
              <div className="flex flex-wrap gap-2">
                {evaluation.correctWords.map((word, i) => (
                  <span
                    key={`c-${i}`}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full border-2 border-[#F5EFE6] bg-[#A7D7A9] text-[#141413] text-xs font-extrabold"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    {word} (Đúng)
                  </span>
                ))}
                {evaluation.mispronouncedWords.map((m, i) => (
                  <span
                    key={`m-${i}`}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full border-2 border-[#F5EFE6] bg-[#FF8A8A] text-[#141413] text-xs font-extrabold line-through"
                  >
                    <AlertCircle className="h-3 w-3" />
                    {m.word} (Sai)
                  </span>
                ))}
              </div>
            </div>

            {/* Mispronounced Words Breakdown */}
            {evaluation.mispronouncedWords.length > 0 ? (
              <div className="space-y-3">
                <h5 className="text-xs font-extrabold uppercase tracking-wider text-[#FF8A8A]">
                  2. Sai chỗ nào & Cách khắc phục:
                </h5>
                <div className="space-y-2.5">
                  {evaluation.mispronouncedWords.map((item, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border-2 border-[#FF8A8A] bg-[#1D1C19] p-4 space-y-2 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="flex items-center gap-1.5 text-[#FF8A8A] text-sm">
                          <XCircle className="h-4 w-4 text-[#FF8A8A] shrink-0" />
                          <span>
                            Từ &ldquo;{item.word}&rdquo;
                            {item.expectedPhonetic && ` (${item.expectedPhonetic})`}
                          </span>
                        </strong>
                        <span className="text-[11px] font-extrabold text-[#141413] bg-[#FF8A8A] px-2 py-0.5 rounded-md">
                          {item.issue}
                        </span>
                      </div>
                      <div className="flex items-start gap-1.5 text-[#F5EFE6] bg-[#141413] p-2.5 rounded-lg border-2 border-[#3A3832]">
                        <Lightbulb className="h-3.5 w-3.5 text-[#F3C969] shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-[#F3C969]">Mẹo sửa khẩu hình: </strong>
                          {item.tip}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border-2 border-[#F5EFE6] bg-[#A7D7A9] p-4 text-xs font-extrabold text-[#141413] flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Bạn đã phát âm chính xác tất cả các từ trong văn bản mẫu! Quá xuất sắc!</span>
              </div>
            )}

            {/* General Feedback */}
            <div className="rounded-xl border-2 border-[#3A3832] bg-[#1D1C19] p-4 space-y-1.5 text-xs leading-relaxed text-[#F5EFE6]">
              <strong className="flex items-center gap-1.5 text-[#C8B6FF]">
                <Target className="h-3.5 w-3.5 text-[#C8B6FF] shrink-0" />
                <span>Nhận xét tổng quan từ Gia sư AI:</span>
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
                className="inline-flex items-center gap-2 rounded-xl border-2 border-[#F5EFE6] bg-[#F3C969] px-5 py-2.5 text-xs font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6] cursor-pointer"
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

