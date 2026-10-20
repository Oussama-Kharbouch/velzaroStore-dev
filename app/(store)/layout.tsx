import "./globals.css";
import MetaPixel from "../../components/meta-pixel";

// Shop styles and the Meta Pixel stay inside this group: the dashboard (app/admin) never loads them.
export default function StoreLayout({children}:{children:React.ReactNode}){return <>{children}<MetaPixel/></>}
