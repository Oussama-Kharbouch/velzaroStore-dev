/**
 * Prepares a photo in the browser before upload: at most 1600 px wide, white
 * background, encoded as WebP (quality 80) by a WebAssembly encoder that works in
 * every browser, Safari and iPhone included. If that encoder cannot run, JPEG
 * (quality 85) from the canvas. The server only checks and stores the result:
 * native image libraries cannot run on Cloudflare Workers.
 */
import {
  UPLOAD_JPEG_QUALITY, UPLOAD_MAX_WIDTH, UPLOAD_WEBP_QUALITY,
  VIGNETTE_INPUT_TYPES, VIGNETTE_MAX_BYTES, VIGNETTE_SIZE, humanSize,
} from "../../lib/media/rules";

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

/**
 * Colourway thumbnail: square 150×150 WebP, the product whole and centred, with no added background:
 * a transparent image (PNG/WebP) stays transparent; an opaque photo is extended with its own
 * background colour (taken from its corners), so that no band of another colour appears.
 * Only JPG, PNG and WebP up to 5 MB; a clear message otherwise.
 */
export async function prepareVignette(file: File): Promise<File> {
  if (!VIGNETTE_INPUT_TYPES.includes(file.type)) throw new Error("Vignette : formats acceptés JPG, PNG ou WebP.");
  if (file.size > VIGNETTE_MAX_BYTES) throw new Error(`Vignette trop lourde (${humanSize(file.size)}) : 5 Mo maximum.`);
  let source;
  try {
    source = await decode(file);
  } catch {
    throw new Error("Ce navigateur ne sait pas lire cette image. Exportez-la en JPEG ou PNG.");
  }

  // Background of the photo: average of its four corners; none at all for a transparent image.
  const probe = document.createElement("canvas");
  probe.width = source.width; probe.height = source.height;
  const probeContext = probe.getContext("2d", { willReadFrequently: true });
  if (!probeContext) throw new Error("Préparation de la vignette impossible dans ce navigateur.");
  probeContext.drawImage(source, 0, 0);
  const corners = [[1, 1], [source.width - 2, 1], [1, source.height - 2], [source.width - 2, source.height - 2]]
    .map(([x, y]) => probeContext.getImageData(Math.max(0, x), Math.max(0, y), 1, 1).data);
  const opaque = corners.every((c) => c[3] > 200);
  const average = (i: number) => Math.round(corners.reduce((sum, c) => sum + c[i], 0) / corners.length);
  const background = opaque ? `rgb(${average(0)}, ${average(1)}, ${average(2)})` : null;

  const canvas = document.createElement("canvas");
  canvas.width = VIGNETTE_SIZE; canvas.height = VIGNETTE_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Préparation de la vignette impossible dans ce navigateur.");
  if (background) {
    context.fillStyle = background;
    context.fillRect(0, 0, VIGNETTE_SIZE, VIGNETTE_SIZE);
  }
  // Whole product, centred, with a small margin.
  const margin = 8;
  const scale = Math.min((VIGNETTE_SIZE - 2 * margin) / source.width, (VIGNETTE_SIZE - 2 * margin) / source.height);
  const width = source.width * scale, height = source.height * scale;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, (VIGNETTE_SIZE - width) / 2, (VIGNETTE_SIZE - height) / 2, width, height);

  try {
    const { encode } = await import("@jsquash/webp");
    const webp = await encode(context.getImageData(0, 0, VIGNETTE_SIZE, VIGNETTE_SIZE), { quality: 85 });
    return new File([webp], "vignette.webp", { type: "image/webp" });
  } catch (error) {
    console.warn("Encodeur WebP indisponible pour la vignette :", error);
    throw new Error("Ce navigateur ne sait pas créer la vignette en WebP. Essayez avec Chrome ou Safari à jour.");
  }
}
