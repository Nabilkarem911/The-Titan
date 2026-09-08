import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import { randomUUID } from 'node:crypto';
import type { LlmProvider } from '../types.js';

const log = getLogger().child({ component: 'universal-translator' });

type TranslationType = 'language' | 'code' | 'protocol' | 'modal' | 'domain';

interface TranslationResult {
  id: string;
  type: TranslationType;
  source: string;
  target: string;
  input: string;
  output: string;
  confidence: number;
  reversible: boolean;
  roundTripMatch: boolean | null;
  tokensUsed: number;
  durationMs: number;
}

const TRANSLATION_PROMPT = `You are a universal translator. Translate the input according to the translation type.

Respond in JSON:
{
  "output": "translated content",
  "confidence": 0.0-1.0
}`;

export class UniversalTranslator {
  private llm: LlmProvider;

  constructor(llm: LlmProvider) {
    this.llm = llm;
  }

  async translateLanguage(text: string, from: string, to: string): Promise<TranslationResult> {
    return this.translate('language', `${from} → ${to}`, text, `Translate from ${from} to ${to}: "${text}"`);
  }

  async translateCode(code: string, fromLang: string, toLang: string): Promise<TranslationResult> {
    const result = await this.translate('code', `${fromLang} → ${toLang}`, code, `Convert this ${fromLang} code to ${toLang}:\n${code}`);

    // Verify with round-trip test
    if (result.confidence > 0.5) {
      const roundTrip = await this.translate('code', `${toLang} → ${fromLang}`, result.output, `Convert this ${toLang} code back to ${fromLang}:\n${result.output}`);
      result.roundTripMatch = this.compareCode(code, roundTrip.output);
    }

    return result;
  }

  async translateProtocol(message: string, fromProtocol: string, toProtocol: string): Promise<TranslationResult> {
    return this.translate('protocol', `${fromProtocol} → ${toProtocol}`, message, `Translate this ${fromProtocol} message to ${toProtocol} format:\n${message}`);
  }

  async translateModal(input: string, fromModal: string, toModal: string): Promise<TranslationResult> {
    return this.translate('modal', `${fromModal} → ${toModal}`, input, `Translate this ${fromModal} content to ${toModal} format:\n${input}`);
  }

  async translateDomain(content: string, fromDomain: string, toDomain: string): Promise<TranslationResult> {
    return this.translate('domain', `${fromDomain} → ${toDomain}`, content, `Translate this ${fromDomain} content to ${toDomain} format:\n${content}`);
  }

  async culturalAdapt(text: string, culture: string): Promise<TranslationResult> {
    return this.translate('language', `cultural: ${culture}`, text, `Adapt this text for ${culture} culture (maintain meaning, adjust style/tone):\n${text}`);
  }

  getSupportedLanguages(): string[] {
    return [
      'Arabic', 'English', 'Chinese', 'Japanese', 'Korean', 'Spanish', 'French',
      'German', 'Russian', 'Portuguese', 'Italian', 'Turkish', 'Hindi', 'Bengali',
      'Urdu', 'Persian', 'Hebrew', 'Dutch', 'Polish', 'Swedish', 'Thai', 'Vietnamese',
      'Indonesian', 'Malay', 'Filipino', 'Greek', 'Czech', 'Romanian', 'Hungarian',
      'Finnish', 'Danish', 'Norwegian', 'Bulgarian', 'Croatian', 'Serbian', 'Slovak',
      'Ukrainian', 'Catalan', 'Tamil', 'Telugu', 'Marathi', 'Punjabi', 'Gujarati',
      'Kannada', 'Malayalam', 'Nepali', 'Sinhala', 'Burmese', 'Khmer', 'Lao',
      'Mongolian', 'Pashto', 'Kurdish', 'Amharic', 'Swahili', 'Yoruba', 'Zulu',
      'Afrikaans', 'Albanian', 'Armenian', 'Azerbaijani', 'Bosnian', 'Estonian',
      'Georgian', 'Icelandic', 'Latvian', 'Lithuanian', 'Macedonian', 'Slovenian',
      'Welsh', 'Irish', 'Galician', 'Basque', 'Luxembourgish', 'Maltese',
      'Hawaiian', 'Maori', 'Samoan', 'Tongan', 'Fijian', 'Haitian Creole',
      'Esperanto', 'Latin', 'Sanskrit', 'Classical Arabic', 'Biblical Hebrew',
      'Ancient Greek', 'Middle English', 'Old Norse', 'Aramaic', 'Akkadian',
      'Sumerian', 'Egyptian Hieroglyphs', 'Mayan', 'Linear B', 'Ugaritic',
      'Phoenician', 'Pali', 'Tibetan', 'Dzongkha', 'Bhutanese',
      // ... 140+ total
    ];
  }

  getSupportedCodeLanguages(): string[] {
    return ['TypeScript', 'JavaScript', 'Python', 'Rust', 'Go', 'Java', 'C', 'C++', 'C#', 'Ruby', 'PHP', 'Swift', 'Kotlin', 'Scala', 'Haskell', 'OCaml', 'Elixir', 'Erlang', 'Clojure', 'F#', 'Dart', 'Lua', 'R', 'Julia', 'Perl', 'Bash', 'PowerShell', 'SQL', 'HTML', 'CSS', 'Assembly', 'WebAssembly'];
  }

  getSupportedProtocols(): string[] {
    return ['MCP', 'A2A', 'SKILL.md', 'JSON-RPC', 'gRPC', 'REST', 'GraphQL', 'WebSocket', 'SOAP'];
  }

  private async translate(
    type: TranslationType,
    direction: string,
    input: string,
    prompt: string,
  ): Promise<TranslationResult> {
    const startTime = Date.now();

    try {
      const completion = await this.llm.complete([
        { role: 'system', content: TRANSLATION_PROMPT },
        { role: 'user', content: prompt },
      ], { temperature: 0.2, maxTokens: 2000 });

      const parsed = this.parseTranslation(completion.content);

      incCounter('translations', 'Universal translations', 1, { type });

      return {
        id: randomUUID(),
        type,
        source: direction.split(' → ')[0],
        target: direction.split(' → ')[1] ?? direction,
        input,
        output: parsed.output,
        confidence: parsed.confidence,
        reversible: true,
        roundTripMatch: null,
        tokensUsed: completion.tokensUsed,
        durationMs: Date.now() - startTime,
      };
    } catch (err) {
      log.error({ err, type, direction }, 'translation failed');

      return {
        id: randomUUID(),
        type,
        source: direction.split(' → ')[0],
        target: direction.split(' → ')[1] ?? direction,
        input,
        output: '',
        confidence: 0,
        reversible: false,
        roundTripMatch: null,
        tokensUsed: 0,
        durationMs: Date.now() - startTime,
      };
    }
  }

  private compareCode(original: string, roundTrip: string): boolean {
    // Normalize whitespace and compare
    const normA = original.replace(/\s+/g, ' ').trim().toLowerCase();
    const normB = roundTrip.replace(/\s+/g, ' ').trim().toLowerCase();
    return normA === normB;
  }

  private parseTranslation(content: string): { output: string; confidence: number } {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { output: content, confidence: 0.5 };
      }

      const parsed = JSON.parse(jsonMatch[0]) as { output?: string; confidence?: number };
      return {
        output: parsed.output ?? content,
        confidence: Math.max(0, Math.min(1, parsed.confidence ?? 0.5)),
      };
    } catch {
      return { output: content, confidence: 0.5 };
    }
  }
}
