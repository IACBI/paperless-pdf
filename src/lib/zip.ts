import JSZip from 'jszip';

export interface ZipEntry {
  name: string;
  data: Uint8Array | Blob;
}

/** Bundle several files into a single ZIP blob, entirely in-browser. */
export async function zipFiles(entries: ZipEntry[]): Promise<Blob> {
  const zip = new JSZip();
  for (const { name, data } of entries) {
    zip.file(name, data);
  }
  return zip.generateAsync({ type: 'blob' });
}
