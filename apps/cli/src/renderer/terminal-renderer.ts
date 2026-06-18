import chalk from 'chalk';

const TITAN_LOGO = chalk.cyan.bold('⚡ Titan');

export function printWelcome(): void {
  console.log('');
  console.log(`  ${TITAN_LOGO} ${chalk.dim('v0.1.0')}`);
  console.log(chalk.dim('  Your intelligent companion. Type /help for commands, /exit to quit.'));
  console.log('');
}

export function printUser(text: string): void {
  console.log(`${chalk.green.bold('You')}: ${text}`);
}

export function printTitan(text: string): void {
  console.log(`${chalk.cyan.bold('Titan')}: ${text}`);
}

export function printTitanStreaming(token: string): void {
  process.stdout.write(token);
}

export function endTitanStreaming(): void {
  console.log('');
}

export function printSystem(text: string): void {
  console.log(chalk.dim(`  ℹ ${text}`));
}

export function printError(text: string): void {
  console.log(chalk.red(`  ✗ ${text}`));
}

export function printSuccess(text: string): void {
  console.log(chalk.green(`  ✓ ${text}`));
}

export function printWarning(text: string): void {
  console.log(chalk.yellow(`  ⚠ ${text}`));
}

export function printStep(index: number, tool: string, status: 'running' | 'done' | 'failed'): void {
  const icon = status === 'done' ? chalk.green('✓') : status === 'failed' ? chalk.red('✗') : chalk.yellow('⟳');
  console.log(chalk.dim(`  ${icon} Step ${index}: ${tool}`));
}

export function printDivider(): void {
  console.log(chalk.dim('  ─'.repeat(30)));
}

export function printCode(code: string, language?: string): void {
  const header = language ? chalk.dim(`  ┌─ ${language} ─`) : chalk.dim('  ┌─');
  console.log(header);
  for (const line of code.split('\n')) {
    console.log(chalk.dim('  │ ') + line);
  }
  console.log(chalk.dim('  └─'));
}

export function printKeyValue(key: string, value: string): void {
  console.log(`  ${chalk.bold(key)}: ${value}`);
}

export function printTable(headers: string[], rows: string[][]): void {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)));
  const headerLine = headers.map((h, i) => h.padEnd(widths[i])).join('  ');
  console.log(chalk.bold(`  ${headerLine}`));
  console.log(chalk.dim(`  ${'─'.repeat(headerLine.length)}`));
  for (const row of rows) {
    console.log(`  ${row.map((c, i) => (c ?? '').padEnd(widths[i])).join('  ')}`);
  }
}
