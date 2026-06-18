import { Command } from 'commander';
import { startRepl } from './repl.js';
import { loadConfig, saveConfig, saveAuth, clearAuth } from './config.js';
import { ApiClient } from './connection/api-client.js';
import { detectProject, getProjectSummary } from './context/project-detector.js';
import {
  printTitan, printError, printSuccess, printSystem, printKeyValue, printWelcome,
} from './renderer/terminal-renderer.js';

const program = new Command();

program
  .name('titan')
  .description('Titan Agent CLI — your intelligent companion in the terminal')
  .version('0.1.0');

// titan chat [message]
program
  .command('chat')
  .alias('c')
  .description('Start a conversation with Titan')
  .argument('[message...]', 'Message to send (omit for interactive mode)')
  .option('-a, --agent <id>', 'Use a specific agent profile')
  .option('--no-stream', 'Disable streaming')
  .action(async (messageParts: string[], opts) => {
    const message = messageParts.join(' ');

    if (!message) {
      await startRepl();
      return;
    }

    const client = new ApiClient();
    try {
      if (opts.stream !== false) {
        process.stdout.write('\x1b[36m\x1b[1mTitan\x1b[0m: ');
        for await (const event of client.streamChat(message)) {
          if (event.type === 'token' && typeof event.data === 'string') {
            process.stdout.write(event.data);
          } else if (event.type === 'done') {
            break;
          }
        }
        console.log('');
      } else {
        const response = await client.chat(message);
        printTitan(response.message);
      }
    } catch (err) {
      printError(err instanceof Error ? err.message : 'Connection failed');
    }
  });

// titan run <prompt>
program
  .command('run')
  .alias('r')
  .description('Run an agent task')
  .argument('<prompt...>', 'Task description')
  .option('-a, --agent <id>', 'Agent profile to use', 'default')
  .option('-s, --steps <n>', 'Max steps', '15')
  .action(async (promptParts: string[], opts) => {
    const prompt = promptParts.join(' ');
    const client = new ApiClient();

    printSystem(`Running agent "${opts.agent}" with prompt: ${prompt}`);
    try {
      const result = await client.runAgent(prompt, opts.agent, parseInt(opts.steps));
      const run = result as { runId: string; status: string; finalAnswer?: string };
      printSuccess(`Run ${run.runId}: ${run.status}`);
      if (run.finalAnswer) printTitan(run.finalAnswer);
    } catch (err) {
      printError(err instanceof Error ? err.message : 'Run failed');
    }
  });

// titan status
program
  .command('status')
  .alias('s')
  .description('Check server and service health')
  .action(async () => {
    const client = new ApiClient();
    const config = loadConfig();

    printKeyValue('Server', config.serverUrl);

    try {
      const health = await client.health();
      printSuccess(`Health: ${health.status}`);
    } catch {
      printError('Server not reachable');
    }

    const project = detectProject(process.cwd());
    if (project.type !== 'unknown') {
      printSystem(getProjectSummary(project));
    }
  });

// titan login
program
  .command('login')
  .description('Authenticate with Titan server')
  .option('--server <url>', 'Server URL')
  .option('--email <email>', 'Email')
  .option('--password <password>', 'Password')
  .option('--api-key <key>', 'Use API key instead of login')
  .action(async (opts) => {
    if (opts.server) {
      saveConfig({ serverUrl: opts.server });
      printSuccess(`Server set to: ${opts.server}`);
    }

    if (opts.apiKey) {
      saveAuth({ accessToken: opts.apiKey, refreshToken: '', email: 'api-key', expiresAt: Date.now() + 365 * 86400000 });
      printSuccess('API key saved');
      return;
    }

    if (!opts.email || !opts.password) {
      printError('Usage: titan login --email <email> --password <password>');
      printSystem('Or: titan login --api-key <key>');
      return;
    }

    try {
      const client = new ApiClient();
      const result = await client.login(opts.email, opts.password);
      saveAuth({ accessToken: result.accessToken, refreshToken: result.refreshToken, email: opts.email, expiresAt: Date.now() + 3600000 });
      printSuccess(`Logged in as ${opts.email}`);
    } catch (err) {
      printError(err instanceof Error ? err.message : 'Login failed');
    }
  });

// titan logout
program
  .command('logout')
  .description('Clear saved credentials')
  .action(() => {
    clearAuth();
    printSuccess('Logged out');
  });

// titan config
program
  .command('config')
  .description('View or set configuration')
  .argument('[action]', 'get or set')
  .argument('[key]', 'Config key')
  .argument('[value]', 'Config value')
  .action((action?: string, key?: string, value?: string) => {
    const config = loadConfig();

    if (!action || action === 'list') {
      printSystem('Current configuration:');
      for (const [k, v] of Object.entries(config)) {
        printKeyValue(`  ${k}`, String(v));
      }
      return;
    }

    if (action === 'set' && key && value) {
      const update: Record<string, unknown> = {};
      if (value === 'true') update[key] = true;
      else if (value === 'false') update[key] = false;
      else if (!isNaN(Number(value))) update[key] = Number(value);
      else update[key] = value;

      saveConfig(update as Partial<ReturnType<typeof loadConfig>>);
      printSuccess(`${key} = ${value}`);
    } else if (action === 'get' && key) {
      const val = (config as Record<string, unknown>)[key];
      if (val !== undefined) printKeyValue(key, String(val));
      else printError(`Unknown key: ${key}`);
    }
  });

// Default: no args = interactive REPL
program
  .action(async () => {
    await startRepl();
  });

program.parse();
