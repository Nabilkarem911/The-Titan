import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { LlmProvider } from '../types.js';
import puppeteer, { type Browser, type Page } from 'puppeteer';

const log = getLogger().child({ component: 'browser-agent' });

type BrowserActionType =
  | 'navigate' | 'click' | 'type' | 'scroll' | 'screenshot'
  | 'extract' | 'wait' | 'select' | 'hover' | 'press_key'
  | 'upload_file' | 'close' | 'evaluate';

export interface BrowserAction {
  type: BrowserActionType;
  selector?: string;
  value?: string;
  url?: string;
  description: string;
  options?: Record<string, unknown>;
}

interface BrowserObservation {
  url: string;
  title: string;
  text: string;
  screenshot?: string;
  elements?: BrowserElement[];
  error?: string;
  success: boolean;
}

interface BrowserElement {
  tag: string;
  text: string;
  selector: string;
  attributes: Record<string, string>;
  isVisible: boolean;
  isClickable: boolean;
}

export interface BrowserSession {
  id: string;
  startedAt: Date;
  actions: Array<{ action: BrowserAction; observation: BrowserObservation; timestamp: Date }>;
  status: 'active' | 'closed' | 'error';
  proxyConfig?: { server: string; username?: string; password?: string };
  viewport: { width: number; height: number };
  userAgent?: string;
  cookies: Array<{ name: string; value: string; domain: string }>;
  currentUrl: string;
}

interface BrowserAgentConfig {
  maxSteps: number;
  viewport: { width: number; height: number };
  timeout: number;
  screenshotEvidence: boolean;
  proxy?: { server: string; username?: string; password?: string };
  allowedDomains?: string[];
  userAgent?: string;
}

interface BrowserTaskResult {
  sessionId: string;
  task: string;
  success: boolean;
  steps: number;
  durationMs: number;
  finalObservation: BrowserObservation | null;
  extractedData: Record<string, unknown>;
  screenshots: string[];
  errors: string[];
}

const PLAN_PROMPT = `You are a browser automation agent. Given a task and the current page state, determine the next action to take.

Available actions:
- navigate: Go to a URL (provide url)
- click: Click an element (provide selector)
- type: Type text into an input (provide selector + value)
- scroll: Scroll the page (provide value: "up" or "down")
- screenshot: Take a screenshot
- extract: Extract data from the page (provide selector for specific element, or leave empty for full page)
- wait: Wait for an element or timeout (provide selector or value as ms)
- select: Select an option from a dropdown (provide selector + value)
- hover: Hover over an element (provide selector)
- press_key: Press a keyboard key (provide value as key name like "Enter", "Tab")
- upload_file: Upload a file (provide selector + value as file path)
- close: Close the browser session
- evaluate: Run JavaScript (provide value as JS code)

Respond in JSON:
{
  "action": "action_type",
  "selector": "css selector if needed",
  "value": "value if needed",
  "url": "url if navigate",
  "description": "why this action",
  "isComplete": true/false,
  "extractedData": {}
}`;

const DEFAULT_CONFIG: BrowserAgentConfig = {
  maxSteps: 25,
  viewport: { width: 1280, height: 800 },
  timeout: 30000,
  screenshotEvidence: true,
};

export class BrowserAgent extends EventEmitter {
  private sessions: Map<string, BrowserSession> = new Map();
  private pages: Map<string, Page> = new Map();
  private browser: Browser | null = null;
  private maxSessions = 20;

  constructor(
    private llm: LlmProvider,
    private config: BrowserAgentConfig = DEFAULT_CONFIG,
  ) {
    super();
  }

