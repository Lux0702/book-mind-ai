import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ChapterLesson, TranslationEvaluation } from "@/types/course";

function getClient(customApiKey?: string): GoogleGenAI {
  const apiKey =
    customApiKey?.trim() ||
    process.env.GEMINI_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    "";

  if (!apiKey) {
    throw new Error(
      "Chưa có Gemini API Key. Vui lòng bấm vào nút 'Cài đặt API & Cloud' ở góc phải trên cùng để nhập Gemini API Key miễn phí của bạn."
    );
  }
  return new GoogleGenAI({ apiKey });
}

const CHAPTER_LESSON_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    chapterTitle: { type: Type.STRING },
    overview: {
      type: Type.OBJECT,
      properties: {
        summary: {
          type: Type.STRING,
          description:
            "Bản diễn giải tổng quan sâu sắc và đầy đủ toàn bộ nội dung, bối cảnh và thông điệp của chương sách bằng tiếng Việt.",
        },
        keyThemes: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        learningObjectives: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
      required: ["summary", "keyThemes", "learningObjectives"],
    },
    contentAnalysis: {
      type: Type.ARRAY,
      description:
        "Chia chương sách thành 3-5 phân đoạn liên tiếp và diễn giải tường tận nội dung từng đoạn để người học nắm trọn vẹn cuốn sách.",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          sectionTitle: { type: Type.STRING },
          originalExcerpt: {
            type: Type.STRING,
            description: "Đoạn trích nguyên văn tiêu biểu từ chương sách.",
          },
          vietnameseTranslation: {
            type: Type.STRING,
            description: "Bản dịch tiếng Việt chuẩn xác, mượt mà.",
          },
          deepExplanation: {
            type: Type.STRING,
            description:
              "Diễn giải chi tiết ý nghĩa nội dung, tâm lý, lập luận hoặc kiến thức chuyên môn của đoạn văn.",
          },
          stylisticOrContextNotes: {
            type: Type.STRING,
            description:
              "Ghi chú về nghệ thuật dùng từ, sắc thái văn phong hoặc ngữ cảnh ẩn ý của tác giả.",
          },
        },
        required: [
          "id",
          "sectionTitle",
          "originalExcerpt",
          "vietnameseTranslation",
          "deepExplanation",
          "stylisticOrContextNotes",
        ],
      },
    },
    grammarPoints: {
      type: Type.ARRAY,
      description:
        "3-5 cấu trúc ngữ pháp đắt giá xuất hiện trực tiếp trong chương sách.",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          title: { type: Type.STRING },
          patternFormula: { type: Type.STRING },
          quoteFromBook: { type: Type.STRING },
          quoteTranslation: { type: Type.STRING },
          detailedExplanation: { type: Type.STRING },
          whyAuthorUsedIt: { type: Type.STRING },
          extraExamples: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                en: { type: Type.STRING },
                vi: { type: Type.STRING },
              },
              required: ["en", "vi"],
            },
          },
        },
        required: [
          "id",
          "title",
          "patternFormula",
          "quoteFromBook",
          "quoteTranslation",
          "detailedExplanation",
          "whyAuthorUsedIt",
          "extraExamples",
        ],
      },
    },
    vocabulary: {
      type: Type.ARRAY,
      description:
        "Trích xuất ĐẦY ĐỦ TẤT CẢ (100%) các từ vựng (Vocabulary), cụm từ (Phrases) và danh từ riêng (Names/Proper Nouns) xuất hiện trong các bảng từ vựng của bài học (ví dụ nếu bài có 35-50 từ thì phải liệt kê đủ 35-50 từ, tuyệt đối không cắt bớt chỉ lấy 10 từ).",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          word: { type: Type.STRING },
          ipa: { type: Type.STRING },
          partOfSpeech: { type: Type.STRING },
          cefrLevel: {
            type: Type.STRING,
            description: "One of A1, A2, B1, B2, C1, C2",
          },
          vietnameseMeaning: { type: Type.STRING },
          explanationInContext: {
            type: Type.STRING,
            description:
              "Giải thích ngắn gọn cách dùng từ này (1-2 câu).",
          },
          quoteFromBook: { type: Type.STRING },
          quoteTranslation: { type: Type.STRING },
          collocations: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          synonyms: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: [
          "id",
          "word",
          "ipa",
          "partOfSpeech",
          "cefrLevel",
          "vietnameseMeaning",
          "explanationInContext",
          "quoteFromBook",
          "quoteTranslation",
          "collocations",
          "synonyms",
        ],
      },
    },
    clozeExercises: {
      type: Type.ARRAY,
      description:
        "6-8 bài tập điền từ hoặc cấu trúc ngữ pháp vào chỗ trống (dùng ký hiệu _____ cho từ cần điền).",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          sentenceWithBlank: { type: Type.STRING },
          answer: {
            type: Type.STRING,
            description: "Từ duy nhất hoặc cụm từ chính xác cần điền vào _____",
          },
          hint: { type: Type.STRING },
          fullSentenceTranslation: { type: Type.STRING },
          explanation: { type: Type.STRING },
        },
        required: [
          "id",
          "sentenceWithBlank",
          "answer",
          "hint",
          "fullSentenceTranslation",
          "explanation",
        ],
      },
    },
    quizExercises: {
      type: Type.ARRAY,
      description:
        "8-10 câu hỏi trắc nghiệm CHỈ KIỂM TRA TỪ VỰNG VÀ NGỮ PHÁP (TUYỆT ĐỐI KHÔNG hỏi nội dung tình tiết hội thoại như nhân vật tên gì, đi đâu).",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          question: { type: Type.STRING },
          category: {
            type: Type.STRING,
            description: "vocabulary | grammar",
          },
          options: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          correctIndex: {
            type: Type.INTEGER,
            description: "0-based index of the correct option (0, 1, 2, or 3)",
          },
          explanation: { type: Type.STRING },
        },
        required: [
          "id",
          "question",
          "category",
          "options",
          "correctIndex",
          "explanation",
        ],
      },
    },
    translationExercises: {
      type: Type.ARRAY,
      description:
        "3-5 câu văn tiêu biểu trong chương để người học luyện dịch sang tiếng Việt và được AI chấm điểm.",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          originalSentence: { type: Type.STRING },
          direction: {
            type: Type.STRING,
            description: "EN_TO_VI",
          },
          contextHint: { type: Type.STRING },
          targetGrammarOrVocab: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          referenceTranslation: { type: Type.STRING },
        },
        required: [
          "id",
          "originalSentence",
          "direction",
          "contextHint",
          "targetGrammarOrVocab",
          "referenceTranslation",
        ],
      },
    },
  },
  required: [
    "chapterTitle",
    "overview",
    "contentAnalysis",
    "grammarPoints",
    "vocabulary",
    "clozeExercises",
    "quizExercises",
    "translationExercises",
  ],
};

