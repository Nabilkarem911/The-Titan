import { describe, it, expect, beforeEach } from 'vitest';
import { ElevenLabsTTSProvider, autoSelectTTSProvider } from './elevenlabs-tts.js';

describe('ElevenLabsTTSProvider', () => {
  it('should initialize with defaults', () => {
    const provider = new ElevenLabsTTSProvider();
    expect(provider.getProviderName()).toBe('elevenlabs');
    expect(provider.getVoiceId()).toBeDefined();
  });

  it('should not be available without API key', () => {
    const provider = new ElevenLabsTTSProvider();
    expect(provider.isAvailable()).toBe(false);
  });

  it('should be available with API key', () => {
    const provider = new ElevenLabsTTSProvider({ apiKey: 'test-key' });
    expect(provider.isAvailable()).toBe(true);
  });

  it('should set and get voice ID', () => {
    const provider = new ElevenLabsTTSProvider({ apiKey: 'test' });
    provider.setVoiceId('custom-voice');
    expect(provider.getVoiceId()).toBe('custom-voice');
  });

  it('should throw on synthesize without API key', async () => {
    const provider = new ElevenLabsTTSProvider();
    await expect(provider.synthesize('hello')).rejects.toThrow();
  });

  it('should return empty cloned voices initially', () => {
    const provider = new ElevenLabsTTSProvider({ apiKey: 'test' });
    expect(provider.getClonedVoices()).toHaveLength(0);
  });

  it('should auto-select elevenlabs when available', () => {
    const provider = new ElevenLabsTTSProvider({ apiKey: 'test' });
    const selected = autoSelectTTSProvider(provider, true);
    expect(selected).toBe('elevenlabs');
  });

  it('should auto-select openai when elevenlabs unavailable', () => {
    const provider = new ElevenLabsTTSProvider();
    const selected = autoSelectTTSProvider(provider, true);
    expect(selected).toBe('openai');
  });

  it('should prefer elevenlabs with clone when preferClone is true', () => {
    const provider = new ElevenLabsTTSProvider({ apiKey: 'test' });
    // No cloned voices yet, so still elevenlabs (available)
    const selected = autoSelectTTSProvider(provider, true, true);
    expect(selected).toBe('elevenlabs');
  });
});
