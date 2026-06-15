export interface TranslateResult {
  originalText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
}

export async function translateText(params: {
  text: string;
  targetLang: string;
  sourceLang?: string;
}): Promise<TranslateResult> {
  const { text, targetLang, sourceLang = 'auto' } = params;

  if (!text) throw new Error('text is required');
  if (!targetLang) throw new Error('targetLang is required');

  const apiKey = process.env['GOOGLE_TRANSLATE_API_KEY'];

  if (apiKey) {
    // Google Translate API
    const body: Record<string, unknown> = { q: text, target: targetLang, format: 'text' };
    if (sourceLang !== 'auto') body['source'] = sourceLang;

    const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json() as {
      data: { translations: Array<{ translatedText: string; detectedSourceLanguage?: string }> };
    };
    const translation = data.data.translations[0];
    return {
      originalText: text,
      translatedText: translation.translatedText,
      sourceLang: translation.detectedSourceLanguage ?? sourceLang,
      targetLang,
    };
  }

  // Free fallback via MyMemory API (no key needed, 5000 chars/day)
  const langPair = sourceLang === 'auto' ? `|${targetLang}` : `${sourceLang}|${targetLang}`;
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langPair}`;
  const res = await fetch(url);
  const data = await res.json() as {
    responseStatus: number;
    responseData: { translatedText: string };
    detectedLanguage?: { language: string };
  };

  if (data.responseStatus !== 200) throw new Error(`Translation failed: status ${data.responseStatus}`);

  return {
    originalText: text,
    translatedText: data.responseData.translatedText,
    sourceLang: data.detectedLanguage?.language ?? sourceLang,
    targetLang,
  };
}
