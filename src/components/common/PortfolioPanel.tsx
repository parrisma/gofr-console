import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  CircularProgress,
  Alert,
  Box,
} from '@mui/material';
import { api } from '../../services/api';

interface Holding {
  ticker: string;
  name?: string;
  instrument_name?: string;
  weight: number;
  weight_pct?: string;
  shares?: number | null;
  avg_cost?: number | null;
}

interface PortfolioPanelProps {
  clientGuid: string;
  authToken: string;
}

type OrderDirection = 'asc' | 'desc';

export const PortfolioPanel: React.FC<PortfolioPanelProps> = ({ clientGuid, authToken }) => {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderBy, setOrderBy] = useState<keyof Holding>('weight');
  const [order, setOrder] = useState<OrderDirection>('desc');

  useEffect(() => {
    const fetchHoldings = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.getPortfolioHoldings(authToken, clientGuid);
        if (response.holdings && Array.isArray(response.holdings)) {
          setHoldings(response.holdings);
        } else {
          setHoldings([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load portfolio holdings');
        setHoldings([]);
      } finally {
        setLoading(false);
      }
    };

    fetchHoldings();
  }, [clientGuid, authToken]);

  const handleSort = (property: keyof Holding) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const sortedHoldings = [...holdings].sort((a, b) => {
    const aValue = a[orderBy];
    const bValue = b[orderBy];
    
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return order === 'asc' ? aValue - bValue : bValue - aValue;
    }
    
    const aString = String(aValue);
    const bString = String(bValue);
    return order === 'asc' 
      ? aString.localeCompare(bString) 
      : bString.localeCompare(aString);
  });

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
      <CircularProgress />
      <Typography sx={{ mt: 2 }}>Loading portfolio from MCP server...</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
        This may take a few moments
      </Typography>
    </Box>
  );

  if (error) {
    return (
      <Paper sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Paper>
    );
  }

  if (holdings.length === 0) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Portfolio Holdings
        </Typography>
        <Alert severity="info">No holdings found for this client</Alert>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3, position: 'relative', minHeight: loading ? 200 : 'auto' }}>
      {loading && <LoadingOverlay />}
      <Typography variant="h6" gutterBottom>
        Portfolio Holdings
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {holdings.length} position{holdings.length !== 1 ? 's' : ''}
      </Typography>
      
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'ticker'}
                  direction={orderBy === 'ticker' ? order : 'asc'}
                  onClick={() => handleSort('ticker')}
                >
                  Ticker
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'name'}
                  direction={orderBy === 'name' ? order : 'asc'}
                  onClick={() => handleSort('name')}
                >
                  Name
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">
                <TableSortLabel
                  active={orderBy === 'weight'}
                  direction={orderBy === 'weight' ? order : 'asc'}
                  onClick={() => handleSort('weight')}
                >
                  Weight %
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">
                <TableSortLabel
                  active={orderBy === 'shares'}
                  direction={orderBy === 'shares' ? order : 'asc'}
                  onClick={() => handleSort('shares')}
                >
                  Shares
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">
                <TableSortLabel
                  active={orderBy === 'avg_cost'}
                  direction={orderBy === 'avg_cost' ? order : 'asc'}
                  onClick={() => handleSort('avg_cost')}
                >
                  Avg Cost
                </TableSortLabel>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedHoldings.map((holding, index) => (
              <TableRow key={index} hover>
                <TableCell>
                  <Typography variant="body2" fontWeight="medium">
                    {holding.ticker}
                  </Typography>
                </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {holding.instrument_name || holding.name || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">
                      {(holding.weight * 100).toFixed(2)}%
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">
                      {holding.shares !== null && holding.shares !== undefined
                        ? holding.shares.toLocaleString()
                        : '-'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">
                      {holding.avg_cost !== null && holding.avg_cost !== undefined
                        ? `$${holding.avg_cost.toFixed(2)}`
                        : '-'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>
      
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </Paper>
  );
};
