// Currency → country code for flag-icons. ISO-4217 currency codes start with the
// 2-letter ISO country code (USD→US, AUD→AU, IDR→ID, EUR→EU…), so the first two
// letters are the flag in almost every case.
export const ccForCurrency = (code: string): string => (code || "").slice(0, 2).toLowerCase();
