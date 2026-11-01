/**
 * "Why you will like it" section of the product page, per colourway: title, and photo cards with a
 * title and a short text in Arabic and French. Written in the dashboard (colourway page, under its
 * photos; stored in variants.comfort); a colourway never edited keeps the built-in wording of its
 * model (lib/product-content.ts).
 *
 * A card shows one photo of the colourway (its number in the gallery); when the same cards are
 * copied to every colourway of a model, each one shows its own photo of that number.
 */
export type Bilingual = { ar: string; fr: string };

/** Framing of a card photo: whole photo, slight zoom, or close-up on the upper (mesh). */
export const COMFORT_ZOOMS = ["none", "sole", "mesh"] as const;
export type ComfortZoom = (typeof COMFORT_ZOOMS)[number];
export const COMFORT_ZOOM_LABELS: Record<ComfortZoom, string> = { none: "Photo entière", sole: "Léger zoom", mesh: "Gros plan" };

export type ComfortCard = { photo: number; zoom: ComfortZoom; title: Bilingual; text: Bilingual };
export type ComfortContent = { enabled: boolean; title: Bilingual; cards: ComfortCard[] };

export const COMFORT_CARDS_MAX = 6;
export const COMFORT_PHOTO_MAX = 10;

/** Built-in wording (first version of the section): photos 4, 2, 3 and 1 of the gallery. */
export const DEFAULT_COMFORT: ComfortContent = {
  enabled: true,
  title: { ar: "علاش غادي تعجبك هاد السبرديلة؟", fr: "Pourquoi vous allez l’adorer ?" },
  cards: [
    { photo: 4, zoom: "sole", title: { ar: "راحة فالمشي", fr: "Confort de marche" }, text: { ar: "تصميم النعل البارز كيعطي للسبرديلة مظهر عصري مناسب للمشي اليومي.", fr: "Une semelle au profil sculpté, au look moderne, pour la marche au quotidien." } },
    { photo: 2, zoom: "mesh", title: { ar: "قماش خفيف ومهوّي", fr: "Tissu léger et aéré" }, text: { ar: "النسيج الشبكي Mesh كيساعد على التهوية وكيعطي إحساس بالخفة.", fr: "La maille (mesh) aide à l’aération et donne une sensation de légèreté." } },
    { photo: 3, zoom: "none", title: { ar: "سهلة فاللبسة", fr: "Facile à porter" }, text: { ar: "تصميم عملي وتفاصيل مدروسة للاستعمال اليومي.", fr: "Un design pratique et des finitions soignées pour tous les jours." } },
    { photo: 1, zoom: "none", title: { ar: "ستايل عصري", fr: "Style moderne" }, text: { ar: "كتجي مع الجينز واللوك الكاجوال والسبور.", fr: "S’associe au jean et aux tenues casual ou sport." } },
  ],
};

/** Content shown for a model: the one saved in the dashboard, else the built-in one (on or off). */
export const resolveComfort = (saved: ComfortContent | null, builtInOn: boolean): ComfortContent =>
  saved ?? { ...DEFAULT_COMFORT, enabled: builtInOn };

/** Text in the visitor's language, or the other language when that one was left empty. */
export const inLang = (text: Bilingual, lang: "ar" | "fr") => text[lang].trim() || text[lang === "ar" ? "fr" : "ar"].trim();
