import { createInterface } from 'node:readline';
import chalk from 'chalk';
import { ApiClient } from './connection/api-client.js';
import { detectProject, getProjectSummary } from './context/project-detector.js';
import { getGitContext, getGitSummary } from './context/git-context.js';
import {
  printWelcome, printUser, printTitan, printTitanStreaming, endTitanStreaming,
  printSystem, printError, printSuccess, printStep, printDivider, printKeyValue,
} from './renderer/terminal-renderer.js';
import { loadConfig } from './config.js';

export async function startRepl(): Promise<void> {
  const config = loadConfig();
  const client = new ApiClient();

  printWelcome();

  // Detect project context
  const cwd = process.cwd();
  const project = detectProject(cwd);
  if (project.type !== 'unknown') {
    printSystem(getProjectSummary(project));
  }
  const git = getGitContext(cwd);
  if (git) {
    printSystem(getGitSummary(git));
  }

  if (!client.isAuthenticated()) {
    printWarning('Not logged in. Use /login or set API key with: titan config set apiKey <key>');
  }

  printDivider();

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.green.bold('› '),
    historySize: 100,
  });

  let sessionId: string | undefined;

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();
    if (!input) { rl.prompt(); return; }

    // Handle commands
    if (input.startsWith('/')) {
      const handled = await handleCommand(input, client, rl);
      if (handled === 'exit') return;
      rl.prompt();
      return;
    }

    printUser(input);

    try {
      if (config.streaming && client.isAuthenticated()) {
        // Streaming mode
        process.stdout.write(chalk.cyan.bold('Titan') + ': ');
        let fullResponse = '';

        for await (const event of client.streamChat(input, sessionId)) {
          switch (event.type) {
            case 'token':
              if (typeof event.data === 'string') {
                printTitanStreaming(event.data);
                fullResponse += event.data;
              }
              break;
            case 'step': {
              const step = event.data as { index?: number; action?: { name: string }; status?: string };
              if (step.action) {
                endTitanStreaming();
                printStep(step.index ?? 0, step.action.name, (step.status === 'completed' ? 'done' : 'running'));
                process.stdout.write(chalk.cyan.bold('Titan') + ': ');
              }
              break;
            }
            case 'tool_call': {
              const tool = event.data as { name: string };
              printStep(0, tool.name, 'running');
              break;
            }
            case 'done':
              endTitanStreaming();
              break;
            case 'error':
              endTitanStreaming();
              printError(String(event.data));
              break;
          }
        }

        if (!fullResponse) endTitanStreaming();
      } else {
        // Non-streaming fallback
        const response = await client.chat(input, sessionId);
        sessionId = response.sessionId;
        printTitan(response.message);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (msg.includes('fetch failed') || msg.includes('ECONNREFUSED')) {
        printError(`Can't connect to server at ${config.serverUrl}`);
        printSystem('Is the server running? Try: titan config set serverUrl <url>');
      } else {
        printError(msg);
      }
    }

    console.log('');
    rl.prompt();
  });

  rl.on('close', () => {
    console.log(chalk.dim('\n  Bye! 👋'));
    process.exit(0);
  });
}

async function handleCommand(input: string, client: ApiClient, rl: ReturnType<typeof createInterface>): Promise<string | void> {
  const [cmd, ...args] = input.slice(1).split(/\s+/);

  switch (cmd) {
    case 'exit':
    case 'quit':
    case 'q':
      console.log(chalk.dim('\n  Bye! 👋'));
      rl.close();
      return 'exit';

    case 'help':
      printDivider();
      printSystem('Commands:');
      printKeyValue('  /help', 'Show this help');
      printKeyValue('  /status', 'Check server health');
      printKeyValue('  /clear', 'Clear screen');
      printKeyValue('  /context', 'Show current project context');
      printKeyValue('  /exit', 'Exit Titan');
      printDivider();
      break;

    case 'status':
      try {
        const health = await client.health();
        printSuccess(`Server: ${health.status}`);
      } catch {
        printError('Server not reachable');
      }
      break;

    case 'clear':
      console.clear();
      printWelcome();
      break;

    case 'context': {
      const project = detectProject(process.cwd());
      const git = getGitContext(process.cwd());
      printKeyValue('  Project', project.name);
      printKeyValue('  Type', project.type);
      if (project.framework) printKeyValue('  Framework', project.framework);
      if (git) {
        printKeyValue('  Branch', git.branch);
        printKeyValue('  Uncommitted', git.hasUncommitted ? 'Yes' : 'No');
      }
      break;
    }

    default:
      printError(`Unknown command: /${cmd}. Type /help for commands.`);
  }
}

function printWarning(text: string): void {
  console.log(chalk.yellow(`  ⚠ ${text}`));
}
