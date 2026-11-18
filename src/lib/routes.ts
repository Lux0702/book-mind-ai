/**
 * Điểm duy nhất định nghĩa các URL của ứng dụng.
 * Dùng ROUTES thay vì viết chuỗi đường dẫn rải rác trong component.
 */
export const LEARNING_TABS = [
  "content",
  "grammar",
  "vocabulary",
  "practice",
  "translation",
  "exam_arena",
] as const;

export type LearningTab = (typeof LEARNING_TABS)[number];

export function isLearningTab(value?: string | null): value is LearningTab {
  return Boolean(value) && (LEARNING_TABS as readonly string[]).includes(value as string);
}

export const ROUTES = {
  home: "/",
  books: "/books",
  library: "/library",
  srs: "/srs",
  book: (courseId: string) => `/books/${encodeURIComponent(courseId)}`,
  chapter: (courseId: string, chapterId: string, tab?: string | null) =>
    `/books/${encodeURIComponent(courseId)}/${encodeURIComponent(chapterId)}/${
      isLearningTab(tab) ? tab : "content"
    }`,
} as const;
