export type ProfileType = 'stealth' | 'balanced' | 'none' | 'custom' | 'browser_tls';

export interface DigPingResponse {
  status: string;
  service: string;
}

export interface AntiDetectionConfig {
  profile: ProfileType;
  custom_headers?: Record<string, string>;
  custom_user_agent?: string;
  rate_limit_delay?: number;
  max_response_chars?: number;
}

export interface AntiDetectionResponse extends AntiDetectionConfig {
  success: boolean;
}

export interface StructureOptions {
  selector?: string;
  include_navigation?: boolean;
  include_internal_links?: boolean;
  include_external_links?: boolean;
  include_forms?: boolean;
  include_outline?: boolean;
  timeout_seconds?: number;
}

export interface ContentOptions {
  selector?: string;
  depth?: number;
  max_pages_per_level?: number;
  include_links?: boolean;
  include_images?: boolean;
  include_meta?: boolean;
  filter_noise?: boolean;
  session?: boolean;
  chunk_size?: number;
  max_bytes?: number;
  timeout_seconds?: number;
  parse_results?: boolean;
  source_profile_name?: string;
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
  language?: string;
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

export type ResponseType = 'inline' | 'session';

/** Provenance tracking for a parsed story */
export interface StoryProvenance {
  root_url: string;
  page_url: string;
  crawl_depth: number;
}

/** Parse quality signals for a parsed story */
export interface StoryParseQuality {
  parse_confidence: number;
  missing_fields: string[];
  segmentation_reason: string;
}

/** A single story extracted by the deterministic news parser */
export interface ParsedStory {
  story_id: string;
  headline: string;
  subheadline?: string | null;
  section?: string | null;
  published?: string | null;
  published_raw?: string;
  body_snippet?: string | null;
  comment_count?: number | null;
  tags?: string[];
  content_type?: string;
  author?: string | null;
  language?: string | null;
  provenance?: StoryProvenance;
  seen_on_pages?: Array<{ page_url: string; crawl_depth: number }>;
  parse_quality?: StoryParseQuality;
}

/** Metadata about the parsed feed/crawl run */
export interface FeedMeta {
  parser_version: string;
  source_profile: string;
  source_name: string;
  source_root_url: string;
  crawl_time_utc: string;
  pages_crawled: number;
  stories_extracted: number;
  duplicates_removed: number;
  noise_lines_stripped: number;
  parse_warnings: number;
}

export interface ContentResponse {
  success?: boolean;
  url?: string;
  response_type?: ResponseType;
  crawl_depth?: number;
  title?: string;
  text?: string;
  language?: string;
  links?: Array<{ href: string; text: string }>;
  headings?: Array<{ level: number; text: string }>;
  images?: Array<{ src: string; alt?: string }>;
  meta?: Record<string, string | null>;
  pages?: ScrapedPage[];
  summary?: CrawlSummary;
  raw_summary?: CrawlSummary;
  session_id?: string;
  total_chunks?: number;
  // Parsed mode (parse_results=true)
  feed_meta?: FeedMeta;
  stories?: ParsedStory[];
  warnings?: string[];
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

/** Standard MCP-style error codes from gofr-dig */
export type DigErrorCode =
  | 'INVALID_URL'
  | 'URL_NOT_FOUND'
  | 'FETCH_ERROR'
  | 'TIMEOUT_ERROR'
  | 'CONNECTION_ERROR'
  | 'ROBOTS_BLOCKED'
  | 'ACCESS_DENIED'
  | 'RATE_LIMITED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'SSRF_BLOCKED'
  | 'SELECTOR_NOT_FOUND'
  | 'INVALID_SELECTOR'
  | 'EXTRACTION_ERROR'
  | 'ENCODING_ERROR'
  | 'INVALID_PROFILE'
  | 'INVALID_HEADERS'
  | 'INVALID_RATE_LIMIT'
  | 'MAX_DEPTH_EXCEEDED'
  | 'MAX_PAGES_EXCEEDED'
  | 'UNKNOWN_TOOL'
  | 'INVALID_ARGUMENT'
  | 'INVALID_MAX_RESPONSE_CHARS'
  | 'AUTH_ERROR'
  | 'PERMISSION_DENIED'
  | 'SESSION_ERROR'
  | 'SESSION_NOT_FOUND'
  | 'INVALID_CHUNK_INDEX'
  | 'CHUNK_NOT_FOUND'
  | 'PARSE_ERROR'
  | 'CONFIGURATION_ERROR'
  | 'CONTENT_TOO_LARGE';

/** Standard error response shape from gofr-dig tools */
export interface DigErrorResponse {
  success: false;
  error_code: DigErrorCode;
  message: string;
  details?: Record<string, unknown>;
  recovery_strategy?: string;
}
