import { describe, it, expect } from 'vitest';
import { detectLanguage } from './lang-detect.js';

describe('detectLanguage', () => {
  it('detects Arabic text correctly', () => {
    expect(detectLanguage('مرحبا كيف حالك')).toBe('ar');
    expect(detectLanguage('أنا تايتن')).toBe('ar');
  });

  it('detects English text correctly', () => {
    expect(detectLanguage('Hello, how are you?')).toBe('en');
    expect(detectLanguage('This is a test sentence.')).toBe('en');
  });

  it('handles mixed text (Arabic + English) as Arabic', () => {
    expect(detectLanguage('Hello مرحبا')).toBe('ar');
    expect(detectLanguage('The word سلام means peace')).toBe('ar');
  });

  it('handles empty string as English (no Arabic detected)', () => {
    expect(detectLanguage('')).toBe('en');
  });

  it('handles text with numbers/emojis only as English (no Arabic detected)', () => {
    expect(detectLanguage('12345')).toBe('en');
    expect(detectLanguage('🎉🔥💯')).toBe('en');
    expect(detectLanguage('123 🎉 !!!')).toBe('en');
  });
});
