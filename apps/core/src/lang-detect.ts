/**
 * Lightweight language detection without extra dependencies.
 * Returns 'ar' if the text contains Arabic script, otherwise 'en'.
 */
export function detectLanguage(text: string): 'ar' | 'en' {
  // Arabic Unicode block: U+0600–U+06FF
  const hasArabic = /[\u0600-\u06FF]/.test(text);
  return hasArabic ? 'ar' : 'en';
}
