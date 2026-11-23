"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Upload,
  FileText,
  BookOpen,
  Layers,
  GraduationCap,
  Volume2,
  Mic,
  Search,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Loader2,
  Wand2,
  Gamepad2,
  Headphones,
  Keyboard,
  FileSpreadsheet,
  ArrowRight,
  Link2,
  Shuffle,
  Check,
  Download,
  Timer,
  Trophy,
  Play,
  Globe,
  MessageSquare,
} from "lucide-react";
import {
  VocabularyItem,
  TopicVocabDeck,
  TopicVocabGeneratedPractice,
  FlashcardSRS,
  Course,
  ChapterUnit,
  SupportedStudyLanguage,
} from "@/types/course";
import {
  speakSmart,
  stopAllSpeech,
  setTtsVoiceConfig,
  getTtsVoiceConfig,
} from "@/lib/tts";
import { fetchAiAgent } from "@/lib/quotaManager";
import {
  getAppSettings,
  saveCourse,
  recordLearningActivity,
} from "@/lib/storage";
import { showToast, runWithFeedback } from "@/lib/feedback";
import { ROUTES } from "@/lib/routes";
import { useAppData } from "@/components/app/AppDataProvider";
import AudioSpeakButton from "@/components/AudioSpeakButton";
import FlashcardArena from "@/components/FlashcardArena";
import PronunciationModal from "@/components/PronunciationModal";
import AiLessonChatWidget from "@/components/AiLessonChatWidget";
import SelectionAiPopover from "@/components/SelectionAiPopover";
import CustomSelect from "@/components/ui/CustomSelect";

const CUSTOM_TOPIC_DECKS_STORAGE_KEY = "bookmind_topic_vocab_decks_v1";

const PRESET_MULTILANG_DECKS: TopicVocabDeck[] = [
  {
    id: "zh-preset-daily-communication",
    slug: "zh-daily-communication",
    language: "Chinese",
    title: "01. Giao Tiếp & Đời Sống Hiện Đại (日常交流与生活)",
    category: "Chủ đề Tiếng Trung (HSK / TOCFL)",
    description: "Bộ từ vựng tiếng Trung chủ đề giao tiếp, học tập và đời sống kèm Pinyin, đồng nghĩa (近义词), trái nghĩa (反义词) và câu ví dụ.",
    level: "HSK 3-4 / B1",
    sourceType: "forumflash_preset",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    items: [
      {
        id: "zh-1-1",
        word: "交流",
        ipa: "/jiāo liú/",
        partOfSpeech: "Động từ / Danh từ",
        cefrLevel: "B1",
        vietnameseMeaning: "giao lưu, trao đổi, giao tiếp",
        explanationInContext: "Dùng khi nói về trao đổi văn hóa, ngôn ngữ hoặc ý kiến giữa hai bên (문화/语言/思想交流).",
        quoteFromBook: "通过跟当地人交流，我的汉语水平提高了很多。",
        quoteTranslation: "Thông qua việc giao tiếp với người bản xứ, trình độ tiếng Trung của tôi đã nâng cao rất nhiều.",
        collocations: ["文化交流 (giao lưu văn hóa)", "互相交流 (trao đổi lẫn nhau)", "交流经验 (trao đổi kinh nghiệm)"],
        synonyms: ["沟通 (gōu tōng)", "往来 (wǎng lái)"],
        antonyms: ["隔绝 (gé jué)", "封闭 (fēng bì)"],
      },
      {
        id: "zh-1-2",
        word: "适应",
        ipa: "/shì yìng/",
        partOfSpeech: "Động từ",
        cefrLevel: "B1",
        vietnameseMeaning: "thích nghi, thích ứng",
        explanationInContext: "Thích nghi với môi trường mới, khí hậu hoặc nhịp sống mới (适应新环境/新生活).",
        quoteFromBook: "刚来这里的时候，我不太适应这儿的天气。",
        quoteTranslation: "Khi mới đến đây, tôi chưa thích nghi lắm với thời tiết ở nơi này.",
        collocations: ["适应环境 (thích nghi môi trường)", "适应能力 (khả năng thích ứng)"],
        synonyms: ["习惯 (xí guàn)", "顺应 (shùn yìng)"],
        antonyms: ["不惯 (bù guàn)", "排斥 (pái chì)"],
      },
      {
        id: "zh-1-3",
        word: "有效",
        ipa: "/yǒu xiào/",
        partOfSpeech: "Tính từ",
        cefrLevel: "B1",
        vietnameseMeaning: "hiệu quả, có hiệu lực",
        explanationInContext: "Mô tả phương pháp, biện pháp hoặc giấy tờ có giá trị hiệu lực.",
        quoteFromBook: "每天复习生词是学习语言最有效的方法。",
        quoteTranslation: "Ôn tập từ mới mỗi ngày là phương pháp học ngôn ngữ hiệu quả nhất.",
        collocations: ["有效方法 (phương pháp hiệu quả)", "行之有效 (áp dụng có hiệu quả)"],
        synonyms: ["管用 (guǎn yòng)", "见效 (jiàn xiào)"],
        antonyms: ["无效 (wú xiào)", "失效 (shī xiào)"],
      },
      {
        id: "zh-1-4",
        word: "养成",
        ipa: "/yǎng chéng/",
        partOfSpeech: "Động từ",
        cefrLevel: "B1",
        vietnameseMeaning: "hình thành, rèn luyện (thói quen)",
        explanationInContext: "Thường đi kèm với 习惯 (thói quen) để chỉ việc rèn luyện kiên trì trong thời gian dài.",
        quoteFromBook: "从小养成阅读的好习惯非常重要。",
        quoteTranslation: "Rèn luyện thói quen đọc sách tốt từ nhỏ là vô cùng quan trọng.",
        collocations: ["养成好习惯 (hình thành thói quen tốt)", "养成规律 (tạo nếp sinh hoạt)"],
        synonyms: ["培养 (péi yǎng)", "形成 (xíng chéng)"],
        antonyms: ["戒除 (jiè chú)", "改掉 (gǎi diào)"],
      },
      {
        id: "zh-1-5",
        word: "理解",
        ipa: "/lǐ jiě/",
        partOfSpeech: "Động từ / Danh từ",
        cefrLevel: "A2",
        vietnameseMeaning: "hiểu, thấu hiểu, thông cảm",
        explanationInContext: "Dùng cả cho việc hiểu kiến thức/ngôn ngữ lẫn sự thấu hiểu cảm xúc của người khác.",
        quoteFromBook: "阅读上下文能帮助你更好地理解这个词的意思。",
        quoteTranslation: "Đọc ngữ cảnh có thể giúp bạn hiểu rõ hơn ý nghĩa của từ này.",
        collocations: ["互相理解 (thấu hiểu lẫn nhau)", "深刻理解 (hiểu sâu sắc)"],
        synonyms: ["明白 (míng bai)", "懂得 (dǒng de)", "领会 (lǐng huì)"],
        antonyms: ["误解 (wù jiě)", "困惑 (kùn huò)"],
      },
      {
        id: "zh-1-6",
        word: "坚持",
        ipa: "/jiān chí/",
        partOfSpeech: "Động từ",
        cefrLevel: "B1",
        vietnameseMeaning: "kiên trì, bền bỉ giữ vững",
        explanationInContext: "Giữ vững hành động hoặc quan điểm không bỏ cuộc giữa chừng.",
        quoteFromBook: "只要你坚持每天练习口语，发音一定会越来越标准。",
        quoteTranslation: "Chỉ cần bạn kiên trì luyện khẩu ngữ mỗi ngày, phát âm nhất định sẽ ngày càng chuẩn.",
        collocations: ["坚持到底 (kiên trì đến cùng)", "坚持不懈 (kiên trì không ngừng nghỉ)"],
        synonyms: ["坚守 (jiān shǒu)", "维持 (wéi chí)"],
        antonyms: ["放弃 (fàng qì)", "动摇 (dòng yáo)"],
      },
      {
        id: "zh-1-7",
        word: "丰富",
        ipa: "/fēng fù/",
        partOfSpeech: "Tính từ / Động từ",
        cefrLevel: "B1",
        vietnameseMeaning: "phong phú, làm giàu thêm",
        explanationInContext: "Mô tả kinh nghiệm, vốn từ vựng, tài nguyên hoặc kiến thức đa dạng.",
        quoteFromBook: "广泛的阅读可以不断丰富我们的词汇量。",
        quoteTranslation: "Việc đọc rộng có thể không ngừng làm phong phú vốn từ vựng của chúng ta.",
        collocations: ["经验丰富 (giàu kinh nghiệm)", "丰富多彩 (phong phú đa dạng)"],
        synonyms: ["充实 (chōng shí)", "充足 (chōng zú)"],
        antonyms: ["贫乏 (pín fá)", "单调 (dān diào)"],
      },
      {
        id: "zh-1-8",
        word: "准确",
        ipa: "/zhǔn què/",
        partOfSpeech: "Tính từ",
        cefrLevel: "B1",
        vietnameseMeaning: "chính xác, chuẩn xác",
        explanationInContext: "Dùng cho phát âm, dùng từ, số liệu hoặc dự đoán đúng hoàn toàn.",
        quoteFromBook: "要想把意思表达得更准确，我们需要学习近义词的区别。",
        quoteTranslation: "Muốn diễn đạt ý nghĩa chuẩn xác hơn, chúng ta cần học sự khác biệt giữa các từ đồng nghĩa.",
        collocations: ["发音准确 (phát âm chuẩn xác)", "准确无误 (chính xác không sai sót)"],
        synonyms: ["精确 (jīng què)", "正确 (zhèng què)"],
        antonyms: ["错误 (cuò wù)", "偏差 (piān chā)"],
      },
    ],
  },
  {
    id: "zh-preset-tech-economy",
    slug: "zh-tech-economy",
    language: "Chinese",
    title: "02. Công Nghệ, Kinh Tế & Công Việc (科技与职场商务)",
    category: "Chủ đề Tiếng Trung (HSK / TOCFL)",
    description: "Từ vựng tiếng Trung chủ đề trí tuệ nhân tạo, kinh tế số, thương mại và môi trường làm việc chuyên nghiệp.",
    level: "HSK 4-5 / B2",
    sourceType: "forumflash_preset",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    items: [
      {
        id: "zh-2-1",
        word: "人工智能",
        ipa: "/rén gōng zhì néng/",
        partOfSpeech: "Cụm danh từ",
        cefrLevel: "B2",
        vietnameseMeaning: "trí tuệ nhân tạo (AI)",
        explanationInContext: "Thuật ngữ công nghệ cốt lõi trong thời đại số hóa và tự động hóa.",
        quoteFromBook: "人工智能正在深刻地改变我们的工作和学习方式。",
        quoteTranslation: "Trí tuệ nhân tạo đang thay đổi sâu sắc phương thức làm việc và học tập của chúng ta.",
        collocations: ["发展人工智能 (phát triển AI)", "人工智能技术 (công nghệ AI)"],
        synonyms: ["智能科技 (zhì néng kē jì)", "机器学习 (jī qì xué xí)"],
        antonyms: ["传统人工 (chuán tǒng rén gōng)"],
      },
      {
        id: "zh-2-2",
        word: "效率",
        ipa: "/xiào lǜ/",
        partOfSpeech: "Danh từ",
        cefrLevel: "B2",
        vietnameseMeaning: "hiệu suất, năng suất",
        explanationInContext: "Tỉ lệ kết quả đạt được trên thời gian và công sức bỏ ra (工作效率/学习效率).",
        quoteFromBook: "合理安排时间能够大大提高我们的工作效率。",
        quoteTranslation: "Sắp xếp thời gian hợp lý có thể nâng cao đáng kể hiệu suất làm việc của chúng ta.",
        collocations: ["提高效率 (nâng cao hiệu suất)", "高效率 (hiệu suất cao)"],
        synonyms: ["效能 (xiào néng)", "效益 (xiào yì)"],
        antonyms: ["低效 (dī xiào)", "拖延 (tuō yán)"],
      },
      {
        id: "zh-2-3",
        word: "创新",
        ipa: "/chuàng xīn/",
        partOfSpeech: "Động từ / Danh từ",
        cefrLevel: "B2",
        vietnameseMeaning: "đổi mới, sáng tạo",
        explanationInContext: "Tạo ra ý tưởng, công nghệ hoặc mô hình kinh doanh mới.",
        quoteFromBook: "企业要想在激烈的竞争中生存，就必须不断创新。",
        quoteTranslation: "Doanh nghiệp muốn tồn tại trong cuộc cạnh tranh khốc liệt thì bắt buộc phải không ngừng đổi mới sáng tạo.",
        collocations: ["科技创新 (đổi mới công nghệ)", "创新精神 (tinh thần sáng tạo)"],
        synonyms: ["革新 (gé xīn)", "创造 (chuàng zào)"],
        antonyms: ["守旧 (shǒu jiù)", "模仿 (mó fǎng)"],
      },
      {
        id: "zh-2-4",
        word: "合作",
        ipa: "/hé zuò/",
        partOfSpeech: "Động từ / Danh từ",
        cefrLevel: "B1",
        vietnameseMeaning: "hợp tác, cộng tác",
        explanationInContext: "Làm việc cùng nhau để đạt mục tiêu chung trong kinh doanh hoặc dự án.",
        quoteFromBook: "我们两家公司已经保持了十多年的友好合作关系。",
        quoteTranslation: "Hai công ty chúng tôi đã duy trì mối quan hệ hợp tác hữu nghị hơn mười năm.",
        collocations: ["合作伙伴 (đối tác hợp tác)", "团队合作 (làm việc nhóm)"],
        synonyms: ["协作 (xié zuò)", "联手 (lián shǒu)"],
        antonyms: ["对抗 (duì kàng)", "竞争 (jìng zhēng)"],
      },
      {
        id: "zh-2-5",
        word: "可持续发展",
        ipa: "/kě chí xù fā zhǎn/",
        partOfSpeech: "Cụm danh từ",
        cefrLevel: "C1",
        vietnameseMeaning: "phát triển bền vững",
        explanationInContext: "Phát triển kinh tế đi đôi với bảo vệ môi trường và tài nguyên cho thế hệ tương lai.",
        quoteFromBook: "保护生态环境是实现经济可持续发展的重要基础。",
        quoteTranslation: "Bảo vệ môi trường sinh thái là nền tảng quan trọng để thực hiện phát triển kinh tế bền vững.",
        collocations: ["实现可持续发展 (thực hiện phát triển bền vững)", "绿色发展 (phát triển xanh)"],
        synonyms: ["绿色经济 (lǜ sè jīng jì)", "长远发展 (cháng yuǎn fā zhǎn)"],
        antonyms: ["过度开发 (guò dù kāi fā)"],
      },
      {
        id: "zh-2-6",
        word: "趋势",
        ipa: "/qū shì/",
        partOfSpeech: "Danh từ",
        cefrLevel: "B2",
        vietnameseMeaning: "xu hướng, xu thế",
        explanationInContext: "Chiều hướng phát triển tất yếu của thị trường, xã hội hoặc công nghệ.",
        quoteFromBook: "数字化转型已经成为全球企业发展的必然趋势。",
        quoteTranslation: "Chuyển đổi số đã trở thành xu thế tất yếu trong sự phát triển của các doanh nghiệp toàn cầu.",
        collocations: ["发展趋势 (xu hướng phát triển)", "必然趋势 (xu thế tất yếu)"],
        synonyms: ["走向 (zǒu xiàng)", "潮流 (cháo liú)"],
        antonyms: ["逆流 (nì liú)"],
      },
    ],
  },
  {
    id: "ja-preset-communication",
    slug: "ja-daily-business",
    language: "Japanese",
    title: "01. Giao Tiếp & Đời Sống Nhật Bản (日常・ビジネス日本語)",
    category: "Chủ đề Tiếng Nhật (JLPT N4-N2)",
    description: "Từ vựng tiếng Nhật theo chủ đề giao tiếp, công việc kèm Furigana, đồng nghĩa và trái nghĩa.",
    level: "JLPT N3 / B1",
    sourceType: "forumflash_preset",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    items: [
      {
        id: "ja-1-1",
        word: "習慣",
        ipa: "/しゅうかん • shūkan/",
        partOfSpeech: "Danh từ",
        cefrLevel: "B1",
        vietnameseMeaning: "thói quen, tập quán",
        explanationInContext: "Thói quen lặp đi lặp lại hằng ngày hoặc phong tục tập quán văn hóa.",
        quoteFromBook: "毎日少しだけでも本を読む習慣をつけましょう。",
        quoteTranslation: "Hãy tập thói quen đọc sách mỗi ngày dù chỉ một chút.",
        collocations: ["生活習慣 (thói quen sinh hoạt)", "習慣を身につける (hình thành thói quen)"],
        synonyms: ["癖 (kuse)", "慣習 (kanshū)"],
        antonyms: ["例外 (reigai)"],
      },
      {
        id: "ja-1-2",
        word: "効率",
        ipa: "/こうりつ • kōritsu/",
        partOfSpeech: "Danh từ",
        cefrLevel: "B2",
        vietnameseMeaning: "hiệu suất, năng suất",
        explanationInContext: "Dùng phổ biến trong học tập và công việc tại Nhật (効率がいい/悪い).",
        quoteFromBook: "新しいツールを使って仕事の効率が上がりました。",
        quoteTranslation: "Nhờ sử dụng công cụ mới mà hiệu suất công việc đã tăng lên.",
        collocations: ["効率を上げる (nâng cao hiệu suất)", "効率的 (có tính hiệu quả)"],
        synonyms: ["能率 (nōritsu)"],
        antonyms: ["非効率 (hikōritsu)"],
      },
      {
        id: "ja-1-3",
        word: "改善",
        ipa: "/かいぜん • kaizen/",
        partOfSpeech: "Danh từ / Động từ",
        cefrLevel: "B2",
        vietnameseMeaning: "cải thiện, cải tiến",
        explanationInContext: "Triết lý cải tiến liên tục trong công việc và đời sống.",
        quoteFromBook: "生活環境を改善するために様々な対策が必要です。",
        quoteTranslation: "Cần có nhiều biện pháp khác nhau để cải thiện môi trường sống.",
        collocations: ["関係を改善する (cải thiện quan hệ)", "改善策 (biện pháp cải thiện)"],
        synonyms: ["改良 (kairyō)", "向上 (kōjō)"],
        antonyms: ["悪化 (akka)", "改悪 (kaiaku)"],
      },
      {
        id: "ja-1-4",
        word: "協力",
        ipa: "/きょうりょく • kyōryoku/",
        partOfSpeech: "Danh từ / Động từ",
        cefrLevel: "B1",
        vietnameseMeaning: "hợp tác, chung sức",
        explanationInContext: "Cùng phối hợp giúp đỡ nhau để hoàn thành mục tiêu chung.",
        quoteFromBook: "皆様のご協力のおかげでイベントは成功しました。",
        quoteTranslation: "Nhờ sự hợp tác của tất cả mọi người mà sự kiện đã thành công tốt đẹp.",
        collocations: ["協力する (hợp tác)", "国際協力 (hợp tác quốc tế)"],
        synonyms: ["連携 (renkei)", "共同 (kyōdō)"],
        antonyms: ["対立 (tairitsu)"],
      },
    ],
  },
  {
    id: "ko-preset-communication",
    slug: "ko-daily-society",
    language: "Korean",
    title: "01. Giao Tiếp & Xã Hội Hàn Quốc (일상 및 사회 어휘)",
    category: "Chủ đề Tiếng Hàn (TOPIK I-II)",
    description: "Từ vựng tiếng Hàn chủ đề đời sống và xã hội kèm phiên âm, đồng nghĩa (유의어) và trái nghĩa (반의어).",
    level: "TOPIK 3-4 / B1",
    sourceType: "forumflash_preset",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    items: [
      {
        id: "ko-1-1",
        word: "습관",
        ipa: "/seup-gwan/",
        partOfSpeech: "Danh từ",
        cefrLevel: "B1",
        vietnameseMeaning: "thói quen",
        explanationInContext: "Thói quen hành vi được lặp lại lâu ngày trong cuộc sống.",
        quoteFromBook: "좋은 습관을 기르는 것은 성공의 첫걸음입니다.",
        quoteTranslation: "Rèn luyện thói quen tốt là bước đầu tiên của sự thành công.",
        collocations: ["습관을 기르다 (nuôi dưỡng thói quen)", "생활 습관 (thói quen sinh hoạt)"],
        synonyms: ["버릇 (beo-reut)", "관습 (gwan-seup)"],
        antonyms: ["일시적 행동 (hành động nhất thời)"],
      },
      {
        id: "ko-1-2",
        word: "소통",
        ipa: "/so-tong/",
        partOfSpeech: "Danh từ / Động từ",
        cefrLevel: "B1",
        vietnameseMeaning: "giao tiếp, sự thấu hiểu thông suốt",
        explanationInContext: "Giao tiếp cởi mở, không bị hiểu lầm giữa các cá nhân hoặc thế hệ.",
        quoteFromBook: "가족 간에는 솔직한 대화와 소통이 가장 중요합니다.",
        quoteTranslation: "Giữa các thành viên gia đình thì trò chuyện thẳng thắn và sự giao tiếp thấu hiểu là quan trọng nhất.",
        collocations: ["의사소통 (giao tiếp ngôn ngữ)", "소통하다 (giao tiếp)"],
        synonyms: ["교류 (gyo-ryu)", "대화 (dae-hwa)"],
        antonyms: ["단절 (dan-jeol)", "불통 (bul-tong)"],
      },
      {
        id: "ko-1-3",
        word: "발전",
        ipa: "/bal-jeon/",
        partOfSpeech: "Danh từ / Động từ",
        cefrLevel: "B1",
        vietnameseMeaning: "sự phát triển, tiến bộ",
        explanationInContext: "Phát triển kinh tế, khoa học kỹ thuật hoặc năng lực bản thân.",
        quoteFromBook: "과학 기술의 발전으로 우리의 삶이 더욱 편리해졌습니다.",
        quoteTranslation: "Nhờ sự phát triển của khoa học kỹ thuật mà cuộc sống của chúng ta trở nên tiện lợi hơn.",
        collocations: ["경제 발전 (phát triển kinh tế)", "발전하다 (phát triển)"],
        synonyms: ["성장 (seong-jang)", "진보 (jin-bo)"],
        antonyms: ["퇴보 (toe-bo)", "낙후 (nak-hu)"],
      },
      {
        id: "ko-1-4",
        word: "협력",
        ipa: "/hyeom-nyeok/",
        partOfSpeech: "Danh từ / Động từ",
        cefrLevel: "B2",
        vietnameseMeaning: "sự hợp tác, hiệp lực",
        explanationInContext: "Cùng hợp sức làm việc giữa các tổ chức, quốc gia hoặc đồng nghiệp.",
        quoteFromBook: "두 회사는 새로운 프로젝트를 위해 적극적으로 협력하기로 했습니다.",
        quoteTranslation: "Hai công ty đã quyết định tích cực hợp tác vì dự án mới.",
        collocations: ["국제 협력 (hợp tác quốc tế)", "협력하다 (hợp tác)"],
        synonyms: ["협동 (hyeop-dong)", "제휴 (je-hyu)"],
        antonyms: ["대립 (dae-rip)", "갈등 (gal-deung)"],
      },
    ],
  },
];

