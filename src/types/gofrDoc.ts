export interface DocTemplateSummary {
  template_id: string;
  name?: string;
  description?: string;
  group?: string;
}

export interface DocListTemplatesResponse {
  templates?: DocTemplateSummary[];
}

export interface DocTemplateDetailsResponse {
  template_id?: string;
  name?: string;
  description?: string;
  group?: string;
  global_parameters?: unknown;
  fragments?: unknown;
}

export interface DocTemplateFragmentSummary {
  fragment_id: string;
  name?: string;
  description?: string;
}

export interface DocListTemplateFragmentsResponse {
  template_id?: string;
  fragments?: DocTemplateFragmentSummary[];
}

export interface DocFragmentDetailsResponse {
  template_id?: string;
  fragment_id?: string;
  name?: string;
  description?: string;
  parameters?: unknown;
}

export interface DocStyleSummary {
  style_id: string;
  name?: string;
  description?: string;
}

export interface DocListStylesResponse {
  styles?: DocStyleSummary[];
}

export interface DocCreateSessionResponse {
  session_id: string;
  alias?: string;
  template_id?: string;
  group?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DocActiveSessionSummary {
  alias?: string;
  session_id: string;
  template_id?: string;
  fragment_count?: number;
  has_global_parameters?: boolean;
  group?: string;
  updated_at?: string;
}

export interface DocListActiveSessionsResponse {
  sessions?: DocActiveSessionSummary[];
}

export interface DocSessionStatusResponse {
  session_id?: string;
  alias?: string;
  template_id?: string;
  is_ready_to_render?: boolean;
  has_global_parameters?: boolean;
  fragment_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface DocAbortSessionResponse {
  success?: boolean;
  message?: string;
}

export type DocParameterType = 'global' | 'fragment';

export interface DocValidateParametersResponse {
  is_valid?: boolean;
  errors?: Array<{
    field?: string;
    message?: string;
    code?: string;
  }>;
}

export interface DocSetGlobalParametersResponse {
  success?: boolean;
  message?: string;
}

export interface DocAddFragmentResponse {
  fragment_instance_guid: string;
}

export interface DocAddImageFragmentResponse {
  fragment_instance_guid: string;
}

export interface DocSessionFragmentRow {
  fragment_instance_guid: string;
  fragment_id?: string;
  type?: string;
  parameters?: unknown;
  created_at?: string;
  position?: unknown;
}

export interface DocListSessionFragmentsResponse {
  fragments?: DocSessionFragmentRow[];
}

export interface DocRemoveFragmentResponse {
  success?: boolean;
  fragment_count?: number;
  message?: string;
}

export type DocRenderFormat = 'html' | 'md' | 'pdf';

export interface DocGetDocumentResponse {
  format?: DocRenderFormat;
  rendered_at?: string;
  style_id?: string;
  proxy?: boolean;

  // Inline content
  content?: string;

  // Proxy fields
  proxy_guid?: string;
  download_url?: string;

  // Server may include additional metadata
  [key: string]: unknown;
}

export interface DocPingResponse {
  status: string;
  service?: string;
  message?: string;
}

// ---------------------------------------------------------------------------
// GOFR-PLOT (via GOFR-DOC plot tools)
// ---------------------------------------------------------------------------

export type PlotFormat = 'png' | 'jpg' | 'svg' | 'pdf';

export type PlotThemeMap = Record<string, string>;
export type PlotHandlerMap = Record<string, string>;

export interface PlotListThemesResponse {
  themes?: PlotThemeMap;
  count?: number;
}

export interface PlotListHandlersResponse {
  handlers?: PlotHandlerMap;
  count?: number;
}

export interface PlotStoredImageRow {
  guid: string;
  format?: string;
  alias?: string | null;
  size?: number;
  created_at?: string | null;
}

export interface PlotListImagesResponse {
  images?: PlotStoredImageRow[];
  count?: number;
}

export interface PlotInlineImage {
  data: string;
  mimeType: string;
}

export interface PlotGetImageMeta {
  identifier?: string;
  format?: string;
  size_bytes?: number;
  alias?: string | null;
}

export interface PlotGetImageResponse {
  image: PlotInlineImage;
  meta: PlotGetImageMeta;
}

export interface PlotRenderGraphInlineMeta {
  format?: string;
  theme?: string;
  type?: string;
  title?: string;
}

export interface PlotRenderGraphProxyData {
  guid: string;
  format?: string;
  theme?: string;
  type?: string;
  title?: string;
  size_bytes?: number;
  alias?: string;
}

export type PlotRenderGraphResponse =
  | {
      mode: 'inline';
      image: PlotInlineImage;
      meta: PlotRenderGraphInlineMeta;
    }
  | {
      mode: 'proxy';
      data: PlotRenderGraphProxyData;
    };

export interface PlotAddPlotFragmentResponse {
  fragment_instance_guid?: string;
  [key: string]: unknown;
}
