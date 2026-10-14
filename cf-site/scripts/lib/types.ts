export interface WpTermRef { taxonomy: string; slug: string }
export interface WpPost {
  id: number; type: string; slug: string; status: string; title: string;
  excerpt: string; content: string; date: string; modified: string;
  thumbnail_id: number | null; menu_order: number; password_protected: boolean;
  meta: Record<string, unknown>; terms: WpTermRef[]; views: number;
}
export interface WpTerm { taxonomy: string; slug: string; name: string; description: string }
export interface WpAttachment { id: number; path: string; mime: string }
export interface WpExport {
  exported_at: string; site_url: string;
  posts: WpPost[]; terms: WpTerm[]; attachments: WpAttachment[];
  options: Record<string, string>;
}
