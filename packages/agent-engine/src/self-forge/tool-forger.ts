import { getLogger } from '@titan/logging';
import { randomUUID } from 'node:crypto';
import type { LlmProvider } from '../types.js';

const log = getLogger().child({ component: 'tool-forger' });

export interface ForgedToolSpec {
  name: string;
  description: string;
  sourceCode: string;
  schema: Record<string, { type: string; description?: string; enum?: string[] }>;
  requiredParams: string[];
  testCases: Array<{ params: Record<string, unknown>; expectedContains?: string }>;
}

export interface ForgeRequest {
  capability: string;
  reason: string;
  existingTools: string[];
}

const FORGE_SYSTEM_PROMPT = `You are a tool forge system. You create TypeScript tool implementations for an AI agent.

When given a capability description, you must:
1. Design a tool that fulfills that capability
2. Write clean, safe TypeScript code that exports an async function
3. Provide a JSON schema for the parameters
4. Include at least 2 test cases

The tool code must:
- Export a single async function called "handler" that takes a params object
- Return a JSON-serializable result
- Handle errors gracefully with try/catch
- NOT use eval, Function constructor, or child_process
- NOT access filesystem outside the workspace
- Use only Node.js built-in modules or fetch() for HTTP
- Be self-contained (no external imports beyond node: builtins)

Respond in JSON format:
{
  "name": "snake_case_name",
  "description": "What this tool does",
  "sourceCode": "export async function handler(params) { ... }",
  "schema": { "paramName": { "type": "string", "description": "..." } },
  "requiredParams": ["paramName"],
  "testCases": [
    { "params": { "paramName": "test_value" }, "expectedContains": "expected substring" }
  ]
}`;

export class ToolForger {
  constructor(private llm: LlmProvider) {}

  async forge(request: ForgeRequest): Promise<ForgedToolSpec | null> {
    const userPrompt = `I need a new tool because: ${request.reason}

Capability needed: ${request.capability}

Existing tools (do NOT duplicate): ${request.existingTools.join(', ')}

Create a tool that fulfills this capability. Respond in the JSON format specified.`;

    log.info({ capability: request.capability }, 'forging new tool');

    try {
      const response = await this.llm.complete([
        { role: 'system', content: FORGE_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ], {
        temperature: 0.2,
        maxTokens: 2000,
      });

      const parsed = this.parseForgeResponse(response.content);
      if (!parsed) {
        log.warn({ capability: request.capability }, 'failed to parse forge response');
        return null;
      }

      log.info({ toolName: parsed.name }, 'tool forged successfully');
      return parsed;
    } catch (err) {
      log.error({ err, capability: request.capability }, 'tool forging failed');
      return null;
    }
  }

  private parseForgeResponse(content: string): ForgedToolSpec | null {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const raw = JSON.parse(jsonMatch[0]);

      if (!raw.name || !raw.sourceCode || !raw.description) {
        log.warn({ raw }, 'forge response missing required fields');
        return null;
      }

      // Validate name is safe
      if (!/^[a-z][a-z0-9_]*$/.test(raw.name)) {
        log.warn({ name: raw.name }, 'forge response has invalid tool name');
        return null;
      }

      // Check for dangerous patterns in source code
      const dangerous = ['eval(', 'Function(', 'child_process', 'require(', 'import(', 'process.exit', 'fs.writeFileSync', 'fs.rmSync'];
      const lowerCode = raw.sourceCode.toLowerCase();
      for (const pattern of dangerous) {
        if (lowerCode.includes(pattern.toLowerCase())) {
          log.warn({ pattern, toolName: raw.name }, 'forge response contains dangerous pattern');
          return null;
        }
      }

      return {
        name: raw.name,
        description: raw.description,
        sourceCode: raw.sourceCode,
        schema: raw.schema ?? {},
        requiredParams: raw.requiredParams ?? [],
        testCases: raw.testCases ?? [],
      };
    } catch (err) {
      log.warn({ err }, 'failed to parse forge JSON');
      return null;
    }
  }
}
