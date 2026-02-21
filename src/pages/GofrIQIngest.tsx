import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Snackbar,
  Tabs,
  Tab,
} from '@mui/material';
import { CloudUpload, ContentPaste, CheckCircle, Search } from '@mui/icons-material';
import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '../services/api';
import { useConfig } from '../hooks/useConfig';
import type { JwtToken } from '../stores/configStore';
import TokenSelect from '../components/common/TokenSelect';
import ToolErrorAlert from '../components/common/ToolErrorAlert';
import type { Source, IngestResult, QueryDocumentsResult, QueryDocumentsResponse } from '../types/gofrIQ';

/** Renders a single document search result card. */
function SearchResultCard({ doc }: { doc: QueryDocumentsResult }) {
  const tierColor = (tier: string) =>
    tier === 'PLATINUM' ? 'error' as const
      : tier === 'GOLD' ? 'warning' as const
      : tier === 'SILVER' ? 'info' as const
      : 'default' as const;

  return (
    <Card variant="outlined" sx={{ mb: 1, p: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
        <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>
          {doc.title || doc.document_guid}
        </Typography>
        {doc.impact_tier && (
          <Chip
            label={`${doc.impact_tier.charAt(0)}${doc.impact_tier.slice(1).toLowerCase()}${doc.impact_score != null ? ` ${doc.impact_score}` : ''}`}
            size="small"
            color={tierColor(doc.impact_tier)}
            sx={{ fontWeight: 600, fontSize: '0.7rem', height: 22 }}
          />
        )}
        {doc.score != null && (
          <Typography variant="caption" color="text.disabled">
            score {doc.score.toFixed(2)}
          </Typography>
        )}
      </Box>
      {doc.content_snippet && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
          {doc.content_snippet.length > 300
            ? doc.content_snippet.slice(0, 300) + '...'
            : doc.content_snippet}
        </Typography>
      )}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {doc.source_name && (
          <Typography variant="caption" color="text.disabled">
            {doc.source_name}
          </Typography>
        )}
        {doc.language && (
          <Typography variant="caption" color="text.disabled">
            {doc.language.toUpperCase()}
          </Typography>
        )}
        {doc.created_at && (
          <Typography variant="caption" color="text.disabled">
            {new Date(doc.created_at).toLocaleDateString()}
          </Typography>
        )}
      </Box>
    </Card>
  );
}

/** Query tab content -- extracted to keep GofrIQIngest complexity under the gate. */
function QueryTab({
  tokens,
  selectedTokenIndex,
  setSelectedTokenIndex,
  selectedToken,
}: {
  tokens: JwtToken[];
  selectedTokenIndex: number;
  setSelectedTokenIndex: (v: number) => void;
  selectedToken: JwtToken | null;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchNResults, setSearchNResults] = useState(10);
  const [searchLanguage, setSearchLanguage] = useState('all');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<QueryDocumentsResponse | null>(null);

  const handleSearch = async () => {
    if (!selectedToken?.token || !searchQuery.trim()) return;
    setSearching(true);
    setSearchError(null);
    setSearchResults(null);
    try {
      const langs = searchLanguage === 'all' ? undefined : [searchLanguage];
      const res = await api.queryDocuments(
        selectedToken.token,
        searchQuery.trim(),
        searchNResults,
        langs,
      );
      setSearchResults(res);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Search documents in the GOFR-IQ knowledge graph.
      </Typography>

      <Box sx={{ mb: 3, mt: 2 }}>
        <TokenSelect
          label="Token (Group)"
          tokens={tokens}
          value={selectedTokenIndex}
          onChange={setSelectedTokenIndex}
          allowNone={false}
          noneLabel={tokens.length === 0 ? 'No tokens available' : 'Select token'}
          disabled={tokens.length === 0}
          fullWidth
        />
      </Box>

      <TextField
        fullWidth
        label="Search Query"
        placeholder="e.g. earnings surprises, China tech regulation"
        size="small"
        sx={{ mb: 2 }}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        disabled={!selectedToken}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && selectedToken?.token && searchQuery.trim()) {
            void handleSearch();
          }
        }}
      />

      <Box display="flex" gap={2} mb={3}>
        <TextField
          label="Results"
          type="number"
          size="small"
          value={searchNResults}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (v >= 1 && v <= 100) setSearchNResults(v);
          }}
          slotProps={{ htmlInput: { min: 1, max: 100 } }}
          sx={{ width: 120 }}
          disabled={!selectedToken}
        />
        <FormControl size="small" sx={{ width: 150 }}>
          <InputLabel>Language</InputLabel>
          <Select
            value={searchLanguage}
            label="Language"
            onChange={(e) => setSearchLanguage(e.target.value)}
            disabled={!selectedToken}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="en">English</MenuItem>
            <MenuItem value="zh">Chinese</MenuItem>
            <MenuItem value="ja">Japanese</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <Button
        variant="contained"
        startIcon={searching ? <CircularProgress size={18} /> : <Search />}
        disabled={!selectedToken || !searchQuery.trim() || searching}
        onClick={() => void handleSearch()}
        sx={{ mb: 2 }}
      >
        {searching ? 'Searching...' : 'Search Documents'}
      </Button>

      {searchError && (
        <ToolErrorAlert
          err={searchError}
          fallback="search failed"
          severity="error"
          onClose={() => setSearchError(null)}
        />
      )}

      {searchResults && !searchError && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            {searchResults.total_found ?? searchResults.results.length} result(s) for &quot;{searchResults.query}&quot;
            {searchResults.execution_time_ms != null && ` in ${searchResults.execution_time_ms.toFixed(0)}ms`}
          </Typography>
          {searchResults.results.length === 0 ? (
            <Alert severity="info">No documents matched your query.</Alert>
          ) : (
            searchResults.results.map((doc: QueryDocumentsResult) => (
              <SearchResultCard key={doc.document_guid} doc={doc} />
            ))
          )}
        </Box>
      )}

      {!searchResults && !searchError && !searching && (
        <Alert severity="info" sx={{ mt: 2 }}>
          Enter a query and press Search to find documents.
        </Alert>
      )}
    </Box>
  );
}

