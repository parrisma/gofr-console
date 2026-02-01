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
  Skeleton,
  Alert,
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
    let cancelled = false;
    
    const fetchHoldings = async () => {
      console.log('Fetching portfolio for client:', clientGuid);
      const startTime = performance.now();
      setLoading(true);
      setError(null);
      try {
        const response = await api.getPortfolioHoldings(authToken, clientGuid);
        if (cancelled) {
          console.log(`Portfolio fetch for ${clientGuid} cancelled (stale)`);
          return;
        }
        console.log(`getPortfolioHoldings for ${clientGuid}: ${(performance.now() - startTime).toFixed(0)}ms`);
        if (response.holdings && Array.isArray(response.holdings)) {
          setHoldings(response.holdings);
        } else {
          setHoldings([]);
        }
      } catch (err) {
        if (cancelled) return;
        console.log(`getPortfolioHoldings for ${clientGuid}: ${(performance.now() - startTime).toFixed(0)}ms (error)`);
        setError(err instanceof Error ? err.message : 'Failed to load portfolio holdings');
        setHoldings([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchHoldings();
    
    return () => {
      cancelled = true;
    };
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

  const SkeletonTable = () => (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Portfolio Holdings
      </Typography>
      <Skeleton variant="text" width={120} sx={{ mb: 2 }} />
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Ticker</TableCell>
              <TableCell>Name</TableCell>
              <TableCell align="right">Weight %</TableCell>
              <TableCell align="right">Shares</TableCell>
              <TableCell align="right">Avg Cost</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {[1, 2, 3, 4, 5].map((i) => (
              <TableRow key={i}>
                <TableCell><Skeleton variant="text" width={50} /></TableCell>
                <TableCell><Skeleton variant="text" width={150} /></TableCell>
                <TableCell align="right"><Skeleton variant="text" width={60} /></TableCell>
                <TableCell align="right"><Skeleton variant="text" width={70} /></TableCell>
                <TableCell align="right"><Skeleton variant="text" width={70} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );

  if (loading) {
    return <SkeletonTable />;
  }

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
    <Paper sx={{ p: 3 }}>
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
