import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
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
    const fetchNews = async () => {
      if (!clientGuid || !authToken) {
        return;
      }
      
      console.log('Fetching news for client:', clientName, clientGuid);
      setLoading(true);
      setError(null);
      try {
        const response = await api.getClientFeed(authToken, clientGuid, 10, 0);
        console.log('Client feed response:', response);
        if (response.articles && Array.isArray(response.articles)) {
          setArticles(response.articles);
        } else {
          setArticles([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load client news feed');
        setArticles([]);
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
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

  const LoadingOverlay = () => (
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        bgcolor: 'rgba(255, 255, 255, 0.8)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1,
      }}
    >
      <CircularProgress size={40} />
      <Typography variant="body2" sx={{ mt: 2 }} color="text.secondary">
        Loading news from MCP server...
      </Typography>
    </Box>
  );

  return (
    <Paper sx={{ p: 2, position: 'relative', minHeight: 200 }}>
      <Typography variant="h6" gutterBottom>
        Top News for {clientName}
      </Typography>
      <Typography variant="caption" color="text.secondary" paragraph>
        Most relevant articles for this client based on fund type, holdings, and watchlist
      </Typography>

      {loading && <LoadingOverlay />}

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      {!loading && !error && articles.length === 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          No news articles found for this client
        </Alert>
      )}

      {!loading && !error && articles.length > 0 && (
        <List sx={{ pt: 0 }}>
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
