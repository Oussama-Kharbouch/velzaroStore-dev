/**
 * Categories of the colourways in the dashboard: <brand> Homme, <brand> Femme, Unisexe.
 * `gender` is stored per colourway (variants.gender), the brand per model (products.brand).
 * Null gender = not classified yet: nothing is ever classified automatically.
 */
export const GENDERS = ["homme", "femme", "unisexe"] as const;
export type Gender = (typeof GENDERS)[number];
export const isGender = (value: unknown): value is Gender => typeof value === "string" && (GENDERS as readonly string[]).includes(value);

const GENDER_LABELS: Record<Gender, string> = { homme: "Homme", femme: "Femme", unisexe: "Unisexe" };

/** "On Homme", "On Femme", "Unisexe" (brand only in front of a gender), "Non classé". */
export const categoryLabel = (brand: string | null, gender: Gender | null) => {
  if (gender === null) return "Non classé";
  if (gender === "unisexe") return GENDER_LABELS.unisexe;
  return brand ? `${brand} ${GENDER_LABELS[gender]}` : GENDER_LABELS[gender];
};

/** Filter values of the Products page (?categorie=…). */
export const CATEGORY_FILTERS = [...GENDERS, "non-classe"] as const;
export type CategoryFilter = (typeof CATEGORY_FILTERS)[number];
export const isCategoryFilter = (value: unknown): value is CategoryFilter =>
  typeof value === "string" && (CATEGORY_FILTERS as readonly string[]).includes(value);
