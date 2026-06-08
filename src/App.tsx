import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import ToolPlaceholder from './pages/ToolPlaceholder';
import Spinner from './components/Spinner';

// Tools are code-split so each heavy library (pdf-lib, pdf.js, tesseract.js)
// loads only when its tool is opened — keeping the initial bundle small.
const MergeTool = lazy(() => import('./tools/merge/MergeTool'));
const SplitTool = lazy(() => import('./tools/split/SplitTool'));
const CompressTool = lazy(() => import('./tools/compress/CompressTool'));
const RotateTool = lazy(() => import('./tools/rotate/RotateTool'));
const ImagesToPdfTool = lazy(() => import('./tools/images/ImagesToPdfTool'));
const PdfToPngTool = lazy(() => import('./tools/pdftopng/PdfToPngTool'));
const OcrTool = lazy(() => import('./tools/ocr/OcrTool'));

function ToolFallback() {
  return (
    <div className="flex items-center justify-center py-20 text-brand-700">
      <Spinner className="h-6 w-6" />
      <span className="ml-2 text-sm text-slate-600">Loading tool…</span>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route
          path="merge"
          element={
            <Suspense fallback={<ToolFallback />}>
              <MergeTool />
            </Suspense>
          }
        />
        <Route
          path="split"
          element={
            <Suspense fallback={<ToolFallback />}>
              <SplitTool />
            </Suspense>
          }
        />
        <Route
          path="compress"
          element={
            <Suspense fallback={<ToolFallback />}>
              <CompressTool />
            </Suspense>
          }
        />
        <Route
          path="rotate"
          element={
            <Suspense fallback={<ToolFallback />}>
              <RotateTool />
            </Suspense>
          }
        />
        <Route
          path="images-to-pdf"
          element={
            <Suspense fallback={<ToolFallback />}>
              <ImagesToPdfTool />
            </Suspense>
          }
        />
        <Route
          path="pdf-to-png"
          element={
            <Suspense fallback={<ToolFallback />}>
              <PdfToPngTool />
            </Suspense>
          }
        />
        <Route
          path="ocr"
          element={
            <Suspense fallback={<ToolFallback />}>
              <OcrTool />
            </Suspense>
          }
        />
        {/* Unknown tool path → friendly not-found. */}
        <Route path=":tool" element={<ToolPlaceholder />} />
      </Route>
    </Routes>
  );
}
