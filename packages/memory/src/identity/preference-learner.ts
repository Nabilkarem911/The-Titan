interface LearnedPreference {
  key: string;
  value: string;
  confidence: number;
  evidence: string[];
  learnedAt: Date;
  updatedAt: Date;
}

export class PreferenceLearner {
  private preferences: Map<string, Map<string, LearnedPreference>> = new Map();

  learn(userId: string, messages: string[]): LearnedPreference[] {
    const learned: LearnedPreference[] = [];
    const combined = messages.join(' ');

    const codeStyle = this.detectCodeStyle(combined);
    if (codeStyle) learned.push(this.upsert(userId, 'code_style', codeStyle, combined));

    const verbosity = this.detectVerbosity(messages);
    if (verbosity) learned.push(this.upsert(userId, 'verbosity', verbosity, combined));

    const techLevel = this.detectTechLevel(combined);
    if (techLevel) learned.push(this.upsert(userId, 'tech_level', techLevel, combined));

    const timeZone = this.detectTimePreference(combined);
    if (timeZone) learned.push(this.upsert(userId, 'time_context', timeZone, combined));

    return learned.filter(Boolean);
  }

  getPreferences(userId: string): LearnedPreference[] {
    const userPrefs = this.preferences.get(userId);
    if (!userPrefs) return [];
    return Array.from(userPrefs.values()).filter((p) => p.confidence > 0.4);
  }

  getPreference(userId: string, key: string): LearnedPreference | undefined {
    return this.preferences.get(userId)?.get(key);
  }

  toContextString(userId: string): string {
    const prefs = this.getPreferences(userId);
    if (prefs.length === 0) return '';
    return prefs.map((p) => `${p.key}: ${p.value} (confidence: ${Math.round(p.confidence * 100)}%)`).join('\n');
  }

  private upsert(userId: string, key: string, value: string, evidence: string): LearnedPreference {
    if (!this.preferences.has(userId)) this.preferences.set(userId, new Map());
    const userPrefs = this.preferences.get(userId)!;

    const existing = userPrefs.get(key);
    if (existing) {
      existing.value = value;
      existing.confidence = Math.min(1, existing.confidence + 0.15);
      existing.evidence.push(evidence.slice(0, 100));
      if (existing.evidence.length > 10) existing.evidence.shift();
      existing.updatedAt = new Date();
      return existing;
    }

    const pref: LearnedPreference = {
      key, value, confidence: 0.5,
      evidence: [evidence.slice(0, 100)],
      learnedAt: new Date(), updatedAt: new Date(),
    };
    userPrefs.set(key, pref);
    return pref;
  }

  private detectCodeStyle(text: string): string | null {
    if (text.match(/\b(typescript|ts|tsx)\b/i)) return 'typescript';
    if (text.match(/\b(python|py|django|flask)\b/i)) return 'python';
    if (text.match(/\b(rust|cargo)\b/i)) return 'rust';
    if (text.match(/\b(go|golang)\b/i)) return 'go';
    return null;
  }

  private detectVerbosity(messages: string[]): string | null {
    const avgLength = messages.reduce((s, m) => s + m.length, 0) / messages.length;
    if (avgLength < 30) return 'concise';
    if (avgLength > 200) return 'detailed';
    return null;
  }

  private detectTechLevel(text: string): string | null {
    const advancedTerms = text.match(/\b(kubernetes|terraform|microservices|distributed|concurrency|sharding|replication|grafana|prometheus)\b/gi);
    const beginnerTerms = text.match(/\b(what is|how to|explain|tutorial|beginner|learn)\b/gi);

    if (advancedTerms && advancedTerms.length > 2) return 'advanced';
    if (beginnerTerms && beginnerTerms.length > 2) return 'beginner';
    return null;
  }

  private detectTimePreference(text: string): string | null {
    if (text.match(/\b(cairo|egypt|مصر|القاهرة)\b/i)) return 'Africa/Cairo';
    if (text.match(/\b(riyadh|saudi|السعودية|الرياض)\b/i)) return 'Asia/Riyadh';
    if (text.match(/\b(dubai|uae|الإمارات|دبي)\b/i)) return 'Asia/Dubai';
    return null;
  }
}
