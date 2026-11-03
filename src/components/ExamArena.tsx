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
import { speakSmart, stopAllSpeech, detectTextLang } from "@/lib/tts";
import AudioSpeakButton from "./AudioSpeakButton";
import ExamGeneratingLoader from "./loadings/ExamGeneratingLoader";
import CustomSelect from "./ui/CustomSelect";
import { getAppSettings } from "@/lib/storage";
import { fetchAiAgent } from "@/lib/quotaManager";

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

    // 1. Khởi tạo MediaRecorder để thu sóng âm giọng nói thực tế gửi cho Gemini Multimodal Audio
    if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm";
        setSpeakingAudioMime(mimeType.split(";")[0]);
        const recorder = new MediaRecorder(stream);
        const chunks: BlobPart[] = [];
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType });
          const reader = new FileReader();
          reader.onloadend = () => {
            const resStr = String(reader.result || "");
            const base64 = resStr.includes(",") ? resStr.split(",")[1] : "";
            if (base64) setSpeakingAudioBase64(base64);
          };
          reader.readAsDataURL(blob);
          stream.getTracks().forEach((t) => t.stop());
        };
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
          "Trình duyệt chưa hỗ trợ thu âm trực tiếp. Vui lòng sử dụng Chrome hoặc Edge và cấp quyền Micro."
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
        let transcript = "";
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript.trim()) setSpeakingTranscript(transcript.trim());
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

  const stopSpeakingRecording = () => {
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
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    setIsSpeakingRecording(false);
  };

  const handleEvaluateSpeaking = async () => {
    stopSpeakingRecording();
    // Chờ 250ms để MediaRecorder kịp chuyển đổi Blob sang Base64 nếu người dùng vừa bấm Chấm Điểm ngay khi đang ghi âm
    await new Promise((r) => setTimeout(r, 250));

    if ((!speakingTranscript.trim() && !speakingAudioBase64) || !currentSpeakingItem) {
      setSpeakingError("Vui lòng bấm Micro và đọc to rõ ràng trước khi chấm điểm.");
      return;
    }

    setIsEvaluatingSpeech(true);
    setSpeakingError(null);
    const s = getAppSettings();

    try {
      const res = await fetchAiAgent("/api/agent/evaluate-pronunciation", {
        expectedText: currentSpeakingItem.targetText,
        spokenText: speakingTranscript,
        audioBase64: speakingAudioBase64 || undefined,
        audioMimeType: speakingAudioMime,
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
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
            <BookOpen className="h-4 w-4 text-indigo-400" />
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

        {/* 4 Practice & Exam Sub-Tabs */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMode("timed_chapter_exam")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
              mode === "timed_chapter_exam"
                ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg"
                : "bg-slate-950 text-amber-300 hover:bg-slate-800"
            }`}
          >
            <Timer className="h-4 w-4" />
            1. Đề Thi Kiểm Tra Chương (Tính giờ từng câu)
          </button>
          <button
            type="button"
            onClick={() => setMode("vocab_quiz")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
              mode === "vocab_quiz"
                ? "bg-indigo-600 text-white shadow"
                : "bg-slate-950 text-slate-400 hover:text-white"
            }`}
          >
            <Trophy className="h-4 w-4" />
            2. Phản Xạ Trắc Nghiệm Từ Vựng ({activeCards.length} từ)
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("matching");
              setMatchedIds([]);
              setSelectedLeft(null);
            }}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
              mode === "matching"
                ? "bg-indigo-600 text-white shadow"
                : "bg-slate-950 text-slate-400 hover:text-white"
            }`}
          >
            <Gamepad2 className="h-4 w-4" />
            3. Ghép Thẻ Từ – Nghĩa
          </button>
          <button
            type="button"
            onClick={() => setMode("typing")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
              mode === "typing"
                ? "bg-indigo-600 text-white shadow"
                : "bg-slate-950 text-slate-400 hover:text-white"
            }`}
          >
            <Keyboard className="h-4 w-4" />
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
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition cursor-pointer ${
              mode === "pronunciation_arena"
                ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/25"
                : "bg-slate-950 text-slate-400 hover:text-white"
            }`}
          >
            <Mic className="h-4 w-4" />
            5. Luyện Đọc & Chấm Âm AI ({speakingItems.length})
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* MODE 1: TIMED CHAPTER EXAM (Tự động tạo bài thi kiểm tra chương)      */}
      {/* ===================================================================== */}
      {mode === "timed_chapter_exam" && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
          {!examStarted && !examFinished ? (
            /* Pre-Exam Setup Screen */
            <div className="space-y-6 py-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400">
                <Timer className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-xl font-extrabold text-white">
                  Bài Thi Kiểm Tra: {targetChapter.title}
                </h3>
                <p className="mx-auto mt-1 max-w-xl text-xs leading-relaxed text-slate-400">
                  Bài thi kiểm tra toàn diện <strong>Từ vựng & Ngữ pháp</strong> của chương này.
                </p>
              </div>

              {/* Exam Stats & Time Setting */}
              <div className="mx-auto flex max-w-xl flex-wrap items-center justify-center gap-4 rounded-2xl border border-slate-800 bg-slate-950 p-4 text-xs">
                <div>
                  <span className="text-slate-400">Tổng số câu hỏi: </span>
                  <strong className="text-white">
                    {examQuestions.length} câu
                  </strong>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">
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
                <div className="mx-auto max-w-lg rounded-xl border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-200">
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
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-3 text-sm font-bold text-white shadow-xl shadow-emerald-600/20 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 cursor-pointer"
                  >
                    <Play className="h-4 w-4" />
                    Bắt Đầu Làm Bài Thi Ngay ({examQuestions.length} câu)
                  </button>

                  <button
                    type="button"
                    disabled={isGeneratingAiExam}
                    onClick={handleGenerateFreshAiExamForChapter}
                    className="inline-flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-950/30 px-5 py-3 text-xs font-bold text-amber-300 hover:bg-amber-900/40 disabled:opacity-50 cursor-pointer"
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
              <div className="rounded-2xl border border-indigo-500/30 bg-slate-950 p-6 text-center space-y-3">
                <Trophy className="mx-auto h-12 w-12 text-amber-400" />
                <h3 className="text-2xl font-extrabold text-white">
                  Kết Quả Bài Thi Kiểm Tra Chương
                </h3>
                <p className="text-sm text-slate-300">
                  Số câu hoàn thành đạt yêu cầu:{" "}
                  <strong className="text-emerald-400">
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
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-500"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Thi Lại Chương Này
                  </button>
                  <button
                    type="button"
                    disabled={isGeneratingAiExam}
                    onClick={handleGenerateFreshAiExamForChapter}
                    className="inline-flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-950/30 px-5 py-2.5 text-xs font-bold text-amber-300 hover:bg-amber-900/40"
                  >
                    <Sparkles className="h-4 w-4" />
                    AI Tạo Đề Khác Cho Chương Này
                  </button>
                </div>
              </div>

              {/* Detailed Review of Each Question */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-white">
                  Chi tiết từng câu trong bài thi:
                </h4>
                {examResults.map((res, i) => (
                  <div
                    key={i}
                    className={`rounded-xl border p-4 text-xs space-y-1.5 ${
                      res.isCorrect
                        ? "border-emerald-500/30 bg-emerald-950/15"
                        : "border-rose-500/30 bg-rose-950/15"
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-white">
                        Câu {i + 1} ({res.question.categoryLabel}):{" "}
                        {res.question.promptText}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 ${
                          res.isCorrect ? "text-emerald-400" : "text-rose-400"
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
                    <p className="text-slate-300">
                      Câu trả lời của bạn: <strong>{res.userAnswerText}</strong>
                    </p>
                    {res.question.explanation && (
                      <p className="flex items-start gap-1.5 text-indigo-300">
                        <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-0.5 text-indigo-400" />
                        <span>Giải thích: {res.question.explanation}</span>
                      </p>
                    )}
                    {res.translationEval && (
                      <p className="flex items-start gap-1.5 text-emerald-300">
                        <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-400" />
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
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <span className="rounded-lg bg-indigo-500/20 px-2.5 py-1 text-xs font-bold text-indigo-300">
                    Câu {examStepIndex + 1} / {examQuestions.length}
                  </span>
                  <span className="text-xs font-semibold text-slate-300">
                    {currentExamQ.categoryLabel}
                  </span>
                </div>

                {/* Timer Badge: Countdown for Quiz/Cloze, Unlimited for Translation */}
                {isCurrentQuestionUntimed ? (
                  <div className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-3.5 py-1.5 text-xs font-bold text-emerald-300">
                    <InfinityIcon className="h-4 w-4" />
                    <span>Câu Dịch Thuật — Không giới hạn thời gian</span>
                  </div>
                ) : (
                  <div
                    className={`flex items-center gap-2 rounded-xl border px-3.5 py-1.5 text-xs font-extrabold ${
                      timeLeft <= 5
                        ? "border-rose-500 bg-rose-950/50 text-rose-300 animate-pulse"
                        : timeLeft <= 10
                        ? "border-amber-500/50 bg-amber-950/40 text-amber-300"
                        : "border-indigo-500/40 bg-indigo-950/40 text-indigo-200"
                    }`}
                  >
                    <Timer className="h-4 w-4" />
                    <span>Thời gian còn lại: {timeLeft} giây</span>
                  </div>
                )}
              </div>

              {/* Visual Progress Bar for Timer */}
              {!isCurrentQuestionUntimed && (
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={`h-full transition-all duration-1000 ${
                      timeLeft <= 5
                        ? "bg-rose-500"
                        : timeLeft <= 10
                        ? "bg-amber-500"
                        : "bg-indigo-500"
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
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <h4 className="text-base font-bold leading-relaxed text-white md:text-lg">
                    {currentExamQ.promptText}
                  </h4>
                  <AudioSpeakButton
                    text={currentExamQ.promptText}
                    showLabel={false}
                    className="shrink-0 rounded-xl bg-slate-800 p-2 text-indigo-400 hover:bg-indigo-600 hover:text-white"
                  />
                </div>
                {currentExamQ.subHint && (
                  <p className="flex items-center gap-1.5 text-xs text-amber-300/90">
                    <Lightbulb className="h-3.5 w-3.5 shrink-0 text-amber-400" />
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
                      "border-slate-800 bg-slate-950 text-slate-200 hover:border-indigo-500";
                    if (isQuestionLocked) {
                      if (isRight)
                        cls =
                          "border-emerald-500 bg-emerald-950/40 text-emerald-200 font-bold";
                      else if (isPicked)
                        cls = "border-rose-500 bg-rose-950/40 text-rose-200";
                    } else if (isPicked) {
                      cls =
                        "border-indigo-500 bg-indigo-950/50 text-white font-bold";
                    }

                    return (
                      <button
                        key={oIdx}
                        type="button"
                        disabled={isQuestionLocked}
                        onClick={() => setUserQuizChoice(oIdx)}
                        className={`rounded-xl border p-4 text-left text-sm transition ${cls}`}
                      >
                        <span className="mr-2 font-bold text-indigo-400">
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
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white focus:border-indigo-500 focus:outline-none"
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
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
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
                      className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg disabled:opacity-40"
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
                      className="rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-40"
                    >
                      Chốt Đáp Án
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950 p-4">
                  {timeLeft <= 0 && !isCurrentQuestionUntimed && (
                    <div className="flex items-center gap-2 text-xs font-bold text-rose-400">
                      <XCircle className="h-4 w-4" />
                      <span>Hết thời gian trả lời cho câu hỏi này!</span>
                    </div>
                  )}

                  {currentExamQ.type === "cloze" && (
                    <div className="text-xs text-emerald-300">
                      Đáp án đúng:{" "}
                      <strong>{currentExamQ.correctTextAnswer}</strong>
                    </div>
                  )}

                  {currentExamQ.explanation && (
                    <p className="flex items-start gap-1.5 text-xs text-slate-300">
                      <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-400" />
                      <span>
                        <strong>Giải thích:</strong> {currentExamQ.explanation}
                      </span>
                    </p>
                  )}

                  {currentTranslationEval && (
                    <div className="space-y-2 text-xs">
                      <div className="text-sm font-bold text-indigo-300">
                        Điểm độ gần đúng AI chấm:{" "}
                        <span className="text-emerald-400">
                          {currentTranslationEval.overallScore}%
                        </span>{" "}
                        (Độ sát nghĩa: {currentTranslationEval.semanticAccuracy}
                        % • Ngữ pháp:{" "}
                        {currentTranslationEval.grammarAndStructure}%)
                      </div>
                      <p className="flex items-start gap-1.5 text-emerald-300">
                        <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-400" />
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
                      className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-500"
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
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
          {generatedVocabQuestions.length === 0 ? (
            <p className="text-center text-sm text-slate-400">
              Chương này chưa có từ vựng nào. Hãy bấm &ldquo;AI Soạn Bài Học Chương Này&rdquo; trước nhé!
            </p>
          ) : quizFinished ? (
            <div className="space-y-4 py-6 text-center">
              <Trophy className="mx-auto h-12 w-12 text-amber-400" />
              <h3 className="text-2xl font-extrabold text-white">
                Hoàn thành ôn phản xạ từ vựng!
              </h3>
              <p className="text-base text-slate-300">
                Điểm số của bạn:{" "}
                <strong className="text-emerald-400">
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
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-500"
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
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>
                      Câu{" "}
                      <strong className="text-white">
                        {quizIdx + 1} / {generatedVocabQuestions.length}
                      </strong>
                    </span>
                    <span className="rounded-lg bg-emerald-500/15 px-3 py-1 font-bold text-emerald-300">
                      Điểm: {quizScore}
                    </span>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-center">
                    <div className="flex items-center justify-center gap-3">
                      <span className="text-3xl font-extrabold text-white">
                        {q.word}
                      </span>
                      <AudioSpeakButton
                        text={q.word}
                        showLabel={false}
                        className="rounded-xl bg-indigo-600/20 p-2 text-indigo-400 hover:bg-indigo-600 hover:text-white"
                      />
                    </div>
                    <p className="mt-1 font-mono text-sm text-indigo-300">
                      {q.ipa}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {q.options.map((opt, idx) => {
                      const isPicked = selectedOpt === idx;
                      const isRight = idx === q.correctIndex;
                      let style =
                        "border-slate-800 bg-slate-950 text-slate-200 hover:border-indigo-500";
                      if (selectedOpt !== null) {
                        if (isRight) {
                          style =
                            "border-emerald-500 bg-emerald-950/40 text-emerald-200 font-bold";
                        } else if (isPicked) {
                          style =
                            "border-rose-500 bg-rose-950/40 text-rose-200";
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
                          className={`rounded-xl border p-4 text-left text-sm transition ${style}`}
                        >
                          <span className="mr-2 font-bold text-indigo-400">
                            {String.fromCharCode(65 + idx)}.
                          </span>
                          {opt}
                        </button>
                      );
                    })}
                  </div>

                  {selectedOpt !== null && (
                    <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-4">
                      <span className="text-xs text-slate-300">
                        {q.explanation}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedOpt(null);
                          if (quizIdx + 1 >= generatedVocabQuestions.length) {
                            setQuizFinished(true);
                          } else {
                            setQuizIdx((i) => i + 1);
                          }
                        }}
                        className="shrink-0 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500"
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
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">
                Ghép Cặp Từ Vựng & Nghĩa Tiếng Việt
              </h3>
              <p className="text-xs text-slate-400">
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
              className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-3.5 py-2 text-xs font-semibold text-indigo-300 hover:bg-slate-700"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Đổi 6 từ khác trong chương
            </button>
          </div>

          {matchedIds.length === matchingBatch.leftItems.length &&
          matchingBatch.leftItems.length > 0 ? (
            <div className="py-8 text-center space-y-3">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
              <h4 className="text-lg font-bold text-white">
                Xuất sắc! Bạn đã ghép đúng toàn bộ các cặp từ!
              </h4>
              <button
                type="button"
                onClick={() => {
                  setSeed((s) => s + 1);
                  setMatchedIds([]);
                }}
                className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-500"
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
                      className={`flex w-full items-center justify-between rounded-xl border p-3.5 text-left transition ${
                        isMatched
                          ? "border-emerald-500/20 bg-emerald-950/20 text-emerald-400 opacity-50"
                          : isSelected
                          ? "border-indigo-500 bg-indigo-600 text-white shadow-lg"
                          : "border-slate-800 bg-slate-950 text-white hover:border-slate-700"
                      }`}
                    >
                      <div>
                        <div className="text-sm font-bold">{item.text}</div>
                        <div className="font-mono text-xs opacity-75">
                          {item.sub}
                        </div>
                      </div>
                      <Volume2 className="h-4 w-4 opacity-70" />
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
                      className={`flex min-h-[62px] w-full items-center rounded-xl border p-3.5 text-left text-xs transition ${
                        isMatched
                          ? "border-emerald-500/20 bg-emerald-950/20 text-emerald-400 opacity-50"
                          : wrongPair
                          ? "border-rose-500/50 bg-slate-950 text-slate-200"
                          : "border-slate-800 bg-slate-950 text-slate-200 hover:border-indigo-500"
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
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 space-y-5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>
              Từ{" "}
              <strong className="text-white">
                {(typingIdx % activeCards.length) + 1} / {activeCards.length}
              </strong>
            </span>
            <button
              type="button"
              onClick={() => setShowTypingHint(!showTypingHint)}
              className="flex items-center gap-1 text-amber-400 hover:underline"
            >
              <Lightbulb className="h-3.5 w-3.5" />
              {showTypingHint ? "Ẩn gợi ý" : "Gợi ý chữ cái đầu & Phiên âm"}
            </button>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-center space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Hãy gõ lại từ vựng có nghĩa sau:
            </div>
            <h3 className="text-xl font-extrabold text-white">
              {currentTypingCard.vietnameseMeaning}
            </h3>
            <p className="text-xs text-slate-400">
              ({currentTypingCard.partOfSpeech} • CEFR{" "}
              {currentTypingCard.cefrLevel})
            </p>
            <AudioSpeakButton
              text={currentTypingCard.word}
              label="Bấm để nghe phát âm từ này"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600/20 px-4 py-2 text-xs font-semibold text-indigo-300 hover:bg-indigo-600 hover:text-white"
            />
            {showTypingHint && (
              <p className="font-mono text-xs text-amber-300">
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
              className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setTypingChecked(true)}
              className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-500"
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
              className="rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
            >
              Từ tiếp theo →
            </button>
          </div>

          {typingChecked && (
            <div
              className={`rounded-xl border p-4 text-xs ${
                typingInput.trim().toLowerCase() ===
                currentTypingCard.word.trim().toLowerCase()
                  ? "border-emerald-500/30 bg-emerald-950/30 text-emerald-200"
                  : "border-rose-500/30 bg-rose-950/30 text-rose-200"
              }`}
            >
              <div className="font-bold text-sm">
                Đáp án chuẩn: {currentTypingCard.word} ({currentTypingCard.ipa})
              </div>
              <p className="mt-1 italic text-slate-300">
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
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 space-y-6">
          {/* Header & Sub-filter */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                  <Mic className="h-4 w-4" />
                </span>
                <h3 className="text-base font-bold text-white">
                  Phòng Luyện Đọc Phát Âm & Chấm Điểm AI
                </h3>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Luyện đọc to từng từ vựng hoặc câu mẫu trong bài. AI sẽ phân tích âm thanh, tính độ chính xác (%) và chỉ rõ từng từ sai kèm cách sửa khẩu hình.
              </p>
            </div>

            {/* Scope Filter Tabs */}
            <div className="flex items-center rounded-xl border border-slate-800 bg-slate-950 p-1 text-xs">
              <button
                type="button"
                onClick={() => {
                  setSpeakingScope("all");
                  setSpeakingIdx(0);
                  setSpeechEvaluation(null);
                  setSpeakingTranscript("");
                }}
                className={`rounded-lg px-3 py-1.5 font-semibold transition ${
                  speakingScope === "all"
                    ? "bg-emerald-600 text-white shadow"
                    : "text-slate-400 hover:text-white"
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
                className={`rounded-lg px-3 py-1.5 font-semibold transition ${
                  speakingScope === "vocab"
                    ? "bg-emerald-600 text-white shadow"
                    : "text-slate-400 hover:text-white"
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
                className={`rounded-lg px-3 py-1.5 font-semibold transition ${
                  speakingScope === "sentences"
                    ? "bg-emerald-600 text-white shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Câu trong sách
              </button>
            </div>
          </div>

          {speakingItems.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <AlertCircle className="mx-auto h-10 w-10 text-slate-600" />
              <p className="text-sm text-slate-400">
                Chưa có mục luyện đọc nào trong phạm vi này của chương. Hãy chọn phạm vi &ldquo;Tất cả&rdquo; hoặc chọn chương khác.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Progress and Score Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-slate-800 px-2.5 py-1 font-bold text-slate-200">
                    Mục {speakingIdx + 1} / {speakingItems.length}
                  </span>
                  <span
                    className={`rounded-lg px-2.5 py-1 font-semibold uppercase tracking-wider text-[11px] ${
                      currentSpeakingItem.type === "vocab"
                        ? "bg-indigo-950/80 text-indigo-300 border border-indigo-500/30"
                        : "bg-amber-950/80 text-amber-300 border border-amber-500/30"
                    }`}
                  >
                    {currentSpeakingItem.type === "vocab" ? "Từ vựng cốt lõi" : "Câu thực tế trong bài"}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {Object.keys(speechScores).length > 0 && (
                    <span className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-950/40 px-2.5 py-1 text-emerald-300 font-semibold">
                      <Award className="h-3.5 w-3.5" />
                      Đã chấm {Object.keys(speechScores).length} mục • TB:{" "}
                      {Math.round(
                        Object.values(speechScores).reduce((a, b) => a + b, 0) /
                          Object.values(speechScores).length
                      )}
                      %
                    </span>
                  )}

                  <div className="flex items-center gap-1">
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
                      className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-40"
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
                      className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                    >
                      Mục tiếp →
                    </button>
                  </div>
                </div>
              </div>

              {/* Central Target Display Card */}
              <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 md:p-8 text-center space-y-4">
                <div className="text-xs uppercase tracking-widest text-slate-400 font-semibold">
                  Mẫu câu / Từ vựng cần luyện đọc:
                </div>

                {/* Target text with native audio preview */}
                <div className="space-y-2">
                  <h2 className="text-2xl md:text-4xl font-extrabold text-white tracking-wide">
                    {currentSpeakingItem.targetText}
                  </h2>
                  {currentSpeakingItem.phonetic && (
                    <p className="font-mono text-sm md:text-base font-semibold text-emerald-400">
                      {currentSpeakingItem.phonetic}
                    </p>
                  )}
                  <p className="text-sm font-medium text-slate-300">
                    {currentSpeakingItem.meaning}
                  </p>
                  {currentSpeakingItem.hint && (
                    <p className="text-xs italic text-slate-400">
                      {currentSpeakingItem.hint}
                    </p>
                  )}
                </div>

                {/* Audio Sample button */}
                <div className="pt-2 flex justify-center">
                  <AudioSpeakButton
                    text={currentSpeakingItem.targetText}
                    label="Nghe AI phát âm mẫu chuẩn"
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 px-4 py-2 text-xs font-semibold text-indigo-300 hover:bg-indigo-600 hover:text-white transition"
                  />
                </div>
              </div>

              {/* Voice Recording & Real-time Transcript Area */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 space-y-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  {/* Record Button */}
                  <div className="flex items-center gap-3">
                    {!isSpeakingRecording ? (
                      <button
                        type="button"
                        onClick={startSpeakingRecording}
                        className="group relative flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/30 hover:from-emerald-500 hover:to-teal-500 transition active:scale-95"
                      >
                        <Mic className="h-5 w-5 animate-pulse" />
                        <span>Bấm vào đây & Bắt đầu đọc</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={stopSpeakingRecording}
                        className="flex items-center gap-2.5 rounded-2xl bg-rose-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-rose-600/30 hover:bg-rose-500 transition animate-pulse active:scale-95"
                      >
                        <MicOff className="h-5 w-5" />
                        <span>Đang nghe bạn đọc... (Bấm để Dừng)</span>
                      </button>
                    )}

                    {isSpeakingRecording && (
                      <div className="flex items-center gap-1.5 text-xs text-rose-400">
                        <span className="flex h-2.5 w-2.5 rounded-full bg-rose-500 animate-ping" />
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
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-3 text-xs font-bold text-white shadow-md hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 transition cursor-pointer"
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

                {/* Real-time transcript feedback (Read-Only: chỉ hiển thị chữ thu từ Micro, không cho nhập/chỉnh sửa bằng bàn phím) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-2">
                      <span>Âm thanh ghi nhận được từ micro của bạn:</span>
                      <span className="rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
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
                        className="text-slate-500 hover:text-slate-300 cursor-pointer"
                      >
                        Thu âm lại
                      </button>
                    )}
                  </div>
                  <div
                    aria-readonly="true"
                    className={`min-h-[64px] w-full rounded-xl border px-4 py-3 text-sm select-none cursor-default transition ${
                      isSpeakingRecording
                        ? "border-emerald-500/50 bg-slate-900/95 text-white shadow-inner"
                        : speakingTranscript
                        ? "border-indigo-500/40 bg-slate-900/90 text-white"
                        : "border-slate-800 bg-slate-900/70 text-slate-500"
                    }`}
                  >
                    {speakingTranscript ? (
                      <p className="font-medium leading-relaxed text-white">
                        {speakingTranscript}
                      </p>
                    ) : isSpeakingRecording ? (
                      <p className="italic text-emerald-300 animate-pulse">
                        Đang thu sóng âm giọng đọc của bạn qua Micro... Hãy đọc to và rõ ràng!
                      </p>
                    ) : (
                      <p className="text-slate-500">
                        Bấm nút micro ở trên và đọc to rõ ràng. Lời đọc của bạn sẽ tự động chạy chữ tại đây (không cho phép gõ văn bản thủ công)...
                      </p>
                    )}
                  </div>
                </div>

                {speakingError && (
                  <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 text-xs text-rose-300">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                    <span>{speakingError}</span>
                  </div>
                )}
              </div>

              {/* AI Evaluation Result Card */}
              {speechEvaluation && (
                <div className="rounded-2xl border border-slate-700 bg-slate-950 p-6 space-y-6 shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {/* Top Score Banner */}
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                    <div className="flex items-center gap-4">
                      {/* Score Badge */}
                      <div
                        className={`flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl border font-black ${
                          speechEvaluation.overallScore >= 85
                            ? "border-emerald-500/50 bg-emerald-950/50 text-emerald-400 shadow-lg shadow-emerald-500/20"
                            : speechEvaluation.overallScore >= 70
                            ? "border-amber-500/50 bg-amber-950/50 text-amber-400"
                            : "border-rose-500/50 bg-rose-950/50 text-rose-400"
                        }`}
                      >
                        <span className="text-xl leading-none">
                          {speechEvaluation.overallScore}
                        </span>
                        <span className="text-[10px] font-medium">%</span>
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold text-white">
                            Kết Quả Đánh Giá Phát Âm
                          </h4>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                              speechEvaluation.overallScore >= 85
                                ? "bg-emerald-500/20 text-emerald-400"
                                : speechEvaluation.overallScore >= 70
                                ? "bg-amber-500/20 text-amber-400"
                                : "bg-rose-500/20 text-rose-400"
                            }`}
                          >
                            {speechEvaluation.accuracyGrade}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">
                          {speechEvaluation.generalFeedback}
                        </p>
                      </div>
                    </div>

                    {/* Quick Metric Bars */}
                    <div className="flex items-center gap-4 text-xs">
                      <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3.5 py-2 text-center">
                        <div className="text-[11px] text-slate-400">Độ lưu loát</div>
                        <div className="mt-0.5 text-sm font-bold text-indigo-300">
                          {speechEvaluation.fluencyScore}/100
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3.5 py-2 text-center">
                        <div className="text-[11px] text-slate-400">Độ hoàn chỉnh</div>
                        <div className="mt-0.5 text-sm font-bold text-emerald-300">
                          {speechEvaluation.completenessScore}/100
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Word-by-word Breakdown */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Correctly Pronounced Words */}
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-4 space-y-2.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                        <Check className="h-4 w-4" />
                        <span>Từ đã phát âm chuẩn xác ({speechEvaluation.correctWords.length}):</span>
                      </div>
                      {speechEvaluation.correctWords.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {speechEvaluation.correctWords.map((w, idx) => (
                            <span
                              key={idx}
                              className="rounded-lg border border-emerald-500/30 bg-emerald-900/40 px-2.5 py-1 text-xs font-semibold text-emerald-200"
                            >
                              {w}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs italic text-slate-400">
                          Chưa ghi nhận từ nào phát âm đúng.
                        </p>
                      )}
                    </div>

                    {/* Needs Work / Mispronounced Words */}
                    <div className="rounded-xl border border-rose-500/20 bg-rose-950/20 p-4 space-y-2.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400">
                        <AlertCircle className="h-4 w-4" />
                        <span>Từ cần cải thiện ({speechEvaluation.mispronouncedWords.length}):</span>
                      </div>
                      {speechEvaluation.mispronouncedWords.length > 0 ? (
                        <div className="space-y-2">
                          {speechEvaluation.mispronouncedWords.map((item, idx) => (
                            <div
                              key={idx}
                              className="rounded-lg border border-rose-500/30 bg-rose-900/30 p-2.5 text-xs space-y-1"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-rose-200 text-sm">
                                  {item.word}
                                </span>
                                {item.expectedPhonetic && (
                                  <span className="font-mono text-[11px] text-amber-300">
                                    Phiên âm chuẩn: {item.expectedPhonetic}
                                  </span>
                                )}
                              </div>
                              <p className="text-slate-300">
                                <strong className="text-rose-300">Lỗi:</strong> {item.issue}
                              </p>
                              <p className="text-emerald-300">
                                <strong className="text-emerald-400">Cách sửa:</strong> {item.tip}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="flex items-center gap-1.5 text-xs text-emerald-300 font-semibold">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                          <span>Tuyệt vời! Không có từ nào bị phát âm sai!</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions & Progression */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setSpeechEvaluation(null);
                        setSpeakingTranscript("");
                        startSpeakingRecording();
                      }}
                      className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
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
                      className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-40 transition"
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
