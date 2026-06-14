/**
 * Xeno CRM — Shared Format Utilities
 * All monetary and count display helpers.
 * Every value displayed in the UI must flow through these functions — never hardcoded.
 */

/**
 * Format a raw rupee value into compact Indian notation.
 * e.g. 353000000 → "₹35.3 Cr"
 *      4200000   → "₹42.0 L"
 *      85000     → "₹85,000"
 */
export function formatCompactCurrency(value: number): string {
  if (!isFinite(value) || isNaN(value)) return '₹0';
  if (value >= 10_000_000) return `₹${(value / 10_000_000).toFixed(1)} Cr`;
  if (value >= 100_000)   return `₹${(value / 100_000).toFixed(1)} L`;
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

/**
 * Format a raw rupee value into full Indian-locale notation with commas.
 * e.g. 353000000 → "₹35,30,00,000"
 *      4200000   → "₹42,00,000"
 */
export function formatIndianCurrency(value: number): string {
  if (!isFinite(value) || isNaN(value)) return '₹0';
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

/**
 * Format a large count into compact notation.
 * e.g. 51867 → "51.9K"
 *      1200  → "1.2K"
 *      850   → "850"
 */
export function formatCompactNumber(value: number): string {
  if (!isFinite(value) || isNaN(value)) return '0';
  if (value >= 10_000_000) return `${(value / 10_000_000).toFixed(1)}Cr`;
  if (value >= 100_000)    return `${(value / 100_000).toFixed(1)}L`;
  if (value >= 1_000)      return `${(value / 1_000).toFixed(1)}K`;
  return Math.round(value).toLocaleString('en-IN');
}

/**
 * Format a count into full locale-formatted notation.
 * e.g. 51867 → "51,867"
 *      10005 → "10,005"
 */
export function formatFullNumber(value: number): string {
  if (!isFinite(value) || isNaN(value)) return '0';
  return Math.round(value).toLocaleString('en-IN');
}

/**
 * Format a ratio as a multiplier.
 * e.g. 3.4 → "3.4×"
 *      campRoi/100 when roi is stored as percent
 */
export function formatMultiplier(value: number): string {
  if (!isFinite(value) || isNaN(value)) return '0×';
  return `${value.toFixed(1)}×`;
}

/**
 * Format a percentage value.
 * e.g. 82.0 → "82.0%"
 */
export function formatPercent(value: number, decimals = 1): string {
  if (!isFinite(value) || isNaN(value)) return '0%';
  return `${value.toFixed(decimals)}%`;
}

/**
 * Derive month-over-month growth percentage from an array of revenue data points.
 * Returns null when there are fewer than 2 data points.
 */
export function calcMoMGrowth(values: number[]): number | null {
  if (values.length < 2) return null;
  const prev = values[values.length - 2];
  const curr = values[values.length - 1];
  if (!prev || prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}

/**
 * Derive YoY or period growth as a formatted string.
 * e.g. calcMoMGrowth([28.1, 30.6, 33.2, 35.3]) → "+6.3%"
 */
export function formatGrowth(values: number[]): string {
  const g = calcMoMGrowth(values);
  if (g === null) return 'N/A';
  const sign = g >= 0 ? '+' : '';
  return `${sign}${g.toFixed(1)}%`;
}

/**
 * Extract the top city name from a city distribution array.
 * Returns an empty string when no data is available.
 */
export function getTopCity(cityDistribution: { city: string; count: number }[]): string {
  if (!cityDistribution || cityDistribution.length === 0) return '—';
  return [...cityDistribution].sort((a, b) => b.count - a.count)[0].city;
}

/**
 * Get the best-performing channel name from a channel performance array.
 */
export function getBestChannel(
  channels: { channel: string; ctr: number }[]
): string {
  if (!channels || channels.length === 0) return '—';
  const best = [...channels].sort((a, b) => b.ctr - a.ctr)[0];
  const name = best.channel;
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}
