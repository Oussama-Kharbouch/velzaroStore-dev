/**
 * Language of the shop: Arabic by default, French when the visitor chose it (FR / العربية switch).
 * The choice is kept in a cookie so that the server renders the page directly in the right
 * language and direction (no French flash, no left-to-right flash).
 */
import "server-only";
import { cookies } from "next/headers";

export type ShopLang = "fr" | "ar";

/** Same name as the localStorage key used by the shop (app/(store)/store.tsx). */
export const LANG_COOKIE = "vz-language";

export async function shopLang(): Promise<ShopLang> {
  return (await cookies()).get(LANG_COOKIE)?.value === "fr" ? "fr" : "ar";
}
