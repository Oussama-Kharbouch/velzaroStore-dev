import type { Metadata } from "next";
export const metadata: Metadata = {title:"VELZARO.store — Le style à chaque pas",description:"Découvrez la sélection de sneakers VELZARO. Commandez simplement avec paiement à la livraison."};
// Root layout shared by the shop and the dashboard; each group loads its own styles.
// The shop sets lang/dir on <html> before hydration (Arabic by default): no mismatch warning.
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="fr" suppressHydrationWarning><body>{children}</body></html>}
