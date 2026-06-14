import { getLogger } from '@titan/logging';

const _log = getLogger().child({ component: 'tool-executor' });

export { executeRegisteredTool as executeTool, listTools } from './registry.js';
export * from './schemas.js';
export * from './sandbox.js';
export * from './registry.js';

import { executeRegisteredTool } from './registry.js';
import type { ToolInput } from './schemas.js';

export async function executeTypedTool(input: ToolInput): Promise<unknown> {
  return executeRegisteredTool(input.tool, input.params);
}