  private async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.connected) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
    }
    return this.browser;
  }

  async executeTask(task: string, startUrl?: string): Promise<BrowserTaskResult> {
    const sessionId = randomUUID().slice(0, 8);
    const startedAt = Date.now();

    const session: BrowserSession = {
      id: sessionId,
      startedAt: new Date(),
      actions: [],
      status: 'active',
      proxyConfig: this.config.proxy,
      viewport: this.config.viewport,
      userAgent: this.config.userAgent,
      cookies: [],
      currentUrl: startUrl ?? 'about:blank',
    };

    this.sessions.set(sessionId, session);
    if (this.sessions.size > this.maxSessions) {
      const oldest = Array.from(this.sessions.values())
        .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())[0];
      if (oldest) this.sessions.delete(oldest.id);
    }

    this.emit('session:start', session);
    log.info({ sessionId, task: task.slice(0, 80) }, 'browser task started');

    const screenshots: string[] = [];
    const errors: string[] = [];
    const extractedData: Record<string, unknown> = {};
    let finalObservation: BrowserObservation | null = null;
    let success = false;

    try {
      let currentObservation: BrowserObservation | null = null;

      if (startUrl) {
        const navAction: BrowserAction = {
          type: 'navigate',
          url: startUrl,
          description: `Navigate to ${startUrl}`,
        };
        currentObservation = await this.executeAction(sessionId, navAction);
        finalObservation = currentObservation;
      }

      for (let step = 0; step < this.config.maxSteps; step++) {
        if (!currentObservation) {
          currentObservation = this.getBlankObservation(session);
        }

        const planResponse = await this.llm.complete([
          { role: 'system', content: PLAN_PROMPT },
          {
            role: 'user',
            content: JSON.stringify({
              task,
              currentUrl: currentObservation.url,
              pageTitle: currentObservation.title,
              pageText: currentObservation.text.slice(0, 2000),
              elements: currentObservation.elements?.slice(0, 30),
              error: currentObservation.error,
              step,
              maxSteps: this.config.maxSteps,
            }),
          },
        ], { temperature: 0.1, maxTokens: 500 });

        const plan = this.parseAction(planResponse.content);
        if (!plan) {
          errors.push(`Failed to parse action at step ${step}`);
          break;
        }

        if (plan.isComplete) {
          success = true;
          if (plan.extractedData) {
            Object.assign(extractedData, plan.extractedData);
          }
          log.info({ sessionId, step, task: task.slice(0, 60) }, 'browser task completed');
          break;
        }

        const action: BrowserAction = {
          type: plan.action,
          selector: plan.selector,
          value: plan.value,
          url: plan.url,
          description: plan.description ?? `${plan.action} at step ${step}`,
          options: plan.options,
        };

        currentObservation = await this.executeAction(sessionId, action);
        finalObservation = currentObservation;

        if (currentObservation.screenshot) {
          screenshots.push(currentObservation.screenshot);
        }

        if (currentObservation.error) {
          errors.push(currentObservation.error);
          incCounter('browser_action_error', 'Browser action errors', 1);
        }

        if (plan.extractedData) {
          Object.assign(extractedData, plan.extractedData);
        }

        incCounter('browser_action', 'Browser actions executed', 1, { type: action.type });
      }

      if (!success && errors.length === 0) {
        errors.push('Max steps reached without completion');
      }
    } catch (err) {
      log.error({ err, sessionId }, 'browser task failed');
      errors.push(err instanceof Error ? err.message : String(err));
      session.status = 'error';
    }

    const result: BrowserTaskResult = {
      sessionId,
      task,
      success,
      steps: session.actions.length,
      durationMs: Date.now() - startedAt,
      finalObservation,
      extractedData,
      screenshots,
      errors,
    };

    incCounter('browser_task', 'Browser tasks', 1, { success: success ? 'true' : 'false' });
    this.emit('task:complete', result);
    return result;
  }

  async executeAction(sessionId: string, action: BrowserAction): Promise<BrowserObservation> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return {
        url: '',
        title: '',
        text: '',
        success: false,
        error: 'Session not found',
      };
    }

    this.emit('action:start', { sessionId, action });

    let observation: BrowserObservation;
    try {
      observation = await this.executeRealAction(sessionId, session, action);
    } catch (err) {
      observation = {
        url: session.currentUrl,
        title: '',
        text: '',
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    session.actions.push({ action, observation, timestamp: new Date() });
    session.currentUrl = observation.url;

    this.emit('action:complete', { sessionId, action, observation });
    return observation;
  }

  private async executeRealAction(sessionId: string, session: BrowserSession, action: BrowserAction): Promise<BrowserObservation> {
    const browser = await this.getBrowser();
    let page = this.pages.get(sessionId);

    if (!page) {
      page = await browser.newPage();
      await page.setViewport(this.config.viewport);
      if (this.config.userAgent) {
        await page.setUserAgent(this.config.userAgent);
      }
      this.pages.set(sessionId, page);
    }

    switch (action.type) {
      case 'navigate': {
        if (this.config.allowedDomains && action.url) {
          const domain = new URL(action.url).hostname;
          if (!this.config.allowedDomains.includes(domain)) {
            return {
              url: session.currentUrl,
              title: '',
              text: '',
              success: false,
              error: `Domain ${domain} not in allowed list`,
            };
          }
        }
        await page.goto(action.url ?? session.currentUrl, {
          waitUntil: 'networkidle2',
          timeout: this.config.timeout,
        });
        const url = page.url();
        const title = await page.title();
        const text = await page.evaluate('document.body?.innerText?.slice(0, 5000) ?? ""') as string;
        return { url, title, text, success: true };
      }

      case 'click': {
        if (action.selector) {
          await page.click(action.selector, { timeout: this.config.timeout } as any);
        }
        await page.waitForNetworkIdle({ timeout: 5000 }).catch((err) => log.error({ err }, 'DB write failed'));
        const text = await page.evaluate('document.body?.innerText?.slice(0, 5000) ?? ""') as string;
        return { url: page.url(), title: await page.title(), text, success: true };
      }

      case 'type': {
        if (action.selector && action.value) {
          await page.type(action.selector, action.value, { delay: 50 });
        }
        return { url: page.url(), title: await page.title(), text: `[Typed "${action.value?.slice(0, 50)}" into ${action.selector}]`, success: true };
      }

      case 'scroll': {
        const direction = action.value ?? 'down';
        await page.evaluate(`window.scrollBy(0, ${direction === 'up' ? '-window.innerHeight' : 'window.innerHeight'})`);
        const text = await page.evaluate('document.body?.innerText?.slice(0, 5000) ?? ""') as string;
        return { url: page.url(), title: await page.title(), text, success: true };
      }

      case 'screenshot': {
        const screenshot = await page.screenshot({ encoding: 'base64' });
        return { url: page.url(), title: await page.title(), text: '[Screenshot captured]', screenshot: `data:image/png;base64,${screenshot}`, success: true };
      }

      case 'extract': {
        if (action.selector) {
          const content = await page.$eval(action.selector, 'el => el.textContent?.slice(0, 5000) ?? ""').catch(() => '') as string;
          return { url: page.url(), title: await page.title(), text: content, success: true };
        }
        const fullText = await page.evaluate('document.body?.innerText?.slice(0, 10000) ?? ""') as string;
        return { url: page.url(), title: await page.title(), text: fullText, success: true };
      }

      case 'wait': {
        if (action.selector) {
          await page.waitForSelector(action.selector, { timeout: this.config.timeout });
        } else {
          await new Promise((r) => setTimeout(r, 2000));
        }
        return { url: page.url(), title: await page.title(), text: '[Waited]', success: true };
      }

      case 'select': {
        if (action.selector && action.value) {
          await page.select(action.selector, action.value);
        }
        return { url: page.url(), title: await page.title(), text: `[Selected ${action.value} in ${action.selector}]`, success: true };
      }

      case 'hover': {
        if (action.selector) {
          await page.hover(action.selector);
        }
        return { url: page.url(), title: await page.title(), text: `[Hovered ${action.selector}]`, success: true };
      }

      case 'press_key': {
        if (action.value) {
          await page.keyboard.press(action.value as any);
        }
        return { url: page.url(), title: await page.title(), text: `[Pressed ${action.value}]`, success: true };
      }

      case 'evaluate': {
        if (action.value) {
          const result = await page.evaluate(action.value);
          return { url: page.url(), title: await page.title(), text: JSON.stringify(result).slice(0, 5000), success: true };
        }
        return { url: page.url(), title: await page.title(), text: '[No script provided]', success: false };
      }

      case 'close': {
        await page.close();
        this.pages.delete(sessionId);
        session.status = 'closed';
        return { url: session.currentUrl, title: '', text: '[Session closed]', success: true };
      }

      default:
        return { url: page.url(), title: await page.title(), text: `[Unknown action: ${action.type}]`, success: false, error: `Unknown action type: ${action.type}` };
    }
  }

  private getBlankObservation(session: BrowserSession): BrowserObservation {
    return {
      url: session.currentUrl,
      title: '',
      text: 'No page loaded yet',
      success: true,
    };
  }

  private parseAction(content: string): {
    action: BrowserActionType;
    selector?: string;
    value?: string;
    url?: string;
    description?: string;
    isComplete: boolean;
    extractedData?: Record<string, unknown>;
    options?: Record<string, unknown>;
  } | null {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      const raw = JSON.parse(jsonMatch[0]);
      return {
        action: raw.action as BrowserActionType,
        selector: raw.selector ? String(raw.selector) : undefined,
        value: raw.value ? String(raw.value) : undefined,
        url: raw.url ? String(raw.url) : undefined,
        description: raw.description ? String(raw.description) : undefined,
        isComplete: Boolean(raw.isComplete ?? false),
        extractedData: raw.extractedData as Record<string, unknown> | undefined,
        options: raw.options as Record<string, unknown> | undefined,
      };
    } catch {
      return null;
    }
  }

  getSession(sessionId: string): BrowserSession | null {
    return this.sessions.get(sessionId) ?? null;
  }

  getActiveSessions(): BrowserSession[] {
    return Array.from(this.sessions.values()).filter((s) => s.status === 'active');
  }

  closeSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.status = 'closed';
    const page = this.pages.get(sessionId);
    if (page) {
      page.close().catch((err) => log.error({ err }, 'DB write failed'));
      this.pages.delete(sessionId);
    }
    this.emit('session:close', sessionId);
    return true;
  }

  stats(): {
    totalSessions: number;
    activeSessions: number;
    totalActions: number;
    avgActionsPerSession: number;
  } {
    const sessions = Array.from(this.sessions.values());
    const totalActions = sessions.reduce((s, sess) => s + sess.actions.length, 0);
    return {
      totalSessions: sessions.length,
      activeSessions: sessions.filter((s) => s.status === 'active').length,
      totalActions,
      avgActionsPerSession: sessions.length > 0 ? Math.round(totalActions / sessions.length) : 0,
    };
  }
}
