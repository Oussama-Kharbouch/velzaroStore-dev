/**
 * Selling copy of the product page, per model (products.slug). The name, price, photos,
 * colourways and sizes always come from the catalogue; only the wording lives here.
 *
 * Only facts visible on the photos or already stated in the shop are written here (mesh upper,
 * sculpted sole…): no technology, material or health claim that has not been checked.
 * A model missing from this list gets the neutral wording (DEFAULT_CONTENT).
 */
type Text = { ar: string; fr: string };

export type ProductContent = {
  /** Title instead of the model name from the catalogue; null keeps the catalogue name. */
  title: Text | null;
  tagline: Text;
  description: Text | null;
  /** "Why you will like it" section (4 photo cards): only for models whose features are checked. */
  comfort: boolean;
};

const SNEAKER_DESCRIPTION: Text = {
  ar: "سبرديلة خفيفة بتصميم عصري، كتكمّل اللوك ديالك فالخدمة، فالخرجات وفالمشي اليومي.",
  fr: "Un style moderne, pensé pour accompagner vos déplacements quotidiens.",
};
const TAGLINE: Text = { ar: "راحة وأناقة فكل خطوة.", fr: "Confort et élégance à chaque pas." };

export const DEFAULT_CONTENT: ProductContent = { title: null, tagline: TAGLINE, description: null, comfort: false };

const CONTENT: Record<string, ProductContent> = {
  // Display name asked by the shop owner for the Cloudtilt model.
  cloudtilt: { title: { ar: "Cloudtlite — Original", fr: "Cloudtlite — Original" }, tagline: TAGLINE, description: SNEAKER_DESCRIPTION, comfort: true },
  "cloudsurfer-max": { title: null, tagline: TAGLINE, description: SNEAKER_DESCRIPTION, comfort: true },
  "more-trail-v3": { title: null, tagline: TAGLINE, description: SNEAKER_DESCRIPTION, comfort: false },
};

export const productContent = (modelSlug: string): ProductContent => CONTENT[modelSlug] ?? DEFAULT_CONTENT;
