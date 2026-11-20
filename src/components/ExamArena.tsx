"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Trophy,
  Sparkles,
  Volume2,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Gamepad2,
  Keyboard,
  Loader2,
  Lightbulb,
  Timer,
  Play,
  Infinity as InfinityIcon,
  BookOpen,
  ArrowRight,
  Mic,
  MicOff,
  Award,
  AlertCircle,
  Check,
  Layers,
  Clock,
} from "lucide-react";
import {
  Course,
  ChapterUnit,
  FlashcardSRS,
  QuizExercise,
  ClozeExercise,
  TranslationExercise,
  TranslationEvaluation,
  PronunciationEvaluation,
} from "@/types/course";
import {
  speakSmart,
  stopAllSpeech,
  detectTextLang,
  extractCleanSpeechTranscript,
} from "@/lib/tts";
import AudioSpeakButton from "./AudioSpeakButton";
import ExamGeneratingLoader from "./loadings/ExamGeneratingLoader";
import CustomSelect from "./ui/CustomSelect";
import { getAppSettings } from "@/lib/storage";
import { fetchAiAgent } from "@/lib/quotaManager";
import { triggerChibiCelebrate } from "@/lib/chibiEvents";

interface ExamArenaProps {
  course: Course;
  currentChapter: ChapterUnit;
  courseFlashcards: FlashcardSRS[];
}

type ReviewMode =
  | "timed_chapter_exam"
  | "vocab_quiz"
  | "matching"
  | "typing"
  | "pronunciation_arena";

interface TimedExamQuestion {
  id: string;
  type: "quiz" | "cloze" | "translation";
  categoryLabel: string;
  promptText: string;
  subHint?: string;
  options?: string[];
  correctIndex?: number;
  correctTextAnswer?: string;
  explanation?: string;
  referenceTranslation?: string;
}

