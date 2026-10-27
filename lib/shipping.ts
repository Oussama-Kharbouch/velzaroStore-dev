/** Livraison gratuite partout au Maroc. Renvoie null tant que la ville n'est pas saisie. */
export function shippingFee(city: string): number | null {
  const normalized = city.trim().toLocaleLowerCase('fr-MA');
  if (normalized.length < 2) return null;
  return 0;
}
