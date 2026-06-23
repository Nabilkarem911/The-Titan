import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getLogger } from '@titan/logging';
import { requireAuth, requirePermission } from '../plugins/auth.js';
import { PERMISSIONS } from '@titan/shared';
import { getGlobalWiring } from '@titan/agent-engine';

const log = getLogger().child({ component: 'integration-keys-routes' });

interface IntegrationKeyDef {
  key: string;
  label: string;
  description: string;
  category: string;
  link?: string;
}

const INTEGRATION_KEYS: IntegrationKeyDef[] = [
  {
    key: 'BRAVE_SEARCH_API_KEY',
    label: 'Brave Search API Key',
    description: 'Used by Web Intelligence for real web search results',
    category: 'Search',
    link: 'https://api.search.brave.com/',
  },
  {
    key: 'BRAVE_ANSWERS_API_KEY',
    label: 'Brave Answers API Key',
    description: 'Used for Brave AI-powered answers',
    category: 'Search',
    link: 'https://api.search.brave.com/',
  },
  {
    key: 'GITHUB_TOKEN',
    label: 'GitHub Token',
    description: 'Personal access token for Git operations and GitHub mining',
    category: 'Development',
    link: 'https://github.com/settings/tokens',
  },
  {
    key: 'OPENWEATHER_API_KEY',
    label: 'OpenWeather API Key',
    description: 'Used for weather data retrieval',
    category: 'Weather',
    link: 'https://openweathermap.org/api',
  },
  {
    key: 'EMBEDDING_BASE_URL',
    label: 'Embedding Base URL',
    description: 'Base URL for embedding API (falls back to LLM_BASE_URL)',
    category: 'AI',
  },
  {
    key: 'EMBEDDING_API_KEY',
    label: 'Embedding API Key',
    description: 'API key for embedding service (falls back to LLM_API_KEY)',
    category: 'AI',
  },
  {
    key: 'EMBEDDING_MODEL',
    label: 'Embedding Model',
    description: 'Model name for embeddings (default: auto)',
    category: 'AI',
  },
  {
    key: 'EMBEDDING_DIMENSIONS',
    label: 'Embedding Dimensions',
    description: 'Vector dimensions for embeddings (default: 1024)',
    category: 'AI',
  },
  {
    key: 'ELEVENLABS_API_KEY',
    label: 'ElevenLabs API Key',
    description: 'Text-to-speech voice generation',
    category: 'Voice',
    link: 'https://elevenlabs.io/',
  },
  {
    key: 'OPENAI_API_KEY',
    label: 'OpenAI API Key',
    description: 'Used for Whisper STT and OpenAI TTS',
    category: 'Voice',
    link: 'https://platform.openai.com/',
  },
  {
    key: 'TELEGRAM_BOT_TOKEN',
    label: 'Telegram Bot Token',
    description: 'Bot token from @BotFather for Telegram integration',
    category: 'Messaging',
    link: 'https://t.me/BotFather',
  },
  {
    key: 'TELEGRAM_ALLOWED_CHAT_IDS',
    label: 'Telegram Allowed Chat IDs',
    description: 'Comma-separated chat IDs allowed to use the bot',
    category: 'Messaging',
  },
];

function maskValue(value: string): string {
  if (!value) return '';
  if (value.length <= 8) return '****';
  return value.substring(0, 4) + '****' + value.substring(value.length - 4);
}

const UpdateKeySchema = z.object({
  key: z.string().min(1),
  value: z.string(),
});

export const integrationKeyRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', requireAuth);

  // List all integration keys with their status (masked)
  app.get('/api/v1/integration-keys', async (req) => {
    requirePermission(req.auth, PERMISSIONS.WORKSPACE_ADMIN);

    const items = INTEGRATION_KEYS.map((def) => {
      const rawValue = process.env[def.key] ?? '';
      return {
        ...def,
        isSet: !!rawValue,
        maskedValue: maskValue(rawValue),
      };
    });

    return { items };
  });

  // Update a key value
  app.put('/api/v1/integration-keys', async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.WORKSPACE_ADMIN);

    const { key, value } = UpdateKeySchema.parse(req.body);

    const def = INTEGRATION_KEYS.find((k) => k.key === key);
    if (!def) {
      return reply.status(400).send({ error: `Unknown key: ${key}` });
    }

    // Set in process.env (runtime update)
    if (value) {
      process.env[key] = value;
    } else {
      delete process.env[key];
    }

    // Update WebIntelligence config at runtime if Brave key changed
    if (key === 'BRAVE_SEARCH_API_KEY') {
      const wiring = getGlobalWiring();
      if (wiring) {
        wiring.webIntelligence.updateConfig({
          apiKey: value,
          baseUrl: value ? 'https://api.search.brave.com' : '',
        });
      }
    }

    log.info({ key, set: !!value }, 'integration key updated');

    return {
      key,
      isSet: !!value,
      maskedValue: maskValue(value),
    };
  });

  // Test a key (for Brave Search, GitHub, etc.)
  app.post('/api/v1/integration-keys/test', async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.WORKSPACE_ADMIN);

    const { key } = req.body as { key: string };
    const value = process.env[key] ?? '';

    if (!value) {
      return reply.status(400).send({ error: 'Key is not set' });
    }

    try {
      switch (key) {
        case 'BRAVE_SEARCH_API_KEY': {
          const res = await fetch('https://api.search.brave.com/res/v1/web/search?q=test&count=1', {
            headers: { 'X-Subscription-Token': value },
            signal: AbortSignal.timeout(10000),
          });
          return { success: res.ok, status: res.status, message: res.ok ? 'Brave Search is working' : `HTTP ${res.status}` };
        }
        case 'GITHUB_TOKEN': {
          const res = await fetch('https://api.github.com/user', {
            headers: { Authorization: `Bearer ${value}` },
            signal: AbortSignal.timeout(10000),
          });
          if (res.ok) {
            const data = await res.json() as { login?: string };
            return { success: true, status: 200, message: `GitHub token valid — user: ${data.login}` };
          }
          return { success: false, status: res.status, message: `HTTP ${res.status}` };
        }
        case 'OPENWEATHER_API_KEY': {
          const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=London&appid=${value}`, {
            signal: AbortSignal.timeout(10000),
          });
          return { success: res.ok, status: res.status, message: res.ok ? 'OpenWeather is working' : `HTTP ${res.status}` };
        }
        default:
          return { success: true, status: 200, message: 'Key is set (no test available for this key)' };
      }
    } catch (err) {
      return { success: false, status: 0, message: err instanceof Error ? err.message : 'Connection failed' };
    }
  });
};
