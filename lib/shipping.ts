export function shippingFee(city: string): number | null {
  const normalized = city.trim().toLocaleLowerCase('fr-MA');
  if (normalized.length < 2) return null;
  return normalized === 'casablanca' || normalized === 'الدار البيضاء' ? 25 : 35;
}
