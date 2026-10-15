export type PostType = "works" | "column" | "news" | "page";
export type PostStatus = "draft" | "publish" | "trash";

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export interface PostInput {
  type: PostType; title: string; title_en: string; slug: string; status: PostStatus;
  published_at: string | null; // 入力は 'YYYY-MM-DDTHH:mm'(JST) または null
  excerpt: string; excerpt_en: string; content: string; content_en: string; thumbnail: string | null;
  meta: Record<string, unknown>; terms: { taxonomy: string; slug: string }[]; expected_modified_at?: string;
}
/** 検証・正規化後。published_at はUTCの 'YYYY-MM-DD HH:MM:SS' */
export interface CleanPost extends Omit<PostInput, "published_at"> { published_at: string | null }

export interface AdminRow { id: number; type: PostType; slug: string; title: string; status: PostStatus; published_at: string; modified_at: string }
