/**
 * Image upload utility / 图片上传工具
 *
 * Turns a user-picked image file into a small compressed data URL suitable for
 * storing inline on a wish record (localStorage-friendly, same place svg_data lives).
 * We resize down to a max dimension and re-encode as JPEG so a phone photo of a
 * hand drawing shrinks from several MB to a few dozen KB.
 *
 * 把用户选的图片压成一段小 data URL，直接挂在愿望记录上（和 svg_data 一样存本地）。
 */

const DEFAULT_MAX_DIM = 960; // px on the longest edge — crisp at the largest display size
const DEFAULT_QUALITY = 0.82;

export class ImageUploadError extends Error {}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new ImageUploadError('decode-failed'));
    img.src = src;
  });
}

/**
 * Read an image File, downscale to maxDim on its longest edge, and return a
 * compressed JPEG data URL. Rejects with ImageUploadError on non-images or
 * decode failure.
 */
export async function fileToCompressedDataUrl(
  file: File,
  maxDim: number = DEFAULT_MAX_DIM,
  quality: number = DEFAULT_QUALITY
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new ImageUploadError('not-an-image');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const { width, height } = img;
    if (!width || !height) throw new ImageUploadError('empty-image');

    const scale = Math.min(1, maxDim / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new ImageUploadError('no-canvas-context');

    // Paint a paper-white base first so transparent PNGs don't turn black under
    // JPEG, and so the multiply blend in WishVisualization reads as ink-on-paper.
    ctx.fillStyle = '#faf9f7';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
