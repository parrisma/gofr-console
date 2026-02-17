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