interface ForumFlashTopicJson {
  topic_index?: number;
  level_index?: number;
  slug: string;
  title: string;
  total_cards: number;
  cards: {
    index: number;
    term: string;
    phonetic: string;
    part_of_speech: string;
    category: string;
    definition: string;
    usage_pattern: string;
    examples: string[];
  }[];
}

// Unified Timed Test Question Type (combines all 4 skills into 1 cohesive timed test)
interface UnifiedTopicTestQuestion {
  id: string;
  skillType: "matching" | "sentence_fill" | "listening" | "word_fill";
  skillLabel: string;
  promptTitle: string;
  subHint?: string;
  ipaHint?: string;
  synonymHint?: string;
  antonymHint?: string;
  audioTextToSpeak: string;
  fullSentenceAudio?: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
}

function inferBasicSynonymsAndAntonyms(
  word: string,
  pattern: string,
  pos: string
): { synonyms: string[]; antonyms: string[] } {
  const w = word.toLowerCase().trim();
  const synMap: Record<string, { syn: string[]; ant: string[] }> = {
    "early childhood education": {
      syn: ["preschool education", "nursery schooling", "kindergarten education"],
      ant: ["higher education", "adult education"],
    },
    "climate change": {
      syn: ["global warming", "climatic shift", "climate crisis"],
      ant: ["climate stability", "ecological balance"],
    },
    "artificial intelligence": {
      syn: ["machine intelligence", "cognitive computing", "AI system"],
      ant: ["human intelligence", "manual processing"],
    },
    "public health": {
      syn: ["community health", "population wellness", "preventive medicine"],
      ant: ["individual illness", "private healthcare"],
    },
    "economic growth": {
      syn: ["economic expansion", "prosperity", "GDP boom"],
      ant: ["economic recession", "stagnation", "downturn"],
    },
    "urbanisation": {
      syn: ["city expansion", "metropolitan growth", "urban development"],
      ant: ["ruralisation", "counter-urbanisation", "decentralisation"],
    },
    "public transport": {
      syn: ["mass transit", "public transit", "commuter network"],
      ant: ["private transport", "personal vehicle"],
    },
    "crime rate": {
      syn: ["offence rate", "delinquency level", "criminality index"],
      ant: ["public safety index", "lawfulness"],
    },
    "democracy": {
      syn: ["representative government", "self-rule", "republic"],
      ant: ["dictatorship", "autocracy", "totalitarianism"],
    },
    "mass media": {
      syn: ["broadcast media", "mainstream press", "public journalism"],
      ant: ["private communication", "niche publication"],
    },
    "globalisation": {
      syn: ["internationalisation", "global integration", "worldwide trade"],
      ant: ["deglobalisation", "protectionism", "isolationism"],
    },
    "personal finance": {
      syn: ["household budgeting", "money management", "financial planning"],
      ant: ["corporate finance", "public expenditure"],
    },
    "lifelong learning": {
      syn: ["continuous education", "ongoing self-study", "permanent learning"],
      ant: ["fixed schooling", "short-term training"],
    },
    "higher education": {
      syn: ["tertiary education", "university study", "post-secondary education"],
      ant: ["primary education", "elementary schooling"],
    },
    "distance learning": {
      syn: ["online education", "remote study", "e-learning"],
      ant: ["in-person schooling", "classroom learning"],
    },
    "compulsory education": {
      syn: ["mandatory schooling", "required education"],
      ant: ["optional courses", "elective study"],
    },
  };

  if (synMap[w]) {
    return { synonyms: synMap[w].syn, antonyms: synMap[w].ant };
  }

  const parts = (pattern || "")
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(
      (s) =>
        s &&
        !s.toLowerCase().includes("danh từ") &&
        !s.toLowerCase().includes("động từ") &&
        !s.toLowerCase().includes("tính từ")
    );

  const wordsInTerm = w.split(/\s+/);
  const fallbackSyn =
    parts.length > 0
      ? parts.slice(0, 2)
      : wordsInTerm.length > 1
        ? [`${wordsInTerm[0]} ${wordsInTerm[wordsInTerm.length - 1]} phrase`]
        : [`related ${pos || "term"}`];

  return {
    synonyms: fallbackSyn,
    antonyms: [],
  };
}

