export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, { type: string; description?: string; enum?: string[] }>;
    required?: string[];
  };
}

export interface McpToolCallResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

export interface McpServerInfo {
  name: string;
  version: string;
  url: string;
  tools: McpToolDefinition[];
  status: 'connected' | 'disconnected' | 'error';
  lastPing?: Date;
}

export interface McpClientConfig {
  serverUrl: string;
  serverName?: string;
  apiKey?: string;
  timeout?: number;
}

export interface McpServerConfig {
  name: string;
  version: string;
  port?: number;
}
