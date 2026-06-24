/**
 * Lightweight language detection without extra dependencies.
 * Returns 'ar' if the text contains Arabic script, otherwise 'en'.
 * Also checks for explicit language requests (e.g. "respond in French", "رد بالفرنسية").
 */
export function detectLanguage(text: string): 'ar' | 'en' {
  // 1. Check for explicit language requests first
  const lower = text.toLowerCase();

  // Explicit Arabic requests
  if (lower.match(/\b(respond|reply|answer|write)\s+in\s+arabic\b/) ||
      lower.match(/(رد|جاوب|اكتب)\s*(بـ?|بالـ?)?(العربي|اللغة العربية|عربي)/) ||
      lower.match(/\b(in\s+arabic|بالعربي|بالعربية)\b/)) {
    return 'ar';
  }

  // Explicit English requests
  if (lower.match(/\b(respond|reply|answer|write)\s+in\s+english\b/) ||
      lower.match(/(رد|جاوب|اكتب)\s*(بـ?|بالـ?)?(الإنجليزي|الانجليزي|english|اللغة الإنجليزية)/) ||
      lower.match(/\b(in\s+english|بالإنجليزي|بالانجليزي)\b/)) {
    return 'en';
  }

  // 2. Fall back to script detection
  // Arabic Unicode block: U+0600–U+06FF
  const hasArabic = /[\u0600-\u06FF]/.test(text);
  return hasArabic ? 'ar' : 'en';
}
