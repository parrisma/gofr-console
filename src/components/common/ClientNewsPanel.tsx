import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  Skeleton,
  Alert,
  Box,
  Chip,
  Divider,
  Link,
  Button,
  Switch,
  FormControlLabel,
} from '@mui/material';
import { FilterList, FilterListOff } from '@mui/icons-material';
import { api } from '../../services/api';
import DocumentViewDialog from './DocumentViewDialog';
import { getIndustryLabel } from '../../types/restrictions';
import type { ClientRestrictions } from '../../types/restrictions';

interface NewsArticle {
  document_guid?: string;
  guid?: string;
  title: string;
  impact_score: number;
  impact_tier: string;
  created_at: string;
  source_name?: string;
  affected_instruments?: string[];
  reasons?: string[];
  why_it_matters?: string;
}

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
        const response = await api.getClientFeed(authToken, clientGuid, 10, effectiveThreshold);
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
  }, [clientGuid, clientName, authToken, impactThreshold, showAllArticles]);

  const getTierColor = (tier: string): 'error' | 'warning' | 'info' | 'default' => {
    switch (tier) {
      case 'PLATINUM': return 'error';
      case 'GOLD': return 'warning';
      case 'SILVER': return 'info';
      default: return 'default';
    }
  };

  const formatDate = (dateStr: string): string => {
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
            return (
              <React.Fragment key={docGuid || index}>
                {index > 0 && <Divider />}
                <ListItem alignItems="flex-start" sx={{ px: 0, flexDirection: 'column', alignItems: 'stretch' }}>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                        <Chip
                          label={article.impact_tier}
                          color={getTierColor(article.impact_tier)}
                          size="small"
                          sx={{ fontWeight: 'bold' }}
                        />
                        <Chip
                          label={article.impact_score}
                          color={getTierColor(article.impact_tier)}
                          size="small"
                          variant="outlined"
                        />
                        {article.affected_instruments && article.affected_instruments.length > 0 && (
                          <Chip
                            label={article.affected_instruments.join(', ')}
                            size="small"
                            variant="outlined"
                            color="primary"
                          />
                        )}
                        <Typography variant="caption" color="text.secondary" component="span">
                          {formatDate(article.created_at)}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      docGuid ? (
                        <Link
                          component="button"
                          variant="body2"
                          onClick={() => handleDocumentClick(docGuid, article)}
                          sx={{
                            fontWeight: 'medium',
                            textAlign: 'left',
                            textDecoration: 'none',
                            cursor: 'pointer',
                            '&:hover': { textDecoration: 'underline' },
                          }}
                        >
                          {article.title}
                        </Link>
                      ) : (
                        article.title
                      )
                    }
                    secondaryTypographyProps={{ component: 'div', mb: 0.5 }}
                  />
                  {article.why_it_matters && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, fontStyle: 'italic' }}>
                      {article.why_it_matters}
                    </Typography>
                  )}
                  {article.reasons && article.reasons.length > 0 && (
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 0.5 }}>
                      {article.reasons.map((reason, i) => (
                        <Chip
                          key={i}
                          label={reason.replace(/_/g, ' ')}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.7rem' }}
                        />
                      ))}
                    </Box>
                  )}
                  {article.source_name && (
                    <Typography variant="caption" color="text.secondary">
                      Source: {article.source_name}
                    </Typography>
                  )}
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
            why_it_matters: selectedArticleMeta.why_it_matters,
          } : undefined}
        />
      )}
    </Paper>
  );
};
