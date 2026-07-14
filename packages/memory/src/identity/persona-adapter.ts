import { getLogger } from '@titan/logging';
import type { UserProfile } from './user-profile-builder.js';

const log = getLogger().child({ component: 'persona-adapter' });

interface PersonaConfig {
  formality: 'casual' | 'balanced' | 'formal';
  verbosity: 'concise' | 'balanced' | 'detailed';
  techDepth: 'beginner' | 'intermediate' | 'expert';
  emoji: boolean;
  codeExamples: boolean;
  language: string;
}

const DEFAULT_PERSONA: PersonaConfig = {
  formality: 'casual',
  verbosity: 'balanced',
  techDepth: 'intermediate',
  emoji: true,
  codeExamples: true,
  language: 'english',
};

export class PersonaAdapter {
  adaptToUser(profile: UserProfile): PersonaConfig {
    const persona: PersonaConfig = { ...DEFAULT_PERSONA };

    if (profile.preferredLanguage) persona.language = profile.preferredLanguage;

    if (profile.communicationStyle === 'concise') {
      persona.verbosity = 'concise';
      persona.emoji = false;
    } else if (profile.communicationStyle === 'detailed') {
      persona.verbosity = 'detailed';
      persona.codeExamples = true;
    }

    if (profile.expertise.includes('ml') || profile.expertise.includes('backend')) {
      persona.techDepth = 'expert';
    } else if (profile.expertise.length === 0) {
      persona.techDepth = 'beginner';
    }

    if (profile.relationship === 'close') {
      persona.formality = 'casual';
      persona.emoji = true;
    } else if (profile.relationship === 'new') {
      persona.formality = 'balanced';
    }

    if (profile.preferredTone === 'formal') persona.formality = 'formal';
    if (profile.preferredTone === 'casual') persona.formality = 'casual';

    return persona;
  }

  toPromptInstructions(persona: PersonaConfig): string {
    const instructions: string[] = [];

    switch (persona.formality) {
      case 'casual': instructions.push('Be casual and friendly — like chatting with a friend.'); break;
      case 'formal': instructions.push('Be professional and structured.'); break;
      default: instructions.push('Be naturally conversational but professional when needed.');
    }

    switch (persona.verbosity) {
      case 'concise': instructions.push('Keep responses SHORT — 1-3 sentences max unless code is needed.'); break;
      case 'detailed': instructions.push('Give thorough explanations with examples.'); break;
      default: instructions.push('Match response length to question complexity.');
    }

    switch (persona.techDepth) {
      case 'beginner': instructions.push('Explain technical concepts simply. Avoid jargon. Use analogies.'); break;
      case 'expert': instructions.push('Skip basics. Use precise technical language. Go deep.'); break;
      default: instructions.push('Adjust technical depth to the question.');
    }

    if (persona.codeExamples) {
      instructions.push('Include code examples when relevant.');
    }

    if (!persona.emoji) {
      instructions.push('No emojis in responses.');
    }

    return instructions.join('\n');
  }
}