export default function GofrIQIngest() {
  const { tokens } = useConfig();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState(0);

  // Token selection (user selects which token/group to use)
  const [selectedTokenIndex, setSelectedTokenIndex] = useState<number>(-1);

  // Sources
  const [sources, setSources] = useState<Source[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedSourceGuid, setSelectedSourceGuid] = useState('');
  const [language, setLanguage] = useState('en');

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<IngestResult | null>(null);

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);

  // Get selected token safely
  const selectedToken: JwtToken | null =
    selectedTokenIndex >= 0 && selectedTokenIndex < tokens.length
      ? tokens.at(selectedTokenIndex) ?? null
      : null;

  // Load sources when token is selected
  const fetchSources = useCallback(async () => {
    if (!selectedToken?.token) {
      setSources([]);
      return;
    }
    setSourcesLoading(true);
    try {
      const data = await api.listSources(selectedToken.token);
      setSources(data.sources || []);
    } catch {
      setSources([]);
      setError('Failed to load sources');
    } finally {
      setSourcesLoading(false);
    }
  }, [selectedToken?.token]);

  useEffect(() => {
    if (selectedToken) {
      fetchSources();
    } else {
      setSources([]);
    }
    // Reset source selection when token changes
    setSelectedSourceGuid('');
  }, [selectedToken, fetchSources]);

  // Handle file read
  const readFile = (file: File) => {
    if (!file.type.startsWith('text/') && !file.name.endsWith('.txt') && !file.name.endsWith('.md')) {
      setError('Please upload a text file (.txt or .md)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setContent(text);
      // Use filename as title if title is empty
      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    };
    reader.onerror = () => {
      setError('Failed to read file');
    };
    reader.readAsText(file);
  };

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      readFile(file);
    }
  };

  // Handle drag events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      readFile(file);
    }
  };

  // Handle paste
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setContent(text);
    } catch {
      setError('Failed to read from clipboard. Please paste directly into the text area.');
    }
  };

  // Submit document
  const handleSubmit = async () => {
    if (!selectedToken?.token) {
      setError('Please select a token');
      return;
    }
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (!content.trim()) {
      setError('Content is required');
      return;
    }
    if (!selectedSourceGuid) {
      setError('Please select a source');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await api.ingestDocument(
        selectedToken.token,
        title.trim(),
        content.trim(),
        selectedSourceGuid,
        language
      );
      setSuccess(result);
      // Clear form
      setTitle('');
      setContent('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to ingest document');
    } finally {
      setSubmitting(false);
    }
  };

  // Clear form
  const handleClear = () => {
    setTitle('');
    setContent('');
    setError(null);
    setSuccess(null);
  };

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <Typography variant="h4">Document Operations</Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Upload research notes and client material, or search the GOFR-IQ knowledge graph.
      </Typography>

      {tokens.length === 0 && (
        <Alert severity="warning" sx={{ mt: 2, mb: 2 }}>
          No tokens configured. Add tokens in Operations to use document operations.
        </Alert>
      )}

      <Card sx={{ mt: 3, maxWidth: 800 }}>
        <Tabs 
          value={activeTab} 
          onChange={(_, newValue) => setActiveTab(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab icon={<CloudUpload />} iconPosition="start" label="Ingest" />
          <Tab icon={<Search />} iconPosition="start" label="Query" />
        </Tabs>

        <CardContent>
          {activeTab === 0 && (
            <Box>
              {/* Ingest Tab Content */}
              {/* Token Selection */}
              <Box sx={{ mb: 3 }}>
                <TokenSelect
                  label="Token (Group)"
                  tokens={tokens}
                  value={selectedTokenIndex}
                  onChange={setSelectedTokenIndex}
                  allowNone={false}
                  noneLabel={tokens.length === 0 ? 'No tokens available' : 'Select token'}
                  disabled={tokens.length === 0}
                  fullWidth
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  Documents will be uploaded to the group associated with this token
                </Typography>
              </Box>

          {/* Source Selection */}
          <FormControl fullWidth size="small" sx={{ mb: 3 }}>
            <InputLabel>Source</InputLabel>
            <Select
              value={selectedSourceGuid}
              label="Source"
              onChange={(e) => setSelectedSourceGuid(e.target.value)}
              disabled={sourcesLoading || !selectedToken}
            >
              {!selectedToken && (
                <MenuItem disabled>Select a token first</MenuItem>
              )}
              {sourcesLoading && (
                <MenuItem disabled>Loading sources...</MenuItem>
              )}
              {!sourcesLoading && selectedToken && sources.length === 0 && (
                <MenuItem disabled>No sources available</MenuItem>
              )}
              {sources.map((source) => (
                <MenuItem key={source.source_guid} value={source.source_guid}>
                  {source.name} ({source.type})
                </MenuItem>
              ))}
            </Select>
            {selectedToken && sources.length === 0 && !sourcesLoading && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                No sources available for this token. Check permissions or add sources.
              </Typography>
            )}
          </FormControl>

          {/* Title */}
          <TextField
            fullWidth
            size="small"
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Document title or headline"
            sx={{ mb: 2 }}
          />

          {/* Language */}
          <FormControl size="small" sx={{ mb: 3, minWidth: 120 }}>
            <InputLabel>Language</InputLabel>
            <Select
              value={language}
              label="Language"
              onChange={(e) => setLanguage(e.target.value)}
            >
              <MenuItem value="en">English</MenuItem>
              <MenuItem value="zh">Chinese</MenuItem>
              <MenuItem value="ja">Japanese</MenuItem>
              <MenuItem value="ko">Korean</MenuItem>
            </Select>
          </FormControl>

          {/* Content area with drag & drop */}
          <Box
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            sx={{
              border: '2px dashed',
              borderColor: isDragging ? 'primary.main' : 'divider',
              borderRadius: 1,
              p: 2,
              mb: 2,
              bgcolor: isDragging ? 'action.hover' : 'transparent',
              transition: 'all 0.2s',
              position: 'relative',
            }}
          >
            <Box display="flex" gap={1} mb={2}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<ContentPaste />}
                onClick={handlePaste}
              >
                Paste from Clipboard
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<CloudUpload />}
                onClick={() => fileInputRef.current?.click()}
              >
                Upload File
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,text/*"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </Box>

            <TextField
              fullWidth
              multiline
              rows={12}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste or type document content here, or drag & drop a text file..."
              variant="outlined"
            />

            {isDragging && (
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'rgba(0,0,0,0.5)',
                  borderRadius: 1,
                  pointerEvents: 'none',
                }}
              >
                <Typography variant="h6" color="primary.main">
                  Drop file here
                </Typography>
              </Box>
            )}
          </Box>

          {/* Character count */}
          <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
            {content.length.toLocaleString()} characters
          </Typography>

          {/* Error */}
          {error && (
            <ToolErrorAlert
              err={error}
              fallback="ingest failed"
              severity="error"
              onClose={() => setError(null)}
            />
          )}

          {/* Actions */}
          <Box display="flex" gap={2}>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={submitting || !selectedToken || !title.trim() || !content.trim() || !selectedSourceGuid}
              startIcon={submitting ? <CircularProgress size={18} /> : undefined}
            >
              {submitting ? 'Uploading...' : 'Upload research note'}
            </Button>
            <Button variant="outlined" onClick={handleClear} disabled={submitting}>
              Clear
            </Button>
          </Box>
            </Box>
          )}

          {activeTab === 1 && (
            <QueryTab
              tokens={tokens}
              selectedTokenIndex={selectedTokenIndex}
              setSelectedTokenIndex={setSelectedTokenIndex}
              selectedToken={selectedToken}
            />
          )}
        </CardContent>
      </Card>

      {/* Success Snackbar */}
      <Snackbar
        open={!!success}
        autoHideDuration={6000}
        onClose={() => setSuccess(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSuccess(null)}
          severity="success"
          icon={<CheckCircle />}
          sx={{ width: '100%' }}
        >
          Document ingested successfully to group: {selectedToken?.groups}
          {success?.embedding_generated && ' • Embeddings generated'}
        </Alert>
      </Snackbar>
    </Box>
  );
}