function parseUploadedVocabFileContent(
  fileName: string,
  rawText: string
): {
  detectedTitle: string;
  items: Partial<VocabularyItem>[];
  rawPreview: string;
} {
  const cleanTitle = fileName
    .replace(/\.(json|csv|tsv|txt|md)$/i, "")
    .replace(/[_-]+/g, " ")
    .trim();

  const lowerName = fileName.toLowerCase();

  if (
    lowerName.endsWith(".json") ||
    rawText.trim().startsWith("{") ||
    rawText.trim().startsWith("[")
  ) {
    try {
      const parsed = JSON.parse(rawText);
      const arr = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.cards)
          ? parsed.cards
          : Array.isArray(parsed.vocabulary)
            ? parsed.vocabulary
            : Array.isArray(parsed.items)
              ? parsed.items
              : [];

      if (arr.length > 0 && Array.isArray(arr[0]?.cards)) {
        const firstTopic = arr[0] as ForumFlashTopicJson;
        const items: Partial<VocabularyItem>[] = firstTopic.cards.map(
          (c, idx) => {
            const { synonyms, antonyms } = inferBasicSynonymsAndAntonyms(
              c.term,
              c.usage_pattern,
              c.part_of_speech
            );
            return {
              id: `imp-${idx + 1}`,
              word: c.term,
              ipa: c.phonetic || "",
              partOfSpeech: c.part_of_speech || "Từ vựng",
              cefrLevel: "B2",
              vietnameseMeaning: c.definition || "",
              explanationInContext: c.usage_pattern
                ? `Cấu trúc & Ngữ pháp: ${c.usage_pattern}`
                : `Thuộc chủ đề ${firstTopic.title}`,
              quoteFromBook: c.examples?.[0] || "",
              quoteTranslation: c.examples?.[1] || "",
              collocations: c.usage_pattern
                ? c.usage_pattern
                  .split(";")
                  .map((s) => s.trim())
                  .filter(Boolean)
                : [],
              synonyms,
              antonyms,
            };
          }
        );
        return {
          detectedTitle: firstTopic.title || cleanTitle,
          items,
          rawPreview: rawText.slice(0, 8000),
        };
      }

      const items: Partial<VocabularyItem>[] = arr
        .map((c: any, idx: number) => {
          const word = String(c.word || c.term || c.english || "").trim();
          if (!word) return null;
          const ipa = String(
            c.ipa || c.phonetic || c.pronunciation || ""
          ).trim();
          const pos = String(
            c.partOfSpeech || c.part_of_speech || c.pos || "Từ vựng"
          ).trim();
          const meaning = String(
            c.vietnameseMeaning || c.definition || c.meaning || c.vi || ""
          ).trim();
          const pattern = String(
            c.usage_pattern || c.explanationInContext || ""
          ).trim();
          const exs = Array.isArray(c.examples) ? c.examples : [];
          const { synonyms, antonyms } = inferBasicSynonymsAndAntonyms(
            word,
            pattern,
            pos
          );

          return {
            id: `imp-${idx + 1}`,
            word,
            ipa,
            partOfSpeech: pos,
            cefrLevel: c.cefrLevel || "B2",
            vietnameseMeaning: meaning,
            explanationInContext:
              c.explanationInContext ||
              (pattern
                ? `Cách dùng: ${pattern}`
                : `Từ vựng chủ đề ${cleanTitle}`),
            quoteFromBook: c.quoteFromBook || exs[0] || "",
            quoteTranslation: c.quoteTranslation || exs[1] || "",
            collocations: Array.isArray(c.collocations)
              ? c.collocations
              : pattern
                ? pattern
                  .split(";")
                  .map((s: string) => s.trim())
                  .filter(Boolean)
                : [],
            synonyms:
              Array.isArray(c.synonyms) && c.synonyms.length > 0
                ? c.synonyms
                : synonyms,
            antonyms:
              Array.isArray(c.antonyms) && c.antonyms.length > 0
                ? c.antonyms
                : antonyms,
          } as Partial<VocabularyItem>;
        })
        .filter(Boolean) as Partial<VocabularyItem>[];

      return {
        detectedTitle: parsed.title || parsed.topicTitle || cleanTitle,
        items,
        rawPreview: rawText.slice(0, 8000),
      };
    } catch {
      // Fallback
    }
  }

  const lines = rawText
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("| :---"));

  const items: Partial<VocabularyItem>[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (
      i === 0 &&
      (line.toLowerCase().includes("topic_index") ||
        line.toLowerCase().includes("từ vựng") ||
        line.toLowerCase().startsWith("term,"))
    ) {
      continue;
    }

    if (line.startsWith("|") && line.endsWith("|")) {
      const cells = line
        .split("|")
        .slice(1, -1)
        .map((c) => c.replace(/\*\*/g, "").replace(/`/g, "").trim());
      if (cells.length >= 5 && isNaN(Number(cells[1]))) {
        const word = cells[1];
        const ipa = cells[2];
        const pos = cells[3];
        const meaning = cells.length >= 6 ? cells[5] : cells[4];
        const pattern = cells.length >= 7 ? cells[6] : "";
        const exampleRaw = cells.length >= 8 ? cells[7] : "";
        const exParts = exampleRaw.split(/<br\s*\/?>/i);
        const { synonyms, antonyms } = inferBasicSynonymsAndAntonyms(
          word,
          pattern,
          pos
        );
        items.push({
          id: `imp-${items.length + 1}`,
          word,
          ipa,
          partOfSpeech: pos || "Từ vựng",
          cefrLevel: "B2",
          vietnameseMeaning: meaning,
          explanationInContext: pattern ? `Cách dùng: ${pattern}` : "",
          quoteFromBook: exParts[0] || "",
          quoteTranslation: exParts[1] || "",
          collocations: pattern
            ? pattern
              .split(";")
              .map((s) => s.trim())
              .filter(Boolean)
            : [],
          synonyms,
          antonyms,
        });
        continue;
      }
    }

    if (line.includes("\t")) {
      const parts = line.split("\t").map((s) => s.trim());
      if (parts[0]) {
        items.push({
          id: `imp-${items.length + 1}`,
          word: parts[0],
          vietnameseMeaning: parts[1] || "",
          explanationInContext: parts[2] || "",
        });
        continue;
      }
    }

    if (line.includes(",")) {
      const cols: string[] = [];
      let cur = "";
      let inQuotes = false;
      for (let c = 0; c < line.length; c++) {
        const ch = line[c];
        if (ch === '"') {
          if (inQuotes && line[c + 1] === '"') {
            cur += '"';
            c++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (ch === "," && !inQuotes) {
          cols.push(cur.trim());
          cur = "";
        } else {
          cur += ch;
        }
      }
      cols.push(cur.trim());

      if (
        cols.length >= 10 &&
        !isNaN(Number(cols[0])) &&
        !isNaN(Number(cols[3]))
      ) {
        const word = cols[4];
        const ipa = cols[5];
        const pos = cols[6];
        const meaning = cols[8];
        const pattern = cols[9];
        const ex1 = cols[10] || "";
        const ex2 = cols[11] || "";
        const { synonyms, antonyms } = inferBasicSynonymsAndAntonyms(
          word,
          pattern,
          pos
        );
        items.push({
          id: `imp-${items.length + 1}`,
          word,
          ipa,
          partOfSpeech: pos,
          cefrLevel: "B2",
          vietnameseMeaning: meaning,
          explanationInContext: pattern
            ? `Cách dùng & Ngữ cảnh (${cols[7] || cols[2]}): ${pattern}`
            : `Chủ đề: ${cols[2]}`,
          quoteFromBook: ex1,
          quoteTranslation: ex2,
          collocations: pattern
            ? pattern
              .split(";")
              .map((s) => s.trim())
              .filter(Boolean)
            : [],
          synonyms,
          antonyms,
          topicTag: cols[2],
        });
        continue;
      } else if (cols.length >= 2 && cols[0].length < 60) {
        items.push({
          id: `imp-${items.length + 1}`,
          word: cols[0],
          vietnameseMeaning: cols[1] || "",
          ipa: cols[2] || "",
          partOfSpeech: cols[3] || "Từ vựng",
        });
        continue;
      }
    }

    const dashMatch = line.match(
      /^(?:\d+[.)]\s*)?([A-Za-z][A-Za-z0-9\s'-]{1,50}?)(?:\s*(\/[^/]+\/))?\s*[-:–—]\s*(.+)$/
    );
    if (dashMatch) {
      items.push({
        id: `imp-${items.length + 1}`,
        word: dashMatch[1].trim(),
        ipa: dashMatch[2]?.trim() || "",
        vietnameseMeaning: dashMatch[3].trim(),
      });
    }
  }

  return {
    detectedTitle: cleanTitle || "Chủ đề Từ vựng Mới",
    items,
    rawPreview: rawText.slice(0, 12000),
  };
}

export default function TopicVocabStudioPage() {
  const router = useRouter();
  const { refreshData } = useAppData();

  const [presetTopics, setPresetTopics] = useState<ForumFlashTopicJson[]>([]);
  const [presetCefr, setPresetCefr] = useState<ForumFlashTopicJson[]>([]);
  const [customDecks, setCustomDecks] = useState<TopicVocabDeck[]>([]);
  const [isLoadingPresets, setIsLoadingPresets] = useState(true);

  const [selectedLanguage, setSelectedLanguage] =
    useState<SupportedStudyLanguage>("English");
  const [activeSourceGroup, setActiveSourceGroup] = useState<
    "thematic_25" | "cefr_6" | "custom_imported"
  >("thematic_25");
  const [selectedTopicSlug, setSelectedTopicSlug] = useState<string>("education");
  const [selectedLessonBatch, setSelectedLessonBatch] = useState<number>(1); // Mặc định Bài 01 (20 từ) để học và test gọn gàng

  const [activeTab, setActiveTab] = useState<
    "vocab_cards" | "flashcards" | "ai_practice" | "import_ai"
  >("vocab_cards");

  // Voice & Accent Controls (Chuẩn bản xứ US / UK / zh-CN / zh-TW / ja-JP / ko-KR + Tốc độ đọc)
  const [voiceAccent, setVoiceAccent] = useState<"en-US" | "en-GB">("en-US");
  const [chineseAccent, setChineseAccent] = useState<"zh-CN" | "zh-TW">("zh-CN");
  const [voiceRate, setVoiceRate] = useState<number>(1.0);

  const [searchQuery, setSearchQuery] = useState("");

  const [pronounceTarget, setPronounceTarget] = useState<{
    word: string;
    ipa: string;
    meaning: string;
    example: string;
  } | null>(null);

  // File Import & AI Generator State
  const [importTopicTitle, setImportTopicTitle] = useState("");
  const [importRawText, setImportRawText] = useState("");
  const [parsedPreviewItems, setParsedPreviewItems] = useState<
    Partial<VocabularyItem>[]
  >([]);
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const [aiTargetCount, setAiTargetCount] = useState<number>(20);
  const [isAiAnalyzingFile, setIsAiAnalyzingFile] = useState(false);
  const [isAiEnrichingCurrentTopic, setIsAiEnrichingCurrentTopic] =
    useState(false);

  // =========================================================================
  // UNIFIED TIMED TEST ARENA STATE (Gói gọn tất cả dạng câu hỏi vào 1 bài Test có thời gian)
  // =========================================================================
  const [isGeneratingAiPractice, setIsGeneratingAiPractice] = useState(false);
  const [aiPracticeCache, setAiPracticeCache] = useState<
    Record<string, TopicVocabGeneratedPractice>
  >({});

  const [testDurationSeconds, setTestDurationSeconds] = useState<number>(20); // Mặc định 20 giây cho MỖI CÂU HỎI (0 = Không giới hạn)
  const [testTimeLeft, setTestTimeLeft] = useState<number>(20);
  const [isTestRunning, setIsTestRunning] = useState<boolean>(false);
  const [isTestSubmitted, setIsTestSubmitted] = useState<boolean>(false);
  const [currentTestIndex, setCurrentTestIndex] = useState<number>(0);
  const [testUserAnswers, setTestUserAnswers] = useState<
    Record<string, string>
  >({});
  const [testCheckedMap, setTestCheckedMap] = useState<Record<string, boolean>>(
    {}
  );
  const [testTimedOutMap, setTestTimedOutMap] = useState<Record<string, boolean>>(
    {}
  );
  const [testAudioPlayCountMap, setTestAudioPlayCountMap] = useState<
    Record<string, number>
  >({});

  // Load presets & custom decks
  useEffect(() => {
    const cfg = getTtsVoiceConfig();
    setVoiceAccent(cfg.accent);
    setChineseAccent(cfg.chineseAccent || "zh-CN");
    setVoiceRate(cfg.rate);

    try {
      const saved = localStorage.getItem(CUSTOM_TOPIC_DECKS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as TopicVocabDeck[];
        if (Array.isArray(parsed)) {
          setCustomDecks(parsed);
        }
      }
    } catch {
      // Ignore
    }

    async function loadForumFlashDatasets() {
      setIsLoadingPresets(true);
      try {
        const [resTopics, resCefr] = await Promise.all([
          fetch("/data/forumflash/forumflash_25_topics_5000_vocab.json"),
          fetch("/data/forumflash/forumflash_cefr_a1_c2_vocab.json"),
        ]);
        if (resTopics.ok) {
          const dataTopics = (await resTopics.json()) as ForumFlashTopicJson[];
          setPresetTopics(dataTopics);
        }
        if (resCefr.ok) {
          const dataCefr = (await resCefr.json()) as ForumFlashTopicJson[];
          setPresetCefr(dataCefr);
        }
      } catch {
        // Ignore
      } finally {
        setIsLoadingPresets(false);
      }
    }
    void loadForumFlashDatasets();
  }, []);

  const saveCustomDecksToStorage = (nextDecks: TopicVocabDeck[]) => {
    setCustomDecks(nextDecks);
    try {
      localStorage.setItem(
        CUSTOM_TOPIC_DECKS_STORAGE_KEY,
        JSON.stringify(nextDecks)
      );
    } catch {
      // Ignore
    }
  };

  // All non-English preset decks + custom decks filtered by selectedLanguage
  const languageCustomDecks = useMemo(() => {
    return customDecks.filter(
      (d) => (d.language || "English") === selectedLanguage
    );
  }, [customDecks, selectedLanguage]);

  const languagePresetDecks = useMemo(() => {
    return PRESET_MULTILANG_DECKS.filter(
      (d) => d.language === selectedLanguage
    );
  }, [selectedLanguage]);

  const activeDeck: TopicVocabDeck | null = useMemo(() => {
    if (selectedLanguage !== "English") {
      const combinedNonEn = [...languageCustomDecks, ...languagePresetDecks];
      return (
        combinedNonEn.find(
          (d) => d.id === selectedTopicSlug || d.slug === selectedTopicSlug
        ) ||
        combinedNonEn[0] ||
        null
      );
    }

    if (activeSourceGroup === "custom_imported") {
      return (
        languageCustomDecks.find((d) => d.id === selectedTopicSlug) ||
        languageCustomDecks[0] ||
        null
      );
    }

    const sourceList =
      activeSourceGroup === "thematic_25" ? presetTopics : presetCefr;
    const found =
      sourceList.find((t) => t.slug === selectedTopicSlug) || sourceList[0];
    if (!found) return null;

    const enrichedOverride = languageCustomDecks.find(
      (d) => d.slug === found.slug && d.sourceType === "forumflash_preset"
    );
    if (enrichedOverride) return enrichedOverride;

    const items: VocabularyItem[] = found.cards.map((c) => {
      const { synonyms, antonyms } = inferBasicSynonymsAndAntonyms(
        c.term,
        c.usage_pattern,
        c.part_of_speech
      );
      const cefrMatch = found.slug.match(/oxford-(a1|a2|b1|b2|c1|c2)/i);
      const defaultCefr = cefrMatch
        ? (cefrMatch[1].toUpperCase() as VocabularyItem["cefrLevel"])
        : "B2";

      return {
        id: `${found.slug}-${c.index}`,
        word: c.term,
        ipa: c.phonetic || "",
        partOfSpeech: c.part_of_speech || "Từ vựng",
        cefrLevel: defaultCefr,
        vietnameseMeaning: c.definition,
        explanationInContext: c.usage_pattern
          ? `Cách dùng & Ngữ pháp (${c.category || found.title}): ${c.usage_pattern}`
          : `Chủ đề: ${found.title}`,
        quoteFromBook: c.examples?.[0] || `We need to focus on ${c.term}.`,
        quoteTranslation:
          c.examples?.[1] ||
          `Ví dụ ứng dụng "${c.term}" (${c.definition}) trong ngữ cảnh thực tế.`,
        collocations: c.usage_pattern
          ? c.usage_pattern
            .split(";")
            .map((s) => s.trim())
            .filter(Boolean)
          : [],
        synonyms,
        antonyms,
        topicTag: found.title,
      };
    });

    return {
      id: `preset-${found.slug}`,
      slug: found.slug,
      language: "English",
      title: found.title,
      category:
        activeSourceGroup === "thematic_25"
          ? "25 Chủ đề Học thuật (5.000 từ)"
          : "Từ vựng Oxford CEFR (A1 - C2)",
      description: `Bộ ${found.total_cards} từ vựng chuẩn chủ đề ${found.title} kèm phiên âm IPA, cách dùng, ví dụ và bài tập ôn luyện.`,
      level:
        activeSourceGroup === "thematic_25"
          ? "B1 - C1"
          : found.slug.replace("oxford-", "").toUpperCase(),
      sourceType: "forumflash_preset",
      items,
      aiPractice: aiPracticeCache[found.slug] || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }, [
    selectedLanguage,
    activeSourceGroup,
    selectedTopicSlug,
    presetTopics,
    presetCefr,
    languageCustomDecks,
    languagePresetDecks,
    aiPracticeCache,
  ]);

  const scopedItems = useMemo(() => {
    if (!activeDeck) return [];
    let list = activeDeck.items;
    if (selectedLessonBatch > 0) {
      const start = (selectedLessonBatch - 1) * 20;
      list = list.slice(start, start + 20);
    }
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (it) =>
        it.word.toLowerCase().includes(q) ||
        it.vietnameseMeaning.toLowerCase().includes(q) ||
        it.ipa.toLowerCase().includes(q) ||
        (it.synonyms || []).some((s) => s.toLowerCase().includes(q)) ||
        (it.antonyms || []).some((a) => a.toLowerCase().includes(q))
    );
  }, [activeDeck, selectedLessonBatch, searchQuery]);

  const topicFlashcards: FlashcardSRS[] = useMemo(() => {
    if (!activeDeck) return [];
    return scopedItems.map((it) => ({
      id: `fc-${activeDeck.id}-${it.id}`,
      courseId: activeDeck.id,
      chapterId: `batch-${selectedLessonBatch}`,
      word: it.word,
      ipa: it.ipa,
      partOfSpeech: it.partOfSpeech,
      cefrLevel: it.cefrLevel,
      vietnameseMeaning: it.vietnameseMeaning,
      explanationInContext: it.explanationInContext,
      quoteFromBook: it.quoteFromBook,
      quoteTranslation: it.quoteTranslation,
      collocations: it.collocations || [],
      synonyms: it.synonyms || [],
      antonyms: it.antonyms || [],
      interval: 1,
      repetition: 0,
      efactor: 2.5,
      nextReviewDate: new Date().toISOString(),
    }));
  }, [activeDeck, scopedItems, selectedLessonBatch]);

  // Build Unified Timed Test Questions combining:
  // - Ghép nghĩa (Matching Meaning)
  // - Điền từ trong câu đúng nghĩa (Sentence Context Fill)
  // - Nghe giọng chuẩn nhận diện từ trong câu (Listening Comprehension)
  // - Tự gõ từ vựng theo nghĩa + đồng/trái nghĩa (Word Typing)
  const unifiedTestQuestions: UnifiedTopicTestQuestion[] = useMemo(() => {
    const cacheKey = `${activeDeck?.id || "default"}_batch_${selectedLessonBatch}`;
    const cachedPractice =
      aiPracticeCache[cacheKey] ||
      (selectedLessonBatch === 0 ? activeDeck?.aiPractice : null);

    const pool = scopedItems.slice(0, 20);
    const allWords = pool.map((p) => p.word);
    const allMeanings = pool.map((p) => p.vietnameseMeaning);

    const pickWordOptions = (correctWord: string): string[] => {
      const others = allWords.filter(
        (w) => w.toLowerCase() !== correctWord.toLowerCase()
      );
      const picked = [...others]
        .sort((a, b) => a.localeCompare(b))
        .slice(0, 3);
      return [correctWord, ...picked].sort((a, b) => a.localeCompare(b));
    };

    const pickMeaningOptions = (correctMeaning: string): string[] => {
      const others = allMeanings.filter((m) => m !== correctMeaning);
      const picked = [...others]
        .sort((a, b) => a.localeCompare(b))
        .slice(0, 3);
      return [correctMeaning, ...picked].sort((a, b) => a.localeCompare(b));
    };

    const escapeRegex = (s: string) =>
      s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const questions: UnifiedTopicTestQuestion[] = [];

    // Nếu đã có bộ câu hỏi ngữ cảnh mới do AI tạo -> trộn vào bài test tổng hợp
    if (cachedPractice) {
      // 1. Các câu ghép nghĩa từ bộ từ
      (cachedPractice.matchingPairs || []).slice(0, 4).forEach((mp, idx) => {
        questions.push({
          id: `u-match-${idx + 1}`,
          skillType: "matching",
          skillLabel: "Ghép Nghĩa Từ Vựng",
          promptTitle: `Chọn nghĩa tiếng Việt chính xác của từ "${mp.word}":`,
          ipaHint: mp.ipa,
          synonymHint: mp.synonymOrAntonymHint,
          audioTextToSpeak: mp.word,
          options: pickMeaningOptions(mp.vietnameseMeaning),
          correctAnswer: mp.vietnameseMeaning,
          explanation: `${mp.word} (${mp.ipa}) có nghĩa là: ${mp.vietnameseMeaning}.`,
        });
      });

      // 2. Các câu điền từ vào câu đúng nghĩa do AI tạo
      (cachedPractice.sentenceFillExercises || [])
        .slice(0, 5)
        .forEach((sf, idx) => {
          questions.push({
            id: `u-sfill-${idx + 1}`,
            skillType: "sentence_fill",
            skillLabel: "Điền Từ Trong Câu Đúng Nghĩa",
            promptTitle: sf.sentenceWithBlank,
            subHint: `Gợi ý nghĩa câu: ${sf.vietnameseTranslation}`,
            audioTextToSpeak: sf.fullSentenceWithAnswer,
            fullSentenceAudio: sf.fullSentenceWithAnswer,
            options:
              sf.options && sf.options.length >= 2
                ? sf.options
                : pickWordOptions(sf.answer),
            correctAnswer: sf.answer,
            explanation: `${sf.explanation} — Câu hoàn chỉnh: "${sf.fullSentenceWithAnswer}"`,
          });
        });

      // 3. Các câu nghe giọng đọc chuẩn do AI tạo
      (cachedPractice.listeningExercises || [])
        .slice(0, 4)
        .forEach((ls, idx) => {
          questions.push({
            id: `u-listen-${idx + 1}`,
            skillType: "listening",
            skillLabel: "Nghe Giọng Chuẩn & Chọn Từ",
            promptTitle: `Bấm nghe câu và chọn từ vựng còn thiếu: "${ls.sentenceWithBlank}"`,
            subHint: `Nghĩa từ cần nghe: ${ls.vietnameseTranslation}`,
            ipaHint: ls.ipa,
            audioTextToSpeak: ls.spokenSentence,
            fullSentenceAudio: ls.spokenSentence,
            options:
              ls.options && ls.options.length >= 2
                ? ls.options
                : pickWordOptions(ls.word),
            correctAnswer: ls.word,
            explanation: `Từ được phát âm trong câu là "${ls.word}" (${ls.ipa}) — Câu đầy đủ: "${ls.spokenSentence}"`,
          });
        });

      // 4. Các câu tự gõ từ (Điền từ theo nghĩa + đồng/trái nghĩa)
      (cachedPractice.wordFillExercises || [])
        .slice(0, 3)
        .forEach((wf, idx) => {
          questions.push({
            id: `u-wfill-${idx + 1}`,
            skillType: "word_fill",
            skillLabel: "Tự Gõ Từ Vựng (Kèm Đồng/Trái Nghĩa)",
            promptTitle: `Gõ từ/cụm từ (${selectedLanguage}) có nghĩa: "${wf.vietnamesePrompt}"`,
            subHint: `Từ loại: ${wf.partOfSpeech} • Gợi ý chữ đầu: "${wf.answer[0]}..." (${wf.answer.length} ký tự)`,
            ipaHint: wf.ipaHint,
            synonymHint: wf.synonymHint,
            antonymHint: wf.antonymHint,
            audioTextToSpeak: wf.answer,
            fullSentenceAudio: wf.exampleSentence,
            correctAnswer: wf.answer,
            explanation: `Đáp án chuẩn: "${wf.answer}" (${wf.ipaHint}). Ví dụ: "${wf.exampleSentence}"`,
          });
        });

      return questions;
    }

    // Mặc định: Tạo ngay bài Test Tổng Hợp 16 câu xoay vòng cả 4 kỹ năng từ danh sách từ hiện tại
    pool.slice(0, 16).forEach((v, idx) => {
      const mod = idx % 4;
      const fullSent =
        v.quoteFromBook && v.quoteFromBook.length > 3
          ? v.quoteFromBook
          : `${v.word}`;
      const reg = new RegExp(escapeRegex(v.word), "i");
      const blanked = reg.test(fullSent)
        ? fullSent.replace(reg, "_____")
        : `${fullSent} (Điền từ: _____)`;

      if (mod === 0) {
        // Dạng 1: Ghép nghĩa
        questions.push({
          id: `q-match-${idx + 1}`,
          skillType: "matching",
          skillLabel: "Ghép Nghĩa Từ Vựng",
          promptTitle: `Từ vựng "${v.word}" có nghĩa tiếng Việt là gì?`,
          ipaHint: `${v.ipa} • ${v.partOfSpeech}`,
          synonymHint: (v.synonyms || []).slice(0, 2).join(", "),
          antonymHint: (v.antonyms || []).slice(0, 2).join(", "),
          audioTextToSpeak: v.word,
          fullSentenceAudio: fullSent,
          options: pickMeaningOptions(v.vietnameseMeaning),
          correctAnswer: v.vietnameseMeaning,
          explanation: `"${v.word}" (${v.ipa}) nghĩa là "${v.vietnameseMeaning}". Ví dụ: "${fullSent}"`,
        });
      } else if (mod === 1) {
        // Dạng 2: Điền từ vào câu đúng nghĩa
        questions.push({
          id: `q-sfill-${idx + 1}`,
          skillType: "sentence_fill",
          skillLabel: "Điền Từ Trong Câu Đúng Nghĩa",
          promptTitle: blanked,
          subHint: `Nghĩa ngữ cảnh: ${v.vietnameseMeaning} (${v.partOfSpeech}) — ${v.quoteTranslation || ""
            }`,
          ipaHint: v.ipa,
          audioTextToSpeak: fullSent,
          fullSentenceAudio: fullSent,
          options: pickWordOptions(v.word),
          correctAnswer: v.word,
          explanation: `Từ phù hợp nhất với ngữ cảnh câu là "${v.word}" (${v.ipa}: ${v.vietnameseMeaning}). Câu đầy đủ: "${fullSent}"`,
        });
      } else if (mod === 2) {
        // Dạng 3: Nghe giọng đọc chuẩn & chọn/điền từ
        questions.push({
          id: `q-listen-${idx + 1}`,
          skillType: "listening",
          skillLabel: "Nghe Giọng Chuẩn & Chọn Từ",
          promptTitle: `Nghe phát âm chuẩn và chọn từ xuất hiện ở chỗ trống: "${blanked}"`,
          subHint: `Gợi ý nghĩa: ${v.vietnameseMeaning}`,
          ipaHint: v.ipa,
          audioTextToSpeak: fullSent,
          fullSentenceAudio: fullSent,
          options: pickWordOptions(v.word),
          correctAnswer: v.word,
          explanation: `Từ bạn vừa nghe là "${v.word}" (${v.ipa}: ${v.vietnameseMeaning}).`,
        });
      } else {
        // Dạng 4: Tự gõ từ vựng theo nghĩa + đồng nghĩa/trái nghĩa
        questions.push({
          id: `q-wfill-${idx + 1}`,
          skillType: "word_fill",
          skillLabel: "Tự Điền Từ Vựng",
          promptTitle: `Nhập từ/cụm từ (${selectedLanguage}) có nghĩa: "${v.vietnameseMeaning}"`,
          subHint: `Từ loại: ${v.partOfSpeech} • Gợi ý chữ đầu: "${v.word[0]}..." (${v.word.length} ký tự)`,
          ipaHint: v.ipa,
          synonymHint: (v.synonyms || []).slice(0, 2).join(", "),
          antonymHint: (v.antonyms || []).slice(0, 2).join(", "),
          audioTextToSpeak: v.word,
          fullSentenceAudio: fullSent,
          correctAnswer: v.word,
          explanation: `Đáp án đúng: "${v.word}" (${v.ipa}). Ví dụ: "${fullSent}"`,
        });
      }
    });

    return questions;
  }, [activeDeck, scopedItems, selectedLessonBatch, aiPracticeCache, selectedLanguage]);

  // Per-question countdown timer effect:
  // Mỗi câu có thời gian đếm ngược riêng (VD: 15s / 20s / 30s).
  // Khi câu hiện tại đã chốt đáp án hoặc hết giờ thì dừng đếm ở câu đó.
  const activeQuestionForTimer =
    unifiedTestQuestions[
    Math.min(currentTestIndex, Math.max(0, unifiedTestQuestions.length - 1))
    ];
  const isActiveQuestionLocked = Boolean(
    activeQuestionForTimer &&
    (testCheckedMap[activeQuestionForTimer.id] || isTestSubmitted)
  );

  // Reset đồng hồ về thời gian mỗi câu khi chuyển sang câu hỏi chưa làm
  useEffect(() => {
    if (!isTestRunning || isTestSubmitted || !activeQuestionForTimer) return;
    if (!testCheckedMap[activeQuestionForTimer.id]) {
      setTestTimeLeft(testDurationSeconds);
    }
  }, [
    currentTestIndex,
    isTestRunning,
    isTestSubmitted,
    activeQuestionForTimer,
    testCheckedMap,
    testDurationSeconds,
  ]);

  useEffect(() => {
    if (
      !isTestRunning ||
      isTestSubmitted ||
      testDurationSeconds <= 0 ||
      isActiveQuestionLocked ||
      !activeQuestionForTimer
    ) {
      return;
    }
    const qId = activeQuestionForTimer.id;
    const timer = setInterval(() => {
      setTestTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setTestCheckedMap((m) => ({ ...m, [qId]: true }));
          setTestTimedOutMap((m) => ({ ...m, [qId]: true }));
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [
    isTestRunning,
    isTestSubmitted,
    testDurationSeconds,
    isActiveQuestionLocked,
    activeQuestionForTimer,
  ]);

  // Start / Restart Unified Timed Test (KHÔNG tự động phát âm thanh khi bắt đầu)
  const handleStartUnifiedTest = (customDuration?: number) => {
    stopAllSpeech();
    const dur = customDuration ?? testDurationSeconds;
    setTestTimeLeft(dur);
    setCurrentTestIndex(0);
    setTestUserAnswers({});
    setTestCheckedMap({});
    setTestTimedOutMap({});
    setTestAudioPlayCountMap({});
    setIsTestSubmitted(false);
    setIsTestRunning(true);
  };

  // Tự động nộp bài & tổng kết ngay khi TẤT CẢ các câu hỏi đã được trả lời hoặc hết giờ
  useEffect(() => {
    if (!isTestRunning || isTestSubmitted || unifiedTestQuestions.length === 0) {
      return;
    }
    const allCompleted = unifiedTestQuestions.every((q) =>
      Boolean(testCheckedMap[q.id])
    );
    if (allCompleted) {
      stopAllSpeech();
      setIsTestRunning(false);
      setIsTestSubmitted(true);
      let correctCount = 0;
      for (const q of unifiedTestQuestions) {
        const uAns = (testUserAnswers[q.id] || "").trim().toLowerCase();
        if (uAns && uAns === q.correctAnswer.trim().toLowerCase()) {
          correctCount++;
        }
      }
      const pct = Math.round(
        (correctCount / unifiedTestQuestions.length) * 100
      );
      void recordLearningActivity({
        type: "exam_completed",
        title: `Hoàn thành Test Chủ đề: ${activeDeck?.title || "Từ vựng"}`,
        details: `Đạt ${correctCount}/${unifiedTestQuestions.length} câu (${pct}%)`,
      });
    }
  }, [
    isTestRunning,
    isTestSubmitted,
    unifiedTestQuestions,
    testCheckedMap,
    testUserAnswers,
    activeDeck?.title,
  ]);

  // Reset test when changing topic or lesson batch
  useEffect(() => {
    stopAllSpeech();
    setIsTestRunning(false);
    setIsTestSubmitted(false);
    setCurrentTestIndex(0);
    setTestUserAnswers({});
    setTestCheckedMap({});
    setTestTimedOutMap({});
    setTestAudioPlayCountMap({});
    setTestTimeLeft(testDurationSeconds);
  }, [activeDeck?.id, selectedLessonBatch, testDurationSeconds]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);
    const text = await file.text();
    const parsed = parseUploadedVocabFileContent(file.name, text);
    if (!importTopicTitle) {
      setImportTopicTitle(parsed.detectedTitle);
    }
    setImportRawText(parsed.rawPreview);
    setParsedPreviewItems(parsed.items);
    showToast({
      type: "success",
      title: `Đã đọc file "${file.name}"`,
      message:
        parsed.items.length > 0
          ? `Nhận diện được ${parsed.items.length} mục từ vựng. Bạn có thể Lưu ngay hoặc bấm "AI Đọc & Biên Soạn Chuyên Sâu"!`
          : "Đã nạp nội dung văn bản. Hãy bấm nút AI Đọc & Biên Soạn để trích xuất từ vựng chủ đề!",
    });
  };

  const handleDirectSaveImportedDeck = async () => {
    if (parsedPreviewItems.length === 0) {
      showToast({
        type: "error",
        title: "Chưa có danh sách từ có cấu trúc",
        message:
          "Văn bản này là dạng tự do. Hãy bấm nút 'AI Đọc File & Tạo Từ Vựng Chủ Đề' để AI trích xuất!",
      });
      return;
    }

    const deckId = `custom-${Date.now()}`;
    const finalItems: VocabularyItem[] = parsedPreviewItems.map((it, idx) => ({
      id: `citem-${idx + 1}`,
      word: String(it.word || "").trim(),
      ipa: String(it.ipa || "/.../").trim(),
      partOfSpeech: String(it.partOfSpeech || "Từ vựng").trim(),
      cefrLevel: (it.cefrLevel as VocabularyItem["cefrLevel"]) || "B2",
      vietnameseMeaning: String(it.vietnameseMeaning || "").trim(),
      explanationInContext: String(
        it.explanationInContext || `Từ vựng chủ đề ${importTopicTitle}`
      ).trim(),
      quoteFromBook: String(
        it.quoteFromBook || `Example with ${it.word}.`
      ).trim(),
      quoteTranslation: String(it.quoteTranslation || "").trim(),
      collocations: it.collocations || [],
      synonyms: it.synonyms || [],
      antonyms: it.antonyms || [],
      topicTag: importTopicTitle || "Chủ đề tải lên",
    }));

    const newDeck: TopicVocabDeck = {
      id: deckId,
      language: selectedLanguage,
      title: importTopicTitle.trim() || uploadedFileName || "Chủ đề Từ vựng Mới",
      category: `Chủ đề ${selectedLanguage} Tải lên & AI`,
      description: `Nhập từ file ${uploadedFileName || "văn bản"} gồm ${finalItems.length
        } từ vựng (${selectedLanguage}).`,
      level: "B1 - C1",
      sourceType: "imported_file",
      items: finalItems,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const nextDecks = [newDeck, ...customDecks];
    saveCustomDecksToStorage(nextDecks);
    setActiveSourceGroup("custom_imported");
    setSelectedTopicSlug(newDeck.id);
    setSelectedLessonBatch(0);
    setActiveTab("vocab_cards");

    showToast({
      type: "success",
      title: "Đã nạp bộ từ vựng chủ đề thành công!",
      message: `${newDeck.title} (${finalItems.length} từ vựng)`,
    });
  };

  const handleAiAnalyzeAndCreateTopic = async () => {
    if (
      !importRawText.trim() &&
      parsedPreviewItems.length === 0 &&
      !importTopicTitle.trim()
    ) {
      showToast({
        type: "error",
        title: "Thiếu dữ liệu đầu vào",
        message:
          "Vui lòng chọn file từ vựng hoặc nhập tên chủ đề / dán nội dung văn bản!",
      });
      return;
    }

    setIsAiAnalyzingFile(true);
    try {
      const settings = getAppSettings();
      const res = await fetchAiAgent("/api/agent/topic-vocab", {
        action: "analyze_and_enrich",
        topicTitle:
          importTopicTitle.trim() || uploadedFileName || "Chủ đề Từ vựng",
        targetLanguage: selectedLanguage,
        rawInputText: importRawText,
        existingItems: parsedPreviewItems.slice(0, aiTargetCount),
        targetCount: aiTargetCount,
        withPractice: true,
        apiKey: settings.geminiApiKey,
        model: settings.geminiModel,
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(
          data.error || "Không thể phân tích từ vựng chủ đề bằng AI."
        );
      }

      const deckId = `ai-topic-${Date.now()}`;
      const newDeck: TopicVocabDeck = {
        id: deckId,
        language: selectedLanguage,
        title: data.topicTitle || importTopicTitle || "Chủ đề AI",
        category: `Chủ đề ${selectedLanguage} AI Biên Soạn`,
        description:
          data.topicSummary ||
          `Bộ từ vựng do AI đọc file và biên soạn đầy đủ phiên âm, đồng nghĩa, trái nghĩa & câu hỏi ôn tập.`,
        level: "B1 - C1",
        sourceType: "ai_generated",
        items: data.vocabulary || [],
        aiPractice: data.practice || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const nextDecks = [newDeck, ...customDecks];
      saveCustomDecksToStorage(nextDecks);
      if (data.practice) {
        setAiPracticeCache((prev) => ({
          ...prev,
          [`${deckId}_batch_0`]: data.practice,
        }));
      }

      await recordLearningActivity({
        type: "lesson_generated",
        title: `AI tạo chủ đề từ vựng: ${newDeck.title}`,
        details: `Đã biên soạn ${newDeck.items.length} từ vựng kèm IPA, đồng nghĩa, trái nghĩa và bài tập ôn luyện.`,
      });

      setActiveSourceGroup("custom_imported");
      setSelectedTopicSlug(deckId);
      setSelectedLessonBatch(0);
      setActiveTab("vocab_cards");
    } catch (err: unknown) {
      showToast({
        type: "error",
        title: "Lỗi AI phân tích chủ đề",
        message:
          err instanceof Error
            ? err.message
            : "Vui lòng kiểm tra kết nối hoặc AI Credit.",
      });
    } finally {
      setIsAiAnalyzingFile(false);
    }
  };

  const handleAiEnrichCurrentBatch = async () => {
    if (!activeDeck || scopedItems.length === 0) return;
    setIsAiEnrichingCurrentTopic(true);
    try {
      const settings = getAppSettings();
      const targetBatch = scopedItems.slice(0, 20);
      const res = await fetchAiAgent("/api/agent/topic-vocab", {
        action: "analyze_and_enrich",
        topicTitle: `${activeDeck.title}${selectedLessonBatch > 0 ? ` - Bài ${selectedLessonBatch}` : ""
          }`,
        targetLanguage: selectedLanguage,
        rawInputText: targetBatch
          .map(
            (it) =>
              `${it.word} (${it.ipa}) [${it.partOfSpeech}]: ${it.vietnameseMeaning} | ${it.quoteFromBook}`
          )
          .join("\n"),
        existingItems: targetBatch,
        targetCount: targetBatch.length,
        withPractice: true,
        apiKey: settings.geminiApiKey,
        model: settings.geminiModel,
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Không thể làm giàu từ vựng bằng AI.");
      }

      const enrichedList: VocabularyItem[] = data.vocabulary || [];
      const enrichedMap = new Map(
        enrichedList.map((v) => [v.word.toLowerCase().trim(), v])
      );

      const updatedItems = activeDeck.items.map((orig) => {
        const match = enrichedMap.get(orig.word.toLowerCase().trim());
        if (!match) return orig;
        return {
          ...orig,
          ipa: match.ipa || orig.ipa,
          partOfSpeech: match.partOfSpeech || orig.partOfSpeech,
          cefrLevel: match.cefrLevel || orig.cefrLevel,
          vietnameseMeaning: match.vietnameseMeaning || orig.vietnameseMeaning,
          explanationInContext:
            match.explanationInContext || orig.explanationInContext,
          quoteFromBook: match.quoteFromBook || orig.quoteFromBook,
          quoteTranslation: match.quoteTranslation || orig.quoteTranslation,
          collocations:
            match.collocations && match.collocations.length > 0
              ? match.collocations
              : orig.collocations,
          synonyms:
            match.synonyms && match.synonyms.length > 0
              ? match.synonyms
              : orig.synonyms,
          antonyms:
            match.antonyms && match.antonyms.length > 0
              ? match.antonyms
              : orig.antonyms,
        };
      });

      const updatedDeck: TopicVocabDeck = {
        ...activeDeck,
        items: updatedItems,
        aiPractice: data.practice || activeDeck.aiPractice,
        updatedAt: new Date().toISOString(),
      };

      const filteredCustom = customDecks.filter(
        (d) => d.id !== updatedDeck.id && d.slug !== updatedDeck.slug
      );
      saveCustomDecksToStorage([updatedDeck, ...filteredCustom]);

      if (data.practice) {
        const cacheKey = `${activeDeck.id}_batch_${selectedLessonBatch}`;
        setAiPracticeCache((prev) => ({
          ...prev,
          [cacheKey]: data.practice,
        }));
      }
    } catch (err: unknown) {
      showToast({
        type: "error",
        title: "Không thể gọi AI biên soạn",
        message: err instanceof Error ? err.message : "Vui lòng thử lại.",
      });
    } finally {
      setIsAiEnrichingCurrentTopic(false);
    }
  };

  // AI Tạo Đề Test Ngữ Cảnh Mới và Bắt Đầu Làm Bài Ngay
  const handleAiGenerateFreshPractice = async () => {
    if (!activeDeck || scopedItems.length === 0) return;
    setIsGeneratingAiPractice(true);
    try {
      const settings = getAppSettings();
      const res = await fetchAiAgent("/api/agent/topic-vocab", {
        action: "generate_practice",
        topicTitle: `${activeDeck.title}${selectedLessonBatch > 0 ? ` (Bài ${selectedLessonBatch})` : ""
          }`,
        targetLanguage: selectedLanguage,
        vocabulary: scopedItems.slice(0, 25),
        apiKey: settings.geminiApiKey,
        model: settings.geminiModel,
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Lỗi khi AI tạo bộ câu hỏi ôn tập.");
      }

      if (data.practice) {
        stopAllSpeech();
        const cacheKey = `${activeDeck.id}_batch_${selectedLessonBatch}`;
        setAiPracticeCache((prev) => ({
          ...prev,
          [cacheKey]: data.practice,
        }));
        setTestTimeLeft(testDurationSeconds);
        setCurrentTestIndex(0);
        setTestUserAnswers({});
        setTestCheckedMap({});
        setTestTimedOutMap({});
        setTestAudioPlayCountMap({});
        setIsTestSubmitted(false);
        setIsTestRunning(true);
      }
    } catch (err: unknown) {
      showToast({
        type: "error",
        title: "Lỗi tạo bài tập AI",
        message: err instanceof Error ? err.message : "Vui lòng thử lại.",
      });
    } finally {
      setIsGeneratingAiPractice(false);
    }
  };

  const handleSaveTopicToBookshelf = async () => {
    if (!activeDeck) return;
    await runWithFeedback(
      {
        variant: "sync",
        loadingTitle: `Đang lưu chủ đề "${activeDeck.title}" vào Tủ sách & Kho SRS...`,
        loadingSubtitle:
          "Đang chia bài học (20 từ/chương) và đồng bộ thẻ nhớ Flashcard",
        successTitle: "Đã thêm vào Tủ sách cá nhân & Ôn tập SRS!",
        successMessage: `${activeDeck.title} (${activeDeck.items.length} từ vựng)`,
      },
      async () => {
        const courseId = `course-topic-${activeDeck.slug || activeDeck.id}`;
        const chunkSize = 20;
        const totalChunks = Math.ceil(activeDeck.items.length / chunkSize);
        const chapters: ChapterUnit[] = [];

        for (let i = 0; i < totalChunks; i++) {
          const slice = activeDeck.items.slice(
            i * chunkSize,
            (i + 1) * chunkSize
          );
          const chId = `${courseId}-ch-${i + 1}`;
          chapters.push({
            id: chId,
            courseId,
            index: i + 1,
            title: `Bài ${String(i + 1).padStart(2, "0")}: ${slice[0]?.word || ""
              } → ${slice[slice.length - 1]?.word || ""}`,
            summary: `Bộ ${slice.length} từ vựng chủ đề ${activeDeck.title
              } (Bài ${i + 1}/${totalChunks})`,
            rawText: slice
              .map(
                (v) =>
                  `${v.word} (${v.ipa}) [${v.partOfSpeech}]: ${v.vietnameseMeaning}. Ví dụ: ${v.quoteFromBook}`
              )
              .join("\n"),
            isGenerated: true,
            lesson: {
              chapterTitle: `${activeDeck.title} - Bài ${i + 1}`,
              overview: {
                summary: activeDeck.description,
                keyThemes: [activeDeck.title, activeDeck.category],
                learningObjectives: [
                  `Nắm vững ${slice.length} từ vựng, phát âm IPA, đồng nghĩa & trái nghĩa`,
                ],
              },
              contentAnalysis: [],
              grammarPoints: [],
              vocabulary: slice,
              clozeExercises: [],
              quizExercises: [],
              translationExercises: [],
              generatedAt: new Date().toISOString(),
            },
            completedClozeIds: [],
            completedQuizIds: [],
            completedTranslationIds: [],
          });
        }

        const newCourse: Course = {
          id: courseId,
          title: `[Từ vựng Chủ đề] ${activeDeck.title}`,
          author: "ForumFlash & BookMind AI",
          description: activeDeck.description,
          targetLanguage: activeDeck.language || selectedLanguage,
          level: activeDeck.level || "B1 - C1",
          coverGradient: "from-amber-500 via-orange-600 to-rose-600",
          chapters,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await saveCourse(newCourse);
        await refreshData();
      }
    );
  };

  const totalLessonBatches = activeDeck
    ? Math.ceil(activeDeck.items.length / 20)
    : 0;

  // Format mm:ss timer
  const formatTimeMmSs = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // Calculate unified test score
  const testStats = useMemo(() => {
    let correct = 0;
    let answered = 0;
    for (const q of unifiedTestQuestions) {
      const userAns = (testUserAnswers[q.id] || "").trim().toLowerCase();
      if (userAns) {
        answered++;
        if (userAns === q.correctAnswer.trim().toLowerCase()) {
          correct++;
        }
      }
    }
    return {
      total: unifiedTestQuestions.length,
      answered,
      correct,
      scorePercent:
        unifiedTestQuestions.length > 0
          ? Math.round((correct / unifiedTestQuestions.length) * 100)
          : 0,
    };
  }, [unifiedTestQuestions, testUserAnswers]);

  const currentQuestion =
    unifiedTestQuestions[
    Math.min(currentTestIndex, Math.max(0, unifiedTestQuestions.length - 1))
    ];

  return (
    <div className="bm-view-enter mx-auto w-full max-w-6xl flex-1 px-3.5 py-5 sm:px-6 sm:py-6 space-y-5">
      {/* Unified 2-Mode Switcher at the very top: 1. Theo Sách/Chương vs 2. Theo Chủ đề Từ vựng */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-3.5 shadow-[4px_4px_0_0_#F5EFE6]">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1">
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new CustomEvent("bookmind:route-start"));
              router.push(ROUTES.srs);
            }}
            className="flex items-center justify-center gap-2 rounded-xl border-2 border-[#3A3832] bg-[#141413] px-4 py-2.5 text-xs sm:text-sm font-extrabold text-[#F5EFE6] hover:border-[#F5EFE6] transition-colors cursor-pointer"
          >
            <BookOpen className="h-4 w-4 text-[#B8D8F8] shrink-0" />
            <span>← 1. Ôn &amp; Thi Theo Sách / Giáo Trình</span>
          </button>

          <button
            type="button"
            className="flex items-center justify-center gap-2 rounded-xl border-2 border-[#F5EFE6] bg-[#F3C969] px-4 py-2.5 text-xs sm:text-sm font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] cursor-pointer"
          >
            <Sparkles className="h-4 w-4 shrink-0" />
            <span>2. Học &amp; Thi Từ Vựng Chủ Đề (Đa Ngôn Ngữ • 5.000+ Từ)</span>
          </button>
        </div>

        {/* Giọng đọc chuẩn thu gọn trên cùng một thanh */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border-2 border-[#3A3832] bg-[#141413] px-3 py-1.5 shrink-0">
          <Volume2 className="h-3.5 w-3.5 text-[#B8D8F8] shrink-0" />

          {selectedLanguage === "English" && (
            <div className="inline-flex rounded-lg border border-[#3A3832] bg-[#1D1C19] p-0.5">
              <button
                type="button"
                onClick={() => {
                  setVoiceAccent("en-US");
                  setTtsVoiceConfig({ accent: "en-US" });
                  speakSmart("American English", undefined, "en-US");
                }}
                className={`rounded-md px-2 py-0.5 text-[11px] font-extrabold cursor-pointer ${voiceAccent === "en-US"
                    ? "bg-[#B8D8F8] text-[#141413]"
                    : "text-[#B8B2A6] hover:text-[#F5EFE6]"
                  }`}
              >
                🇺🇸 US
              </button>
              <button
                type="button"
                onClick={() => {
                  setVoiceAccent("en-GB");
                  setTtsVoiceConfig({ accent: "en-GB" });
                  speakSmart("British English", undefined, "en-GB");
                }}
                className={`rounded-md px-2 py-0.5 text-[11px] font-extrabold cursor-pointer ${voiceAccent === "en-GB"
                    ? "bg-[#B8D8F8] text-[#141413]"
                    : "text-[#B8B2A6] hover:text-[#F5EFE6]"
                  }`}
              >
                🇬🇧 UK
              </button>
            </div>
          )}

          {selectedLanguage === "Chinese" && (
            <div className="inline-flex rounded-lg border border-[#3A3832] bg-[#1D1C19] p-0.5">
              <button
                type="button"
                onClick={() => {
                  setChineseAccent("zh-CN");
                  setTtsVoiceConfig({ chineseAccent: "zh-CN" });
                  speakSmart("普通话", undefined, "zh-CN");
                }}
                className={`rounded-md px-2 py-0.5 text-[11px] font-extrabold cursor-pointer ${chineseAccent === "zh-CN"
                    ? "bg-[#B8D8F8] text-[#141413]"
                    : "text-[#B8B2A6] hover:text-[#F5EFE6]"
                  }`}
              >
                🇨🇳 Đại lục
              </button>
              <button
                type="button"
                onClick={() => {
                  setChineseAccent("zh-TW");
                  setTtsVoiceConfig({ chineseAccent: "zh-TW" });
                  speakSmart("國語", undefined, "zh-TW");
                }}
                className={`rounded-md px-2 py-0.5 text-[11px] font-extrabold cursor-pointer ${chineseAccent === "zh-TW"
                    ? "bg-[#B8D8F8] text-[#141413]"
                    : "text-[#B8B2A6] hover:text-[#F5EFE6]"
                  }`}
              >
                🇹🇼 Đài Loan
              </button>
            </div>
          )}

          {selectedLanguage === "Japanese" && (
            <span className="text-[11px] font-extrabold text-[#B8D8F8]">
              🇯🇵 ja-JP
            </span>
          )}

          {selectedLanguage === "Korean" && (
            <span className="text-[11px] font-extrabold text-[#B8D8F8]">
              🇰🇷 ko-KR
            </span>
          )}
        </div>
      </div>

      {/* Step-by-Step Selector: 1. Chọn Ngôn ngữ -> 2. Chọn Chủ đề -> 3. Chọn Bài học */}
      <div className="grid grid-cols-1 gap-4 rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-4 sm:p-5 shadow-[4px_4px_0_0_#F5EFE6] lg:grid-cols-12 lg:items-end">
        {/* 1. CHỌN NGÔN NGỮ HỌC */}
        <div className="lg:col-span-3 space-y-1.5 min-w-0">
          <label className="block text-xs font-extrabold uppercase tracking-wider text-[#F3C969]">
            1. Chọn Ngôn Ngữ Học
          </label>
          <CustomSelect
            value={selectedLanguage}
            onChange={(val) => {
              const nextLang = val as SupportedStudyLanguage;
              setSelectedLanguage(nextLang);
              if (nextLang === "English") {
                setActiveSourceGroup("thematic_25");
                setSelectedTopicSlug(presetTopics[0]?.slug || "education");
                setSelectedLessonBatch(1);
              } else {
                const firstPreset = PRESET_MULTILANG_DECKS.find(
                  (d) => d.language === nextLang
                );
                const firstCustom = customDecks.find(
                  (d) => d.language === nextLang
                );
                setSelectedTopicSlug(
                  firstCustom?.id || firstPreset?.slug || ""
                );
                setSelectedLessonBatch(0);
              }
            }}
            accentColor="amber"
            icon={<Globe className="h-3.5 w-3.5" />}
            options={[
              {
                value: "English",
                label: "🇬🇧 Tiếng Anh (English)",
                subLabel: "25 Chủ đề (5.000 từ) + CEFR A1-C2",
                badge: "9.922+ từ",
              },
              {
                value: "Chinese",
                label: "🇨🇳 Tiếng Trung (中文 / HSK / TOCFL)",
                subLabel: "Chữ Hán + Pinyin + Đồng/Trái nghĩa",
                badge: "Đa chủ đề",
              },
              {
                value: "Japanese",
                label: "🇯🇵 Tiếng Nhật (日本語 / JLPT)",
                subLabel: "Kanji + Furigana + Đồng/Trái nghĩa",
                badge: "JLPT",
              },
              {
                value: "Korean",
                label: "🇰🇷 Tiếng Hàn (한국어 / TOPIK)",
                subLabel: "Hangul + Phiên âm + Đồng/Trái nghĩa",
                badge: "TOPIK",
              },
            ]}
          />
        </div>

        {/* 2. CHỌN CHỦ ĐỀ THEO NGÔN NGỮ ĐÃ CHỌN (Gộp tất cả vào 1 dropdown duy nhất không tách nút con) */}
        <div className="lg:col-span-6 space-y-1.5 min-w-0">
          <label className="block text-xs font-extrabold uppercase tracking-wider text-[#A7D7A9]">
            2. Chọn Chủ Đề Từ Vựng ({selectedLanguage})
          </label>

          {selectedLanguage !== "English" ? (
            <CustomSelect
              value={activeDeck?.slug || activeDeck?.id || ""}
              onChange={(val) => {
                setSelectedTopicSlug(val);
                setSelectedLessonBatch(0);
              }}
              accentColor="emerald"
              icon={<Layers className="h-3.5 w-3.5" />}
              options={[...languageCustomDecks, ...languagePresetDecks].map(
                (d) => ({
                  value: d.slug || d.id,
                  label: d.title,
                  subLabel: `${d.items.length} từ vựng • ${d.category}`,
                  badge: `${d.items.length} từ`,
                })
              )}
            />
          ) : (
            <CustomSelect
              value={activeDeck?.slug || activeDeck?.id || selectedTopicSlug}
              onChange={(val) => {
                if (languageCustomDecks.some((d) => d.id === val)) {
                  setActiveSourceGroup("custom_imported");
                  setSelectedTopicSlug(val);
                  setSelectedLessonBatch(0);
                } else if (presetCefr.some((t) => t.slug === val)) {
                  setActiveSourceGroup("cefr_6");
                  setSelectedTopicSlug(val);
                  setSelectedLessonBatch(1);
                } else {
                  setActiveSourceGroup("thematic_25");
                  setSelectedTopicSlug(val);
                  setSelectedLessonBatch(1);
                }
              }}
              accentColor="indigo"
              icon={<Layers className="h-3.5 w-3.5" />}
              options={[
                ...languageCustomDecks.map((d) => ({
                  value: d.id,
                  label: `★ [File/AI] ${d.title}`,
                  subLabel: `${d.items.length} từ vựng • ${d.category}`,
                  badge: `${d.items.length} từ`,
                })),
                ...presetTopics.map((t, i) => ({
                  value: t.slug,
                  label: `${String(i + 1).padStart(2, "0")}. ${t.title}`,
                  subLabel: `Chủ đề Học thuật • ${t.total_cards} từ vựng`,
                  badge: `${t.total_cards} từ`,
                })),
                ...presetCefr.map((t) => ({
                  value: t.slug,
                  label: `[CEFR] ${t.title}`,
                  subLabel: `Từ vựng phân bậc Oxford • ${t.total_cards} từ`,
                  badge: `${t.total_cards} từ`,
                })),
              ]}
            />
          )}
        </div>

        {/* 3. CHỌN BÀI HỌC (20 TỪ / BÀI) */}
        <div className="lg:col-span-3 space-y-1.5 min-w-0">
          <label className="block text-xs font-extrabold uppercase tracking-wider text-[#C8B6FF]">
            3. Chọn Bài Học (20 từ/bài)
          </label>
          <CustomSelect
            value={String(selectedLessonBatch)}
            onChange={(val) => setSelectedLessonBatch(Number(val))}
            accentColor="indigo"
            icon={<GraduationCap className="h-3.5 w-3.5" />}
            options={[
              {
                value: "0",
                label: `Toàn bộ (${activeDeck?.items.length || 0} từ)`,
                badge: "Tất cả",
              },
              ...Array.from({ length: totalLessonBatches }, (_, i) => {
                const start = i * 20 + 1;
                const end = Math.min(
                  (i + 1) * 20,
                  activeDeck?.items.length || 0
                );
                return {
                  value: String(i + 1),
                  label: `Bài ${String(i + 1).padStart(2, "0")} (Từ ${start}–${end})`,
                  badge: `${end - start + 1} từ`,
                };
              }),
            ]}
          />
        </div>
      </div>

      {/* Main Functional Tabs */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <button
          type="button"
          onClick={() => setActiveTab("vocab_cards")}
          className={`flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 px-3.5 py-2.5 text-xs sm:text-sm font-extrabold transition-transform active:translate-x-[2px] active:translate-y-[2px] cursor-pointer ${activeTab === "vocab_cards"
              ? "border-[#F5EFE6] bg-[#F3C969] text-[#141413] shadow-[4px_4px_0_0_#F5EFE6]"
              : "border-[#3A3832] bg-[#1D1C19] text-[#F5EFE6] hover:border-[#F5EFE6]"
            }`}
        >
          <BookOpen className="h-4 w-4 shrink-0" />
          <span>1. Từ Vựng &amp; Đồng/Trái Nghĩa ({scopedItems.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("flashcards")}
          className={`flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 px-3.5 py-2.5 text-xs sm:text-sm font-extrabold transition-transform active:translate-x-[2px] active:translate-y-[2px] cursor-pointer ${activeTab === "flashcards"
              ? "border-[#F5EFE6] bg-[#C8B6FF] text-[#141413] shadow-[4px_4px_0_0_#F5EFE6]"
              : "border-[#3A3832] bg-[#1D1C19] text-[#F5EFE6] hover:border-[#F5EFE6]"
            }`}
        >
          <GraduationCap className="h-4 w-4 shrink-0" />
          <span>2. Flashcard Chủ Đề ({topicFlashcards.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("ai_practice")}
          className={`flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 px-3.5 py-2.5 text-xs sm:text-sm font-extrabold transition-transform active:translate-x-[2px] active:translate-y-[2px] cursor-pointer ${activeTab === "ai_practice"
              ? "border-[#F5EFE6] bg-[#B8D8F8] text-[#141413] shadow-[4px_4px_0_0_#F5EFE6]"
              : "border-[#3A3832] bg-[#1D1C19] text-[#F5EFE6] hover:border-[#F5EFE6]"
            }`}
        >
          <Timer className="h-4 w-4 shrink-0" />
          <span>3. Bài Test Tổng Hợp (Có Bấm Giờ)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("import_ai")}
          className={`flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 px-3.5 py-2.5 text-xs sm:text-sm font-extrabold transition-transform active:translate-x-[2px] active:translate-y-[2px] cursor-pointer ${activeTab === "import_ai"
              ? "border-[#F5EFE6] bg-[#A7D7A9] text-[#141413] shadow-[4px_4px_0_0_#F5EFE6]"
              : "border-[#3A3832] bg-[#1D1C19] text-[#F5EFE6] hover:border-[#F5EFE6]"
            }`}
        >
          <Wand2 className="h-4 w-4 shrink-0" />
          <span>4. Nạp File Từ Vựng AI</span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: DETAILED TOPIC VOCABULARY CARDS                                */}
      {/* ===================================================================== */}
      {activeTab === "vocab_cards" && (
        <div
          key={`tab-vocab-${selectedLanguage}-${activeDeck?.id}-${selectedLessonBatch}`}
          className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-4 shadow-[4px_4px_0_0_#F5EFE6]">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#B8B2A6]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm từ vựng, phiên âm IPA, nghĩa tiếng Việt, từ đồng nghĩa hoặc trái nghĩa..."
                className="w-full rounded-xl border-2 border-[#F5EFE6] bg-[#141413] pl-10 pr-4 py-2.5 text-xs sm:text-sm text-[#F5EFE6] placeholder-[#8F8A7E] focus:border-[#F3C969] focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={isAiEnrichingCurrentTopic || scopedItems.length === 0}
                onClick={handleAiEnrichCurrentBatch}
                className="flex items-center gap-1.5 rounded-xl border-2 border-[#F5EFE6] bg-[#C8B6FF] px-4 py-2.5 text-xs font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-50 cursor-pointer"
              >
                {isAiEnrichingCurrentTopic ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>AI đang biên soạn Đồng/Trái nghĩa...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4" />
                    <span>
                      AI Bổ Sung Đồng Nghĩa / Trái Nghĩa Sâu (20 từ bài này)
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>

          {isLoadingPresets ? (
            <div className="rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-12 text-center text-sm font-bold text-[#B8B2A6]">
              Đang tải kho 5.000 từ vựng chủ đề...
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {scopedItems.map((voc, idx) => (
                <div
                  key={voc.id}
                  className="rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-5 space-y-3.5 shadow-[4px_4px_0_0_#F5EFE6]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-lg border-2 border-[#3A3832] bg-[#141413] px-2 py-0.5 text-[11px] font-extrabold text-[#F3C969]">
                          #{idx + 1}
                        </span>
                        <h3 className="text-lg font-extrabold text-[#F5EFE6] break-words">
                          {voc.word}
                        </h3>
                        <AudioSpeakButton
                          text={voc.word}
                          showLabel={false}
                          className="rounded-lg border-2 border-[#F5EFE6] bg-[#B8D8F8] p-1.5 text-[#141413]"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setPronounceTarget({
                              word: voc.word,
                              ipa: voc.ipa,
                              meaning: voc.vietnameseMeaning,
                              example: voc.quoteFromBook,
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-lg border-2 border-[#F5EFE6] bg-[#A7D7A9] px-2.5 py-1 text-[11px] font-extrabold text-[#141413] cursor-pointer"
                        >
                          <Mic className="h-3 w-3" />
                          <span>Luyện phát âm</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            window.dispatchEvent(
                              new CustomEvent("bookmind:ask-ai-tutor", {
                                detail: {
                                  question: `Phân tích sâu từ vựng "${voc.word}" (${voc.ipa} - ${voc.vietnameseMeaning}) trong chủ đề ${activeDeck?.title || "Từ vựng"}: cách dùng, collocations, từ đồng/trái nghĩa, từ dễ nhầm lẫn và ví dụ thực tế.`,
                                  excerpt: `${voc.word} (${voc.ipa}): ${voc.vietnameseMeaning}`,
                                  autoSend: true,
                                },
                              })
                            );
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border-2 border-[#F5EFE6] bg-[#C8B6FF] px-2.5 py-1 text-[11px] font-extrabold text-[#141413] cursor-pointer"
                          title="Hỏi Gia sư AI phân tích sâu từ vựng này"
                        >
                          <MessageSquare className="h-3 w-3" />
                          <span>Hỏi AI</span>
                        </button>
                      </div>
                      <p className="mt-1 font-mono text-xs sm:text-sm font-bold text-[#F3C969]">
                        {voc.ipa} •{" "}
                        <span className="text-[#C8B6FF]">{voc.partOfSpeech}</span>
                      </p>
                    </div>

                    <span className="shrink-0 rounded-full border-2 border-[#F5EFE6] bg-[#C8B6FF] px-2.5 py-0.5 text-xs font-extrabold text-[#141413]">
                      {voc.cefrLevel}
                    </span>
                  </div>

                  <div className="rounded-lg border-2 border-[#3A3832] bg-[#141413] px-3.5 py-2.5">
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#A7D7A9]">
                      Nghĩa tiếng Việt
                    </div>
                    <div className="mt-0.5 text-sm sm:text-base font-extrabold text-[#F5EFE6]">
                      {voc.vietnameseMeaning}
                    </div>
                    {voc.explanationInContext && (
                      <p className="mt-1 text-xs text-[#B8B2A6]">
                        {voc.explanationInContext}
                      </p>
                    )}
                  </div>

                  {voc.quoteFromBook && (
                    <div className="rounded-lg border-2 border-[#3A3832] bg-[#141413] p-3 text-xs space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="italic text-[#F5EFE6] flex-1">
                          &ldquo;{voc.quoteFromBook}&rdquo;
                        </p>
                        <AudioSpeakButton
                          text={voc.quoteFromBook}
                          showLabel={false}
                          className="shrink-0 rounded-lg border-2 border-[#F5EFE6] bg-[#B8D8F8] p-1 text-[#141413]"
                        />
                      </div>
                      {voc.quoteTranslation && (
                        <p className="text-[#B8B2A6]">→ {voc.quoteTranslation}</p>
                      )}
                    </div>
                  )}

                  <div className="space-y-2 pt-1">
                    {voc.collocations && voc.collocations.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-extrabold text-[#B8D8F8]">
                          Cụm từ / Cách dùng:
                        </span>
                        {voc.collocations.map((col, cIdx) => (
                          <span
                            key={cIdx}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#3A3832] bg-[#141413] px-2 py-0.5 text-[11px] font-semibold text-[#F5EFE6]"
                          >
                            <Link2 className="h-3 w-3 text-[#B8D8F8]" />
                            {col}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                      {voc.synonyms && voc.synonyms.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-extrabold text-[#A7D7A9]">
                            Đồng nghĩa:
                          </span>
                          {voc.synonyms.map((syn, sIdx) => (
                            <button
                              key={sIdx}
                              type="button"
                              onClick={() => speakSmart(syn)}
                              className="rounded-lg border border-[#A7D7A9]/50 bg-[#141413] px-2 py-0.5 text-[11px] font-bold text-[#A7D7A9] hover:bg-[#A7D7A9] hover:text-[#141413] transition-colors cursor-pointer"
                              title="Bấm để nghe phát âm từ đồng nghĩa"
                            >
                              ≈ {syn}
                            </button>
                          ))}
                        </div>
                      )}

                      {voc.antonyms && voc.antonyms.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-extrabold text-[#FF8A8A]">
                            Trái nghĩa:
                          </span>
                          {voc.antonyms.map((ant, aIdx) => (
                            <button
                              key={aIdx}
                              type="button"
                              onClick={() => speakSmart(ant)}
                              className="rounded-lg border border-[#FF8A8A]/50 bg-[#141413] px-2 py-0.5 text-[11px] font-bold text-[#FF8A8A] hover:bg-[#FF8A8A] hover:text-[#141413] transition-colors cursor-pointer"
                              title="Bấm để nghe phát âm từ trái nghĩa"
                            >
                              ≠ {ant}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: DEDICATED FLASHCARD ARENA FOR THIS TOPIC                       */}
      {/* ===================================================================== */}
      {activeTab === "flashcards" && (
        <div
          key={`tab-flashcards-${selectedLanguage}-${activeDeck?.id}-${selectedLessonBatch}`}
          className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-4 shadow-[4px_4px_0_0_#F5EFE6]">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-[#F5EFE6]">
                Thẻ Nhớ Flashcard Chuyên Biệt — Chủ đề: {activeDeck?.title}
              </h2>
              <p className="text-xs text-[#B8B2A6]">
                Lật thẻ 3D để xem nghĩa, phiên âm IPA, câu ví dụ, từ đồng nghĩa &amp; trái nghĩa.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab("ai_practice")}
              className="flex items-center gap-1.5 rounded-xl border-2 border-[#F5EFE6] bg-[#B8D8F8] px-4 py-2 text-xs font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] cursor-pointer"
            >
              <Timer className="h-4 w-4" />
              <span>Vào Làm Bài Test Tổng Hợp Bấm Giờ →</span>
            </button>
          </div>

          <FlashcardArena
            cards={topicFlashcards}
            onCardsUpdated={() => {
              void recordLearningActivity({
                type: "vocab_review",
                title: `Ôn Flashcard chủ đề: ${activeDeck?.title}`,
                details: `Đã ôn tập bộ thẻ chủ đề (${topicFlashcards.length} từ).`,
              });
            }}
          />
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: UNIFIED TIMED TEST ARENA (BẮT ĐẦU MỚI HIỆN CÂU HỎI + FOCUS)    */}
      {/* ===================================================================== */}
      {activeTab === "ai_practice" && (
        <div
          key={`tab-test-${selectedLanguage}-${activeDeck?.id}-${selectedLessonBatch}`}
          className="animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          {/* TRẠNG THÁI CHƯA BẮT ĐẦU: Màn hình chuẩn bị gọn gàng, bấm Bắt đầu mới mở khung Focus câu hỏi */}
          {!isTestRunning && !isTestSubmitted && (
            <div className="mx-auto max-w-2xl rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-6 sm:p-8 text-center space-y-6 shadow-[4px_4px_0_0_#F5EFE6]">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl border-2 border-[#F5EFE6] bg-[#F3C969] text-[#141413] shadow-[3px_3px_0_0_#F5EFE6]">
                <Timer className="h-7 w-7" />
              </div>

              <div className="space-y-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-[#F5EFE6] bg-[#C8B6FF] px-3 py-0.5 text-xs font-extrabold text-[#141413]">
                  {activeDeck?.title}{" "}
                  {selectedLessonBatch > 0
                    ? `• Bài ${String(selectedLessonBatch).padStart(2, "0")}`
                    : ""}
                </span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-[#F5EFE6]">
                  Bài Test Tổng Hợp Từ Vựng Chủ Đề ({unifiedTestQuestions.length} câu)
                </h2>
                <p className="text-xs sm:text-sm text-[#B8B2A6] max-w-lg mx-auto leading-relaxed">
                  Gói gọn tất cả kỹ năng trong 1 bài test duy nhất:{" "}
                  <strong className="text-[#F5EFE6]">
                    Ghép nghĩa, Điền từ vào câu đúng nghĩa, Nghe giọng chuẩn ({voiceAccent}) &amp; Tự gõ từ vựng
                  </strong>
                </p>
              </div>

              {/* Chọn thời gian cho MỖI CÂU HỎI */}
              <div className="space-y-2">
                <div className="text-xs font-extrabold uppercase tracking-wider text-[#F3C969]">
                  Thời gian suy nghĩ cho mỗi câu hỏi
                </div>
                <div className="inline-flex flex-wrap justify-center rounded-xl border-2 border-[#3A3832] bg-[#141413] p-1.5 gap-1.5">
                  {[
                    { label: "15 Giây / câu", sec: 15 },
                    { label: "20 Giây / câu", sec: 20 },
                    { label: "30 Giây / câu", sec: 30 },
                    { label: "Không giới hạn", sec: 0 },
                  ].map((opt) => (
                    <button
                      key={opt.sec}
                      type="button"
                      onClick={() => {
                        setTestDurationSeconds(opt.sec);
                        setTestTimeLeft(opt.sec);
                      }}
                      className={`rounded-lg px-3.5 py-2 text-xs sm:text-sm font-extrabold transition-colors cursor-pointer ${testDurationSeconds === opt.sec
                          ? "border-2 border-[#F5EFE6] bg-[#B8D8F8] text-[#141413] shadow-[2px_2px_0_0_#F5EFE6]"
                          : "text-[#B8B2A6] hover:text-[#F5EFE6]"
                        }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2 Nút Hành Động Chính ở dưới */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleStartUnifiedTest()}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border-2 border-[#F5EFE6] bg-[#A7D7A9] px-7 py-3.5 text-sm font-extrabold text-[#141413] shadow-[4px_4px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] cursor-pointer"
                >
                  <Play className="h-4 w-4 fill-current" />
                  <span>
                    Bắt Đầu Làm Bài Ngay (
                    {testDurationSeconds > 0
                      ? `${testDurationSeconds}s / câu`
                      : "Tự do"}
                    )
                  </span>
                </button>

                <button
                  type="button"
                  disabled={isGeneratingAiPractice}
                  onClick={handleAiGenerateFreshPractice}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border-2 border-[#F5EFE6] bg-[#F3C969] px-5 py-3.5 text-xs sm:text-sm font-extrabold text-[#141413] shadow-[4px_4px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-50 cursor-pointer"
                >
                  {isGeneratingAiPractice ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>AI đang tạo ngữ cảnh mới...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      <span>AI Tạo Đề Ngữ Cảnh Mới &amp; Làm Ngay</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* TRẠNG THÁI ĐANG LÀM BÀI HOẶC XEM KẾT QUẢ: Giao diện Focus toàn màn hình (Không cần scroll, bấm ra ngoài hoặc Thoát là đóng) */}
          {(isTestRunning || isTestSubmitted) && (
            <div
              onClick={() => {
                stopAllSpeech();
                setIsTestRunning(false);
                setIsTestSubmitted(false);
              }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-[#141413]/90 p-3 sm:p-5 backdrop-blur-xs animate-in fade-in duration-150"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="relative flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border-2 border-[#F5EFE6] bg-[#1D1C19] shadow-[6px_6px_0_0_#F5EFE6]"
              >
                {/* Modal Top Header: Per-Question Timer + Progress + Nút Thoát nhanh */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#3A3832] bg-[#141413] px-4 py-3 sm:px-5">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`inline-flex items-center gap-1.5 rounded-xl border-2 border-[#F5EFE6] px-3 py-1 text-xs sm:text-sm font-extrabold ${testDurationSeconds > 0 &&
                          testTimeLeft <= 5 &&
                          isTestRunning &&
                          !isActiveQuestionLocked
                          ? "bg-[#FF8A8A] text-[#141413] animate-pulse"
                          : "bg-[#F3C969] text-[#141413]"
                        }`}
                    >
                      <Timer className="h-4 w-4 shrink-0" />
                      <span>
                        {testDurationSeconds > 0
                          ? `Câu ${currentTestIndex + 1}: ${testTimeLeft}s`
                          : "Không giới hạn giờ"}
                      </span>
                    </div>

                    <span className="rounded-xl border-2 border-[#3A3832] bg-[#1D1C19] px-2.5 py-1 text-xs font-extrabold text-[#A7D7A9]">
                      Đúng {testStats.correct}/{testStats.total}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isGeneratingAiPractice}
                      onClick={handleAiGenerateFreshPractice}
                      className="inline-flex items-center gap-1.5 rounded-xl border-2 border-[#F5EFE6] bg-[#F3C969] px-3 py-1.5 text-xs font-extrabold text-[#141413] shadow-[2px_2px_0_0_#F5EFE6] disabled:opacity-50 cursor-pointer"
                      title="Nhờ AI tạo bộ câu hỏi ngữ cảnh mới tinh"
                    >
                      {isGeneratingAiPractice ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Đang tạo đề...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">AI Tạo Ngữ Cảnh Mới</span>
                          <span className="sm:hidden">Đề AI Mới</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        stopAllSpeech();
                        setIsTestRunning(false);
                        setIsTestSubmitted(false);
                      }}
                      className="inline-flex items-center gap-1 rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] px-3 py-1.5 text-xs font-extrabold text-[#FF8A8A] hover:bg-[#FF8A8A] hover:text-[#141413] transition-colors cursor-pointer"
                      title="Thoát khỏi phòng thi (hoặc nhấn ra ngoài khung)"
                    >
                      <XCircle className="h-4 w-4" />
                      <span>Thoát</span>
                    </button>
                  </div>
                </div>

                {/* Compact Progress Pills Bar */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b-2 border-[#3A3832] bg-[#141413]/60 px-4 py-2">
                  {unifiedTestQuestions.map((q, idx) => {
                    const userAns = (testUserAnswers[q.id] || "")
                      .trim()
                      .toLowerCase();
                    const isChecked = testCheckedMap[q.id] || isTestSubmitted;
                    const isRight =
                      Boolean(userAns) &&
                      userAns === q.correctAnswer.trim().toLowerCase();

                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => {
                          stopAllSpeech();
                          setCurrentTestIndex(idx);
                        }}
                        className={`shrink-0 rounded-lg border-2 px-2.5 py-1 text-[11px] font-extrabold transition-all cursor-pointer ${idx === currentTestIndex
                            ? "border-[#F5EFE6] bg-[#F3C969] text-[#141413]"
                            : isChecked && isRight
                              ? "border-[#A7D7A9] bg-[#A7D7A9]/20 text-[#A7D7A9]"
                              : isChecked && !isRight
                                ? "border-[#FF8A8A] bg-[#FF8A8A]/20 text-[#FF8A8A]"
                                : "border-[#3A3832] bg-[#1D1C19] text-[#B8B2A6] hover:border-[#F5EFE6]"
                          }`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>

                {/* Focused Question Body OR Auto-Summary Review Board */}
                <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 select-text">
                  {isTestSubmitted ? (
                    <div className="space-y-4 select-text">
                      {/* Tổng kết điểm tự động + Hướng dẫn bôi đen tra từ */}
                      <div className="rounded-xl border-2 border-[#A7D7A9] bg-[#141413] p-5 text-center space-y-2.5">
                        <div className="flex items-center justify-center gap-2 text-lg sm:text-xl font-extrabold text-[#F5EFE6]">
                          <Trophy className="h-6 w-6 text-[#F3C969]" />
                          <span>
                            Tổng Kết Bài Test: {testStats.correct} / {testStats.total} câu đúng ({testStats.scorePercent}%)
                          </span>
                        </div>
                        <p className="text-xs text-[#B8D8F8] font-bold">
                          💡 Mẹo học sâu: Bạn có thể <span className="underline text-[#F3C969]">bôi đen bất kỳ từ vựng hoặc câu nào</span> trong bảng tổng kết dưới đây để mở pop-up Tra Từ &amp; AI Giải Thích ngay lập tức!
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                          <button
                            type="button"
                            onClick={() => handleStartUnifiedTest()}
                            className="inline-flex items-center gap-1.5 rounded-xl border-2 border-[#F5EFE6] bg-[#A7D7A9] px-4 py-2 text-xs font-extrabold text-[#141413] shadow-[2px_2px_0_0_#F5EFE6] cursor-pointer"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>Làm lại đề này</span>
                          </button>
                          <button
                            type="button"
                            disabled={isGeneratingAiPractice}
                            onClick={handleAiGenerateFreshPractice}
                            className="inline-flex items-center gap-1.5 rounded-xl border-2 border-[#F5EFE6] bg-[#F3C969] px-4 py-2 text-xs font-extrabold text-[#141413] shadow-[2px_2px_0_0_#F5EFE6] cursor-pointer"
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                            <span>AI Tạo Ngữ Cảnh Mới</span>
                          </button>
                        </div>
                      </div>

                      {/* Danh sách chi tiết từng câu Đúng / Sai để ôn tập & bôi đen tra từ */}
                      <div className="space-y-3">
                        {unifiedTestQuestions.map((q, qIdx) => {
                          const uAns = (testUserAnswers[q.id] || "").trim();
                          const isCorrect =
                            uAns.toLowerCase() ===
                            q.correctAnswer.trim().toLowerCase();

                          return (
                            <div
                              key={q.id}
                              className={`rounded-xl border-2 p-4 space-y-2 ${isCorrect
                                  ? "border-[#A7D7A9]/70 bg-[#141413]"
                                  : "border-[#FF8A8A]/80 bg-[#141413]"
                                }`}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`rounded-lg border px-2.5 py-0.5 text-xs font-extrabold ${isCorrect
                                        ? "border-[#A7D7A9] bg-[#A7D7A9] text-[#141413]"
                                        : "border-[#FF8A8A] bg-[#FF8A8A] text-[#141413]"
                                      }`}
                                  >
                                    {isCorrect
                                      ? `✓ Câu ${qIdx + 1}: ĐÚNG`
                                      : `✗ Câu ${qIdx + 1}: SAI`}
                                  </span>
                                  <span className="text-xs font-bold text-[#B8B2A6]">
                                    {q.skillLabel}
                                  </span>
                                </div>
                                <AudioSpeakButton
                                  text={
                                    q.fullSentenceAudio || q.audioTextToSpeak
                                  }
                                  label="Nghe chuẩn"
                                  className="rounded-lg border border-[#F5EFE6] bg-[#B8D8F8] px-2.5 py-1 text-xs font-extrabold text-[#141413]"
                                />
                              </div>

                              <p className="text-sm font-extrabold text-[#F5EFE6]">
                                {q.promptTitle}
                              </p>

                              <div className="flex flex-wrap items-center gap-3 text-xs">
                                <span
                                  className={
                                    isCorrect
                                      ? "font-bold text-[#A7D7A9]"
                                      : "font-bold text-[#FF8A8A]"
                                  }
                                >
                                  Bạn chọn/nhập:{" "}
                                  <strong>{uAns || "(Chưa trả lời / Hết giờ)"}</strong>
                                </span>
                                {!isCorrect && (
                                  <span className="font-extrabold text-[#A7D7A9]">
                                    → Đáp án đúng: &ldquo;{q.correctAnswer}&rdquo;
                                  </span>
                                )}
                              </div>

                              <p className="text-xs text-[#B8B2A6] leading-relaxed">
                                {q.explanation}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    currentQuestion && (
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border-2 border-[#F5EFE6] bg-[#C8B6FF] px-3 py-0.5 text-xs font-extrabold text-[#141413]">
                              Câu {currentTestIndex + 1} /{" "}
                              {unifiedTestQuestions.length}
                            </span>
                            <span className="rounded-full border-2 border-[#3A3832] bg-[#141413] px-3 py-0.5 text-xs font-extrabold text-[#F3C969]">
                              {currentQuestion.skillLabel}
                            </span>
                          </div>

                          {/* CHỈ CÂU TỰ ĐIỀN TỪ VỰNG (word_fill) MỚI CÓ NÚT ĐỌC (VÀ USER TỰ NHẤN TỐI ĐA 2 LẦN) */}
                          {currentQuestion.skillType === "word_fill" &&
                            (() => {
                              const playCount =
                                testAudioPlayCountMap[currentQuestion.id] || 0;
                              const maxPlays = 2;
                              const remaining = Math.max(
                                0,
                                maxPlays - playCount
                              );
                              return (
                                <button
                                  type="button"
                                  disabled={remaining === 0}
                                  onClick={() => {
                                    if (remaining <= 0) return;
                                    setTestAudioPlayCountMap((prev) => ({
                                      ...prev,
                                      [currentQuestion.id]: playCount + 1,
                                    }));
                                    speakSmart(
                                      currentQuestion.audioTextToSpeak
                                    );
                                  }}
                                  className={`inline-flex items-center gap-1.5 rounded-xl border-2 px-3.5 py-1.5 text-xs font-extrabold transition-all cursor-pointer ${remaining > 0
                                      ? "border-[#F5EFE6] bg-[#B8D8F8] text-[#141413] shadow-[2px_2px_0_0_#F5EFE6]"
                                      : "border-[#3A3832] bg-[#141413] text-[#8F8A7E] opacity-60 cursor-not-allowed"
                                    }`}
                                >
                                  <Volume2 className="h-4 w-4" />
                                  <span>
                                    {remaining > 0
                                      ? `Nhấn để nghe từ (${remaining}/${maxPlays} lần)`
                                      : "Đã hết lượt nghe (2/2)"}
                                  </span>
                                </button>
                              );
                            })()}
                        </div>

                        <div className="space-y-1.5">
                          <h3 className="text-base sm:text-lg font-extrabold text-[#F5EFE6] leading-relaxed">
                            {currentQuestion.promptTitle}
                          </h3>

                          {currentQuestion.ipaHint && (
                            <p className="font-mono text-xs sm:text-sm font-bold text-[#F3C969]">
                              Phiên âm: {currentQuestion.ipaHint}
                            </p>
                          )}

                          {currentQuestion.subHint && (
                            <p className="text-xs sm:text-sm text-[#B8B2A6]">
                              {currentQuestion.subHint}
                            </p>
                          )}

                          {(currentQuestion.synonymHint ||
                            currentQuestion.antonymHint) && (
                              <div className="flex flex-wrap gap-2 pt-1 text-xs">
                                {currentQuestion.synonymHint && (
                                  <span className="rounded-lg border border-[#A7D7A9]/50 bg-[#141413] px-2.5 py-1 font-bold text-[#A7D7A9]">
                                    ≈ Đồng nghĩa: {currentQuestion.synonymHint}
                                  </span>
                                )}
                                {currentQuestion.antonymHint && (
                                  <span className="rounded-lg border border-[#FF8A8A]/50 bg-[#141413] px-2.5 py-1 font-bold text-[#FF8A8A]">
                                    ≠ Trái nghĩa: {currentQuestion.antonymHint}
                                  </span>
                                )}
                              </div>
                            )}
                        </div>

                        {currentQuestion.options &&
                          currentQuestion.options.length > 0 ? (
                          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                            {currentQuestion.options.map((opt) => {
                              const userChosen =
                                testUserAnswers[currentQuestion.id] || "";
                              const isChecked =
                                testCheckedMap[currentQuestion.id] ||
                                isTestSubmitted;
                              const isOptSelected = userChosen === opt;
                              const isOptCorrect =
                                opt.trim().toLowerCase() ===
                                currentQuestion.correctAnswer
                                  .trim()
                                  .toLowerCase();

                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  disabled={isChecked}
                                  onClick={() => {
                                    if (isChecked) return;
                                    // Tuyệt đối KHÔNG tự động đọc ở câu trắc nghiệm / điền từ trong câu
                                    setTestUserAnswers((prev) => ({
                                      ...prev,
                                      [currentQuestion.id]: opt,
                                    }));
                                    setTestCheckedMap((prev) => ({
                                      ...prev,
                                      [currentQuestion.id]: true,
                                    }));
                                  }}
                                  className={`flex items-center justify-between rounded-xl border-2 px-4 py-3 text-xs sm:text-sm font-extrabold text-left transition-all cursor-pointer disabled:cursor-default ${isChecked && isOptCorrect
                                      ? "border-[#F5EFE6] bg-[#A7D7A9] text-[#141413] shadow-[3px_3px_0_0_#F5EFE6]"
                                      : isChecked &&
                                        isOptSelected &&
                                        !isOptCorrect
                                        ? "border-[#F5EFE6] bg-[#FF8A8A] text-[#141413]"
                                        : isOptSelected
                                          ? "border-[#F5EFE6] bg-[#F3C969] text-[#141413]"
                                          : "border-[#3A3832] bg-[#141413] text-[#F5EFE6] hover:border-[#F5EFE6]"
                                    }`}
                                >
                                  <span>{opt}</span>
                                  {isChecked && isOptCorrect && (
                                    <Check className="h-4 w-4 shrink-0" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="flex flex-col sm:flex-row gap-2.5">
                            <input
                              type="text"
                              autoFocus
                              value={testUserAnswers[currentQuestion.id] || ""}
                              onChange={(e) => {
                                if (
                                  testCheckedMap[currentQuestion.id] ||
                                  isTestSubmitted
                                ) {
                                  return;
                                }
                                setTestUserAnswers((prev) => ({
                                  ...prev,
                                  [currentQuestion.id]: e.target.value,
                                }));
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  const alreadyChecked =
                                    testCheckedMap[currentQuestion.id];
                                  if (!alreadyChecked) {
                                    // Nhấn Enter lần 1: Chốt đáp án câu điền từ
                                    setTestCheckedMap((prev) => ({
                                      ...prev,
                                      [currentQuestion.id]: true,
                                    }));
                                  } else if (
                                    currentTestIndex <
                                    unifiedTestQuestions.length - 1
                                  ) {
                                    // Nhấn Enter lần 2: Chuyển ngay qua câu tiếp theo
                                    stopAllSpeech();
                                    setCurrentTestIndex((prev) => prev + 1);
                                  }
                                }
                              }}
                              placeholder="Gõ từ vựng vào đây → Nhấn Enter để chốt & nhấn Enter lần nữa để qua câu..."
                              className="flex-1 rounded-xl border-2 border-[#F5EFE6] bg-[#141413] px-4 py-3 text-sm font-bold text-[#F5EFE6] placeholder-[#8F8A7E] focus:border-[#F3C969] focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const alreadyChecked =
                                  testCheckedMap[currentQuestion.id];
                                if (!alreadyChecked) {
                                  setTestCheckedMap((prev) => ({
                                    ...prev,
                                    [currentQuestion.id]: true,
                                  }));
                                } else if (
                                  currentTestIndex <
                                  unifiedTestQuestions.length - 1
                                ) {
                                  stopAllSpeech();
                                  setCurrentTestIndex((prev) => prev + 1);
                                }
                              }}
                              className="rounded-xl border-2 border-[#F5EFE6] bg-[#F3C969] px-5 py-3 text-xs font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] cursor-pointer"
                            >
                              {testCheckedMap[currentQuestion.id]
                                ? "Qua câu tiếp (Enter) →"
                                : "Chốt Đáp Án (Enter)"}
                            </button>
                          </div>
                        )}

                        {testCheckedMap[currentQuestion.id] && (
                          <div
                            className={`rounded-xl border-2 p-3.5 text-xs sm:text-sm space-y-1 ${(testUserAnswers[currentQuestion.id] || "")
                                .trim()
                                .toLowerCase() ===
                                currentQuestion.correctAnswer.trim().toLowerCase()
                                ? "border-[#A7D7A9] bg-[#141413] text-[#A7D7A9]"
                                : "border-[#FF8A8A] bg-[#141413] text-[#FF8A8A]"
                              }`}
                          >
                            <div className="font-extrabold">
                              {(testUserAnswers[currentQuestion.id] || "")
                                .trim()
                                .toLowerCase() ===
                                currentQuestion.correctAnswer.trim().toLowerCase()
                                ? "✓ Chính xác!"
                                : testTimedOutMap[currentQuestion.id] &&
                                  !(
                                    testUserAnswers[currentQuestion.id] || ""
                                  ).trim()
                                  ? `⏰ Hết giờ cho câu này! Đáp án đúng là: "${currentQuestion.correctAnswer}"`
                                  : `✗ Đáp án đúng là: "${currentQuestion.correctAnswer}"`}
                            </div>
                            <p className="text-[#F5EFE6]">
                              {currentQuestion.explanation}
                            </p>
                          </div>
                        )}
                      </div>
                    )
                  )}
                </div>

                {/* Modal Bottom Footer: Câu trước / Câu tiếp */}
                {!isTestSubmitted && (
                  <div className="flex items-center justify-between gap-3 border-t-2 border-[#3A3832] bg-[#141413] px-5 py-3.5">
                    <button
                      type="button"
                      disabled={currentTestIndex === 0}
                      onClick={() => {
                        stopAllSpeech();
                        const prevIdx = Math.max(0, currentTestIndex - 1);
                        setCurrentTestIndex(prevIdx);
                      }}
                      className="rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] px-4 py-2 text-xs font-extrabold text-[#F5EFE6] disabled:opacity-40 cursor-pointer"
                    >
                      ← Câu trước
                    </button>

                    <span className="hidden sm:inline text-[11px] text-[#B8B2A6]">
                      Hoàn thành hết các câu hệ thống sẽ tự động tổng kết bài • Nhấn ra ngoài để Thoát
                    </span>

                    {currentTestIndex < unifiedTestQuestions.length - 1 ? (
                      <button
                        type="button"
                        onClick={() => {
                          stopAllSpeech();
                          const nextIdx = currentTestIndex + 1;
                          setCurrentTestIndex(nextIdx);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl border-2 border-[#F5EFE6] bg-[#F3C969] px-5 py-2 text-xs font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] cursor-pointer"
                      >
                        <span>Câu tiếp theo</span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          stopAllSpeech();
                          setIsTestRunning(false);
                          setIsTestSubmitted(true);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl border-2 border-[#F5EFE6] bg-[#A7D7A9] px-5 py-2 text-xs font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] cursor-pointer"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Xem Bảng Tổng Kết Ngay</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: IMPORT VOCAB FILE & AI TOPIC VOCABULARY GENERATOR              */}
      {/* ===================================================================== */}
      {activeTab === "import_ai" && (
        <div className="rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-5 sm:p-6 space-y-5 shadow-[4px_4px_0_0_#F5EFE6] animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="border-b-2 border-[#3A3832] pb-4">
            <h2 className="text-lg font-extrabold text-[#F5EFE6]">
              Thêm Từ Vựng Theo Chủ Đề Từ File — AI Đọc &amp; Biên Soạn Chuyên Sâu
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-[#B8B2A6]">
              Hỗ trợ tải lên mọi định dạng file từ vựng (<strong className="text-[#F5EFE6]">.CSV, .JSON, .TSV, .MD, .TXT</strong>) hoặc dán danh sách từ/văn bản. AI sẽ đọc và tự động viết ra bộ từ vựng chủ đề gồm: <strong className="text-[#F3C969]">Phiên âm IPA, Từ loại, Nghĩa tiếng Việt, Từ đồng nghĩa (Synonyms), Từ trái nghĩa (Antonyms), Ví dụ &amp; Bộ câu hỏi ôn tập</strong>.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-extrabold uppercase tracking-wider text-[#F3C969]">
                Tên Chủ Đề Từ Vựng
              </label>
              <input
                type="text"
                value={importTopicTitle}
                onChange={(e) => setImportTopicTitle(e.target.value)}
                placeholder="VD: Environment & Climate, Healthcare, Business English..."
                className="w-full rounded-xl border-2 border-[#F5EFE6] bg-[#141413] px-3.5 py-2.5 text-sm font-bold text-[#F5EFE6] placeholder-[#8F8A7E] focus:border-[#F3C969] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-extrabold uppercase tracking-wider text-[#C8B6FF]">
                Số lượng từ AI biên soạn sâu / lượt
              </label>
              <input
                type="number"
                min={5}
                max={40}
                value={aiTargetCount}
                onChange={(e) =>
                  setAiTargetCount(
                    Math.min(40, Math.max(5, Number(e.target.value) || 20))
                  )
                }
                className="w-full rounded-xl border-2 border-[#F5EFE6] bg-[#141413] px-3.5 py-2.5 text-sm font-bold text-[#F5EFE6] focus:border-[#F3C969] focus:outline-none"
              />
            </div>
          </div>

          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#A7D7A9] bg-[#141413] p-6 text-center transition-colors hover:bg-[#25241F]">
            <FileSpreadsheet className="mb-2 h-9 w-9 text-[#A7D7A9]" />
            <span className="text-sm font-extrabold text-[#F5EFE6]">
              {uploadedFileName
                ? `Đã chọn file: ${uploadedFileName} (${parsedPreviewItems.length} mục từ nhận diện được)`
                : "Bấm để chọn File Từ Vựng (.CSV, .JSON, .TSV, .MD, .TXT)"}
            </span>
            <span className="mt-1 text-xs text-[#B8B2A6]">
              Hỗ trợ trực tiếp cả các file trong thư mục forumflash_vocab.zip (CSV, JSON, TSV, Markdown) hoặc bất kỳ tài liệu tiếng Anh nào
            </span>
            <input
              type="file"
              accept=".csv,.json,.tsv,.md,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          <div>
            <label className="mb-1.5 block text-xs font-extrabold uppercase tracking-wider text-[#B8B2A6]">
              Hoặc dán danh sách từ vựng / đoạn văn bản chủ đề để AI đọc &amp; trích xuất:
            </label>
            <textarea
              rows={6}
              value={importRawText}
              onChange={(e) => {
                setImportRawText(e.target.value);
                const parsed = parseUploadedVocabFileContent(
                  importTopicTitle || "Pasted",
                  e.target.value
                );
                if (parsed.items.length > 0) {
                  setParsedPreviewItems(parsed.items);
                }
              }}
              placeholder="Dán danh sách từ vựng, bảng Markdown, CSV hoặc một bài báo tiếng Anh vào đây..."
              className="w-full rounded-xl border-2 border-[#F5EFE6] bg-[#141413] p-3.5 text-xs sm:text-sm text-[#F5EFE6] placeholder-[#8F8A7E] focus:border-[#F3C969] focus:outline-none"
            />
          </div>

          {parsedPreviewItems.length > 0 && (
            <div className="rounded-xl border-2 border-[#3A3832] bg-[#141413] p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-extrabold text-[#A7D7A9]">
                <span>
                  Xem trước {parsedPreviewItems.length} từ vựng trích xuất từ file:
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {parsedPreviewItems.slice(0, 60).map((it, i) => (
                  <span
                    key={i}
                    className="rounded-lg border border-[#3A3832] bg-[#1D1C19] px-2.5 py-1 text-xs font-bold text-[#F5EFE6]"
                  >
                    {i + 1}. {it.word}{" "}
                    {it.vietnameseMeaning ? `— ${it.vietnameseMeaning}` : ""}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
            {parsedPreviewItems.length > 0 && (
              <button
                type="button"
                onClick={handleDirectSaveImportedDeck}
                className="flex items-center gap-2 rounded-xl border-2 border-[#F5EFE6] bg-[#141413] px-4 py-3 text-xs sm:text-sm font-extrabold text-[#F3C969] shadow-[3px_3px_0_0_#F5EFE6] hover:bg-[#2A2823] cursor-pointer"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>
                  Lưu Nhanh Bộ {parsedPreviewItems.length} Từ Này (0 Credit)
                </span>
              </button>
            )}

            <button
              type="button"
              disabled={isAiAnalyzingFile}
              onClick={handleAiAnalyzeAndCreateTopic}
              className="flex items-center gap-2 rounded-xl border-2 border-[#F5EFE6] bg-[#A7D7A9] px-5 py-3 text-xs sm:text-sm font-extrabold text-[#141413] shadow-[4px_4px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-50 cursor-pointer"
            >
              {isAiAnalyzingFile ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>
                    AI đang đọc file, viết Đồng/Trái nghĩa &amp; tạo bài tập...
                  </span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>
                    AI Đọc File &amp; Tạo Từ Vựng Chủ Đề (IPA + Đồng/Trái Nghĩa + Bài Test)
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {pronounceTarget && (
        <PronunciationModal
          isOpen={Boolean(pronounceTarget)}
          onClose={() => setPronounceTarget(null)}
          targetText={pronounceTarget.word}
          phonetic={pronounceTarget.ipa}
          vietnameseMeaning={pronounceTarget.meaning}
          contextHint={`Ví dụ: ${pronounceTarget.example}`}
        />
      )}

      {/* Bôi đen tra từ & AI Giải thích khi đã nộp bài hoặc đang xem bảng từ vựng */}
      {(!isTestRunning || isTestSubmitted) && (
        <>
          <SelectionAiPopover
            courseTitle={`Từ vựng Chủ đề (${selectedLanguage})`}
            chapterTitle={activeDeck?.title || "Chủ đề Từ vựng"}
            chapterText={scopedItems
              .map(
                (v) =>
                  `${v.word} (${v.ipa}) [${v.partOfSpeech}]: ${v.vietnameseMeaning}. Ví dụ: ${v.quoteFromBook}`
              )
              .join("\n")}
            selectedAiModel=""
          />
          <AiLessonChatWidget
            mode="floating"
            courseTitle={`Từ vựng Chủ đề (${selectedLanguage})`}
            chapterTitle={`${activeDeck?.title || "Chủ đề"} — Bài ${String(
              selectedLessonBatch + 1
            ).padStart(2, "0")}`}
            vocabularyList={scopedItems}
          />
        </>
      )}
    </div>
  );
}
