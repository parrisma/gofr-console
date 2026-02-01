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
} from '@mui/material';
import { api } from '../../services/api';

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
}

export const ClientNewsPanel: React.FC<ClientNewsPanelProps> = ({ clientGuid, clientName, authToken }) => {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        const response = await api.getClientFeed(authToken, clientGuid, 10, 0);
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
  }, [clientGuid, clientName, authToken]);

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
          {articles.map((article, index) => (
            <React.Fragment key={article.document_guid || article.guid || index}>
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
                  secondary={article.title}
                  secondaryTypographyProps={{ fontWeight: 'medium', mb: 0.5 }}
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
          ))}
        </List>
      )}
    </Paper>
  );
};