export default function ExamArena({
  course,
  currentChapter,
  courseFlashcards,
}: ExamArenaProps) {
  const [mode, setMode] = useState<ReviewMode>("timed_chapter_exam");
  const [selectedChapterId, setSelectedChapterId] = useState<string>(
    currentChapter.id
  );
  const [seed, setSeed] = useState(0);

  // Sync when parent chapter changes
  useEffect(() => {
    setSelectedChapterId(currentChapter.id);
  }, [currentChapter.id]);

  const targetChapter = useMemo(() => {
    return (
      course.chapters.find((c) => c.id === selectedChapterId) || currentChapter
    );
  }, [course.chapters, selectedChapterId, currentChapter]);

  // Strictly filter flashcards for the selected chapter of this course
  const activeCards = useMemo(() => {
    const chCards = courseFlashcards.filter(
      (f) => f.chapterId === targetChapter.id
    );
    if (chCards.length > 0) return chCards;
    // Fallback to targetChapter.lesson.vocabulary if flashcards table hasn't synced yet
    if (targetChapter.lesson?.vocabulary) {
      return targetChapter.lesson.vocabulary.map((v) => ({
        id: `temp-${v.id}`,
        courseId: course.id,
        chapterId: targetChapter.id,
        word: v.word,
        ipa: v.ipa,
        partOfSpeech: v.partOfSpeech,
        cefrLevel: v.cefrLevel,
        vietnameseMeaning: v.vietnameseMeaning,
        explanationInContext: v.explanationInContext,
        quoteFromBook: v.quoteFromBook,
        quoteTranslation: v.quoteTranslation,
        collocations: v.collocations || [],
        interval: 0,
        repetition: 0,
        efactor: 2.5,
        nextReviewDate: "",
      }));
    }
    return [];
  }, [courseFlashcards, targetChapter, course.id]);

  // ============================================================================
  // MODE 1: TIMED CHAPTER EXAM (Tự động tạo bài thi kiểm tra chương + Đếm ngược từng câu, trừ câu Dịch thuật)
  // ============================================================================
  const [secondsPerQuestion, setSecondsPerQuestion] = useState<number>(20);
  const [examStarted, setExamStarted] = useState(false);
  const [examFinished, setExamFinished] = useState(false);
  const [examStepIndex, setExamStepIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number>(20);
  const [isQuestionLocked, setIsQuestionLocked] = useState(false);

  // Custom AI-generated exam questions override if user clicked "AI Sinh Đề Thi Mới"
  const [aiGeneratedExam, setAiGeneratedExam] = useState<{
    examTitle: string;
    quizQuestions: QuizExercise[];
    clozeQuestions: ClozeExercise[];
    translationChallenges: TranslationExercise[];
  } | null>(null);
  const [isGeneratingAiExam, setIsGeneratingAiExam] = useState(false);
  const [aiExamError, setAiExamError] = useState<string | null>(null);

  // User answers in the Timed Exam
  const [userQuizChoice, setUserQuizChoice] = useState<number | null>(null);
  const [userClozeInput, setUserClozeInput] = useState("");
  const [userTranslationInput, setUserTranslationInput] = useState("");
  const [isEvaluatingTranslation, setIsEvaluatingTranslation] = useState(false);
  const [currentTranslationEval, setCurrentTranslationEval] =
    useState<TranslationEvaluation | null>(null);

  const [examResults, setExamResults] = useState<
    {
      question: TimedExamQuestion;
      isCorrect: boolean;
      timedOut: boolean;
      userAnswerText: string;
      translationScore?: number;
      translationEval?: TranslationEvaluation;
    }[]
  >([]);

  // Automatically stop any playing speech when switching modes or unmounting
  useEffect(() => {
    stopAllSpeech();
    return () => {
      stopAllSpeech();
    };
  }, [mode, examStepIndex, selectedChapterId]);

  // ============================================================================
  // MODE 5: AI PRONUNCIATION / SPEAKING ARENA
  // ============================================================================
  const [speakingIdx, setSpeakingIdx] = useState(0);
  const [speakingScope, setSpeakingScope] = useState<"all" | "vocab" | "sentences">("all");
  const [isSpeakingRecording, setIsSpeakingRecording] = useState(false);
  const [speakingTranscript, setSpeakingTranscript] = useState("");
  const [speakingAudioBase64, setSpeakingAudioBase64] = useState("");
  const [speakingAudioMime, setSpeakingAudioMime] = useState("audio/webm");
  const [isEvaluatingSpeech, setIsEvaluatingSpeech] = useState(false);
  const [speechEvaluation, setSpeechEvaluation] = useState<PronunciationEvaluation | null>(null);
  const [speechScores, setSpeechScores] = useState<Record<string, number>>({});
  const [speakingError, setSpeakingError] = useState<string | null>(null);
  const speechRecognitionRef = React.useRef<any>(null);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const mediaStreamRef = React.useRef<MediaStream | null>(null);
  const speakingTranscriptRef = React.useRef<string>("");
  const speakingAudioBase64Ref = React.useRef<string>("");
  const speakingAudioMimeRef = React.useRef<string>("audio/webm");
  const speakingRecorderReadyRef = React.useRef<Promise<void> | null>(null);

  // Build speaking practice list (Vocab + Sentences from this chapter)
  const speakingItems = useMemo(() => {
    const list: {
      id: string;
      type: "vocab" | "sentence";
      targetText: string;
      phonetic?: string;
      meaning: string;
      hint?: string;
    }[] = [];

    // 1. Vocabulary
    if (speakingScope === "all" || speakingScope === "vocab") {
      activeCards.forEach((c) => {
        list.push({
          id: `sp-v-${c.id}`,
          type: "vocab",
          targetText: c.word,
          phonetic: c.ipa,
          meaning: c.vietnameseMeaning,
          hint: c.quoteFromBook ? `Ví dụ: ${c.quoteFromBook}` : undefined,
        });
      });
    }

    // 2. Sentences from grammar and translation
    if (speakingScope === "all" || speakingScope === "sentences") {
      targetChapter.lesson?.grammarPoints?.forEach((gp) => {
        if (gp.quoteFromBook) {
          list.push({
            id: `sp-g-${gp.id}`,
            type: "sentence",
            targetText: gp.quoteFromBook,
            meaning: gp.quoteTranslation,
            hint: `Ngữ pháp: ${gp.title}`,
          });
        }
      });

      targetChapter.lesson?.translationExercises?.forEach((tr) => {
        if (tr.originalSentence) {
          list.push({
            id: `sp-t-${tr.id}`,
            type: "sentence",
            targetText: tr.originalSentence,
            meaning: tr.referenceTranslation,
            hint: tr.contextHint,
          });
        }
      });
    }

    return list;
  }, [activeCards, targetChapter.lesson, speakingScope]);

  const currentSpeakingItem = speakingItems[speakingIdx] || speakingItems[0];

  const startSpeakingRecording = async () => {
    stopAllSpeech();
    setSpeakingError(null);
    setSpeechEvaluation(null);
    setSpeakingTranscript("");
    setSpeakingAudioBase64("");
    speakingTranscriptRef.current = "";
    speakingAudioBase64Ref.current = "";
    speakingRecorderReadyRef.current = null;

    // 1. Khởi tạo MediaRecorder để thu sóng âm giọng nói thực tế gửi cho Gemini Multimodal Audio
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
        setSpeakingAudioMime(cleanMime);
        speakingAudioMimeRef.current = cleanMime;
        const recorder = supportedMime
          ? new MediaRecorder(stream, { mimeType: supportedMime })
          : new MediaRecorder(stream);
        const chunks: BlobPart[] = [];
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };
        speakingRecorderReadyRef.current = new Promise<void>((resolve) => {
          recorder.onstop = () => {
            const finalMime = (recorder.mimeType || supportedMime || cleanMime).split(";")[0] || "audio/mp4";
            setSpeakingAudioMime(finalMime);
            speakingAudioMimeRef.current = finalMime;
            const blob = new Blob(chunks, { type: finalMime });
            const reader = new FileReader();
            reader.onloadend = () => {
              const resStr = String(reader.result || "");
              const base64 = resStr.includes(",") ? resStr.split(",")[1] : "";
              if (base64) {
                speakingAudioBase64Ref.current = base64;
                setSpeakingAudioBase64(base64);
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
        setIsSpeakingRecording(true);
      } catch {
        // Fallback nếu chỉ dùng SpeechRecognition
      }
    }

    // 2. Khởi tạo Web Speech API để hiển thị chữ trực tiếp khi người dùng đang đọc
    const SpeechRecognition =
      typeof window !== "undefined"
        ? (window as any).SpeechRecognition ||
          (window as any).webkitSpeechRecognition
        : null;

    if (!SpeechRecognition) {
      if (!mediaRecorderRef.current) {
        setSpeakingError(
          "Trình duyệt chưa hỗ trợ thu âm trực tiếp. Vui lòng sử dụng Chrome, Safari hoặc Edge và cấp quyền Micro."
        );
      }
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      if (currentSpeakingItem) {
        recognition.lang = detectTextLang(currentSpeakingItem.targetText);
      }

      recognition.onstart = () => setIsSpeakingRecording(true);
      recognition.onresult = (event: any) => {
        const cleanTranscript = extractCleanSpeechTranscript(event.results);
        if (cleanTranscript) {
          speakingTranscriptRef.current = cleanTranscript;
          setSpeakingTranscript(cleanTranscript);
        }
      };
      recognition.onerror = (event: any) => {
        if (event.error !== "no-speech" && event.error !== "aborted") {
          setSpeakingError(`Lỗi mic: ${event.error}`);
        }
      };
      recognition.onend = () => {
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") {
          setIsSpeakingRecording(false);
        }
      };

      speechRecognitionRef.current = recognition;
      recognition.start();
    } catch {
      if (!mediaRecorderRef.current) {
        setSpeakingError("Không thể kích hoạt Microphone. Vui lòng cho phép quyền truy cập Micro.");
        setIsSpeakingRecording(false);
      }
    }
  };

  const stopSpeakingRecording = async () => {
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {
        // ignore
      }
      speechRecognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
      mediaRecorderRef.current = null;
    }
    if (speakingRecorderReadyRef.current) {
      try {
        await Promise.race([
          speakingRecorderReadyRef.current,
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
    setIsSpeakingRecording(false);
  };

  const handleEvaluateSpeaking = async () => {
    await stopSpeakingRecording();
    const finalTranscript = (speakingTranscriptRef.current || speakingTranscript).trim();
    const finalAudioBase64 = speakingAudioBase64Ref.current || speakingAudioBase64;
    const finalAudioMime = speakingAudioMimeRef.current || speakingAudioMime;

    if ((!finalTranscript && !finalAudioBase64) || !currentSpeakingItem) {
      setSpeakingError("Vui lòng bấm Micro và đọc to rõ ràng trước khi chấm điểm.");
      return;
    }

    setIsEvaluatingSpeech(true);
    setSpeakingError(null);
    const s = getAppSettings();

    try {
      const res = await fetchAiAgent("/api/agent/evaluate-pronunciation", {
        expectedText: currentSpeakingItem.targetText,
        spokenText: finalTranscript,
        audioBase64: finalAudioBase64 || undefined,
        audioMimeType: finalAudioMime,
        language: detectTextLang(currentSpeakingItem.targetText),
        pinyinOrIpa: currentSpeakingItem.phonetic,
        apiKey: s.geminiApiKey,
        model: s.geminiModel,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi khi chấm điểm");
      setSpeechEvaluation(data.evaluation);
      if (data.evaluation?.overallScore) {
        setSpeechScores((prev) => ({
          ...prev,
          [currentSpeakingItem.id]: data.evaluation.overallScore,
        }));
      }
    } catch (err: unknown) {
      setSpeakingError(err instanceof Error ? err.message : "Lỗi kết nối AI");
    } finally {
      setIsEvaluatingSpeech(false);
    }
  };

  // Build automatic exam questions for the selected chapter
  const examQuestions: TimedExamQuestion[] = useMemo(() => {
    const list: TimedExamQuestion[] = [];

    if (aiGeneratedExam) {
      for (const q of aiGeneratedExam.quizQuestions) {
        list.push({
          id: `ai-q-${q.id}`,
          type: "quiz",
          categoryLabel: `Trắc nghiệm ${
            q.category === "grammar" ? "Ngữ pháp" : "Từ vựng"
          }`,
          promptText: q.question,
          options: q.options,
          correctIndex: q.correctIndex,
          explanation: q.explanation,
        });
      }
      for (const c of aiGeneratedExam.clozeQuestions) {
        list.push({
          id: `ai-c-${c.id}`,
          type: "cloze",
          categoryLabel: "Điền từ / Ngữ pháp vào chỗ trống",
          promptText: c.sentenceWithBlank,
          subHint: `${c.hint} (Nghĩa câu: ${c.fullSentenceTranslation})`,
          correctTextAnswer: c.answer,
          explanation: c.explanation,
        });
      }
      for (const t of aiGeneratedExam.translationChallenges) {
        list.push({
          id: `ai-t-${t.id}`,
          type: "translation",
          categoryLabel: "Dịch thuật (Không giới hạn thời gian)",
          promptText: t.originalSentence,
          subHint: t.contextHint,
          referenceTranslation: t.referenceTranslation,
        });
      }
      return list;
    }

    // Otherwise auto-generate a rich exam from the chapter's vocabulary + grammar + exercises!
    const shuffledVocab = [...activeCards].sort(() => Math.random() - 0.5);

    // 1. Auto-generate Vocabulary Multiple-Choice questions (up to 8 questions)
    shuffledVocab.slice(0, 8).forEach((card, idx) => {
      const distractors = activeCards
        .filter((c) => c.id !== card.id)
        .map((c) => c.vietnameseMeaning)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);
      while (distractors.length < 3) {
        distractors.push(
          ["Xin lỗi / Làm ơn", "Rất vui được gặp", "Trà ô long", "Người nước nào"][
            distractors.length
          ]
        );
      }
      const opts = [...distractors, card.vietnameseMeaning].sort(
        () => Math.random() - 0.5
      );
      list.push({
        id: `auto-voc-q-${seed}-${idx}`,
        type: "quiz",
        categoryLabel: "Trắc nghiệm Từ vựng",
        promptText: `Từ vựng "${card.word}" (${card.ipa} • ${card.partOfSpeech}) có nghĩa tiếng Việt là gì?`,
        subHint: card.quoteFromBook ? `Ngữ cảnh: "${card.quoteFromBook}"` : undefined,
        options: opts,
        correctIndex: opts.indexOf(card.vietnameseMeaning),
        explanation: `${card.word} (${card.ipa}) = ${card.vietnameseMeaning}. ${card.explanationInContext}`,
      });
    });

    // 2. Include Chapter's Grammar & Vocab Quiz Exercises (filtering out any dialogue trivia)
    if (targetChapter.lesson?.quizExercises) {
      targetChapter.lesson.quizExercises.forEach((qz, idx) => {
        list.push({
          id: `ch-qz-${seed}-${idx}`,
          type: "quiz",
          categoryLabel:
            qz.category === "grammar"
              ? "Trắc nghiệm Ngữ pháp"
              : "Trắc nghiệm Từ vựng & Ngữ pháp",
          promptText: qz.question,
          options: qz.options,
          correctIndex: qz.correctIndex,
          explanation: qz.explanation,
        });
      });
    }

    // 3. Include Chapter's Cloze Exercises (Timed)
    if (targetChapter.lesson?.clozeExercises) {
      targetChapter.lesson.clozeExercises.forEach((cl, idx) => {
        list.push({
          id: `ch-cl-${seed}-${idx}`,
          type: "cloze",
          categoryLabel: "Điền từ & Ngữ pháp",
          promptText: cl.sentenceWithBlank,
          subHint: `${cl.hint} — (${cl.fullSentenceTranslation})`,
          correctTextAnswer: cl.answer,
          explanation: cl.explanation,
        });
      });
    }

    // 4. Include Chapter's Translation Exercises (UNTIMED - No countdown timer!)
    if (targetChapter.lesson?.translationExercises) {
      targetChapter.lesson.translationExercises.forEach((tr, idx) => {
        list.push({
          id: `ch-tr-${seed}-${idx}`,
          type: "translation",
          categoryLabel: "Dịch câu (Không giới hạn thời gian)",
          promptText: tr.originalSentence,
          subHint: tr.contextHint,
          referenceTranslation: tr.referenceTranslation,
        });
      });
    }

    return list;
  }, [activeCards, targetChapter.lesson, aiGeneratedExam, seed]);

  const currentExamQ: TimedExamQuestion | undefined =
    examQuestions[examStepIndex];
  const isCurrentQuestionUntimed = currentExamQ?.type === "translation";

  // Countdown Timer Effect for Timed Questions (Quiz & Cloze only; Translation has NO timer!)
  useEffect(() => {
    if (
      !examStarted ||
      examFinished ||
      isQuestionLocked ||
      !currentExamQ ||
      isCurrentQuestionUntimed
    ) {
      return;
    }

    if (timeLeft <= 0) {
      // Time is up! Lock this question as timed out
      setIsQuestionLocked(true);
      setExamResults((prev) => [
        ...prev,
        {
          question: currentExamQ,
          isCorrect: false,
          timedOut: true,
          userAnswerText: "(Hết thời gian trả lời)",
        },
      ]);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((t) => t - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [
    examStarted,
    examFinished,
    isQuestionLocked,
    timeLeft,
    currentExamQ,
    isCurrentQuestionUntimed,
  ]);

  const startTimedExam = () => {
    setExamResults([]);
    setExamStepIndex(0);
    setUserQuizChoice(null);
    setUserClozeInput("");
    setUserTranslationInput("");
    setCurrentTranslationEval(null);
    setIsQuestionLocked(false);
    setTimeLeft(secondsPerQuestion);
    setExamFinished(false);
    setExamStarted(true);
  };

  const handleConfirmTimedAnswer = () => {
    if (!currentExamQ || isQuestionLocked) return;

    if (currentExamQ.type === "quiz") {
      if (userQuizChoice === null) return;
      const isCorrect = userQuizChoice === currentExamQ.correctIndex;
      setIsQuestionLocked(true);
      setExamResults((prev) => [
        ...prev,
        {
          question: currentExamQ,
          isCorrect,
          timedOut: false,
          userAnswerText:
            currentExamQ.options?.[userQuizChoice] || "Đã chọn đáp án",
        },
      ]);
    } else if (currentExamQ.type === "cloze") {
      const cleanUser = userClozeInput.trim();
      const isCorrect =
        cleanUser.toLowerCase() ===
        (currentExamQ.correctTextAnswer || "").trim().toLowerCase();
      setIsQuestionLocked(true);
      setExamResults((prev) => [
        ...prev,
        {
          question: currentExamQ,
          isCorrect,
          timedOut: false,
          userAnswerText: cleanUser || "(Bỏ trống)",
        },
      ]);
    }
  };

  const handleEvaluateUntimedTranslation = async () => {
    if (!currentExamQ || !userTranslationInput.trim()) return;
    setIsEvaluatingTranslation(true);
    try {
      const settings = getAppSettings();
      const res = await fetchAiAgent("/api/agent/evaluate-translation", {
        originalSentence: currentExamQ.promptText,
        referenceTranslation: currentExamQ.referenceTranslation || "",
        contextHint: currentExamQ.subHint || "",
        userTranslation: userTranslationInput,
        apiKey: settings.geminiApiKey,
        model: settings.geminiModel,
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Không thể chấm điểm dịch thuật.");
      }
      const evaluation: TranslationEvaluation = data.evaluation;
      setCurrentTranslationEval(evaluation);
      setIsQuestionLocked(true);
      setExamResults((prev) => [
        ...prev,
        {
          question: currentExamQ,
          isCorrect: evaluation.overallScore >= 70,
          timedOut: false,
          userAnswerText: userTranslationInput,
          translationScore: evaluation.overallScore,
          translationEval: evaluation,
        },
      ]);
    } catch (err: unknown) {
      window.alert(
        err instanceof Error
          ? err.message
          : "Lỗi khi chấm điểm câu dịch. Hãy kiểm tra Gemini API Key."
      );
    } finally {
      setIsEvaluatingTranslation(false);
    }
  };

  const handleNextExamQuestion = () => {
    if (examStepIndex + 1 >= examQuestions.length) {
      setExamFinished(true);
      const total = examResults.length;
      const correctCount = examResults.filter((r) => r.isCorrect).length;
      const pct = total > 0 ? Math.round((correctCount / total) * 100) : 0;
      if (pct >= 70) {
        triggerChibiCelebrate({
          badge: "🏆 HOÀN THÀNH XUẤT SẮC!",
          message: `WOOHOO!! Đạt ${pct}% (${correctCount}/${total} câu) luôn!! La la la~ Quẩy lên nào!! 🎵🎉`,
          subtext: `Bài thi kiểm tra: ${targetChapter.title}`,
        });
      }
      return;
    }
    setExamStepIndex((i) => i + 1);
    setUserQuizChoice(null);
    setUserClozeInput("");
    setUserTranslationInput("");
    setCurrentTranslationEval(null);
    setIsQuestionLocked(false);
    setTimeLeft(secondsPerQuestion);
  };

  const handleGenerateFreshAiExamForChapter = async () => {
    setIsGeneratingAiExam(true);
    setAiExamError(null);
    try {
      const settings = getAppSettings();
      const vocabSummary = activeCards
        .map((c) => `${c.word} (${c.ipa} - ${c.partOfSpeech}): ${c.vietnameseMeaning}`)
        .join("\n");

      const grammarSummary =
        targetChapter.lesson?.grammarPoints
          .map((g) => `${g.title} (${g.patternFormula}): ${g.detailedExplanation}`)
          .join("\n") || "";

      const combinedPayload = `TỪ VỰNG CỦA CHƯƠNG:\n${vocabSummary}\n\nNGỮ PHÁP CỦA CHƯƠNG:\n${grammarSummary}\n\nVĂN BẢN CHƯƠNG ĐÃ QUÉT:\n${targetChapter.rawText.slice(
        0,
        20000
      )}`;

      const res = await fetchAiAgent("/api/agent/generate-exam", {
        courseTitle: course.title,
        scopeTitle: targetChapter.title,
        scannedContentAndVocab: combinedPayload,
        apiKey: settings.geminiApiKey,
        model: settings.geminiModel,
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Không thể sinh đề thi AI.");
      }

      setAiGeneratedExam(data.exam);
      setExamStarted(false);
      setExamFinished(false);
    } catch (err: unknown) {
      setAiExamError(
        err instanceof Error ? err.message : "Lỗi khi gọi AI sinh đề thi."
      );
    } finally {
      setIsGeneratingAiExam(false);
    }
  };

  // ============================================================================
  // MODE 2: VOCAB SPEED QUIZ
  // ============================================================================
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);
  const [quizFinished, setQuizFinished] = useState(false);

  const generatedVocabQuestions = useMemo(() => {
    if (activeCards.length === 0) return [];
    const shuffled = [...activeCards].sort(() => Math.random() - 0.5);
    return shuffled.map((card, i) => {
      const otherMeanings = activeCards
        .filter((c) => c.id !== card.id)
        .map((c) => c.vietnameseMeaning)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);

      while (otherMeanings.length < 3) {
        otherMeanings.push(
          ["Sự phát triển", "Thói quen", "Quan điểm", "Hoàn cảnh"][
            otherMeanings.length
          ]
        );
      }

      const options = [...otherMeanings, card.vietnameseMeaning].sort(
        () => Math.random() - 0.5
      );
      const correctIndex = options.indexOf(card.vietnameseMeaning);

      return {
        id: `vq-${seed}-${i}`,
        word: card.word,
        ipa: card.ipa,
        quote: card.quoteFromBook,
        options,
        correctIndex,
        explanation: `${card.word} (${card.ipa}): ${card.vietnameseMeaning}`,
      };
    });
  }, [activeCards, seed]);

  // ============================================================================
  // MODE 3: WORD MATCHING GAME
  // ============================================================================
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [matchedIds, setMatchedIds] = useState<string[]>([]);
  const [wrongPair, setWrongPair] = useState<boolean>(false);

  const matchingBatch = useMemo(() => {
    const batch = [...activeCards]
      .sort(() => Math.random() - 0.5)
      .slice(0, 6);
    const leftItems = batch.map((c) => ({
      id: c.id,
      text: c.word,
      sub: c.ipa,
    }));
    const rightItems = [...batch]
      .sort(() => Math.random() - 0.5)
      .map((c) => ({
        id: c.id,
        meaning: c.vietnameseMeaning,
      }));
    return { leftItems, rightItems };
  }, [activeCards, seed]);

  const handleMatchRight = (rightId: string) => {
    if (!selectedLeft) return;
    if (selectedLeft === rightId) {
      setMatchedIds((prev) => [...prev, rightId]);
      setSelectedLeft(null);
      setWrongPair(false);
    } else {
      setWrongPair(true);
      setTimeout(() => setWrongPair(false), 600);
    }
  };

  // ============================================================================
  // MODE 4: ACTIVE RECALL TYPING
  // ============================================================================
  const [typingIdx, setTypingIdx] = useState(0);
  const [typingInput, setTypingInput] = useState("");
  const [typingChecked, setTypingChecked] = useState(false);
  const [showTypingHint, setShowTypingHint] = useState(false);

  const currentTypingCard =
    activeCards.length > 0 ? activeCards[typingIdx % activeCards.length] : null;

  return (
    <div className="space-y-6">
      {/* Top Filter: Select Specific Chapter in this Course & Mode */}
      <div className="flex flex-col gap-4 rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-4 shadow-[4px_4px_0_0_#F5EFE6]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#3A3832] pb-3">
          <div className="flex items-center gap-2 text-xs font-extrabold text-[#F3C969]">
            <BookOpen className="h-4 w-4 text-[#F3C969]" />
            <span>Đang ôn tập & kiểm tra theo Chương:</span>
          </div>
          <div className="w-full sm:w-96">
            <CustomSelect
              value={selectedChapterId}
              onChange={(newVal) => {
                setSelectedChapterId(newVal);
                setExamStarted(false);
                setExamFinished(false);
                setAiGeneratedExam(null);
                setQuizIdx(0);
                setMatchedIds([]);
              }}
              size="sm"
              accentColor="indigo"
              icon={<Layers className="h-3.5 w-3.5" />}
              options={course.chapters.map((ch) => ({
                value: ch.id,
                label: `Chương ${ch.index}: ${ch.title}`,
                badge: ch.isGenerated ? "Đã soạn" : "Chưa soạn",
              }))}
            />
          </div>
        </div>

        {/* 5 Practice & Exam Sub-Tabs */}
        <div className="flex overflow-x-auto no-scrollbar gap-2 pb-1 sm:flex-wrap sm:pb-0">
          <button
            type="button"
            onClick={() => setMode("timed_chapter_exam")}
            className={`flex shrink-0 whitespace-nowrap items-center gap-2 rounded-xl border-2 px-3.5 sm:px-4 py-2 text-xs font-extrabold transition-transform active:translate-x-[1px] active:translate-y-[1px] cursor-pointer ${
              mode === "timed_chapter_exam"
                ? "border-[#F5EFE6] bg-[#F3C969] text-[#141413] shadow-[3px_3px_0_0_#F5EFE6]"
                : "border-[#3A3832] bg-[#141413] text-[#F3C969] hover:border-[#F5EFE6]"
            }`}
          >
            <Timer className="h-4 w-4 shrink-0" />
            1. Đề Thi Kiểm Tra Chương (Tính giờ)
          </button>
          <button
            type="button"
            onClick={() => setMode("vocab_quiz")}
            className={`flex shrink-0 whitespace-nowrap items-center gap-2 rounded-xl border-2 px-3.5 sm:px-4 py-2 text-xs font-extrabold transition-transform active:translate-x-[1px] active:translate-y-[1px] cursor-pointer ${
              mode === "vocab_quiz"
                ? "border-[#F5EFE6] bg-[#C8B6FF] text-[#141413] shadow-[3px_3px_0_0_#F5EFE6]"
                : "border-[#3A3832] bg-[#141413] text-[#F5EFE6] hover:border-[#F5EFE6]"
            }`}
          >
            <Trophy className="h-4 w-4 shrink-0" />
            2. Phản Xạ Trắc Nghiệm Từ Vựng ({activeCards.length} từ)
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("matching");
              setMatchedIds([]);
              setSelectedLeft(null);
            }}
            className={`flex shrink-0 whitespace-nowrap items-center gap-2 rounded-xl border-2 px-3.5 sm:px-4 py-2 text-xs font-extrabold transition-transform active:translate-x-[1px] active:translate-y-[1px] cursor-pointer ${
              mode === "matching"
                ? "border-[#F5EFE6] bg-[#B8D8F8] text-[#141413] shadow-[3px_3px_0_0_#F5EFE6]"
                : "border-[#3A3832] bg-[#141413] text-[#F5EFE6] hover:border-[#F5EFE6]"
            }`}
          >
            <Gamepad2 className="h-4 w-4 shrink-0" />
            3. Ghép Thẻ Từ – Nghĩa
          </button>
          <button
            type="button"
            onClick={() => setMode("typing")}
            className={`flex shrink-0 whitespace-nowrap items-center gap-2 rounded-xl border-2 px-3.5 sm:px-4 py-2 text-xs font-extrabold transition-transform active:translate-x-[1px] active:translate-y-[1px] cursor-pointer ${
              mode === "typing"
                ? "border-[#F5EFE6] bg-[#F3C969] text-[#141413] shadow-[3px_3px_0_0_#F5EFE6]"
                : "border-[#3A3832] bg-[#141413] text-[#F5EFE6] hover:border-[#F5EFE6]"
            }`}
          >
            <Keyboard className="h-4 w-4 shrink-0" />
            4. Nghe / Nhìn Nghĩa Gõ Từ
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("pronunciation_arena");
              stopAllSpeech();
              setSpeakingIdx(0);
              setSpeechEvaluation(null);
              setSpeakingTranscript("");
            }}
            className={`flex shrink-0 whitespace-nowrap items-center gap-2 rounded-xl border-2 px-3.5 sm:px-4 py-2 text-xs font-extrabold transition-transform active:translate-x-[1px] active:translate-y-[1px] cursor-pointer ${
              mode === "pronunciation_arena"
                ? "border-[#F5EFE6] bg-[#A7D7A9] text-[#141413] shadow-[3px_3px_0_0_#F5EFE6]"
                : "border-[#3A3832] bg-[#141413] text-[#A7D7A9] hover:border-[#F5EFE6]"
            }`}
          >
            <Mic className="h-4 w-4 shrink-0" />
            5. Luyện Đọc &amp; Chấm Âm AI ({speakingItems.length})
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* MODE 1: TIMED CHAPTER EXAM (Tự động tạo bài thi kiểm tra chương)      */}
      {/* ===================================================================== */}
      {mode === "timed_chapter_exam" && (
        <div className="rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-6 shadow-[4px_4px_0_0_#F5EFE6]">
          {!examStarted && !examFinished ? (
            /* Pre-Exam Setup Screen */
            <div className="space-y-6 py-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl border-2 border-[#F5EFE6] bg-[#F3C969] text-[#141413] shadow-[3px_3px_0_0_#F5EFE6]">
                <Timer className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-xl font-extrabold text-[#F5EFE6]">
                  Bài Thi Kiểm Tra: {targetChapter.title}
                </h3>
                <p className="mx-auto mt-1 max-w-xl text-xs leading-relaxed text-[#B8B2A6]">
                  Bài thi kiểm tra toàn diện <strong className="text-[#F5EFE6]">Từ vựng & Ngữ pháp</strong> của chương này.
                </p>
              </div>

              {/* Exam Stats & Time Setting */}
              <div className="mx-auto flex max-w-xl flex-wrap items-center justify-center gap-4 rounded-xl border-2 border-[#3A3832] bg-[#141413] p-4 text-xs">
                <div>
                  <span className="text-[#B8B2A6]">Tổng số câu hỏi: </span>
                  <strong className="text-[#F5EFE6]">
                    {examQuestions.length} câu
                  </strong>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#B8B2A6]">
                    Thời gian trả lời mỗi câu:
                  </span>
                  <div className="w-40 text-left">
                    <CustomSelect
                      value={secondsPerQuestion}
                      onChange={(newVal) =>
                        setSecondsPerQuestion(Number(newVal))
                      }
                      size="sm"
                      accentColor="amber"
                      icon={<Timer className="h-3.5 w-3.5" />}
                      options={[
                        { value: 15, label: "15 giây / câu" },
                        { value: 20, label: "20 giây / câu" },
                        { value: 30, label: "30 giây / câu" },
                        { value: 45, label: "45 giây / câu" },
                        { value: 60, label: "60 giây / câu" },
                      ]}
                    />
                  </div>
                </div>
              </div>

              {aiExamError && (
                <div className="mx-auto max-w-lg rounded-lg border-2 border-[#FF8A8A] bg-[#141413] p-3 text-xs font-bold text-[#FF8A8A]">
                  {aiExamError}
                </div>
              )}

              {isGeneratingAiExam ? (
                <div className="mt-4">
                  <ExamGeneratingLoader />
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    disabled={examQuestions.length === 0}
                    onClick={startTimedExam}
                    className="inline-flex items-center gap-2 rounded-xl border-2 border-[#F5EFE6] bg-[#A7D7A9] px-6 py-3 text-sm font-extrabold text-[#141413] shadow-[4px_4px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6] disabled:opacity-40 cursor-pointer"
                  >
                    <Play className="h-4 w-4" />
                    Bắt Đầu Làm Bài Thi Ngay ({examQuestions.length} câu)
                  </button>

                  <button
                    type="button"
                    disabled={isGeneratingAiExam}
                    onClick={handleGenerateFreshAiExamForChapter}
                    className="inline-flex items-center gap-2 rounded-xl border-2 border-[#F5EFE6] bg-[#F3C969] px-5 py-3 text-xs font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6] disabled:opacity-50 cursor-pointer"
                  >
                    <Sparkles className="h-4 w-4" />
                    AI Tạo Bộ Đề Thi Mới Tinh Cho Chương Này
                  </button>
                </div>
              )}
            </div>
          ) : examFinished ? (
            /* Exam Summary & Score Report */
            <div className="space-y-6">
              <div className="rounded-xl border-2 border-[#F5EFE6] bg-[#141413] p-6 text-center space-y-3">
                <Trophy className="mx-auto h-12 w-12 text-[#F3C969]" />
                <h3 className="text-2xl font-extrabold text-[#F5EFE6]">
                  Kết Quả Bài Thi Kiểm Tra Chương
                </h3>
                <p className="text-sm text-[#B8B2A6]">
                  Số câu hoàn thành đạt yêu cầu:{" "}
                  <strong className="text-[#A7D7A9]">
                    {examResults.filter((r) => r.isCorrect).length} /{" "}
                    {examResults.length}
                  </strong>{" "}
                  (
                  {examResults.length > 0
                    ? Math.round(
                        (examResults.filter((r) => r.isCorrect).length /
                          examResults.length) *
                          100
                      )
                    : 0}
                  %)
                </p>
                <div className="flex flex-wrap justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSeed((s) => s + 1);
                      startTimedExam();
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border-2 border-[#F5EFE6] bg-[#A7D7A9] px-5 py-2.5 text-xs font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] cursor-pointer"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Thi Lại Chương Này
                  </button>
                  <button
                    type="button"
                    disabled={isGeneratingAiExam}
                    onClick={handleGenerateFreshAiExamForChapter}
                    className="inline-flex items-center gap-2 rounded-xl border-2 border-[#F5EFE6] bg-[#F3C969] px-5 py-2.5 text-xs font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] cursor-pointer"
                  >
                    <Sparkles className="h-4 w-4" />
                    AI Tạo Đề Khác Cho Chương Này
                  </button>
                </div>
              </div>

              {/* Detailed Review of Each Question */}
              <div className="space-y-3">
                <h4 className="text-sm font-extrabold text-[#F5EFE6]">
                  Chi tiết từng câu trong bài thi:
                </h4>
                {examResults.map((res, i) => (
                  <div
                    key={i}
                    className={`rounded-xl border-2 p-4 text-xs space-y-1.5 bg-[#141413] ${
                      res.isCorrect ? "border-[#A7D7A9]" : "border-[#FF8A8A]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 font-bold">
                      <span className="text-[#F5EFE6]">
                        Câu {i + 1} ({res.question.categoryLabel}):{" "}
                        {res.question.promptText}
                      </span>
                      <span
                        className={`inline-flex shrink-0 items-center gap-1 font-extrabold ${
                          res.isCorrect ? "text-[#A7D7A9]" : "text-[#FF8A8A]"
                        }`}
                      >
                        {res.timedOut ? (
                          <>
                            <Clock className="h-3.5 w-3.5" />
                            <span>Hết giờ</span>
                          </>
                        ) : res.translationScore !== undefined ? (
                          `Điểm dịch AI: ${res.translationScore}%`
                        ) : res.isCorrect ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Đúng</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3.5 w-3.5" />
                            <span>Sai</span>
                          </>
                        )}
                      </span>
                    </div>
                    <p className="text-[#B8B2A6]">
                      Câu trả lời của bạn: <strong className="text-[#F5EFE6]">{res.userAnswerText}</strong>
                    </p>
                    {res.question.explanation && (
                      <p className="flex items-start gap-1.5 text-[#B8D8F8]">
                        <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[#F3C969]" />
                        <span>Giải thích: {res.question.explanation}</span>
                      </p>
                    )}
                    {res.translationEval && (
                      <p className="flex items-start gap-1.5 text-[#A7D7A9]">
                        <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[#A7D7A9]" />
                        <span>
                          Bản dịch gợi ý:{" "}
                          {res.translationEval.suggestedTranslation}
                        </span>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : currentExamQ ? (
            /* Active Timed Question View */
            <div className="space-y-5">
              {/* Top Question Bar & Countdown Timer */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-[#3A3832] bg-[#141413] px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <span className="rounded-lg border-2 border-[#F5EFE6] bg-[#C8B6FF] px-2.5 py-0.5 text-xs font-extrabold text-[#141413]">
                    Câu {examStepIndex + 1} / {examQuestions.length}
                  </span>
                  <span className="text-xs font-bold text-[#F5EFE6]">
                    {currentExamQ.categoryLabel}
                  </span>
                </div>

                {/* Timer Badge */}
                {isCurrentQuestionUntimed ? (
                  <div className="flex items-center gap-1.5 rounded-full border-2 border-[#F5EFE6] bg-[#A7D7A9] px-3.5 py-1 text-xs font-extrabold text-[#141413]">
                    <InfinityIcon className="h-4 w-4" />
                    <span>Câu Dịch Thuật — Không giới hạn thời gian</span>
                  </div>
                ) : (
                  <div
                    className={`flex items-center gap-2 rounded-full border-2 border-[#F5EFE6] px-3.5 py-1 text-xs font-extrabold text-[#141413] ${
                      timeLeft <= 5
                        ? "bg-[#FF8A8A] animate-pulse"
                        : timeLeft <= 10
                        ? "bg-[#F3C969]"
                        : "bg-[#B8D8F8]"
                    }`}
                  >
                    <Timer className="h-4 w-4" />
                    <span>Thời gian còn lại: {timeLeft} giây</span>
                  </div>
                )}
              </div>

              {/* Visual Progress Bar for Timer */}
              {!isCurrentQuestionUntimed && (
                <div className="h-2.5 w-full overflow-hidden rounded-full border-2 border-[#F5EFE6] bg-[#141413]">
                  <div
                    className={`h-full transition-all duration-1000 ${
                      timeLeft <= 5
                        ? "bg-[#FF8A8A]"
                        : timeLeft <= 10
                        ? "bg-[#F3C969]"
                        : "bg-[#B8D8F8]"
                    }`}
                    style={{
                      width: `${Math.max(
                        0,
                        Math.round((timeLeft / secondsPerQuestion) * 100)
                      )}%`,
                    }}
                  />
                </div>
              )}

              {/* Question Prompt Box */}
              <div className="rounded-xl border-2 border-[#3A3832] bg-[#141413] p-6 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <h4 className="text-base font-extrabold leading-relaxed text-[#F5EFE6] md:text-lg">
                    {currentExamQ.promptText}
                  </h4>
                  <AudioSpeakButton
                    text={currentExamQ.promptText}
                    showLabel={false}
                    className="shrink-0 rounded-xl border-2 border-[#F5EFE6] bg-[#B8D8F8] p-2 text-[#141413]"
                  />
                </div>
                {currentExamQ.subHint && (
                  <p className="flex items-center gap-1.5 text-xs text-[#F3C969]">
                    <Lightbulb className="h-3.5 w-3.5 shrink-0 text-[#F3C969]" />
                    <span>{currentExamQ.subHint}</span>
                  </p>
                )}
              </div>

              {/* Render Input by Question Type */}
              {currentExamQ.type === "quiz" && currentExamQ.options && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {currentExamQ.options.map((opt, oIdx) => {
                    const isPicked = userQuizChoice === oIdx;
                    const isRight = currentExamQ.correctIndex === oIdx;
                    let cls =
                      "border-[#3A3832] bg-[#141413] text-[#F5EFE6] hover:border-[#F5EFE6]";
                    if (isQuestionLocked) {
                      if (isRight)
                        cls =
                          "border-[#F5EFE6] bg-[#A7D7A9] text-[#141413] font-extrabold";
                      else if (isPicked)
                        cls =
                          "border-[#F5EFE6] bg-[#FF8A8A] text-[#141413] font-extrabold";
                    } else if (isPicked) {
                      cls =
                        "border-[#F5EFE6] bg-[#F3C969] text-[#141413] font-extrabold shadow-[3px_3px_0_0_#F5EFE6]";
                    }

                    return (
                      <button
                        key={oIdx}
                        type="button"
                        disabled={isQuestionLocked}
                        onClick={() => setUserQuizChoice(oIdx)}
                        className={`rounded-xl border-2 p-4 text-left text-sm transition-colors cursor-pointer ${cls}`}
                      >
                        <span className="mr-2 font-black">
                          {String.fromCharCode(65 + oIdx)}.
                        </span>
                        {opt}
                      </button>
                    );
                  })}
                </div>
              )}

              {currentExamQ.type === "cloze" && (
                <div className="space-y-3">
                  <input
                    type="text"
                    disabled={isQuestionLocked}
                    value={userClozeInput}
                    onChange={(e) => setUserClozeInput(e.target.value)}
                    placeholder="Nhập từ vựng / cấu trúc ngữ pháp còn thiếu vào đây..."
                    className="w-full rounded-lg border-2 border-[#F5EFE6] bg-[#141413] px-4 py-3 text-sm text-[#F5EFE6] focus:border-[#F3C969] focus:shadow-[2px_2px_0_0_#F3C969] focus:outline-none"
                  />
                </div>
              )}

              {currentExamQ.type === "translation" && (
                <div className="space-y-3">
                  <textarea
                    rows={3}
                    disabled={isQuestionLocked || isEvaluatingTranslation}
                    value={userTranslationInput}
                    onChange={(e) => setUserTranslationInput(e.target.value)}
                    placeholder="Nhập bản dịch tiếng Việt của bạn (Không giới hạn thời gian)..."
                    className="w-full rounded-lg border-2 border-[#F5EFE6] bg-[#141413] p-3.5 text-sm text-[#F5EFE6] focus:border-[#F3C969] focus:shadow-[2px_2px_0_0_#F3C969] focus:outline-none"
                  />
                </div>
              )}

              {/* Action Buttons & Instant Feedback */}
              {!isQuestionLocked ? (
                <div className="flex justify-end">
                  {currentExamQ.type === "translation" ? (
                    <button
                      type="button"
                      disabled={
                        isEvaluatingTranslation || !userTranslationInput.trim()
                      }
                      onClick={handleEvaluateUntimedTranslation}
                      className="flex items-center gap-2 rounded-xl border-2 border-[#F5EFE6] bg-[#A7D7A9] px-6 py-2.5 text-xs font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-40 cursor-pointer"
                    >
                      {isEvaluatingTranslation ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          AI đang chấm điểm câu dịch...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          Nộp Câu Dịch & Chấm Điểm AI
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={
                        currentExamQ.type === "quiz"
                          ? userQuizChoice === null
                          : !userClozeInput.trim()
                      }
                      onClick={handleConfirmTimedAnswer}
                      className="rounded-xl border-2 border-[#F5EFE6] bg-[#A7D7A9] px-6 py-2.5 text-xs font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-40 cursor-pointer"
                    >
                      Chốt Đáp Án
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4 rounded-xl border-2 border-[#3A3832] bg-[#141413] p-4">
                  {timeLeft <= 0 && !isCurrentQuestionUntimed && (
                    <div className="flex items-center gap-2 text-xs font-extrabold text-[#FF8A8A]">
                      <XCircle className="h-4 w-4" />
                      <span>Hết thời gian trả lời cho câu hỏi này!</span>
                    </div>
                  )}

                  {currentExamQ.type === "cloze" && (
                    <div className="text-xs text-[#A7D7A9]">
                      Đáp án đúng:{" "}
                      <strong>{currentExamQ.correctTextAnswer}</strong>
                    </div>
                  )}

                  {currentExamQ.explanation && (
                    <p className="flex items-start gap-1.5 text-xs text-[#F5EFE6]">
                      <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[#F3C969]" />
                      <span>
                        <strong>Giải thích:</strong> {currentExamQ.explanation}
                      </span>
                    </p>
                  )}

                  {currentTranslationEval && (
                    <div className="space-y-2 text-xs">
                      <div className="text-sm font-extrabold text-[#B8D8F8]">
                        Điểm độ gần đúng AI chấm:{" "}
                        <span className="text-[#A7D7A9]">
                          {currentTranslationEval.overallScore}%
                        </span>{" "}
                        (Độ sát nghĩa: {currentTranslationEval.semanticAccuracy}
                        % • Ngữ pháp:{" "}
                        {currentTranslationEval.grammarAndStructure}%)
                      </div>
                      <p className="flex items-start gap-1.5 text-[#A7D7A9]">
                        <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[#A7D7A9]" />
                        <span>
                          Bản dịch gợi ý:{" "}
                          {currentTranslationEval.suggestedTranslation}
                        </span>
                      </p>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleNextExamQuestion}
                      className="flex items-center gap-1.5 rounded-xl border-2 border-[#F5EFE6] bg-[#F3C969] px-5 py-2 text-xs font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] cursor-pointer"
                    >
                      <span>
                        {examStepIndex + 1 >= examQuestions.length
                          ? "Xem Tổng Kết Điểm Thi"
                          : "Sang Câu Tiếp Theo"}
                      </span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODE 2: VOCAB SPEED QUIZ                                              */}
      {/* ===================================================================== */}
      {mode === "vocab_quiz" && (
        <div className="rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-6 shadow-[4px_4px_0_0_#F5EFE6]">
          {generatedVocabQuestions.length === 0 ? (
            <p className="text-center text-sm text-[#B8B2A6]">
              Chương này chưa có từ vựng nào. Hãy bấm &ldquo;AI Soạn Bài Học Chương Này&rdquo; trước nhé!
            </p>
          ) : quizFinished ? (
            <div className="space-y-4 py-6 text-center">
              <Trophy className="mx-auto h-12 w-12 text-[#F3C969]" />
              <h3 className="text-2xl font-extrabold text-[#F5EFE6]">
                Hoàn thành ôn phản xạ từ vựng!
              </h3>
              <p className="text-base text-[#B8B2A6]">
                Điểm số của bạn:{" "}
                <strong className="text-[#A7D7A9]">
                  {quizScore} / {generatedVocabQuestions.length}
                </strong>
              </p>
              <button
                type="button"
                onClick={() => {
                  setSeed((s) => s + 1);
                  setQuizIdx(0);
                  setQuizScore(0);
                  setSelectedOpt(null);
                  setQuizFinished(false);
                }}
                className="inline-flex items-center gap-2 rounded-xl border-2 border-[#F5EFE6] bg-[#F3C969] px-5 py-2.5 text-xs font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" />
                Làm Lại (Xáo trộn thứ tự)
              </button>
            </div>
          ) : (
            (() => {
              const q = generatedVocabQuestions[quizIdx];
              return (
                <div className="space-y-5">
                  <div className="flex items-center justify-between text-xs text-[#B8B2A6]">
                    <span>
                      Câu{" "}
                      <strong className="text-[#F5EFE6]">
                        {quizIdx + 1} / {generatedVocabQuestions.length}
                      </strong>
                    </span>
                    <span className="rounded-full border-2 border-[#F5EFE6] bg-[#A7D7A9] px-3 py-0.5 font-extrabold text-[#141413]">
                      Điểm: {quizScore}
                    </span>
                  </div>

                  <div className="rounded-xl border-2 border-[#3A3832] bg-[#141413] p-6 text-center">
                    <div className="flex items-center justify-center gap-3">
                      <span className="text-3xl font-extrabold text-[#F5EFE6]">
                        {q.word}
                      </span>
                      <AudioSpeakButton
                        text={q.word}
                        showLabel={false}
                        className="rounded-xl border-2 border-[#F5EFE6] bg-[#B8D8F8] p-2 text-[#141413]"
                      />
                    </div>
                    <p className="mt-1 font-mono text-sm font-bold text-[#F3C969]">
                      {q.ipa}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {q.options.map((opt, idx) => {
                      const isPicked = selectedOpt === idx;
                      const isRight = idx === q.correctIndex;
                      let style =
                        "border-[#3A3832] bg-[#141413] text-[#F5EFE6] hover:border-[#F5EFE6]";
                      if (selectedOpt !== null) {
                        if (isRight) {
                          style =
                            "border-[#F5EFE6] bg-[#A7D7A9] text-[#141413] font-extrabold";
                        } else if (isPicked) {
                          style =
                            "border-[#F5EFE6] bg-[#FF8A8A] text-[#141413] font-extrabold";
                        }
                      }

                      return (
                        <button
                          key={idx}
                          type="button"
                          disabled={selectedOpt !== null}
                          onClick={() => {
                            setSelectedOpt(idx);
                            if (isRight) setQuizScore((s) => s + 1);
                          }}
                          className={`rounded-xl border-2 p-4 text-left text-sm transition-colors cursor-pointer ${style}`}
                        >
                          <span className="mr-2 font-black">
                            {String.fromCharCode(65 + idx)}.
                          </span>
                          {opt}
                        </button>
                      );
                    })}
                  </div>

                  {selectedOpt !== null && (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-[#3A3832] bg-[#141413] p-4">
                      <span className="text-xs text-[#F5EFE6]">
                        {q.explanation}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedOpt(null);
                          if (quizIdx + 1 >= generatedVocabQuestions.length) {
                            setQuizFinished(true);
                            const total = generatedVocabQuestions.length;
                            const pct =
                              total > 0
                                ? Math.round((quizScore / total) * 100)
                                : 0;
                            if (pct >= 70) {
                              triggerChibiCelebrate({
                                badge: "⚡ PHẢN XẠ TỪ VỰNG ĐỈNH!",
                                message: `LA LA LA~ Đúng ${quizScore}/${total} câu (${pct}%)!! Quá siêu luôn!! 🎶✨`,
                                subtext: "Tốc độ ghi nhớ từ vựng rất ấn tượng!",
                              });
                            }
                          } else {
                            setQuizIdx((i) => i + 1);
                          }
                        }}
                        className="shrink-0 rounded-xl border-2 border-[#F5EFE6] bg-[#F3C969] px-4 py-2 text-xs font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] cursor-pointer"
                      >
                        Câu tiếp theo →
                      </button>
                    </div>
                  )}
                </div>
              );
            })()
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODE 3: WORD MATCHING GAME                                            */}
      {/* ===================================================================== */}
      {mode === "matching" && (
        <div className="rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-6 space-y-4 shadow-[4px_4px_0_0_#F5EFE6]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-extrabold text-[#F5EFE6]">
                Ghép Cặp Từ Vựng & Nghĩa Tiếng Việt
              </h3>
              <p className="text-xs text-[#B8B2A6]">
                Bấm chọn 1 từ ở cột bên trái, sau đó bấm vào nghĩa tương ứng ở cột bên phải
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSeed((s) => s + 1);
                setMatchedIds([]);
                setSelectedLeft(null);
              }}
              className="flex items-center gap-1.5 rounded-xl border-2 border-[#F5EFE6] bg-[#141413] px-3.5 py-2 text-xs font-bold text-[#F5EFE6] shadow-[2px_2px_0_0_#F5EFE6] hover:bg-[#F3C969] hover:text-[#141413] transition-colors cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Đổi 6 từ khác trong chương
            </button>
          </div>

          {matchedIds.length === matchingBatch.leftItems.length &&
          matchingBatch.leftItems.length > 0 ? (
            <div className="py-8 text-center space-y-3">
              <CheckCircle2 className="mx-auto h-12 w-12 text-[#A7D7A9]" />
              <h4 className="text-lg font-extrabold text-[#F5EFE6]">
                Xuất sắc! Bạn đã ghép đúng toàn bộ các cặp từ!
              </h4>
              <button
                type="button"
                onClick={() => {
                  setSeed((s) => s + 1);
                  setMatchedIds([]);
                }}
                className="rounded-xl border-2 border-[#F5EFE6] bg-[#A7D7A9] px-5 py-2 text-xs font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] cursor-pointer"
              >
                Chơi tiếp lượt mới
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2.5">
                {matchingBatch.leftItems.map((item) => {
                  const isMatched = matchedIds.includes(item.id);
                  const isSelected = selectedLeft === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={isMatched}
                      onClick={() => {
                        setSelectedLeft(item.id);
                        speakSmart(item.text);
                      }}
                      className={`flex w-full items-center justify-between rounded-xl border-2 p-3.5 text-left transition-colors cursor-pointer ${
                        isMatched
                          ? "border-[#A7D7A9] bg-[#141413] text-[#A7D7A9] opacity-50"
                          : isSelected
                          ? "border-[#F5EFE6] bg-[#F3C969] text-[#141413] shadow-[3px_3px_0_0_#F5EFE6]"
                          : "border-[#3A3832] bg-[#141413] text-[#F5EFE6] hover:border-[#F5EFE6]"
                      }`}
                    >
                      <div>
                        <div className="text-sm font-extrabold">{item.text}</div>
                        <div className="font-mono text-xs opacity-80">
                          {item.sub}
                        </div>
                      </div>
                      <Volume2 className="h-4 w-4 opacity-80" />
                    </button>
                  );
                })}
              </div>

              <div className="space-y-2.5">
                {matchingBatch.rightItems.map((item) => {
                  const isMatched = matchedIds.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={isMatched}
                      onClick={() => handleMatchRight(item.id)}
                      className={`flex min-h-[62px] w-full items-center rounded-xl border-2 p-3.5 text-left text-xs font-bold transition-colors cursor-pointer ${
                        isMatched
                          ? "border-[#A7D7A9] bg-[#141413] text-[#A7D7A9] opacity-50"
                          : wrongPair
                          ? "border-[#FF8A8A] bg-[#141413] text-[#F5EFE6]"
                          : "border-[#3A3832] bg-[#141413] text-[#F5EFE6] hover:border-[#F5EFE6]"
                      }`}
                    >
                      {item.meaning}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODE 4: ACTIVE RECALL TYPING                                          */}
      {/* ===================================================================== */}
      {mode === "typing" && currentTypingCard && (
        <div className="rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-6 space-y-5 shadow-[4px_4px_0_0_#F5EFE6]">
          <div className="flex items-center justify-between text-xs text-[#B8B2A6]">
            <span>
              Từ{" "}
              <strong className="text-[#F5EFE6]">
                {(typingIdx % activeCards.length) + 1} / {activeCards.length}
              </strong>
            </span>
            <button
              type="button"
              onClick={() => setShowTypingHint(!showTypingHint)}
              className="flex items-center gap-1 font-bold text-[#F3C969] hover:underline cursor-pointer"
            >
              <Lightbulb className="h-3.5 w-3.5" />
              {showTypingHint ? "Ẩn gợi ý" : "Gợi ý chữ cái đầu & Phiên âm"}
            </button>
          </div>

          <div className="rounded-xl border-2 border-[#3A3832] bg-[#141413] p-6 text-center space-y-3">
            <div className="text-xs font-extrabold uppercase tracking-wider text-[#A7D7A9]">
              Hãy gõ lại từ vựng có nghĩa sau:
            </div>
            <h3 className="text-xl font-extrabold text-[#F5EFE6]">
              {currentTypingCard.vietnameseMeaning}
            </h3>
            <p className="text-xs text-[#B8B2A6]">
              ({currentTypingCard.partOfSpeech} • CEFR{" "}
              {currentTypingCard.cefrLevel})
            </p>
            <AudioSpeakButton
              text={currentTypingCard.word}
              label="Bấm để nghe phát âm từ này"
              className="inline-flex items-center gap-2 rounded-xl border-2 border-[#F5EFE6] bg-[#B8D8F8] px-4 py-2 text-xs font-extrabold text-[#141413] shadow-[2px_2px_0_0_#F5EFE6]"
            />
            {showTypingHint && (
              <p className="font-mono text-xs font-bold text-[#F3C969]">
                Gợi ý: Bắt đầu bằng &ldquo;{currentTypingCard.word.slice(0, 1)}
                ...&rdquo; • Phiên âm: {currentTypingCard.ipa}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={typingInput}
              onChange={(e) => {
                setTypingInput(e.target.value);
                setTypingChecked(false);
              }}
              placeholder="Gõ từ vựng (Tiếng Anh / Chữ Hán)..."
              className="flex-1 rounded-lg border-2 border-[#F5EFE6] bg-[#141413] px-4 py-2.5 text-sm text-[#F5EFE6] focus:border-[#F3C969] focus:shadow-[2px_2px_0_0_#F3C969] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setTypingChecked(true)}
              className="rounded-xl border-2 border-[#F5EFE6] bg-[#A7D7A9] px-5 py-2.5 text-xs font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] cursor-pointer"
            >
              Kiểm tra
            </button>
            <button
              type="button"
              onClick={() => {
                setTypingIdx((i) => i + 1);
                setTypingInput("");
                setTypingChecked(false);
                setShowTypingHint(false);
              }}
              className="rounded-xl border-2 border-[#F5EFE6] bg-[#141413] px-4 py-2.5 text-xs font-bold text-[#F5EFE6] shadow-[2px_2px_0_0_#F5EFE6] hover:bg-[#F3C969] hover:text-[#141413] transition-colors cursor-pointer"
            >
              Từ tiếp theo →
            </button>
          </div>

          {typingChecked && (
            <div
              className={`rounded-xl border-2 p-4 text-xs bg-[#141413] ${
                typingInput.trim().toLowerCase() ===
                currentTypingCard.word.trim().toLowerCase()
                  ? "border-[#A7D7A9] text-[#A7D7A9]"
                  : "border-[#FF8A8A] text-[#FF8A8A]"
              }`}
            >
              <div className="font-extrabold text-sm">
                Đáp án chuẩn: {currentTypingCard.word} ({currentTypingCard.ipa})
              </div>
              <p className="mt-1 italic text-[#F5EFE6]">
                &ldquo;{currentTypingCard.quoteFromBook}&rdquo; →{" "}
                {currentTypingCard.quoteTranslation}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODE 5: AI PRONUNCIATION & SPEAKING ARENA                             */}
      {/* ===================================================================== */}
      {mode === "pronunciation_arena" && (
        <div className="rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-6 space-y-6 shadow-[4px_4px_0_0_#F5EFE6]">
          {/* Header & Sub-filter */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-[#3A3832] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg border-2 border-[#F5EFE6] bg-[#A7D7A9] text-[#141413]">
                  <Mic className="h-4 w-4" />
                </span>
                <h3 className="text-base font-extrabold text-[#F5EFE6]">
                  Phòng Luyện Đọc Phát Âm & Chấm Điểm AI
                </h3>
              </div>
              <p className="mt-1 text-xs text-[#B8B2A6]">
                Luyện đọc to từng từ vựng hoặc câu mẫu trong bài. AI sẽ phân tích âm thanh, tính độ chính xác (%) và chỉ rõ từng từ sai kèm cách sửa khẩu hình.
              </p>
            </div>

            {/* Scope Filter Tabs */}
            <div className="flex items-center gap-1 rounded-xl border-2 border-[#3A3832] bg-[#141413] p-1 text-xs">
              <button
                type="button"
                onClick={() => {
                  setSpeakingScope("all");
                  setSpeakingIdx(0);
                  setSpeechEvaluation(null);
                  setSpeakingTranscript("");
                }}
                className={`rounded-lg px-3 py-1.5 font-extrabold transition-colors cursor-pointer ${
                  speakingScope === "all"
                    ? "bg-[#A7D7A9] text-[#141413]"
                    : "text-[#B8B2A6] hover:text-[#F5EFE6]"
                }`}
              >
                Tất cả ({speakingItems.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setSpeakingScope("vocab");
                  setSpeakingIdx(0);
                  setSpeechEvaluation(null);
                  setSpeakingTranscript("");
                }}
                className={`rounded-lg px-3 py-1.5 font-extrabold transition-colors cursor-pointer ${
                  speakingScope === "vocab"
                    ? "bg-[#A7D7A9] text-[#141413]"
                    : "text-[#B8B2A6] hover:text-[#F5EFE6]"
                }`}
              >
                Từ vựng ({activeCards.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setSpeakingScope("sentences");
                  setSpeakingIdx(0);
                  setSpeechEvaluation(null);
                  setSpeakingTranscript("");
                }}
                className={`rounded-lg px-3 py-1.5 font-extrabold transition-colors cursor-pointer ${
                  speakingScope === "sentences"
                    ? "bg-[#A7D7A9] text-[#141413]"
                    : "text-[#B8B2A6] hover:text-[#F5EFE6]"
                }`}
              >
                Câu trong sách
              </button>
            </div>
          </div>

          {speakingItems.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <AlertCircle className="mx-auto h-10 w-10 text-[#B8B2A6]" />
              <p className="text-sm text-[#B8B2A6]">
                Chưa có mục luyện đọc nào trong phạm vi này của chương. Hãy chọn phạm vi &ldquo;Tất cả&rdquo; hoặc chọn chương khác.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Progress and Score Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="rounded-lg border-2 border-[#3A3832] bg-[#141413] px-2.5 py-1 font-extrabold text-[#F5EFE6]">
                    Mục {speakingIdx + 1} / {speakingItems.length}
                  </span>
                  <span
                    className={`rounded-full border-2 border-[#F5EFE6] px-2.5 py-0.5 font-extrabold uppercase tracking-wider text-[11px] text-[#141413] ${
                      currentSpeakingItem.type === "vocab"
                        ? "bg-[#C8B6FF]"
                        : "bg-[#F3C969]"
                    }`}
                  >
                    {currentSpeakingItem.type === "vocab" ? "Từ vựng cốt lõi" : "Câu thực tế trong bài"}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {Object.keys(speechScores).length > 0 && (
                    <span className="flex items-center gap-1.5 rounded-full border-2 border-[#F5EFE6] bg-[#A7D7A9] px-2.5 py-0.5 text-[#141413] font-extrabold">
                      <Award className="h-3.5 w-3.5" />
                      Đã chấm {Object.keys(speechScores).length} mục • TB:{" "}
                      {Math.round(
                        Object.values(speechScores).reduce((a, b) => a + b, 0) /
                          Object.values(speechScores).length
                      )}
                      %
                    </span>
                  )}

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={speakingIdx === 0}
                      onClick={() => {
                        stopSpeakingRecording();
                        setSpeakingIdx((i) => Math.max(0, i - 1));
                        setSpeechEvaluation(null);
                        setSpeakingTranscript("");
                        setSpeakingError(null);
                      }}
                      className="rounded-lg border-2 border-[#F5EFE6] bg-[#141413] px-3 py-1.5 font-bold text-[#F5EFE6] hover:bg-[#F3C969] hover:text-[#141413] disabled:opacity-40 cursor-pointer"
                    >
                      ← Mục trước
                    </button>
                    <button
                      type="button"
                      disabled={speakingIdx >= speakingItems.length - 1}
                      onClick={() => {
                        stopSpeakingRecording();
                        setSpeakingIdx((i) => Math.min(speakingItems.length - 1, i + 1));
                        setSpeechEvaluation(null);
                        setSpeakingTranscript("");
                        setSpeakingError(null);
                      }}
                      className="rounded-lg border-2 border-[#F5EFE6] bg-[#141413] px-3 py-1.5 font-bold text-[#F5EFE6] hover:bg-[#F3C969] hover:text-[#141413] disabled:opacity-40 cursor-pointer"
                    >
                      Mục tiếp →
                    </button>
                  </div>
                </div>
              </div>

              {/* Central Target Display Card */}
              <div className="relative overflow-hidden rounded-xl border-2 border-[#3A3832] bg-[#141413] p-6 md:p-8 text-center space-y-4">
                <div className="text-xs uppercase tracking-widest text-[#B8B2A6] font-extrabold">
                  Mẫu câu / Từ vựng cần luyện đọc:
                </div>

                {/* Target text with native audio preview */}
                <div className="space-y-2">
                  <h2 className="text-2xl md:text-4xl font-extrabold text-[#F5EFE6] tracking-wide">
                    {currentSpeakingItem.targetText}
                  </h2>
                  {currentSpeakingItem.phonetic && (
                    <p className="font-mono text-sm md:text-base font-bold text-[#A7D7A9]">
                      {currentSpeakingItem.phonetic}
                    </p>
                  )}
                  <p className="text-sm font-semibold text-[#F5EFE6]">
                    {currentSpeakingItem.meaning}
                  </p>
                  {currentSpeakingItem.hint && (
                    <p className="text-xs italic text-[#B8B2A6]">
                      {currentSpeakingItem.hint}
                    </p>
                  )}
                </div>

                {/* Audio Sample button */}
                <div className="pt-2 flex justify-center">
                  <AudioSpeakButton
                    text={currentSpeakingItem.targetText}
                    label="Nghe AI phát âm mẫu chuẩn"
                    className="inline-flex items-center gap-2 rounded-xl border-2 border-[#F5EFE6] bg-[#B8D8F8] px-4 py-2 text-xs font-extrabold text-[#141413] shadow-[2px_2px_0_0_#F5EFE6]"
                  />
                </div>
              </div>

              {/* Voice Recording & Real-time Transcript Area */}
              <div className="rounded-xl border-2 border-[#3A3832] bg-[#141413] p-6 space-y-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  {/* Record Button */}
                  <div className="flex items-center gap-3">
                    {!isSpeakingRecording ? (
                      <button
                        type="button"
                        onClick={startSpeakingRecording}
                        className="group relative flex items-center gap-2.5 rounded-xl border-2 border-[#F5EFE6] bg-[#F3C969] px-5 py-3 text-sm font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] cursor-pointer"
                      >
                        <Mic className="h-5 w-5" />
                        <span>Bấm vào đây & Bắt đầu đọc</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={stopSpeakingRecording}
                        className="flex items-center gap-2.5 rounded-xl border-2 border-[#F5EFE6] bg-[#FF8A8A] px-5 py-3 text-sm font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] animate-pulse cursor-pointer"
                      >
                        <MicOff className="h-5 w-5" />
                        <span>Đang nghe bạn đọc... (Bấm để Dừng)</span>
                      </button>
                    )}

                    {isSpeakingRecording && (
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#FF8A8A]">
                        <span className="flex h-2.5 w-2.5 rounded-full bg-[#FF8A8A] animate-ping" />
                        <span>Đang ghi âm</span>
                      </div>
                    )}
                  </div>

                  {/* Submit to AI button */}
                  <button
                    type="button"
                    disabled={
                      isEvaluatingSpeech ||
                      (!speakingTranscript.trim() && !speakingAudioBase64)
                    }
                    onClick={handleEvaluateSpeaking}
                    className="flex items-center gap-2 rounded-xl border-2 border-[#F5EFE6] bg-[#A7D7A9] px-5 py-3 text-xs font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-40 cursor-pointer"
                  >
                    {isEvaluatingSpeech ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>AI đang nghe giọng & phân tích khẩu âm...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        <span>AI Chấm Điểm Phát Âm</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Real-time transcript feedback */}
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#B8B2A6]">
                    <span className="flex flex-wrap items-center gap-2">
                      <span>Âm thanh ghi nhận được từ micro của bạn:</span>
                      <span className="rounded-md border border-[#3A3832] bg-[#1D1C19] px-2 py-0.5 text-[10px] font-semibold text-[#B8B2A6]">
                        Chỉ nhận giọng đọc từ Micro • Không cho gõ phím
                      </span>
                    </span>
                    {(speakingTranscript || speakingAudioBase64) && (
                      <button
                        type="button"
                        onClick={() => {
                          setSpeakingTranscript("");
                          setSpeakingAudioBase64("");
                        }}
                        className="font-bold text-[#F3C969] hover:underline cursor-pointer"
                      >
                        Thu âm lại
                      </button>
                    )}
                  </div>
                  <div
                    aria-readonly="true"
                    className={`min-h-[64px] w-full rounded-lg border-2 px-4 py-3 text-sm select-none cursor-default ${
                      isSpeakingRecording
                        ? "border-[#A7D7A9] bg-[#1D1C19] text-[#F5EFE6]"
                        : speakingTranscript
                        ? "border-[#F5EFE6] bg-[#1D1C19] text-[#F5EFE6]"
                        : "border-[#3A3832] bg-[#1D1C19] text-[#B8B2A6]"
                    }`}
                  >
                    {speakingTranscript ? (
                      <p className="font-semibold leading-relaxed text-[#F5EFE6]">
                        {speakingTranscript}
                      </p>
                    ) : isSpeakingRecording ? (
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

                {speakingError && (
                  <div className="flex items-center gap-2 rounded-lg border-2 border-[#FF8A8A] bg-[#1D1C19] p-3 text-xs font-bold text-[#FF8A8A]">
                    <AlertCircle className="h-4 w-4 shrink-0 text-[#FF8A8A]" />
                    <span>{speakingError}</span>
                  </div>
                )}
              </div>

              {/* AI Evaluation Result Card */}
              {speechEvaluation && (
                <div className="rounded-xl border-2 border-[#F5EFE6] bg-[#141413] p-6 space-y-6">
                  {/* Top Score Banner */}
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-[#3A3832] pb-4">
                    <div className="flex items-center gap-4">
                      {/* Score Badge */}
                      <div
                        className={`flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl border-2 border-[#F5EFE6] font-black text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] ${
                          speechEvaluation.overallScore >= 85
                            ? "bg-[#A7D7A9]"
                            : speechEvaluation.overallScore >= 70
                            ? "bg-[#F3C969]"
                            : "bg-[#FF8A8A]"
                        }`}
                      >
                        <span className="text-xl leading-none">
                          {speechEvaluation.overallScore}
                        </span>
                        <span className="text-[10px] font-bold">%</span>
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-base font-extrabold text-[#F5EFE6]">
                            Kết Quả Đánh Giá Phát Âm
                          </h4>
                          <span
                            className={`rounded-full border-2 border-[#F5EFE6] px-2.5 py-0.5 text-xs font-extrabold text-[#141413] ${
                              speechEvaluation.overallScore >= 85
                                ? "bg-[#A7D7A9]"
                                : speechEvaluation.overallScore >= 70
                                ? "bg-[#F3C969]"
                                : "bg-[#FF8A8A]"
                            }`}
                          >
                            {speechEvaluation.accuracyGrade}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-[#B8B2A6]">
                          {speechEvaluation.generalFeedback}
                        </p>
                      </div>
                    </div>

                    {/* Quick Metric Bars */}
                    <div className="flex items-center gap-3 text-xs">
                      <div className="rounded-lg border-2 border-[#3A3832] bg-[#1D1C19] px-3.5 py-2 text-center">
                        <div className="text-[11px] text-[#B8B2A6]">Độ lưu loát</div>
                        <div className="mt-0.5 text-sm font-extrabold text-[#B8D8F8]">
                          {speechEvaluation.fluencyScore}/100
                        </div>
                      </div>
                      <div className="rounded-lg border-2 border-[#3A3832] bg-[#1D1C19] px-3.5 py-2 text-center">
                        <div className="text-[11px] text-[#B8B2A6]">Độ hoàn chỉnh</div>
                        <div className="mt-0.5 text-sm font-extrabold text-[#A7D7A9]">
                          {speechEvaluation.completenessScore}/100
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Word-by-word Breakdown */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Correctly Pronounced Words */}
                    <div className="rounded-xl border-2 border-[#A7D7A9] bg-[#1D1C19] p-4 space-y-2.5">
                      <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#A7D7A9]">
                        <Check className="h-4 w-4" />
                        <span>Từ đã phát âm chuẩn xác ({speechEvaluation.correctWords.length}):</span>
                      </div>
                      {speechEvaluation.correctWords.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {speechEvaluation.correctWords.map((w, idx) => (
                            <span
                              key={idx}
                              className="rounded-full border border-[#141413] bg-[#A7D7A9] px-2.5 py-0.5 text-xs font-extrabold text-[#141413]"
                            >
                              {w}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs italic text-[#B8B2A6]">
                          Chưa ghi nhận từ nào phát âm đúng.
                        </p>
                      )}
                    </div>

                    {/* Needs Work / Mispronounced Words */}
                    <div className="rounded-xl border-2 border-[#FF8A8A] bg-[#1D1C19] p-4 space-y-2.5">
                      <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#FF8A8A]">
                        <AlertCircle className="h-4 w-4" />
                        <span>Từ cần cải thiện ({speechEvaluation.mispronouncedWords.length}):</span>
                      </div>
                      {speechEvaluation.mispronouncedWords.length > 0 ? (
                        <div className="space-y-2">
                          {speechEvaluation.mispronouncedWords.map((item, idx) => (
                            <div
                              key={idx}
                              className="rounded-lg border-2 border-[#3A3832] bg-[#141413] p-2.5 text-xs space-y-1"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-extrabold text-[#FF8A8A] text-sm">
                                  {item.word}
                                </span>
                                {item.expectedPhonetic && (
                                  <span className="font-mono text-[11px] font-bold text-[#F3C969]">
                                    Phiên âm chuẩn: {item.expectedPhonetic}
                                  </span>
                                )}
                              </div>
                              <p className="text-[#F5EFE6]">
                                <strong className="text-[#FF8A8A]">Lỗi:</strong> {item.issue}
                              </p>
                              <p className="text-[#A7D7A9]">
                                <strong className="text-[#A7D7A9]">Cách sửa:</strong> {item.tip}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="flex items-center gap-1.5 text-xs text-[#A7D7A9] font-extrabold">
                          <CheckCircle2 className="h-4 w-4 text-[#A7D7A9] shrink-0" />
                          <span>Tuyệt vời! Không có từ nào bị phát âm sai!</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions & Progression */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t-2 border-[#3A3832]">
                    <button
                      type="button"
                      onClick={() => {
                        setSpeechEvaluation(null);
                        setSpeakingTranscript("");
                        startSpeakingRecording();
                      }}
                      className="flex items-center gap-1.5 rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] px-4 py-2 text-xs font-bold text-[#F5EFE6] shadow-[2px_2px_0_0_#F5EFE6] cursor-pointer"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Luyện đọc lại câu này
                    </button>

                    <button
                      type="button"
                      disabled={speakingIdx >= speakingItems.length - 1}
                      onClick={() => {
                        stopSpeakingRecording();
                        setSpeakingIdx((i) => Math.min(speakingItems.length - 1, i + 1));
                        setSpeechEvaluation(null);
                        setSpeakingTranscript("");
                        setSpeakingError(null);
                      }}
                      className="flex items-center gap-2 rounded-xl border-2 border-[#F5EFE6] bg-[#A7D7A9] px-5 py-2 text-xs font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-40 cursor-pointer"
                    >
                      <span>Mục tiếp theo</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
