import type { ClientRestrictions } from './restrictions';

export interface Source {
  source_guid: string;
  name: string;
  type: string;
  region: string | null;
  languages: string[];
  trust_level: string;
  active: boolean;
}

export interface Instrument {
  ticker: string;
  name: string;
  instrument_type?: string;
  sector?: string;
  exchange?: string;
  currency?: string;
  company?: string;
}

export interface ClientSummary {
  guid: string;
  client_guid?: string;
  name: string;
  client_type: string | null;
  group_guid?: string;
  created_at?: string | null;
  portfolio_guid?: string;
  watchlist_guid?: string;
}

export interface IngestResult {
  guid: string;
  group_guid: string;
  language: string;
  embedding_generated: boolean;
}

// ============================================================================
// API Response Types
// ============================================================================

/** Response from get_client_profile */
export interface ClientProfileResponse {
  name: string;
  client_type: string | null;
  profile?: {
    mandate_type?: string;
    benchmark?: string;
    horizon?: string;
    esg_constrained?: boolean;
    turnover_rate?: string;
    mandate_text?: string;
    restrictions?: ClientRestrictions;
  };
  settings?: {
    alert_frequency?: string;
    impact_threshold?: number;
  };
}

/** Response from get_client_profile_score */
export interface ProfileScoreResponse {
  completeness_score?: number;
  score?: number; // Alternative field name
  missing_fields?: string[];
  recommendations?: string[];
  breakdown?: {
    holdings?: { score: number; weight: number };
    mandate?: { score: number; weight: number };
    constraints?: { score: number; weight: number };
    engagement?: { score: number; weight: number };
  };
}

/** Response from get_market_context */
export interface MarketContextResponse {
  ticker: string;
  context?: Record<string, unknown>;
  peers?: unknown[];
  indices?: unknown[];
}

/** Response from update_client_profile */
export interface UpdateProfileResponse {
  success: boolean;
  message?: string;
}

/** Response from create_client */
export interface CreateClientResponse {
  client_guid: string;
  name: string;
  client_type: string;
}

/** Response from get_document */
export interface DocumentResponse {
  guid: string;
  title?: string;
  content?: string;
  source_guid?: string;
  language?: string;
  created_at?: string;
  metadata?: Record<string, unknown>;
}

/** Article in news feed */
export interface NewsArticle {
  document_guid?: string;
  guid?: string;
  title?: string;
  summary?: string;
  source?: string;
  source_name?: string;
  published_at?: string;
  created_at?: string;
  impact_score?: number;
  impact_tier?: string;
  relevance_score?: number;
  instruments?: string[];
  affected_instruments?: string[];
  reasons?: string[];
  why_it_matters_base?: string;
  why_it_matters?: string;
  story_summary?: string;
}

/** Response from why_it_matters_to_client */
export interface WhyItMattersToClientResponse {
  client_guid: string;
  document_guid: string;
  why_it_matters: string;
  story_summary: string;
}

/** Response from get_top_client_news */
export interface ClientFeedResponse {
  articles?: NewsArticle[];
  total_found?: number;
}

/** Portfolio holding item */
export interface PortfolioHolding {
  ticker: string;
  weight: number;
  shares?: number;
  avg_cost?: number;
  added_at?: string;
}

/** Response from get_portfolio_holdings */
export interface PortfolioHoldingsResponse {
  holdings?: PortfolioHolding[];
  total_weight?: number;
}

/** Response from add_to_portfolio / remove_from_portfolio */
export interface PortfolioUpdateResponse {
  success: boolean;
  message?: string;
  portfolio_guid?: string;
}

/** Watchlist item */
export interface WatchlistItem {
  ticker: string;
  alert_threshold?: number;
  added_at?: string;
}

/** Response from get_watchlist_items */
export interface WatchlistResponse {
  items?: WatchlistItem[];
  watchlist?: WatchlistItem[]; // Alternative property name from some backends
}

/** Response from add_to_watchlist / remove_from_watchlist */
export interface WatchlistUpdateResponse {
  success: boolean;
  message?: string;
  watchlist_guid?: string;
}

/** Single result from query_documents */
export interface QueryDocumentsResult {
  document_guid: string;
  title?: string;
  content_snippet?: string;
  score?: number;
  similarity_score?: number;
  trust_score?: number;
  source_guid?: string;
  source_name?: string;
  language?: string;
  created_at?: string;
  impact_score?: number;
  impact_tier?: string;
  event_type?: string;
}

/** Response from query_documents */
export interface QueryDocumentsResponse {
  query: string;
  results: QueryDocumentsResult[];
  total_found?: number;
  execution_time_ms?: number;
}

/** Response from get_instrument_news */
export interface InstrumentNewsResponse {
  ticker: string;
  articles?: NewsArticle[];
  total_found?: number;
}
