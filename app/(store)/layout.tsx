import "./globals.css";
import "./product-conversion.css";
import "./shop-design.css";
import MetaPixel from "../../components/meta-pixel";
import { shopLang } from "../../lib/shop-lang";

// Shop styles and the Meta Pixel stay inside this group: the dashboard (app/admin) never loads them.
// The page language and direction are set before anything is painted (Arabic, right to left, by
// default), so the shop never flashes in French or left to right.
export default async function StoreLayout({children}:{children:React.ReactNode}){
  const lang = await shopLang();
  return <><script dangerouslySetInnerHTML={{__html:`document.documentElement.lang="${lang}";document.documentElement.dir="${lang === "ar" ? "rtl" : "ltr"}";`}}/>{children}<MetaPixel/></>;
}
