export type ToolStatus = 'ready' | 'soon';

export interface ToolDef {
  id: string;
  /** Route path under the hash router, e.g. "merge". */
  path: string;
  title: string;
  /** Short one-liner for cards. */
  blurb: string;
  /** SVG path `d` attribute, rendered by <ToolIcon>. Keeps this module DOM-free. */
  iconPath: string;
  status: ToolStatus;
}

/**
 * The single source of truth for the toolkit's features. The home page,
 * navigation, and router all derive from this list. New tools are added
 * here (see CLAUDE.md → "How to add a new tool").
 */
export const TOOLS: ToolDef[] = [
  {
    id: 'merge',
    path: 'merge',
    title: 'Merge PDFs',
    blurb: 'Combine files and drag to reorder or delete pages.',
    iconPath:
      'M8 3H5a2 2 0 0 0-2 2v3m0 8v3a2 2 0 0 0 2 2h3m8-18h3a2 2 0 0 1 2 2v3m0 8v3a2 2 0 0 1-2 2h-3M9 12h6',
    status: 'ready',
  },
  {
    id: 'split',
    path: 'split',
    title: 'Split PDF',
    blurb: 'Extract page ranges into separate documents.',
    iconPath: 'M14 4l6 6m0-6l-6 6M4 14l6 6m0-6l-6 6',
    status: 'ready',
  },
  {
    id: 'compress',
    path: 'compress',
    title: 'Compress PDF',
    blurb: 'Shrink file size by re-encoding page images.',
    iconPath:
      'M4 9V5a1 1 0 0 1 1-1h4M4 15v4a1 1 0 0 0 1 1h4m11-11V5a1 1 0 0 0-1-1h-4m5 11v4a1 1 0 0 1-1 1h-4',
    status: 'ready',
  },
  {
    id: 'images-to-pdf',
    path: 'images-to-pdf',
    title: 'Images → PDF',
    blurb: 'Turn JPG/PNG images into a single PDF.',
    iconPath: 'M3 16l5-5 4 4 3-3 6 6M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z',
    status: 'ready',
  },
  {
    id: 'pdf-to-png',
    path: 'pdf-to-png',
    title: 'PDF → PNG',
    blurb: 'Export PDF pages as PNG images.',
    iconPath: 'M4 4h11l5 5v11H4V4zM8 13l2 2 3-4 4 5H7l1-3z',
    status: 'ready',
  },
  {
    id: 'rotate',
    path: 'rotate',
    title: 'Rotate pages',
    blurb: 'Rotate any or all pages in 90° steps.',
    iconPath: 'M21 12a9 9 0 1 1-3-6.7M21 3v5h-5',
    status: 'ready',
  },
  {
    id: 'ocr',
    path: 'ocr',
    title: 'OCR (make searchable)',
    blurb: 'Add a searchable text layer to scans, on-device.',
    iconPath:
      'M4 7V5a1 1 0 0 1 1-1h2M4 17v2a1 1 0 0 0 1 1h2m10-16h2a1 1 0 0 1 1 1v2m-3 13h2a1 1 0 0 0 1-1v-2M8 9h8M8 13h5',
    status: 'ready',
  },
];

export const getTool = (path: string): ToolDef | undefined =>
  TOOLS.find((t) => t.path === path);
