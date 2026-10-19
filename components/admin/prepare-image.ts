/**
 * Prepares a photo in the browser before upload: at most 1600 px wide, white
 * background, encoded as WebP (quality 80) by a WebAssembly encoder that works in
 * every browser, Safari and iPhone included. If that encoder cannot run, JPEG
 * (quality 85) from the canvas. The server only checks and stores the result:
 * native image libraries cannot run on Cloudflare Workers.
 */
import { UPLOAD_JPEG_QUALITY, UPLOAD_MAX_WIDTH, UPLOAD_WEBP_QUALITY } from "../../lib/media/rules";

/** Decodes the file: createImageBitmap where available, <img> otherwise. */
const decode = async (file: File): Promise<CanvasImageSource & { width: number; height: number }> => {
  if (typeof createImageBitmap === "function") {
    try { return await createImageBitmap(file); } catch { /* fall back to <img> */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
};

export async function prepareImage(file: File): Promise<{ file: File; format: "webp" | "jpeg" }> {
  let source;
  try {
    source = await decode(file);
  } catch {
    throw new Error("Ce navigateur ne sait pas lire cette image (format HEIC ?). Exportez-la en JPEG ou PNG.");
  }

  const scale = Math.min(1, UPLOAD_MAX_WIDTH / source.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Préparation de l’image impossible dans ce navigateur.");
  // No transparency in the shop: white background, like the existing photos.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  const name = file.name.replace(/\.[^.]+$/, "") || "photo";

  try {
    // Loaded on demand: the WebAssembly encoder is only needed when a photo is added.
    const { encode } = await import("@jsquash/webp");
    const webp = await encode(context.getImageData(0, 0, canvas.width, canvas.height), { quality: UPLOAD_WEBP_QUALITY });
    return { file: new File([webp], `${name}.webp`, { type: "image/webp" }), format: "webp" };
  } catch (error) {
    console.warn("Encodeur WebP indisponible, envoi en JPEG :", error);
  }

  const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", UPLOAD_JPEG_QUALITY));
  if (!jpeg) throw new Error("Préparation de l’image impossible dans ce navigateur.");
  return { file: new File([jpeg], `${name}.jpg`, { type: "image/jpeg" }), format: "jpeg" };
}
