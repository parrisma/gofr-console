import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Paper,
  Typography,
  List,
  ListItem,
  Skeleton,
  Alert,
  CircularProgress,
  Box,
  Chip,
  Divider,
  Link,
  Button,
  Switch,
  FormControlLabel,
  Slider,
  Select,
  MenuItem,
  FormControl,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { FilterList, FilterListOff } from '@mui/icons-material';
import { api } from '../../services/api';
import DocumentViewDialog from './DocumentViewDialog';
import { getIndustryLabel } from '../../types/restrictions';
import type { ClientRestrictions } from '../../types/restrictions';
import type { NewsArticle, WhyItMattersToClientResponse } from '../../types/gofrIQ';

interface ClientNewsPanelProps {
  clientGuid: string;
  clientName: string;
  authToken: string;
  impactThreshold?: number;
  restrictions?: ClientRestrictions;
}

export const ClientNewsPanel: React.FC<ClientNewsPanelProps> = ({ 
  clientGuid, 
  clientName, 
  authToken, 
  impactThreshold,
  restrictions,
}) => {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDocGuid, setSelectedDocGuid] = useState<string | null>(null);
  const [selectedArticleMeta, setSelectedArticleMeta] = useState<NewsArticle | null>(null);
  const [docDialogOpen, setDocDialogOpen] = useState(false);
  const [showAllArticles, setShowAllArticles] = useState(false);

  // Alpha Engine controls
  const [opportunityBias, setOpportunityBias] = useState(0.0);
  const [debouncedBias, setDebouncedBias] = useState(0.0);
  const [feedLimit, setFeedLimit] = useState(3);
  const [timeWindowHours, setTimeWindowHours] = useState(24);
  const biasTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce slider changes by 400ms to avoid spamming API calls while dragging
  const handleBiasChange = useCallback((_event: Event, value: number | number[]) => {
    const v = typeof value === 'number' ? value : value[0];
    setOpportunityBias(v);
    if (biasTimerRef.current) clearTimeout(biasTimerRef.current);
    biasTimerRef.current = setTimeout(() => setDebouncedBias(v), 400);
  }, []);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (biasTimerRef.current) clearTimeout(biasTimerRef.current);
    };
  }, []);

  /** Contextual label for current slider position */
  const getBiasLabel = (bias: number): string => {
    if (bias === 0) return 'Defense -- prioritising holdings risk';
    if (bias < 0.5) return `Mostly defense (bias ${bias.toFixed(2)})`;
    if (bias === 0.5) return 'Balanced';
    if (bias < 1) return `Mostly offense (bias ${bias.toFixed(2)})`;
    return 'Offense -- prioritising thematic opportunities';
  };

  // On-demand LLM enrichment. Never fetch automatically.
  const [enrichedByDocGuid, setEnrichedByDocGuid] = useState<Map<string, WhyItMattersToClientResponse>>(
    () => new Map(),
  );
  const [enrichOpen, setEnrichOpen] = useState<Set<string>>(() => new Set());
  const [enrichLoading, setEnrichLoading] = useState<Set<string>>(() => new Set());
  const [enrichError, setEnrichError] = useState<Map<string, string>>(() => new Map());

  const handleDocumentClick = (docGuid: string, article: NewsArticle) => {
    setSelectedDocGuid(docGuid);
    setSelectedArticleMeta(article);
    setDocDialogOpen(true);
  };

  const handleDocDialogClose = () => {
    setDocDialogOpen(false);
    setSelectedDocGuid(null);
    setSelectedArticleMeta(null);
  };

  useEffect(() => {
    let cancelled = false;
    
    const fetchNews = async () => {
      if (!clientGuid || !authToken) {
        return;
      }
      
      console.log('Fetching news for client:', clientName, clientGuid);
      const startTime = performance.now();
      setLoading(true);
      setError(null);
      try {
        // Apply threshold filter unless "show all" is toggled
        const effectiveThreshold = showAllArticles ? 0 : (impactThreshold ?? 0);
        const response = await api.getClientFeed(
          authToken, clientGuid, feedLimit, effectiveThreshold,
          debouncedBias, timeWindowHours,
        );
        if (cancelled) {
          console.log(`News fetch for ${clientName} cancelled (stale)`);
          return;
        }
        console.log(`get_top_client_news for ${clientName}: ${(performance.now() - startTime).toFixed(0)}ms`);
        console.log('Client feed response:', response);
        if (response.articles && Array.isArray(response.articles)) {
          setArticles(response.articles);
        } else {
          setArticles([]);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load client news feed');
        setArticles([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchNews();
    
    return () => {
      cancelled = true;
    };
  }, [clientGuid, clientName, authToken, impactThreshold, showAllArticles, debouncedBias, feedLimit, timeWindowHours]);

  // Reset enrichment when switching client/token.
  useEffect(() => {
    setEnrichedByDocGuid(new Map());
    setEnrichOpen(new Set());
    setEnrichLoading(new Set());
    setEnrichError(new Map());
  }, [clientGuid, authToken]);

  const requestEnrichment = async (documentGuid: string) => {
    // Cache hit
    if (enrichedByDocGuid.has(documentGuid)) {
      setEnrichOpen((prev) => {
        const next = new Set(prev);
        next.add(documentGuid);
        return next;
      });
      return;
    }

    setEnrichOpen((prev) => {
      const next = new Set(prev);
      next.add(documentGuid);
      return next;
    });
    setEnrichError((prev) => {
      const next = new Map(prev);
      next.delete(documentGuid);
      return next;
    });
    setEnrichLoading((prev) => {
      const next = new Set(prev);
      next.add(documentGuid);
      return next;
    });
    try {
      const res = await api.whyItMattersToClient(authToken, clientGuid, documentGuid);
      setEnrichedByDocGuid((prev) => {
        const next = new Map(prev);
        next.set(documentGuid, res);
        return next;
      });
    } catch (err) {
      setEnrichError((prev) => {
        const next = new Map(prev);
        next.set(documentGuid, err instanceof Error ? err.message : 'Failed to generate explanation');
        return next;
      });
    } finally {
      setEnrichLoading((prev) => {
        const next = new Set(prev);
        next.delete(documentGuid);
        return next;
      });
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

  /** Convert UPPER_SNAKE reason to title case: DIRECT_HOLDING -> Direct holding */
  const humanizeReason = (reason: string): string => {
    return reason
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/^\w/, (c) => c.toUpperCase());
  };

  /** Title-case a tier label: GOLD -> Gold */
  const humanizeTier = (tier: string): string => {
    return tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase();
  };

  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  const SkeletonNews = () => (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Top News for {clientName}
      </Typography>
      <Skeleton variant="text" width="80%" sx={{ mb: 2 }} />
      <List sx={{ pt: 0 }}>
        {[1, 2, 3].map((i) => (
          <React.Fragment key={i}>
            {i > 1 && <Divider />}
            <ListItem sx={{ px: 0, py: 1.5, flexDirection: 'column', alignItems: 'stretch' }}>
              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <Skeleton variant="rounded" width={60} height={24} />
                <Skeleton variant="rounded" width={40} height={24} />
              </Box>
              <Skeleton variant="text" width="90%" height={28} />
              <Skeleton variant="text" width="60%" sx={{ mt: 0.5 }} />
              <Box sx={{ display: 'flex', gap: 0.5, mt: 1 }}>
                <Skeleton variant="rounded" width={50} height={20} />
                <Skeleton variant="rounded" width={70} height={20} />
              </Box>
              <Skeleton variant="text" width="100%" sx={{ mt: 1 }} />
              <Skeleton variant="text" width="85%" />
            </ListItem>
          </React.Fragment>
        ))}
      </List>
    </Paper>
  );

  if (loading) {
    return <SkeletonNews />;
  }

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Top News for {clientName}
      </Typography>
      <Typography variant="caption" color="text.secondary" paragraph>
        Most relevant articles for this client based on fund type, holdings, and watchlist
      </Typography>

      {/* Alpha Engine controls: bias slider + limit + time window */}
      <Box sx={{ mb: 2 }}>
        {/* Bias slider row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, maxWidth: 340, mb: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', minWidth: 52 }}>
            Defense
          </Typography>
          <Slider
            value={opportunityBias}
            onChange={handleBiasChange}
            min={0}
            max={1}
            step={0.05}
            marks={[
              { value: 0, label: '' },
              { value: 0.5, label: '' },
              { value: 1, label: '' },
            ]}
            valueLabelDisplay="auto"
            valueLabelFormat={(v: number) => v.toFixed(2)}
            size="small"
            sx={{ mx: 1 }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', minWidth: 48 }}>
            Offense
          </Typography>
        </Box>

        {/* Limit + Time window selects */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="caption" color="text.secondary">Limit:</Typography>
            <FormControl size="small" variant="standard">
              <Select
                value={feedLimit}
                onChange={(e: SelectChangeEvent<number>) => setFeedLimit(Number(e.target.value))}
                sx={{ fontSize: '0.75rem', minWidth: 40 }}
              >
                <MenuItem value={3}>3</MenuItem>
                <MenuItem value={5}>5</MenuItem>
                <MenuItem value={10}>10</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="caption" color="text.secondary">Window:</Typography>
            <FormControl size="small" variant="standard">
              <Select
                value={timeWindowHours}
                onChange={(e: SelectChangeEvent<number>) => setTimeWindowHours(Number(e.target.value))}
                sx={{ fontSize: '0.75rem', minWidth: 50 }}
              >
                <MenuItem value={1}>1h</MenuItem>
                <MenuItem value={4}>4h</MenuItem>
                <MenuItem value={12}>12h</MenuItem>
                <MenuItem value={24}>24h</MenuItem>
                <MenuItem value={48}>48h</MenuItem>
                <MenuItem value={168}>1w</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Box>

        {/* Bias indicator label */}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          {getBiasLabel(opportunityBias)}
        </Typography>
      </Box>

      {/* Filter Transparency Alert */}
      {!showAllArticles && (impactThreshold !== undefined && impactThreshold > 0 || restrictions) && (
        <Alert 
          severity="info" 
          icon={<FilterList />}
          sx={{ mb: 2 }}
          action={
            <FormControlLabel
              control={
                <Switch
                  checked={showAllArticles}
                  onChange={(e) => setShowAllArticles(e.target.checked)}
                  size="small"
                />
              }
              label="Show All"
              labelPlacement="start"
              sx={{ mr: 0 }}
            />
          }
        >
          <Typography variant="body2" sx={{ fontWeight: 'medium', mb: 0.5 }}>
            Active Filters
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {impactThreshold !== undefined && impactThreshold > 0 && (
              <Typography variant="caption">
                • Impact threshold: {impactThreshold} (hiding articles below this score)
              </Typography>
            )}
            {restrictions?.ethical_sector?.excluded_industries && restrictions.ethical_sector.excluded_industries.length > 0 && (
              <Typography variant="caption">
                • Excluded industries: {restrictions.ethical_sector.excluded_industries.map(getIndustryLabel).join(', ')}
              </Typography>
            )}
            {restrictions?.ethical_sector?.faith_based && (
              <Typography variant="caption">
                • Faith-based compliance: {restrictions.ethical_sector.faith_based}
              </Typography>
            )}
            {restrictions?.impact_sustainability?.impact_themes && restrictions.impact_sustainability.impact_themes.length > 0 && (
              <Typography variant="caption" sx={{ color: 'success.main' }}>
                • Prioritizing {restrictions.impact_sustainability.impact_themes.length} impact theme(s)
              </Typography>
            )}
          </Box>
        </Alert>
      )}

      {/* Show All Mode Indicator */}
      {showAllArticles && (
        <Alert 
          severity="warning" 
          icon={<FilterListOff />}
          sx={{ mb: 2 }}
          action={
            <Button
              size="small"
              onClick={() => setShowAllArticles(false)}
              sx={{ textTransform: 'none' }}
            >
              Restore Filters
            </Button>
          }
        >
          <Typography variant="body2">
            Showing all articles - filters temporarily disabled
          </Typography>
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      {!error && articles.length === 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          No news articles found for this client
        </Alert>
      )}

      {!error && articles.length > 0 && (
        <List sx={{ pt: 0, maxHeight: 400, overflow: 'auto' }}>
          {articles.map((article, index) => {
            const docGuid = article.document_guid || article.guid;
            const enriched = docGuid ? enrichedByDocGuid.get(docGuid) : undefined;
            const isOpen = docGuid ? enrichOpen.has(docGuid) : false;
            const isLoading = docGuid ? enrichLoading.has(docGuid) : false;
            const localError = docGuid ? enrichError.get(docGuid) : undefined;
            const baseWhy = article.why_it_matters_base ?? article.why_it_matters;
            const tierLabel = article.impact_tier ? humanizeTier(article.impact_tier) : '';
            const scoreLabel = article.impact_score != null ? ` ${article.impact_score}` : '';
            return (
              <React.Fragment key={docGuid || index}>
                {index > 0 && <Divider sx={{ opacity: 0.4 }} />}
                <ListItem
                  sx={{
                    px: 0,
                    py: 1.5,
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    gap: 0.5,
                  }}
                >
                  {/* Row 1: tier+score chip | instruments (bold text) | timestamp */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    {article.impact_tier && (
                      <Chip
                        label={`${tierLabel}${scoreLabel}`}
                        color={getTierColor(article.impact_tier)}
                        size="small"
                        sx={{ fontWeight: 600, fontSize: '0.7rem', height: 22 }}
                      />
                    )}
                    {article.relevance_score != null && (
                      <Typography
                        variant="caption"
                        component="span"
                        sx={{ color: 'text.secondary', fontWeight: 500, fontSize: '0.7rem' }}
                      >
                        {Math.round(article.relevance_score * 100)}%
                      </Typography>
                    )}
                    {article.affected_instruments && article.affected_instruments.length > 0 && (
                      <Typography
                        variant="body2"
                        component="span"
                        sx={{ fontWeight: 700, letterSpacing: '0.02em' }}
                      >
                        {article.affected_instruments.join(', ')}
                      </Typography>
                    )}
                    <Box sx={{ flex: 1 }} />
                    <Typography variant="caption" color="text.disabled" component="span">
                      {formatDate(article.created_at)}
                    </Typography>
                  </Box>

                  {/* Row 2: headline */}
                  {docGuid ? (
                    <Link
                      component="button"
                      variant="body2"
                      onClick={() => handleDocumentClick(docGuid, article)}
                      sx={{
                        fontWeight: 500,
                        textAlign: 'left',
                        textDecoration: 'none',
                        color: 'text.primary',
                        cursor: 'pointer',
                        '&:hover': { textDecoration: 'underline', color: 'primary.main' },
                      }}
                    >
                      {article.title}
                    </Link>
                  ) : (
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {article.title}
                    </Typography>
                  )}

                  {/* Row 3: base relevance + "Why?" toggle */}
                  {baseWhy ? (
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        {baseWhy}
                      </Typography>
                      {docGuid ? (
                        <Link
                          component="button"
                          variant="caption"
                          onClick={() => {
                            if (isOpen) {
                              setEnrichOpen((prev) => {
                                const next = new Set(prev);
                                next.delete(docGuid);
                                return next;
                              });
                            } else {
                              void requestEnrichment(docGuid);
                            }
                          }}
                          sx={{
                            color: 'secondary.main',
                            fontWeight: 500,
                            textDecoration: 'none',
                            cursor: isLoading ? 'wait' : 'pointer',
                            whiteSpace: 'nowrap',
                            '&:hover': { textDecoration: 'underline' },
                          }}
                        >
                          {isOpen ? 'hide' : 'Why?'}
                        </Link>
                      ) : null}
                      {isLoading ? <CircularProgress size={12} sx={{ ml: 0.5 }} /> : null}
                    </Box>
                  ) : docGuid ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Link
                        component="button"
                        variant="caption"
                        onClick={() => {
                          if (isOpen) {
                            setEnrichOpen((prev) => {
                              const next = new Set(prev);
                              next.delete(docGuid);
                              return next;
                            });
                          } else {
                            void requestEnrichment(docGuid);
                          }
                        }}
                        sx={{
                          color: 'secondary.main',
                          fontWeight: 500,
                          textDecoration: 'none',
                          cursor: isLoading ? 'wait' : 'pointer',
                          '&:hover': { textDecoration: 'underline' },
                        }}
                      >
                        {isOpen ? 'hide' : 'Why?'}
                      </Link>
                      {isLoading ? <CircularProgress size={12} /> : null}
                    </Box>
                  ) : null}

                  {/* Enriched LLM content (collapsed by default) */}
                  {docGuid && isOpen ? (
                    <Box
                      sx={{
                        pl: 1.5,
                        borderLeft: '2px solid',
                        borderColor: 'secondary.dark',
                        mt: 0.5,
                      }}
                    >
                      {localError ? (
                        <Alert
                          severity="warning"
                          sx={{ py: 0.25, px: 1 }}
                          action={
                            <Button size="small" onClick={() => void requestEnrichment(docGuid)} sx={{ textTransform: 'none', fontSize: '0.75rem' }}>
                              Retry
                            </Button>
                          }
                        >
                          <Typography variant="caption">{localError}</Typography>
                        </Alert>
                      ) : enriched ? (
                        <>
                          <Typography variant="body2" sx={{ mb: 0.25 }}>
                            {enriched.why_it_matters}
                          </Typography>
                          {enriched.story_summary ? (
                            <Typography variant="caption" color="text.secondary">
                              {enriched.story_summary}
                            </Typography>
                          ) : null}
                        </>
                      ) : null}
                    </Box>
                  ) : null}

                  {/* Row 4: reason tags (muted) + source */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                    {article.reasons && article.reasons.length > 0 && (
                      article.reasons.map((reason, i) => (
                        <Chip
                          key={i}
                          label={humanizeReason(reason)}
                          size="small"
                          variant="outlined"
                          sx={{
                            fontSize: '0.65rem',
                            height: 20,
                            color: 'text.disabled',
                            borderColor: 'divider',
                          }}
                        />
                      ))
                    )}
                    {article.source_name && (
                      <Typography
                        variant="caption"
                        color="text.disabled"
                        sx={{ ml: article.reasons && article.reasons.length > 0 ? 0.5 : 0 }}
                      >
                        {article.source_name}
                      </Typography>
                    )}
                  </Box>
                </ListItem>
              </React.Fragment>
            );
          })}
        </List>
      )}

      {/* Document View Dialog */}
      {selectedDocGuid && (
        <DocumentViewDialog
          open={docDialogOpen}
          onClose={handleDocDialogClose}
          documentGuid={selectedDocGuid}
          authToken={authToken}
          articleMetadata={selectedArticleMeta ? {
            impact_score: selectedArticleMeta.impact_score,
            impact_tier: selectedArticleMeta.impact_tier,
            source_name: selectedArticleMeta.source_name,
            affected_instruments: selectedArticleMeta.affected_instruments,
            reasons: selectedArticleMeta.reasons,
            why_it_matters: selectedArticleMeta.why_it_matters_base ?? selectedArticleMeta.why_it_matters,
          } : undefined}
        />
      )}
    </Paper>
  );
};