const TRANSLATION_EVAL_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    overallScore: {
      type: Type.INTEGER,
      description: "Tổng điểm độ gần đúng từ 0 đến 100",
    },
    semanticAccuracy: {
      type: Type.INTEGER,
      description: "Điểm truyền tải đúng ý nghĩa câu gốc (0-100)",
    },
    grammarAndStructure: {
      type: Type.INTEGER,
      description: "Điểm ngữ pháp và cấu trúc câu dịch (0-100)",
    },
    naturalnessAndTone: {
      type: Type.INTEGER,
      description: "Điểm độ tự nhiên và giữ đúng sắc thái văn phong (0-100)",
    },
    strengths: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Các điểm người học đã dịch tốt, sát nghĩa",
    },
    improvements: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        "Các góp ý chi tiết chỗ dịch thiếu ý, lệch sắc thái hoặc chưa tự nhiên",
    },
    suggestedTranslation: {
      type: Type.STRING,
      description: "Bản dịch mẫu hoàn chỉnh và tối ưu nhất",
    },
    wordByWordBreakdown: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          sourcePhrase: { type: Type.STRING },
          userRendered: { type: Type.STRING },
          betterChoice: { type: Type.STRING },
          note: { type: Type.STRING },
        },
        required: ["sourcePhrase", "userRendered", "betterChoice", "note"],
      },
    },
  },
  required: [
    "overallScore",
    "semanticAccuracy",
    "grammarAndStructure",
    "naturalnessAndTone",
    "strengths",
    "improvements",
    "suggestedTranslation",
    "wordByWordBreakdown",
  ],
};

