/**
 * The ONLY way results leave the app: a local browser download. There is no
 * network here by design — see CLAUDE.md → "Privacy invariant".
 */
export function downloadBlob(data: Blob | Uint8Array, filename: string): void {
  const blob =
    data instanceof Blob ? data : new Blob([data as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Revoke on the next tick so the click has a chance to start.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

/** Replace a file's extension, e.g. swapExt("scan.pdf", "png") → "scan.png". */
export function swapExt(filename: string, ext: string): string {
  return filename.replace(/\.[^./\\]+$/, '') + '.' + ext;
}

/** Append a suffix before the extension, e.g. addSuffix("a.pdf","-merged"). */
export function addSuffix(filename: string, suffix: string): string {
  const m = filename.match(/^(.*?)(\.[^./\\]+)?$/);
  const base = m?.[1] ?? filename;
  const ext = m?.[2] ?? '';
  return base + suffix + ext;
}
