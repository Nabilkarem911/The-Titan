import { getLogger } from '@titan/logging';
import type { MemoryLayer, MemoryEntry, UserPreference } from './types.js';

const log = getLogger().child({ component: 'user-memory' });

export class UserMemory implements MemoryLayer {
  name = 'user';
  private entries: Map<string, MemoryEntry> = new Map();
  private preferences: Map<string, UserPreference> = new Map();

  async store(entry: MemoryEntry): Promise<void> {
    this.entries.set(entry.id, { ...entry, type: 'user' });
  }

  setPreference(pref: UserPreference): void {
    const existing = this.preferences.get(pref.key);
    if (existing) {
      existing.value = pref.value;
      existing.confidence = Math.min(1, existing.confidence + 0.1);
      existing.updatedAt = new Date();
    } else {
      this.preferences.set(pref.key, { ...pref });
    }
    log.debug({ key: pref.key, category: pref.category }, 'user preference set');
  }

  getPreference(key: string): UserPreference | undefined {
    return this.preferences.get(key);
  }

  getPreferencesByCategory(category: UserPreference['category']): UserPreference[] {
    return Array.from(this.preferences.values()).filter((p) => p.category === category);
  }

  getAllPreferences(): UserPreference[] {
    return Array.from(this.preferences.values());
  }

  removePreference(key: string): void {
    this.preferences.delete(key);
  }

  buildContextString(): string {
    const prefs = Array.from(this.preferences.values());
    if (prefs.length === 0) return '';

    const grouped = new Map<string, UserPreference[]>();
    for (const p of prefs) {
      const group = grouped.get(p.category) ?? [];
      group.push(p);
      grouped.set(p.category, group);
    }

    const parts: string[] = [];
    for (const [category, items] of grouped) {
      const lines = items.map((p) => `${p.key}: ${p.value}`);
      parts.push(`[${category}]\n${lines.join('\n')}`);
    }

    return parts.join('\n\n');
  }

  inferPreferencesFromMessage(message: string): UserPreference[] {
    const inferred: UserPreference[] = [];
    const lower = message.toLowerCase();

    if (lower.match(/(بالعربي|عربي|مصري|\begyptian\b)/)) {
      inferred.push({ key: 'language', value: 'arabic-egyptian', category: 'language', confidence: 0.8, updatedAt: new Date() });
    }
    if (lower.match(/(\benglish\b|بالإنجليزي|انجليزي)/)) {
      inferred.push({ key: 'language', value: 'english', category: 'language', confidence: 0.8, updatedAt: new Date() });
    }
    if (lower.match(/(\bshort\b|\bbrief\b|مختصر|باختصار)/)) {
      inferred.push({ key: 'response_length', value: 'short', category: 'format', confidence: 0.7, updatedAt: new Date() });
    }
    if (lower.match(/(\bdetail\b|\bdetailed\b|فصّل|بالتفصيل)/)) {
      inferred.push({ key: 'response_length', value: 'detailed', category: 'format', confidence: 0.7, updatedAt: new Date() });
    }
    if (lower.match(/(\bformal\b|رسمي)/)) {
      inferred.push({ key: 'tone', value: 'formal', category: 'tone', confidence: 0.7, updatedAt: new Date() });
    }
    if (lower.match(/(\bcasual\b|عادي|طبيعي)/)) {
      inferred.push({ key: 'tone', value: 'casual', category: 'tone', confidence: 0.7, updatedAt: new Date() });
    }

    for (const pref of inferred) {
      this.setPreference(pref);
    }

    return inferred;
  }

  async retrieve(query: string, limit = 5): Promise<MemoryEntry[]> {
    return Array.from(this.entries.values())
      .sort((a, b) => b.importance - a.importance)
      .slice(0, limit);
  }

  async remove(id: string): Promise<void> {
    this.entries.delete(id);
  }

  async list(limit = 20): Promise<MemoryEntry[]> {
    return Array.from(this.entries.values()).slice(0, limit);
  }

  size(): number {
    return this.entries.size + this.preferences.size;
  }

  clear(): void {
    this.entries.clear();
    this.preferences.clear();
  }
}
