/**
 * Shrink a photo in the browser before upload. Phone photos are often 3–8 MB; the API (and Vercel's
 * 4.5 MB request limit) only needs ~1280 px for the AI and a small thumbnail for scan history.
 */
export async function resizeImage(file: Blob, maxDim: number, quality = 0.8): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Photo khul nahi payi'));
      i.src = url;
    });
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not available');
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** One photo -> an upload copy for the AI and a thumbnail to keep in scan history. */
export async function preparePhoto(file: Blob): Promise<{ upload: string; thumbnail: string }> {
  const [upload, thumbnail] = await Promise.all([resizeImage(file, 1280, 0.82), resizeImage(file, 320, 0.7)]);
  return { upload, thumbnail };
}