export async function generateChapterLessonWithAI(params: {
  courseTitle: string;
  chapterTitle: string;
  chapterText: string;
  pageImagesBase64?: string[];
  apiKey?: string;
  model?: string;
}): Promise<ChapterLesson> {
  const ai = getClient(params.apiKey);
  const modelName = params.model || "gemini-2.5-flash";

  // Limit text per single chapter call to ~35,000 chars (~8,000 words) for fast & deep response
  const trimmedText = params.chapterText.slice(0, 35000);

  const prompt = `Bạn là một Giáo sư Ngôn ngữ học & Gia sư Đọc hiểu Sách chuyên sâu (Multilingual Book Tutor Agent - hỗ trợ sách Tiếng Anh, Tiếng Trung 繁體/簡體 Pinyin, Tiếng Nhật, Tiếng Hàn...).
Hãy phân tích toàn diện chương sách dưới đây thuộc cuốn sách "${params.courseTitle}" và tạo ra bài học cực kỳ chi tiết bằng tiếng Việt để người học vừa nắm trọn vẹn nội dung cuốn sách, vừa giỏi từ vựng, ngữ pháp và kỹ năng dịch thuật.
(Nếu có hình ảnh trang sách đính kèm do PDF dạng scan, hãy đọc kỹ toàn bộ chữ trên các trang ảnh đó để soạn bài).

TÊN CHƯƠNG: ${params.chapterTitle}

NỘI DUNG VĂN BẢN CHƯƠNG SÁCH:
"""
${trimmedText}
"""

YÊU CẦU BẮT BUỘC:
1. overview: Tóm tắt và diễn giải đầy đủ nội dung/luận điểm của chương sách, nêu các chủ đề chính và mục tiêu học tập.
2. contentAnalysis: Chia nội dung chương thành các phần trọng tâm theo mạch sách (ví dụ Dialogue 1, Dialogue 2, Bài đọc...). Mỗi phần trích dẫn đoạn văn gốc (originalExcerpt), dịch sang tiếng Việt chuẩn xác (vietnameseTranslation), và giải thích sâu ý nghĩa nội dung, bối cảnh (deepExplanation & stylisticOrContextNotes).
3. grammarPoints: Trích xuất ĐẦY ĐỦ tất cả các cấu trúc ngữ pháp xuất hiện trong chương (ví dụ cách dùng 嗎, 呢, 很, 不, 姓/叫, 要, 哪...). Giải thích công thức, cách dùng và cho thêm ví dụ.
4. vocabulary: BẮT BUỘC LẤY ĐẦY ĐỦ 100% TẤT CẢ TỪ VỰNG (Vocabulary), DANH TỪ RIÊNG (Names) và CỤM TỪ (Phrases) có liệt kê trong bài học (ví dụ bài học có 35-45 từ thì phải xuất ra đủ cả 35-45 từ đó, TUYỆT ĐỐI KHÔNG chỉ lấy 10 từ!). Ở trường ipa: ghi phiên âm Pinyin có dấu (nếu tiếng Trung) hoặc IPA (nếu tiếng Anh). Cung cấp từ loại (N, V, Vs, Vst, Adv, Ptc, Det, Vaux...), nghĩa tiếng Việt, câu ví dụ ngắn, 1-2 collocations.
5. clozeExercises: Tạo 6 đến 8 câu bài tập điền từ/ngữ pháp vào chỗ trống (dùng đúng ký hiệu "_____" tại vị trí từ bị khuyết).
6. quizExercises: Tạo 8 đến 10 câu hỏi trắc nghiệm (4 lựa chọn) CHỈ KIỂM TRA TỪ VỰNG (nghĩa từ, cách dùng từ, phiên âm) VÀ NGỮ PHÁP (trật tự từ, chọn cấu trúc đúng, điền trợ từ). TUYỆT ĐỐI KHÔNG đặt câu hỏi về tình tiết câu chuyện/hội thoại (như nhân vật tên gì hay làm nghề gì).
7. translationExercises: Chọn 4 đến 6 câu tiêu biểu sử dụng từ vựng và ngữ pháp của chương để người học luyện dịch sang tiếng Việt.`;

  const contentsPayload: Array<
    string | { inlineData: { mimeType: string; data: string } }
  > = [prompt];

  if (params.pageImagesBase64 && params.pageImagesBase64.length > 0) {
    for (const base64Img of params.pageImagesBase64) {
      contentsPayload.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Img,
        },
      });
    }
  }

  const response = await ai.models.generateContent({
    model: modelName,
    contents: contentsPayload,
    config: {
      responseMimeType: "application/json",
      responseSchema: CHAPTER_LESSON_SCHEMA,
      temperature: 0.25,
      maxOutputTokens: 65536,
    },
  });

  if (!response.text) {
    throw new Error("AI không trả về dữ liệu bài học. Vui lòng thử lại.");
  }

  const parsed = JSON.parse(response.text) as ChapterLesson;
  return {
    ...parsed,
    generatedAt: new Date().toISOString(),
  };
}

