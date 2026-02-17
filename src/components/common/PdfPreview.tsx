import { useEffect, useRef, useState } from 'react';
import { Alert, Box, CircularProgress, Typography } from '@mui/material';

// pdfjs-dist types are included in the package.
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist';

// Ensure the worker is bundled by Vite and loaded from the app origin (no external network fetch).
GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

export default function PdfPreview({
  pdfData,
  title = 'PDF preview',
}: {
  pdfData: ArrayBuffer | Uint8Array | null;
  title?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);

  useEffect(() => {
    let destroyed = false;
    let doc: PDFDocumentProxy | null = null;
    const canvas = canvasRef.current;

    const run = async () => {
      if (!pdfData) return;
      if (!canvas) return;

      setLoading(true);
      setErr(null);
      setPageCount(null);

      try {
        const loadingTask = getDocument({ data: pdfData });
        doc = await loadingTask.promise;
        if (destroyed) return;

        setPageCount(doc.numPages);
        const page = await doc.getPage(1);
        if (destroyed) return;

        const viewport = page.getViewport({ scale: 1.2 });
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas 2D context unavailable');

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);

        await page.render({ canvasContext: context, viewport }).promise;
      } catch (e) {
        if (destroyed) return;
        setErr(e instanceof Error ? e.message : 'Failed to render PDF');
      } finally {
        if (!destroyed) setLoading(false);
      }
    };

    void run();

    return () => {
      destroyed = true;
      try {
        void doc?.destroy();
      } catch {
        // ignore
      }
    };
  }, [pdfData]);

  if (!pdfData) return null;

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="subtitle2" gutterBottom>
        {title}
        {pageCount != null ? ` (pages: ${pageCount})` : ''}
      </Typography>
      {loading ? (
        <Box display="flex" alignItems="center" gap={1}>
          <CircularProgress size={16} />
          <Typography variant="body2" color="text.secondary">
            Rendering…
          </Typography>
        </Box>
      ) : null}
      {err ? (
        <Alert severity="error" sx={{ mt: 1 }}>
          {err}
        </Alert>
      ) : null}
      <Box sx={{ mt: 1, overflowX: 'auto', bgcolor: 'background.paper', borderRadius: 1, p: 1, border: '1px solid', borderColor: 'divider' }}>
        <canvas ref={canvasRef} style={{ maxWidth: '100%', height: 'auto' }} />
      </Box>
    </Box>
  );
}
