import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Divider,
  IconButton,
  Chip,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CloseIcon from '@mui/icons-material/Close';
import { api } from '../../services/api';

interface DocumentViewDialogProps {
  open: boolean;
  onClose: () => void;
  documentGuid: string;
  authToken: string;
  // Article context metadata (passed from news feed)
  articleMetadata?: {
    impact_score?: number;
    impact_tier?: string;
    source_name?: string;
    affected_instruments?: string[];
    reasons?: string[];
    why_it_matters?: string;
  };
}

interface DocumentData {
  guid: string;
  title?: string;
  content?: string;
  source_name?: string;
  source_guid?: string;
  language?: string;
  created_at?: string;
  updated_at?: string;
  impact_score?: number;
  impact_tier?: string;
  region?: string;
  sector?: string;
  company?: string;
  ticker?: string;
  event_type?: string;
  trust_level?: number;
  metadata?: Record<string, unknown>;
  [key: string]: unknown; // Allow any additional fields
}

export default function DocumentViewDialog({
  open,
  onClose,
  documentGuid,
  authToken,
  articleMetadata,
}: DocumentViewDialogProps) {
  const [document, setDocument] = useState<DocumentData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    if (open && documentGuid && authToken) {
      loadDocument();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, documentGuid, authToken]);

  const loadDocument = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await api.getDocument(authToken, documentGuid);
      // Cast to DocumentData which has index signature for additional fields
      setDocument(data as DocumentData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load document');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyContent = async () => {
    if (!document) return;

    const fullText = `
TITLE: ${document.title}

${document.content}

---
METADATA
Document ID: ${document.guid}
Source: ${document.source_name || 'Unknown'}
Language: ${document.language || 'Unknown'}
Impact Score: ${document.impact_score || 'N/A'}
Impact Tier: ${document.impact_tier || 'N/A'}
Created: ${document.created_at ? new Date(document.created_at).toLocaleString() : 'Unknown'}
    `.trim();

    try {
      await navigator.clipboard.writeText(fullText);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return 'Unknown';
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  };

  const getTierColor = (tier?: string): 'error' | 'warning' | 'info' | 'default' => {
    switch (tier) {
      case 'PLATINUM': return 'error';
      case 'GOLD': return 'warning';
      case 'SILVER': return 'info';
      default: return 'default';
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Typography variant="h6">Document View</Typography>
          <IconButton onClick={onClose} size="small" edge="end">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {!loading && !error && document && (
          <Box>
            {/* Metadata Header */}
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                {(document.impact_tier || articleMetadata?.impact_tier) && (
                  <Chip
                    label={document.impact_tier || articleMetadata?.impact_tier}
                    color={getTierColor(document.impact_tier || articleMetadata?.impact_tier)}
                    size="small"
                  />
                )}
                {(document.impact_score !== undefined || articleMetadata?.impact_score !== undefined) && (
                  <Chip
                    label={`Score: ${document.impact_score ?? articleMetadata?.impact_score}`}
                    color={getTierColor(document.impact_tier || articleMetadata?.impact_tier)}
                    variant="outlined"
                    size="small"
                  />
                )}
                {document.language && (
                  <Chip label={document.language.toUpperCase()} size="small" variant="outlined" />
                )}
                {articleMetadata?.affected_instruments && articleMetadata.affected_instruments.length > 0 && (
                  <Chip
                    label={articleMetadata.affected_instruments.join(', ')}
                    size="small"
                    variant="outlined"
                    color="primary"
                  />
                )}
              </Box>

              <Typography variant="body2" color="text.secondary" gutterBottom>
                <strong>Document ID:</strong>{' '}
                <span style={{ fontFamily: 'monospace', fontSize: '0.85em' }}>{document.guid}</span>
              </Typography>
              
              {(document.source_name || articleMetadata?.source_name) && (
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>Source:</strong> {document.source_name || articleMetadata?.source_name}
                  {document.trust_level !== undefined && ` (Trust Level: ${document.trust_level})`}
                </Typography>
              )}
              
              {articleMetadata?.why_it_matters && (
                <Typography variant="body2" color="text.secondary" gutterBottom sx={{ fontStyle: 'italic', mt: 1 }}>
                  <strong>Why It Matters:</strong> {articleMetadata.why_it_matters}
                </Typography>
              )}
              
              {articleMetadata?.reasons && articleMetadata.reasons.length > 0 && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                    <strong>Reasons:</strong>
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {articleMetadata.reasons.map((reason, i) => (
                      <Chip
                        key={i}
                        label={reason.replace(/_/g, ' ')}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.7rem' }}
                      />
                    ))}
                  </Box>
                </Box>
              )}
              
              {document.created_at && (
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>Created:</strong> {formatDate(document.created_at)}
                </Typography>
              )}
              
              {document.updated_at && document.updated_at !== document.created_at && (
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>Updated:</strong> {formatDate(document.updated_at)}
                </Typography>
              )}

              {document.region && (
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>Region:</strong> {document.region}
                </Typography>
              )}

              {document.sector && (
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>Sector:</strong> {document.sector}
                </Typography>
              )}

              {document.company && (
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>Company:</strong> {document.company}
                </Typography>
              )}

              {document.ticker && (
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>Ticker:</strong> {document.ticker}
                </Typography>
              )}

              {document.event_type && (
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>Event Type:</strong> {document.event_type}
                </Typography>
              )}

              {document.metadata && Object.keys(document.metadata).length > 0 && (
                <Box sx={{ mt: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5, fontWeight: 'bold' }}>
                    Additional Metadata:
                  </Typography>
                  {Object.entries(document.metadata).map(([key, value]) => (
                    <Typography key={key} variant="caption" color="text.secondary" display="block">
                      <strong>{key}:</strong> {JSON.stringify(value)}
                    </Typography>
                  ))}
                </Box>
              )}
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Title */}
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
              {document.title}
            </Typography>

            <Divider sx={{ my: 2 }} />

            {/* Content */}
            <Box
              sx={{
                p: 2,
                bgcolor: 'background.default',
                borderRadius: 1,
                maxHeight: 500,
                overflow: 'auto',
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {document.content}
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        {copySuccess && (
          <Typography variant="caption" color="success.main" sx={{ mr: 2 }}>
            Copied to clipboard!
          </Typography>
        )}
        <Button
          startIcon={<ContentCopyIcon />}
          onClick={handleCopyContent}
          disabled={!document}
        >
          Copy All
        </Button>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