export async function evaluateSentenceTranslationWithAI(params: {
  originalSentence: string;
  referenceTranslation: string;
  contextHint: string;
  userTranslation: string;
  apiKey?: string;
  model?: string;
}): Promise<TranslationEvaluation> {
  const ai = getClient(params.apiKey);
  const modelName = params.model || "gemini-2.5-flash";

  const prompt = `Bạn là Giám khảo Chấm thi Dịch thuật Song ngữ Anh - Việt (AI Semantic Translation Evaluator).
Hãy đánh giá độ chính xác, độ gần đúng về ngữ nghĩa, cấu trúc ngữ pháp và sắc thái văn phong của câu dịch do người học thực hiện so với câu gốc trong sách.

CÂU GỐC TRONG SÁCH:
"${params.originalSentence}"

GỢI Ý NGỮ CẢNH:
"${params.contextHint}"

BẢN DỊCH THAM KHẢO:
"${params.referenceTranslation}"

BẢN DỊCH CỦA NGƯỜI HỌC:
"${params.userTranslation}"

YÊU CẦU CHẤM ĐIỂM CÔNG TÂM VÀ CHI TIẾT:
- Đánh giá xem bản dịch của người học đúng được bao nhiêu phần trăm (0 - 100%) về mặt ý nghĩa (không bắt buộc phải trùng từng chữ với bản tham khảo nếu dùng từ đồng nghĩa hợp lý và tự nhiên).
- Chỉ rõ những điểm dịch tốt (strengths) và những chỗ dịch sai nghĩa, thiếu từ hoặc chưa tự nhiên (improvements).
- Phân tích đối chiếu từng cụm từ quan trọng trong wordByWordBreakdown.`;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: TRANSLATION_EVAL_SCHEMA,
      temperature: 0.2,
    },
  });

  if (!response.text) {
    throw new Error("Không nhận được phản hồi chấm điểm từ AI.");
  }

  const parsed = JSON.parse(response.text);
  return {
    ...parsed,
    userTranslation: params.userTranslation,
    evaluatedAt: new Date().toISOString(),
  };
}

export async function askBookTutorWithAI(params: {
  courseTitle: string;
  chapterTitle: string;
  chapterText: string;
  question: string;
  selectedExcerpt?: string;
  apiKey?: string;
  model?: string;
}): Promise<string> {
  const ai = getClient(params.apiKey);
  const modelName = params.model || "gemini-2.5-flash";

  const prompt = `Bạn là Gia sư AI chuyên giải đáp sách "${params.courseTitle}" (${params.chapterTitle}).
Ngữ cảnh chương sách (trích lược):
"""
${params.chapterText.slice(0, 15000)}
"""
${
  params.selectedExcerpt
    ? `\nĐoạn văn người học đang bôi đen / thắc mắc:\n"${params.selectedExcerpt}"\n`
    : ""
}
Câu hỏi của người học: "${params.question}"

Hãy trả lời thật rõ ràng, sâu sắc, dễ hiểu bằng tiếng Việt (phân tích cả ý nghĩa nội dung lẫn từ vựng/ngữ pháp nếu liên quan).`;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
  });

  return response.text || "Không có phản hồi từ AI.";
}

const TOC_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    chapters: {
      type: Type.ARRAY,
      description:
        "Danh sách các Chương / Bài học chính thức của sách dựa trên Mục lục và tiêu đề trang PDF (bỏ qua bìa, lời tựa, phụ lục không cần thiết).",
      items: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description: "Tên bài học / chương (VD: Lesson 1: 歡迎你來臺灣！ Welcome to Taiwan!)",
          },
          startPage: {
            type: Type.INTEGER,
            description: "Số trang PDF bắt đầu (1-based)",
          },
          endPage: {
            type: Type.INTEGER,
            description: "Số trang PDF kết thúc (1-based)",
          },
        },
        required: ["title", "startPage", "endPage"],
      },
    },
  },
  required: ["chapters"],
};

