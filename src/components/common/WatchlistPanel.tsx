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
  IconButton,
  Tooltip,
  Button,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { api } from '../../services/api';
import WatchlistEditDialog from '../watchlist/WatchlistEditDialog';

interface WatchlistItem {
  ticker: string;
  instrument_name?: string;
  name?: string;
  alert_threshold?: number;
  price_threshold?: number;
  volume_threshold?: number;
  current_price?: number;
  current_volume?: number;
}

interface WatchlistPanelProps {
  clientGuid: string;
  authToken: string;
  defaultImpactThreshold?: number;
}

type OrderDirection = 'asc' | 'desc';

export const WatchlistPanel: React.FC<WatchlistPanelProps> = ({ 
  clientGuid,
  authToken,
  defaultImpactThreshold = 50,
}) => {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderBy, setOrderBy] = useState<keyof WatchlistItem>('ticker');
  const [order, setOrder] = useState<OrderDirection>('asc');
  
  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState<'add' | 'edit'>('add');
  const [selectedItem, setSelectedItem] = useState<WatchlistItem | null>(null);
  
  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<WatchlistItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    
    const fetchWatchlist = async () => {
      console.log('Fetching watchlist for client:', clientGuid);
      const startTime = performance.now();
      setLoading(true);
      setError(null);
      try {
        const response = await api.getClientWatchlist(authToken, clientGuid);
        if (cancelled) {
          console.log(`Watchlist fetch for ${clientGuid} cancelled (stale)`);
          return;
        }
        console.log(`getClientWatchlist for ${clientGuid}: ${(performance.now() - startTime).toFixed(0)}ms`);
        // Response can have either 'items' or 'watchlist' array
        const items = response.items || response.watchlist;
        if (items && Array.isArray(items)) {
          setWatchlist(items);
        } else {
          setWatchlist([]);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load watchlist');
        setWatchlist([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchWatchlist();
    
    return () => {
      cancelled = true;
    };
  }, [clientGuid, authToken]);

  const loadWatchlist = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.getClientWatchlist(authToken, clientGuid);
      const items = response.items || response.watchlist;
      if (items && Array.isArray(items)) {
        setWatchlist(items);
      } else {
        setWatchlist([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load watchlist');
      setWatchlist([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddClick = () => {
    setEditMode('add');
    setSelectedItem(null);
    setEditDialogOpen(true);
  };

  const handleEditClick = (item: WatchlistItem) => {
    setEditMode('edit');
    setSelectedItem(item);
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (item: WatchlistItem) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;

    setDeleting(true);
    setError(null);
    try {
      await api.removeFromWatchlist(authToken, clientGuid, itemToDelete.ticker);
      await loadWatchlist();
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete watchlist item');
    } finally {
      setDeleting(false);
    }
  };

  const handleEditSuccess = async () => {
    await loadWatchlist();
  };

  const handleSort = (property: keyof WatchlistItem) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const sortedWatchlist = [...watchlist].sort((a, b) => {
    const aValue = a[orderBy];
    const bValue = b[orderBy];
    
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return order === 'asc' ? aValue - bValue : bValue - aValue;
    }
    
    const aString = String(aValue ?? '');
    const bString = String(bValue ?? '');
    return order === 'asc' 
      ? aString.localeCompare(bString) 
      : bString.localeCompare(aString);
  });

  const isThresholdBreached = (item: WatchlistItem): boolean => {
    // Backend doesn't provide current_price/volume yet, so no breaches
    if (item.current_price && item.price_threshold && item.current_price > item.price_threshold) {
      return true;
    }
    if (item.current_volume && item.volume_threshold && item.current_volume > item.volume_threshold) {
      return true;
    }
    return false;
  };

  const SkeletonTable = () => (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Watchlist
      </Typography>
      <Skeleton variant="text" width={140} sx={{ mb: 2 }} />
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Ticker</TableCell>
              <TableCell>Name</TableCell>
              <TableCell align="right">Price Alert</TableCell>
              <TableCell align="right">Volume Alert</TableCell>
              <TableCell align="center">Status</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {[1, 2, 3, 4].map((i) => (
              <TableRow key={i}>
                <TableCell><Skeleton variant="text" width={50} /></TableCell>
                <TableCell><Skeleton variant="text" width={130} /></TableCell>
                <TableCell align="right"><Skeleton variant="text" width={60} /></TableCell>
                <TableCell align="right"><Skeleton variant="text" width={70} /></TableCell>
                <TableCell align="center"><Skeleton variant="rounded" width={60} height={24} /></TableCell>
                <TableCell align="center"><Skeleton variant="circular" width={24} height={24} /></TableCell>
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

  if (watchlist.length === 0) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Watchlist
        </Typography>
        <Alert severity="info">No items in watchlist</Alert>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          Watchlist
        </Typography>
        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={handleAddClick}
          disabled={loading}
        >
          Add Item
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {watchlist.length === 0 && !loading ? (
        <Alert severity="info">No items in watchlist</Alert>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {watchlist.length} item{watchlist.length !== 1 ? 's' : ''} monitored
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
                      active={orderBy === 'instrument_name'}
                      direction={orderBy === 'instrument_name' ? order : 'asc'}
                      onClick={() => handleSort('instrument_name')}
                    >
                      Name
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right">
                    <TableSortLabel
                      active={orderBy === 'alert_threshold'}
                      direction={orderBy === 'alert_threshold' ? order : 'asc'}
                      onClick={() => handleSort('alert_threshold')}
                    >
                      Alert Threshold
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedWatchlist.map((item, index) => {
                  const breached = isThresholdBreached(item);
                  return (
                    <TableRow key={index} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {item.ticker}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {item.instrument_name || item.name || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {item.alert_threshold !== null && item.alert_threshold !== undefined
                            ? item.alert_threshold
                            : '-'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() => handleEditClick(item)}
                            disabled={loading}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteClick(item)}
                            disabled={loading}
                            color="error"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      <WatchlistEditDialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        onSuccess={handleEditSuccess}
        item={selectedItem}
        clientGuid={clientGuid}
        authToken={authToken}
        mode={editMode}
        defaultImpactThreshold={defaultImpactThreshold}
      />

      <Dialog open={deleteDialogOpen} onClose={() => !deleting && setDeleteDialogOpen(false)}>
        <DialogTitle>Remove from Watchlist?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to remove <strong>{itemToDelete?.ticker}</strong> from the watchlist?
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};
