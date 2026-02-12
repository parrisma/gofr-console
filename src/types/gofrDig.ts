export type ProfileType = 'stealth' | 'balanced' | 'none' | 'custom' | 'browser_tls';

export interface DigPingResponse {
  status: string;
  service: string;
}

export interface AntiDetectionConfig {
  profile: ProfileType;
  custom_headers?: Record<string, string>;
  custom_user_agent?: string;
  respect_robots_txt?: boolean;
  rate_limit_delay?: number;
  max_tokens?: number;
}

export interface AntiDetectionResponse extends AntiDetectionConfig {
  success: boolean;
}

export interface StructureOptions {
  include_navigation?: boolean;
  include_internal_links?: boolean;
  include_external_links?: boolean;
  include_forms?: boolean;
  include_outline?: boolean;
}

export interface ContentOptions {
  selector?: string;
  depth?: number;
  max_pages_per_level?: number;
  include_links?: boolean;
  include_images?: boolean;
  include_meta?: boolean;
  session?: boolean;
  chunk_size?: number;
}

export interface DigSection {
  tag: string;
  id?: string;
  classes?: string[];
  children?: number;
}

export interface DigNavigation {
  type: string;
  id?: string;
  links: Array<{ text: string; href: string }>;
}

export interface DigForm {
  id?: string;
  action?: string;
  method?: string;
  inputs: Array<{ name: string; type: string; required?: boolean }>;
}

export interface PageStructureResponse {
  success: boolean;
  url: string;
  title?: string;
  sections?: DigSection[];
  navigation?: DigNavigation[];
  internal_links?: Array<{ text: string; href: string }>;
  external_links?: Array<{ text: string; href: string }>;
  forms?: DigForm[];
  outline?: Array<{ level: number; text: string }>;
}

export interface ScrapedPage {
  depth: number;
  url: string;
  title?: string;
  text?: string;
}

export interface CrawlSummary {
  total_pages: number;
  total_text_length: number;
  pages_by_depth: Record<string, number>;
}

export interface ContentResponse {
  success: boolean;
  url: string;
  title?: string;
  text?: string;
  language?: string;
  links?: Array<{ href: string; text: string }>;
  headings?: Array<{ level: number; text: string }>;
  images?: Array<{ src: string; alt?: string }>;
  meta?: Record<string, string | null>;
  pages?: ScrapedPage[];
  summary?: CrawlSummary;
  session_id?: string;
  total_chunks?: number;
}

export interface SessionInfoResponse {
  session_id: string;
  source_url: string;
  total_size_bytes: number;
  total_chunks: number;
  created_at: string;
}

export interface SessionChunkResponse {
  success?: boolean;
  session_id?: string;
  chunk_index?: number;
  url?: string;
  title?: string;
  text?: string;
  content?: string;
  language?: string;
  total_chunks?: number;
  is_last?: boolean;
}

export interface SessionSummary {
  session_id: string;
  url: string;
  total_chunks: number;
  total_size_bytes: number;
  total_chars?: number;
  chunk_size?: number;
  group?: string | null;
  created_at: string;
}

export interface ListSessionsResponse {
  sessions: SessionSummary[];
  total: number;
}

/** Chunk reference object returned when as_json=true */
export interface SessionChunkRef {
  session_id: string;
  chunk_index: number;
}

/** Response shape when as_json=false (default until now) — plain HTTP URLs */
export interface SessionUrlsResponse {
  success?: boolean;
  session_id: string;
  url?: string;
  total_chunks: number;
  chunk_urls: string[];
}

/** Response shape when as_json=true — MCP-friendly chunk references */
export interface SessionUrlsJsonResponse {
  success?: boolean;
  session_id: string;
  url?: string;
  total_chunks: number;
  chunks: SessionChunkRef[];
}

/** Successful get_session response (all chunks joined server-side) */
export interface GetSessionResponse {
  success: boolean;
  session_id: string;
  url?: string;
  total_chunks: number;
  total_size_bytes: number;
  content: string;
}

/** Error response when session content exceeds max_bytes */
export interface GetSessionErrorResponse {
  success: false;
  error_code: 'CONTENT_TOO_LARGE';
  message: string;
  details: {
    session_id: string;
    total_size_bytes: number;
    max_bytes: number;
    total_chunks: number;
  };
}