export async function extractBookTocWithAI(params: {
  pageSummaries: string;
  totalPages: number;
  apiKey?: string;
  model?: string;
}): Promise<{ title: string; startPage: number; endPage: number }[]> {
  const ai = getClient(params.apiKey);
  const modelName = params.model || "gemini-2.5-flash";

  const prompt = `Bạn là Chuyên gia Phân tích Cấu trúc Sách & Mục lục (Table of Contents Analyzer).
Dưới đây là dữ liệu trích xuất từ các trang của một cuốn sách PDF (Tổng cộng ${params.totalPages} trang PDF).
Hãy đọc phần Mục lục (Table of Contents / 目錄 / Contents ở các trang đầu) KẾT HỢP với tiêu đề xuất hiện trên từng trang [Page X] để xác định chính xác danh sách các Bài học / Chương chính (Lessons / Chapters / Units) từ bài đầu tiên đến bài cuối cùng.

LƯU Ý QUAN TRỌNG:
1. Loại bỏ các phần dẫn nhập không phải bài học (như Bìa, Lời nói đầu, Bản quyền, Mục lục).
2. Chú ý độ lệch giữa "số trang in trong mục lục" và "số trang thực tế của file PDF [Page X]". Hãy ưu tiên khớp theo số trang thực tế [Page X] nơi bài học thực sự bắt đầu!
3. Đảm bảo lấy đầy đủ tất cả các bài học từ Lesson 1 / Chapter 1 cho đến bài cuối cùng của cuốn sách.

DỮ LIỆU CÁC TRANG PDF:
"""
${params.pageSummaries.slice(0, 45000)}
"""`;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: TOC_SCHEMA,
      temperature: 0.1,
    },
  });

  if (!response.text) {
    throw new Error("AI không thể phân tích mục lục.");
  }

  const parsed = JSON.parse(response.text);
  return parsed.chapters || [];
}

const CUSTOM_EXAM_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    examTitle: { type: Type.STRING },
    quizQuestions: {
      type: Type.ARRAY,
      description: "8-10 câu hỏi trắc nghiệm mới đa dạng (từ vựng, ngữ pháp, tình huống đọc hiểu).",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          question: { type: Type.STRING },
          category: { type: Type.STRING },
          options: { type: Type.ARRAY, items: { type: Type.STRING } },
          correctIndex: { type: Type.INTEGER },
          explanation: { type: Type.STRING },
        },
        required: [
          "id",
          "question",
          "category",
          "options",
          "correctIndex",
          "explanation",
        ],
      },
    },
    clozeQuestions: {
      type: Type.ARRAY,
      description: "5-6 câu điền từ mới (dùng _____ cho chỗ trống).",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          sentenceWithBlank: { type: Type.STRING },
          answer: { type: Type.STRING },
          hint: { type: Type.STRING },
          fullSentenceTranslation: { type: Type.STRING },
          explanation: { type: Type.STRING },
        },
        required: [
          "id",
          "sentenceWithBlank",
          "answer",
          "hint",
          "fullSentenceTranslation",
          "explanation",
        ],
      },
    },
    translationChallenges: {
      type: Type.ARRAY,
      description: "3-4 câu thử thách dịch thuật sát với từ vựng và cấu trúc ngữ pháp vừa học.",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          originalSentence: { type: Type.STRING },
          direction: { type: Type.STRING },
          contextHint: { type: Type.STRING },
          targetGrammarOrVocab: { type: Type.ARRAY, items: { type: Type.STRING } },
          referenceTranslation: { type: Type.STRING },
        },
        required: [
          "id",
          "originalSentence",
          "direction",
          "contextHint",
          "targetGrammarOrVocab",
          "referenceTranslation",
        ],
      },
    },
  },
  required: ["examTitle", "quizQuestions", "clozeQuestions", "translationChallenges"],
};

