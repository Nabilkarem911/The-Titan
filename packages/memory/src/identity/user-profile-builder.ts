import { getLogger } from '@titan/logging';

const log = getLogger().child({ component: 'user-profile' });

export interface UserProfile {
  userId: string;
  name?: string;
  preferredLanguage?: string;
  preferredTone?: string;
  expertise: string[];
  interests: string[];
  projects: string[];
  communicationStyle: 'concise' | 'detailed' | 'balanced';
  relationship: 'new' | 'familiar' | 'close';
  totalInteractions: number;
  lastInteraction?: Date;
  facts: Map<string, { value: string; confidence: number; source: string }>;
}

export class UserProfileBuilder {
  private profiles: Map<string, UserProfile> = new Map();

  getOrCreate(userId: string): UserProfile {
    let profile = this.profiles.get(userId);
    if (!profile) {
      profile = {
        userId,
        expertise: [],
        interests: [],
        projects: [],
        communicationStyle: 'balanced',
        relationship: 'new',
        totalInteractions: 0,
        facts: new Map(),
      };
      this.profiles.set(userId, profile);
    }
    return profile;
  }

  recordInteraction(userId: string, message: string): void {
    const profile = this.getOrCreate(userId);
    profile.totalInteractions++;
    profile.lastInteraction = new Date();

    if (profile.totalInteractions > 20) profile.relationship = 'close';
    else if (profile.totalInteractions > 5) profile.relationship = 'familiar';

    this.inferFromMessage(profile, message);
  }

  learnFact(userId: string, key: string, value: string, confidence = 0.7, source = 'inferred'): void {
    const profile = this.getOrCreate(userId);
    const existing = profile.facts.get(key);

    if (existing) {
      existing.value = value;
      existing.confidence = Math.min(1, existing.confidence + 0.1);
    } else {
      profile.facts.set(key, { value, confidence, source });
    }
  }

  getContextString(userId: string): string {
    const profile = this.profiles.get(userId);
    if (!profile) return '';

    const parts: string[] = [];
    if (profile.name) parts.push(`Name: ${profile.name}`);
    if (profile.preferredLanguage) parts.push(`Language: ${profile.preferredLanguage}`);
    if (profile.preferredTone) parts.push(`Tone: ${profile.preferredTone}`);
    if (profile.expertise.length) parts.push(`Expertise: ${profile.expertise.join(', ')}`);
    if (profile.projects.length) parts.push(`Projects: ${profile.projects.join(', ')}`);
    parts.push(`Relationship: ${profile.relationship} (${profile.totalInteractions} interactions)`);
    parts.push(`Style: ${profile.communicationStyle}`);

    const facts = Array.from(profile.facts.entries())
      .filter(([, v]) => v.confidence > 0.5)
      .map(([k, v]) => `${k}: ${v.value}`);
    if (facts.length) parts.push(`Known: ${facts.join(', ')}`);

    return parts.join('\n');
  }

  private inferFromMessage(profile: UserProfile, message: string): void {
    const lower = message.toLowerCase();

    if (lower.match(/(بالعربي|عربي|مصري|يا هندسه|يا حب)/)) {
      profile.preferredLanguage = 'arabic-egyptian';
    } else if (lower.match(/(شلونك|يا خوي)/)) {
      profile.preferredLanguage = 'arabic-gulf';
    } else if (lower.match(/^[a-zA-Z\s]+$/) && message.length > 10) {
      profile.preferredLanguage = profile.preferredLanguage ?? 'english';
    }

    if (lower.match(/(deploy|docker|kubernetes|ci\/cd|devops|server)/)) {
      this.addUnique(profile.expertise, 'devops');
    }
    if (lower.match(/(react|vue|angular|frontend|css|html|component)/)) {
      this.addUnique(profile.expertise, 'frontend');
    }
    if (lower.match(/(api|backend|database|sql|fastify|express|node)/)) {
      this.addUnique(profile.expertise, 'backend');
    }
    if (lower.match(/(python|ml|ai|model|training|dataset)/)) {
      this.addUnique(profile.expertise, 'ml');
    }

    if (lower.match(/(باختصار|short|brief|مختصر)/)) {
      profile.communicationStyle = 'concise';
    }
    if (lower.match(/(بالتفصيل|detail|explain|اشرح)/)) {
      profile.communicationStyle = 'detailed';
    }
  }

  private addUnique(arr: string[], item: string): void {
    if (!arr.includes(item)) arr.push(item);
  }
}
