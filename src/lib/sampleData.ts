import { Course, FlashcardSRS } from "@/types/course";

export const SAMPLE_COURSE: Course = {
  id: "sample-course-gatsby",
  title: "The Great Gatsby (Bản Phân Tích Chuyên Sâu)",
  author: "F. Scott Fitzgerald",
  description:
    "Khóa học mẫu trích từ tiểu thuyết kinh điển The Great Gatsby. Học từ vựng học thuật & văn học cấp độ B2-C2, cấu trúc câu phức, đảo ngữ và luyện dịch câu theo văn phong nghệ thuật.",
  targetLanguage: "English",
  level: "B2 - C1",
  coverGradient: "from-indigo-600 via-purple-600 to-pink-500",
  sourceFileName: "The_Great_Gatsby_Full_Edition.pdf",
  sourceFileSizeMB: 14.2,
  totalPages: 180,
  createdAt: "2026-10-30T00:00:00.000Z",
  updatedAt: "2026-10-30T00:00:00.000Z",
  chapters: [
    {
      id: "gatsby-ch-1",
      courseId: "sample-course-gatsby",
      index: 1,
      title: "Chapter 1: Lời khuyên của người cha & Biệt thự Đông Trứng (East Egg)",
      summary:
        "Nick Carraway hồi tưởng lời dạy của cha về sự khoan dung trước khi phán xét người khác, giới thiệu nhân vật bí ẩn Jay Gatsby và buổi tối tại dinh thự nhà Buchanan.",
      startPage: 1,
      endPage: 18,
      isGenerated: true,
      completedClozeIds: [],
      completedQuizIds: [],
      completedTranslationIds: [],
      rawText: `In my younger and more vulnerable years my father gave me some advice that I've been turning over in my mind ever since.
"Whenever you feel like criticizing any one," he told me, "just remember that all the people in this world haven't had the advantages that you've had."
He didn't say any more, but we've always been unusually communicative in a reserved way, and I understood that he meant a great deal more than that. In consequence, I'm inclined to reserve all judgments, a habit that has opened up many curious natures to me and also made me the victim of not a few veteran bores.
Only Gatsby, the man who gives his name to this book, was exempt from my reaction—Gatsby, who represented everything for which I have an unaffected scorn. If personality is an unbroken series of successful gestures, then there was something gorgeous about him, some heightened sensitivity to the promises of life, as if he were related to one of those intricate machines that register earthquakes ten thousand miles away.`,
      lesson: {
        chapterTitle: "Chapter 1: Lời khuyên của người cha & Biệt thự Đông Trứng",
        generatedAt: "2026-10-30T00:00:00.000Z",
        overview: {
          summary:
            "Chương mở đầu đặt nền móng cho toàn bộ tác phẩm thông qua góc nhìn hồi tưởng của người kể chuyện Nick Carraway. Tác giả giới thiệu triết lý 'khoan hồng và tạm hoãn sự phán xét' của Nick, đồng thời dựng lên chân dung đối lập đầy mê hoặc của Jay Gatsby — một con người mang khát vọng mãnh liệt và sự nhạy cảm phi thường trước những hứa hẹn của cuộc đời.",
          keyThemes: [
            "Sự khoan dung và định kiến xã hội (Tolerance vs. Social Judgment)",
            "Đặc quyền giai cấp (Class Privilege)",
            "Sự ngưỡng mộ pha lẫn khinh miệt đối với Giấc mơ Mỹ của Gatsby",
          ],
          learningObjectives: [
            "Nắm vững cụm động từ và tính từ miêu tả tính cách & tâm lý bậc cao (vulnerable, reserved, inclined to, exempt from).",
            "Hiểu và vận dụng cấu trúc câu điều kiện giả định và mệnh đề quan hệ có giới từ ('for which', 'as if he were').",
            "Rèn kỹ năng dịch câu văn giàu tính ẩn dụ và nhịp điệu văn học Anh-Mỹ.",
          ],
        },
        contentAnalysis: [
          {
            id: "sec-1",
            sectionTitle: "1. Lời răn dạy của người cha về sự phán xét",
            originalExcerpt:
              'In my younger and more vulnerable years my father gave me some advice that I\'ve been turning over in my mind ever since. "Whenever you feel like criticizing any one," he told me, "just remember that all the people in this world haven\'t had the advantages that you\'ve had."',
            vietnameseTranslation:
              'Vào những năm tháng tuổi trẻ non nớt và dễ tổn thương hơn của tôi, cha tôi đã cho tôi một lời khuyên mà từ đó đến nay tôi vẫn luôn suy ngẫm mãi trong lòng. "Bất cứ khi nào con muốn chỉ trích một ai đó," ông bảo tôi, "hãy nhớ rằng không phải ai trên thế gian này cũng có được những ưu thế mà con từng có."',
            deepExplanation:
              "Mở đầu truyện, Nick tự nhận mình từng 'younger and more vulnerable' (trẻ trung và dễ bị tác động/tổn thương). Lời khuyên của người cha không chỉ là bài học đạo đức cá nhân mà còn phơi bày thực trạng bất bình đẳng giai cấp: sự giàu có và nền tảng gia đình là một 'advantage' (đặc quyền) không phải ai sinh ra cũng có.",
            stylisticOrContextNotes:
              "Cụm thành ngữ 'turn over in one's mind' tạo hình ảnh một ý nghĩ được lật đi lật lại, nghiền ngẫm suốt nhiều năm tháng (thì hiện tại hoàn thành tiếp diễn: have been turning over).",
          },
          {
            id: "sec-2",
            sectionTitle: "2. Thói quen kiềm chế sự phán xét và hệ quả của nó",
            originalExcerpt:
              "He didn't say any more, but we've always been unusually communicative in a reserved way, and I understood that he meant a great deal more than that. In consequence, I'm inclined to reserve all judgments, a habit that has opened up many curious natures to me and also made me the victim of not a few veteran bores.",
            vietnameseTranslation:
              "Ông không nói gì thêm, nhưng cha con tôi vốn luôn thấu hiểu nhau một cách lạ thường dù kiệm lời, và tôi hiểu ông muốn gửi gắm nhiều hơn thế rất nhiều. Hệ quả là tôi có xu hướng giữ lại mọi sự phán xét — một thói quen đã mở ra trước mắt tôi biết bao bản tính kỳ lạ, nhưng đồng thời cũng biến tôi thành nạn nhân của không ít kẻ nói dai kỳ cựu.",
            deepExplanation:
              "Tác giả dùng phép nghịch ngữ (oxymoron) tinh tế: 'communicative in a reserved way' (giao tiếp thấu hiểu sâu sắc nhưng lại kín đáo, ít lời). Nhờ không vội phán xét ('reserve all judgments'), người khác dễ mở lòng tâm sự với Nick, giúp anh trở thành người quan sát lý tưởng của toàn bộ câu chuyện.",
            stylisticOrContextNotes:
              "Cách dùng 'not a few' (Litotes - nói giảm nói tránh phủ định của phủ định) đồng nghĩa với 'quite a lot of' (khá nhiều), tạo giọng điệu hóm hỉnh, châm biếm nhẹ nhàng.",
          },
          {
            id: "sec-3",
            sectionTitle: "3. Ngoại lệ mang tên Jay Gatsby",
            originalExcerpt:
              "Only Gatsby, the man who gives his name to this book, was exempt from my reaction—Gatsby, who represented everything for which I have an unaffected scorn. If personality is an unbroken series of successful gestures, then there was something gorgeous about him, some heightened sensitivity to the promises of life, as if he were related to one of those intricate machines that register earthquakes ten thousand miles away.",
            vietnameseTranslation:
              "Chỉ riêng Gatsby, người đàn ông được lấy tên đặt cho cuốn sách này, là ngoại lệ trước phản ứng đó của tôi — Gatsby, người đại diện cho tất cả những gì tôi vốn dành sự khinh miệt chân thật nhất. Nếu nhân cách là một chuỗi liền mạch những cử chỉ thành công, thì ở anh ta có một điều gì đó thật lộng lẫy, một sự nhạy cảm cao độ trước những hứa hẹn của cuộc đời, tựa như thể anh có họ hàng với một trong những cỗ máy tinh vi có khả năng ghi nhận các trận động đất cách xa vạn dặm.",
            deepExplanation:
              "Đây là một trong những đoạn văn nổi tiếng nhất văn học thế kỷ 20. Dù Gatsby đại diện cho lối sống xa hoa phù phiếm mà Nick ghét bỏ ('unaffected scorn'), Nick vẫn bị cuốn hút bởi khát vọng sống rực rỡ ('heightened sensitivity to the promises of life') của Gatsby. Hình ảnh so sánh Gatsby với 'cỗ máy địa chấn tinh vi' khắc họa khả năng cảm nhận hy vọng và ước mơ nhạy bén đến mức mong manh của nhân vật.",
            stylisticOrContextNotes:
              "Cấu trúc giả định 'as if he were...' kết hợp ẩn dụ khoa học ('intricate machines that register earthquakes') nâng tầm văn phong từ tự sự thông thường lên chất thơ triết lý.",
          },
        ],
        grammarPoints: [
          {
            id: "gram-1",
            title: "Thì Hiện tại Hoàn thành Tiếp diễn nhấn mạnh sự nghiền ngẫm kéo dài",
            patternFormula: "S + have/has + been + V-ing + ... + ever since",
            quoteFromBook:
              "...my father gave me some advice that I've been turning over in my mind ever since.",
            quoteTranslation:
              "...cha tôi đã cho tôi một lời khuyên mà từ đó đến nay tôi vẫn luôn suy ngẫm mãi trong lòng.",
            detailedExplanation:
              "Thì Present Perfect Continuous ('have been turning over') kết hợp với 'ever since' (kể từ thời điểm quá khứ đó cho tới tận bây giờ) nhấn mạnh hành động suy ngẫm không chỉ xảy ra một lần mà lặp đi lặp lại liên tục, vẫn còn nguyên giá trị ở hiện tại.",
            whyAuthorUsedIt:
              "Giúp người đọc cảm nhận được lời khuyên của người cha không phải là lời dạy thoáng qua, mà là kim chỉ nam ám ảnh tâm trí Nick suốt cuộc đời và chi phối cách anh kể lại câu chuyện này.",
            extraExamples: [
              {
                en: "She shared a secret that I've been thinking about ever since.",
                vi: "Cô ấy đã chia sẻ một bí mật mà từ đó đến giờ tôi cứ suy nghĩ mãi.",
              },
              {
                en: "They have been debating that philosophical question ever since the lecture ended.",
                vi: "Họ vẫn tranh luận mãi câu hỏi triết học đó kể từ khi buổi giảng kết thúc.",
              },
            ],
          },
          {
            id: "gram-2",
            title: "Mệnh đề quan hệ trang trọng với 'Giới từ + which' (Preposition + Relative Pronoun)",
            patternFormula: "Noun / Pronoun + [Preposition + which / whom] + S + V",
            quoteFromBook:
              "...Gatsby, who represented everything for which I have an unaffected scorn.",
            quoteTranslation:
              "...Gatsby, người đại diện cho tất cả những gì tôi vốn dành sự khinh miệt chân thật nhất.",
            detailedExplanation:
              "Trong văn nói thông thường, người ta thường để giới từ ở cuối câu ('everything that I have an unaffected scorn for'). Tuy nhiên, trong văn viết học thuật và văn học trang trọng, giới từ 'for' (đi theo cụm danh từ 'scorn for something') được đảo lên đứng ngay trước đại từ quan hệ 'which' tạo thành 'for which'.",
            whyAuthorUsedIt:
              "Tạo nhịp câu chặt chẽ, cổ điển và thể hiện trình độ học vấn cao (tốt nghiệp đại học Yale) của người kể chuyện Nick Carraway.",
            extraExamples: [
              {
                en: "He defended a principle for which he was willing to sacrifice everything.",
                vi: "Ông ấy đã bảo vệ một nguyên tắc mà vì nó ông sẵn sàng hy sinh tất cả.",
              },
              {
                en: "This is the literary masterpiece in which the author critiques modern society.",
                vi: "Đây là kiệt tác văn học mà trong đó tác giả phê phán xã hội hiện đại.",
              },
            ],
          },
          {
            id: "gram-3",
            title: "Cấu trúc giả định 'as if + S + were' (Subjunctive Mood)",
            patternFormula: "Clause + as if / as though + S + were / V2 (quá khứ giả định)",
            quoteFromBook:
              "...as if he were related to one of those intricate machines that register earthquakes ten thousand miles away.",
            quoteTranslation:
              "...tựa như thể anh có họ hàng với một trong những cỗ máy tinh vi có khả năng ghi nhận các trận động đất cách xa vạn dặm.",
            detailedExplanation:
              "Sau 'as if' hoặc 'as though', khi diễn tả một sự việc không có thật hoặc một phép so sánh giả định ở thời điểm câu chuyện, động từ to be luôn chia là 'were' cho tất cả các ngôi (kể cả he/she/it).",
            whyAuthorUsedIt:
              "Tạo ra một phép so sánh siêu thực (Gatsby là con người nhưng lại nhạy cảm như một cỗ máy đo địa chấn), nhấn mạnh tính chất phi thường, vượt khỏi thực tại trần trụi của nhân vật.",
            extraExamples: [
              {
                en: "He spoke about the future as if it were already written in stone.",
                vi: "Anh ta nói về tương lai cứ như thể nó đã được khắc cốt ghi tâm từ trước.",
              },
              {
                en: "She looked at the painting as though she were seeing her own past.",
                vi: "Cô nhìn bức tranh như thể đang nhìn thấy chính quá khứ của mình.",
              },
            ],
          },
        ],
        vocabulary: [
          {
            id: "voc-1",
            word: "vulnerable",
            ipa: "/ˈvʌl.nər.ə.bəl/",
            partOfSpeech: "adj",
            cefrLevel: "B2",
            vietnameseMeaning: "dễ bị tổn thương, non nớt, dễ bị tác động",
            explanationInContext:
              "Trong câu mở đầu, 'vulnerable years' không chỉ có nghĩa là yếu đuối về thể xác mà chỉ giai đoạn tuổi trẻ tâm hồn còn nhạy cảm, chưa va chạm nhiều nên dễ bị ảnh hưởng bởi thế giới xung quanh.",
            quoteFromBook: "In my younger and more vulnerable years my father gave me some advice...",
            quoteTranslation: "Vào những năm tháng tuổi trẻ non nớt và dễ tổn thương hơn của tôi, cha tôi đã cho tôi một lời khuyên...",
            collocations: ["vulnerable to criticism", "emotionally vulnerable", "vulnerable years"],
            synonyms: ["impressionable", "susceptible", "sensitive", "fragile"],
          },
          {
            id: "voc-2",
            word: "turn over in one's mind",
            ipa: "/tɜːn ˈəʊ.vər ɪn wʌnz maɪnd/",
            partOfSpeech: "idiom",
            cefrLevel: "C1",
            vietnameseMeaning: "suy đi nghĩ lại, trăn trở, nghiền ngẫm kỹ lưỡng",
            explanationInContext:
              "Diễn tả việc cân nhắc một lời khuyên hay một vấn đề từ nhiều góc độ khác nhau trong suốt thời gian dài.",
            quoteFromBook: "...some advice that I've been turning over in my mind ever since.",
            quoteTranslation: "...một lời khuyên mà từ đó đến nay tôi vẫn luôn suy ngẫm mãi trong lòng.",
            collocations: ["turn a problem over in one's mind", "turn the idea over"],
            synonyms: ["ponder", "contemplate", "mull over", "ruminate on"],
          },
          {
            id: "voc-3",
            word: "reserved",
            ipa: "/rɪˈzɜːvd/",
            partOfSpeech: "adj",
            cefrLevel: "B2",
            vietnameseMeaning: "kín đáo, dè dặt, kiệm lời",
            explanationInContext:
              "Chỉ phong cách giao tiếp điềm đạm của tầng lớp quý tộc cũ miền Trung Tây nước Mỹ: không bộc lộ cảm xúc ồn ào ra ngoài nhưng lại rất sâu sắc.",
            quoteFromBook: "...we've always been unusually communicative in a reserved way...",
            quoteTranslation: "...chúng tôi vốn luôn thấu hiểu nhau một cách lạ thường dù kiệm lời...",
            collocations: ["in a reserved way", "reserved nature", "quietly reserved"],
            synonyms: ["reticent", "restrained", "unassuming", "introverted"],
          },
          {
            id: "voc-4",
            word: "be inclined to",
            ipa: "/bi ɪnˈklaɪnd tuː/",
            partOfSpeech: "phrase",
            cefrLevel: "B2",
            vietnameseMeaning: "có xu hướng, thiên về, nghiêng về làm việc gì",
            explanationInContext:
              "Thể hiện một khuynh hướng hành xử có suy xét chứ không phải phản xạ bốc đồng.",
            quoteFromBook: "In consequence, I'm inclined to reserve all judgments...",
            quoteTranslation: "Hệ quả là tôi có xu hướng giữ lại mọi sự phán xét...",
            collocations: ["be inclined to believe", "be inclined to agree", "feel inclined to"],
            synonyms: ["tend to", "be disposed to", "be prone to"],
          },
          {
            id: "voc-5",
            word: "exempt",
            ipa: "/ɪɡˈzempt/",
            partOfSpeech: "adj",
            cefrLevel: "C1",
            vietnameseMeaning: "được miễn trừ, ngoại lệ, nằm ngoài quy luật chung",
            explanationInContext:
              "Gatsby là người duy nhất nằm ngoài quy tắc 'bình thản nhưng giữ khoảng cách' của Nick.",
            quoteFromBook: "Only Gatsby, the man who gives his name to this book, was exempt from my reaction...",
            quoteTranslation: "Chỉ riêng Gatsby, người đàn ông được lấy tên đặt cho cuốn sách này, là ngoại lệ trước phản ứng đó của tôi...",
            collocations: ["exempt from judgment", "exempt from tax", "no one is exempt"],
            synonyms: ["excepted", "excluded", "immune", "spared"],
          },
          {
            id: "voc-6",
            word: "unaffected scorn",
            ipa: "/ˌʌn.əˈfek.tɪd skɔːn/",
            partOfSpeech: "noun phrase",
            cefrLevel: "C2",
            vietnameseMeaning: "sự khinh miệt chân thật (không giả tạo, không làm bộ)",
            explanationInContext:
              "Lưu ý bẫy từ vựng: 'unaffected' ở đây KHÔNG mang nghĩa là 'không bị ảnh hưởng', mà là tính từ bậc C2 bắt nguồn từ 'affectation' (sự giả tạo, làm màu). 'Unaffected scorn' là sự khinh bỉ xuất phát thật từ đáy lòng.",
            quoteFromBook: "...Gatsby, who represented everything for which I have an unaffected scorn.",
            quoteTranslation: "...Gatsby, người đại diện cho tất cả những gì tôi vốn dành sự khinh miệt chân thật nhất.",
            collocations: ["unaffected sincerity", "with open scorn", "pour scorn on"],
            synonyms: ["genuine contempt", "sincere disdain", "unfeigned derision"],
          },
          {
            id: "voc-7",
            word: "intricate",
            ipa: "/ˈɪn.trɪ.kət/",
            partOfSpeech: "adj",
            cefrLevel: "C1",
            vietnameseMeaning: "tinh vi, phức tạp, có nhiều chi tiết đan xen tỉ mỉ",
            explanationInContext:
              "Miêu tả cỗ máy đo địa chấn có cấu tạo cực kỳ tinh xảo, ẩn dụ cho tâm hồn nhạy cảm của Gatsby.",
            quoteFromBook: "...as if he were related to one of those intricate machines that register earthquakes...",
            quoteTranslation: "...tựa như thể anh có họ hàng với một trong những cỗ máy tinh vi có khả năng ghi nhận các trận động đất...",
            collocations: ["intricate machine", "intricate network", "intricate detail"],
            synonyms: ["elaborate", "complex", "sophisticated", "delicate"],
          },
        ],
        clozeExercises: [
          {
            id: "cloze-1",
            sentenceWithBlank:
              "In my younger and more _____ years my father gave me some advice that I've been turning over in my mind ever since.",
            answer: "vulnerable",
            hint: "Tính từ (B2) nghĩa là non nớt, dễ bị tổn thương, bắt đầu bằng chữ 'v'",
            fullSentenceTranslation:
              "Vào những năm tháng tuổi trẻ non nớt và dễ tổn thương hơn của tôi, cha tôi đã cho tôi một lời khuyên mà từ đó đến nay tôi vẫn luôn suy ngẫm mãi trong lòng.",
            explanation:
              "'Vulnerable' kết hợp với 'younger' để diễn tả thời niên thiếu nhạy cảm, dễ bị tác động.",
          },
          {
            id: "cloze-2",
            sentenceWithBlank:
              "In consequence, I'm _____ to reserve all judgments, a habit that has opened up many curious natures to me.",
            answer: "inclined",
            hint: "Cụm 'be _____ to' (B2): có xu hướng, thiên về làm gì",
            fullSentenceTranslation:
              "Hệ quả là tôi có xu hướng giữ lại mọi sự phán xét, một thói quen đã mở ra trước mắt tôi biết bao bản tính kỳ lạ.",
            explanation:
              "Cấu trúc 'be inclined to + V-inf' diễn tả khuynh hướng suy nghĩ hoặc hành động.",
          },
          {
            id: "cloze-3",
            sentenceWithBlank:
              "Only Gatsby, the man who gives his name to this book, was _____ from my reaction.",
            answer: "exempt",
            hint: "Tính từ (C1) đi với giới từ 'from', nghĩa là được miễn trừ / là ngoại lệ",
            fullSentenceTranslation:
              "Chỉ riêng Gatsby, người đàn ông được lấy tên đặt cho cuốn sách này, là ngoại lệ trước phản ứng đó của tôi.",
            explanation: "'Exempt from something' nghĩa là được miễn khỏi hoặc là ngoại lệ đối với điều gì.",
          },
          {
            id: "cloze-4",
            sentenceWithBlank:
              "There was some heightened sensitivity to the promises of life, as if he were related to one of those _____ machines that register earthquakes.",
            answer: "intricate",
            hint: "Tính từ (C1) nghĩa là tinh vi, phức tạp, tỉ mỉ (bắt đầu bằng 'i')",
            fullSentenceTranslation:
              "Có một sự nhạy cảm cao độ trước những hứa hẹn của cuộc đời, tựa như thể anh có họ hàng với một trong những cỗ máy tinh vi có khả năng ghi nhận các trận động đất.",
            explanation: "'Intricate machines' chỉ những cỗ máy có cấu tạo tinh xảo, nhạy bén.",
          },
        ],
        quizExercises: [
          {
            id: "quiz-1",
            category: "vocabulary",
            question:
              'Trong câu "Gatsby, who represented everything for which I have an unaffected scorn", từ "unaffected" mang nghĩa nào sát nhất?',
            options: [
              "Không bị ảnh hưởng hay tác động bởi hoàn cảnh",
              "Chân thật, tự nhiên, không giả tạo hay làm màu",
              "Lạnh lùng và thiếu cảm xúc",
              "Chưa từng được kiểm chứng",
            ],
            correctIndex: 1,
            explanation:
              "Ở trình độ C1/C2, 'unaffected' (trái nghĩa với 'affected' - điệu bộ, giả tạo) mang nghĩa là 'genuine, sincere' (thật lòng, không giả bộ). 'Unaffected scorn' là sự khinh miệt hoàn toàn thật lòng.",
          },
          {
            id: "quiz-2",
            category: "grammar",
            question:
              'Vì sao tác giả sử dụng "were" thay vì "was" trong mệnh đề "...as if he were related to one of those intricate machines"?',
            options: [
              "Vì chủ ngữ thực sự là danh từ số nhiều 'machines'",
              "Đây là lỗi in ấn trong phương ngữ tiếng Anh cổ",
              "Đây là thức giả định (Subjunctive Mood) sau 'as if' để diễn tả một phép so sánh giả tưởng không có thật",
              "Để hòa hợp với thì quá khứ hoàn thành ở mệnh đề trước",
            ],
            correctIndex: 2,
            explanation:
              "Sau 'as if / as though', tiếng Anh chuẩn dùng thức giả định 'were' cho mọi ngôi để nhấn mạnh sự việc chỉ là giả định, ẩn dụ (Gatsby không thực sự có họ hàng với máy móc).",
          },
          {
            id: "quiz-3",
            category: "comprehension",
            question:
              "Theo đoạn trích, việc Nick tuân theo lời khuyên của cha ('reserve all judgments') đã dẫn đến hệ quả kép nào?",
            options: [
              "Anh trở nên giàu có nhanh chóng nhưng lại đánh mất bạn bè chân thành",
              "Nhiều người có tính cách thú vị dễ mở lòng với anh, nhưng anh cũng phải chịu đựng không ít kẻ nói chuyện nhàm chán",
              "Anh không bao giờ bị ai chỉ trích nhưng lại sống cô độc tại East Egg",
              "Cha anh hoàn toàn tin tưởng giao toàn bộ gia sản cho anh quản lý",
            ],
            correctIndex: 1,
            explanation:
              "Trong bài viết: 'a habit that has opened up many curious natures to me and also made me the victim of not a few veteran bores' (mở ra nhiều bản tính kỳ lạ thú vị nhưng cũng biến tôi thành nạn nhân của không ít kẻ nói dai nhàm chán).",
          },
        ],
        translationExercises: [
          {
            id: "trans-1",
            direction: "EN_TO_VI",
            originalSentence:
              'Whenever you feel like criticizing any one, just remember that all the people in this world haven\'t had the advantages that you\'ve had.',
            contextHint:
              "Lời khuyên của cha Nick. Chú ý cấu trúc 'all the people... haven't had' trong tiếng Anh mang nghĩa phủ định một phần ('không phải ai trên đời này cũng có được...').",
            targetGrammarOrVocab: [
              "feel like + V-ing (muốn làm gì)",
              "all... not (không phải tất cả đều...)",
              "advantages (những ưu thế / điều kiện thuận lợi)",
            ],
            referenceTranslation:
              "Bất cứ khi nào con muốn chỉ trích một ai đó, hãy nhớ rằng không phải ai trên thế gian này cũng có được những điều kiện thuận lợi như con từng có.",
          },
          {
            id: "trans-2",
            direction: "EN_TO_VI",
            originalSentence:
              "In consequence, I'm inclined to reserve all judgments, a habit that has opened up many curious natures to me.",
            contextHint:
              "Chú ý cụm 'In consequence' (Hệ quả là), 'be inclined to' (có xu hướng), và 'reserve all judgments' (giữ lại/kiềm chế mọi sự phán xét).",
            targetGrammarOrVocab: [
              "In consequence (Hệ quả là / Do đó)",
              "be inclined to (có xu hướng)",
              "reserve judgments (kiềm chế / hoãn sự phán xét)",
            ],
            referenceTranslation:
              "Hệ quả là tôi có xu hướng kiềm chế mọi sự phán xét, một thói quen đã mở ra trước mắt tôi biết bao bản tính kỳ lạ.",
          },
          {
            id: "trans-3",
            direction: "EN_TO_VI",
            originalSentence:
              "There was something gorgeous about him, some heightened sensitivity to the promises of life.",
            contextHint:
              "Câu văn ca ngợi vẻ đẹp tâm hồn của Gatsby. 'heightened sensitivity' = sự nhạy cảm cao độ; 'promises of life' = những hứa hẹn của cuộc đời.",
            targetGrammarOrVocab: [
              "something gorgeous about him (một nét gì đó lộng lẫy/tuyệt đẹp ở anh ta)",
              "heightened sensitivity (sự nhạy cảm cao độ)",
              "the promises of life (những hứa hẹn của cuộc đời)",
            ],
            referenceTranslation:
              "Ở anh ta có một điều gì đó thật lộng lẫy, một sự nhạy cảm cao độ trước những hứa hẹn của cuộc đời.",
          },
        ],
      },
    },
    {
      id: "gatsby-ch-2",
      courseId: "sample-course-gatsby",
      index: 2,
      title: "Chapter 2: Thung lũng Tro Tàn (The Valley of Ashes) & Đôi mắt bác sĩ T. J. Eckleburg",
      summary:
        "Bức tranh tương phản gay gắt giữa sự xa hoa của giới thượng lưu và vùng đất hoang tàn xám xịt nằm giữa West Egg và New York.",
      startPage: 19,
      endPage: 36,
      isGenerated: false,
      completedClozeIds: [],
      completedQuizIds: [],
      completedTranslationIds: [],
      rawText: `About half way between West Egg and New York the motor road hastily joins the railroad and runs beside it for a quarter of a mile, so as to shrink away from a certain desolate area of land. This is a valley of ashes—a fantastic farm where ashes grow like wheat into ridges and hills and grotesque gardens; where ashes take the forms of houses and chimneys and rising smoke and, finally, with a transcendent effort, of men who move dimly and already crumbling through the powdery air.
But above the grey land and the spasms of bleak dust which drift endlessly over it, you perceive, after a moment, the eyes of Doctor T. J. Eckleburg. The eyes of Doctor T. J. Eckleburg are blue and gigantic—their retinas are one yard high. They look out of no face, but, instead, from a pair of enormous yellow spectacles which pass over a non-existent nose.`,
      lesson: null,
    },
  ],
};

export const SAMPLE_FLASHCARDS: FlashcardSRS[] =
  SAMPLE_COURSE.chapters[0].lesson!.vocabulary.map((v) => ({
    id: `fc-${v.id}`,
    courseId: SAMPLE_COURSE.id,
    chapterId: "gatsby-ch-1",
    word: v.word,
    ipa: v.ipa,
    partOfSpeech: v.partOfSpeech,
    cefrLevel: v.cefrLevel,
    vietnameseMeaning: v.vietnameseMeaning,
    explanationInContext: v.explanationInContext,
    quoteFromBook: v.quoteFromBook,
    quoteTranslation: v.quoteTranslation,
    collocations: v.collocations,
    interval: 0,
    repetition: 0,
    efactor: 2.5,
    nextReviewDate: "2026-10-30T00:00:00.000Z",
  }));