export async function generateCustomExamWithAI(params: {
  courseTitle: string;
  scopeTitle: string;
  scannedContentAndVocab: string;
  apiKey?: string;
  model?: string;
}) {
  const ai = getClient(params.apiKey);
  const modelName = params.model || "gemini-2.5-flash";

  const prompt = `Bạn là Giám khảo Ra Đề Thi Ngôn Ngữ (AI Exam Generator).
Dựa trên dữ liệu văn bản đã quét (scanned data), từ vựng và ngữ pháp của "${params.scopeTitle}" trong khóa học "${params.courseTitle}", hãy sinh ra một ĐỀ THI KIỂM TRA CHƯƠNG MỚI TINH để người học làm bài kiểm tra.

QUY TẮC BẮT BUỘC:
1. quizQuestions (10 câu trắc nghiệm): CHỈ KIỂM TRA TỪ VỰNG (nghĩa, phiên âm, cách dùng từ, từ loại) VÀ NGỮ PHÁP (cấu trúc câu, sắp xếp từ, điền từ đúng ngữ pháp). TUYỆT ĐỐI KHÔNG hỏi tình tiết cốt truyện hay hội thoại (như nhân vật là ai, làm gì trong bài khóa).
2. clozeQuestions (6 câu điền từ): Tạo các câu ứng dụng mới (dùng _____ cho chỗ trống) yêu cầu điền đúng từ vựng hoặc điểm ngữ pháp của chương.
3. translationChallenges (4 câu dịch thuật): Các câu hoàn chỉnh vận dụng từ vựng và ngữ pháp của chương để người học dịch và được AI chấm điểm độ gần đúng.

DỮ LIỆU ĐÃ QUÉT & TỪ VỰNG:
"""
${params.scannedContentAndVocab.slice(0, 30000)}
"""`;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: CUSTOM_EXAM_SCHEMA,
      temperature: 0.5,
    },
  });

  if (!response.text) {
    throw new Error("Không thể tạo đề thi mới.");
  }

  return JSON.parse(response.text);
}

const FULL_VOCAB_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    vocabulary: CHAPTER_LESSON_SCHEMA.properties!.vocabulary,
  },
  required: ["vocabulary"],
};

export async function extractAllChapterVocabWithAI(params: {
  courseTitle: string;
  chapterTitle: string;
  chapterText: string;
  pageImagesBase64?: string[];
  apiKey?: string;
  model?: string;
}) {
  const ai = getClient(params.apiKey);
  const modelName = params.model || "gemini-2.5-flash";

  const prompt = `Bạn là Chuyên gia Từ điển & Ngôn ngữ học.
Hãy quét toàn bộ văn bản (và hình ảnh trang sách nếu có) của "${params.chapterTitle}" thuộc sách "${params.courseTitle}" và trích xuất ĐẦY ĐỦ 100% TẤT CẢ các mục từ vựng:
- Toàn bộ các mục trong bảng Vocabulary (生詞 / Từ mới)
- Toàn bộ các mục trong bảng People / Names / Proper Nouns (專有名詞 / Danh từ riêng)
- Toàn bộ các mục trong bảng Phrases / Idioms (慣用語 / Cụm từ)

KHÔNG ĐƯỢC BỎ SÓT BẤT KỲ TỪ NÀO (nếu trong bài có 40-50 từ đánh số từ 1 đến hết thì phải lấy đủ tất cả!).
Với mỗi từ, cung cấp:
- word: Từ gốc (VD: 請, 喝, 烏龍茶, 陳月美, 對不起...)
- ipa: Phiên âm Pinyin có dấu (nếu tiếng Trung) hoặc IPA (nếu tiếng Anh)
- partOfSpeech: Từ loại (N, V, Vs, Vst, Adv, Ptc, Det, Vaux, Phrase, Proper Noun...)
- cefrLevel: A1, A2, B1, B2, C1, hoặc C2
- vietnameseMeaning: Nghĩa tiếng Việt đầy đủ, chính xác
- explanationInContext: Giải thích ngắn gọn cách dùng từ trong câu (1-2 câu)
- quoteFromBook: Câu ví dụ có chứa từ đó
- quoteTranslation: Dịch nghĩa câu ví dụ sang tiếng Việt
- collocations: 1-2 cụm từ kết hợp phổ biến
- synonyms: Từ đồng nghĩa hoặc liên quan

NỘI DUNG CHƯƠNG SÁCH:
"""
${params.chapterText.slice(0, 35000)}
"""`;

  const contentsPayload: Array<
    string | { inlineData: { mimeType: string; data: string } }
  > = [prompt];

  if (params.pageImagesBase64 && params.pageImagesBase64.length > 0) {
    for (const base64Img of params.pageImagesBase64) {
      contentsPayload.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Img,
        },
      });
    }
  }

  const response = await ai.models.generateContent({
    model: modelName,
    contents: contentsPayload,
    config: {
      responseMimeType: "application/json",
      responseSchema: FULL_VOCAB_SCHEMA,
      temperature: 0.2,
      maxOutputTokens: 65536,
    },
  });

  if (!response.text) {
    throw new Error("Không nhận được danh sách từ vựng từ AI.");
  }

  const parsed = JSON.parse(response.text);
  return parsed.vocabulary || [];
}
