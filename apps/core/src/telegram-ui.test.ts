/**
 * Tests for Telegram Rich UI helpers.
 * Covers: MarkdownV2 escaping, keyboard builders, progress bar, callback parsing.
 */

import { describe, it, expect } from 'vitest';
import {
  escapeMarkdownV2,
  markdownToMarkdownV2,
  buildYesNoKeyboard,
  buildChoiceKeyboard,
  buildQuickActionsKeyboard,
  buildConfirmKeyboard,
  buildProgressBar,
  parseCallbackData,
  validateCallbackOrigin,
  type CallbackQuery,
} from './telegram-ui.js';

describe('escapeMarkdownV2', () => {
  it('should escape all special characters', () => {
    const input = 'Hello _world_ [test] (paren) ~tilde~ `code` > quote #hash +plus -minus =eq |pipe {br} .dot !bang';
    const result = escapeMarkdownV2(input);
    // Every special char should be preceded by backslash
    expect(result).toContain('\\_');
    expect(result).toContain('\\[');
    expect(result).toContain('\\]');
    expect(result).toContain('\\(');
    expect(result).toContain('\\)');
    expect(result).toContain('\\~');
    expect(result).toContain('\\`');
    expect(result).toContain('\\>');
    expect(result).toContain('\\#');
    expect(result).toContain('\\+');
    expect(result).toContain('\\-');
    expect(result).toContain('\\=');
    expect(result).toContain('\\|');
    expect(result).toContain('\\{');
    expect(result).toContain('\\}');
    expect(result).toContain('\\.');
    expect(result).toContain('\\!');
  });

  it('should handle empty string', () => {
    expect(escapeMarkdownV2('')).toBe('');
  });

  it('should handle already escaped characters', () => {
    const input = 'Already escaped \\* test';
    const result = escapeMarkdownV2(input);
    // Backslash is not in the special chars list, so it stays as-is
    // The * after backslash gets escaped to \*
    expect(result).toContain('\\*');
  });

  it('should handle text with no special characters', () => {
    expect(escapeMarkdownV2('Hello World 123')).toBe('Hello World 123');
  });
});

describe('markdownToMarkdownV2', () => {
  it('should convert **bold** to *bold*', () => {
    const result = markdownToMarkdownV2('This is **bold** text');
    expect(result).toContain('*bold*');
  });

  it('should convert *italic* to _italic_', () => {
    const result = markdownToMarkdownV2('This is *italic* text');
    expect(result).toContain('_italic_');
  });

  it('should preserve code blocks', () => {
    const result = markdownToMarkdownV2('```\ncode here\n```');
    expect(result).toContain('```');
    expect(result).toContain('code here');
  });

  it('should preserve inline code', () => {
    const result = markdownToMarkdownV2('Use `npm install` to install');
    expect(result).toContain('`npm install`');
  });

  it('should handle empty string', () => {
    expect(markdownToMarkdownV2('')).toBe('');
  });

  it('should handle mixed formatting', () => {
    const result = markdownToMarkdownV2('**Bold** and *italic* and `code`');
    expect(result).toContain('*Bold*');
    expect(result).toContain('_italic_');
    expect(result).toContain('`code`');
  });
});

describe('buildYesNoKeyboard', () => {
  it('should build a keyboard with Yes and No buttons', () => {
    const keyboard = buildYesNoKeyboard();
    expect(keyboard.inline_keyboard).toHaveLength(1);
    expect(keyboard.inline_keyboard[0]).toHaveLength(2);
    expect(keyboard.inline_keyboard[0][0].text).toContain('Yes');
    expect(keyboard.inline_keyboard[0][1].text).toContain('No');
  });

  it('should use custom prefix', () => {
    const keyboard = buildYesNoKeyboard('deploy');
    expect(keyboard.inline_keyboard[0][0].callback_data).toBe('deploy:yes');
    expect(keyboard.inline_keyboard[0][1].callback_data).toBe('deploy:no');
  });
});

describe('buildChoiceKeyboard', () => {
  it('should build keyboard with 4 options in 2 rows', () => {
    const keyboard = buildChoiceKeyboard(['Option 1', 'Option 2', 'Option 3', 'Option 4']);
    expect(keyboard.inline_keyboard).toHaveLength(2);
    expect(keyboard.inline_keyboard[0]).toHaveLength(2);
    expect(keyboard.inline_keyboard[1]).toHaveLength(2);
  });

  it('should build keyboard with 3 options in 2 rows', () => {
    const keyboard = buildChoiceKeyboard(['A', 'B', 'C']);
    expect(keyboard.inline_keyboard).toHaveLength(2);
    expect(keyboard.inline_keyboard[0]).toHaveLength(2);
    expect(keyboard.inline_keyboard[1]).toHaveLength(1);
  });

  it('should use custom prefix', () => {
    const keyboard = buildChoiceKeyboard(['X'], 'select');
    expect(keyboard.inline_keyboard[0][0].callback_data).toBe('select:a');
  });

  it('should handle single option', () => {
    const keyboard = buildChoiceKeyboard(['Only one']);
    expect(keyboard.inline_keyboard).toHaveLength(1);
    expect(keyboard.inline_keyboard[0]).toHaveLength(1);
  });
});

describe('buildQuickActionsKeyboard', () => {
  it('should build keyboard with screenshot, status, devices, memory, help', () => {
    const keyboard = buildQuickActionsKeyboard();
    const allButtons = keyboard.inline_keyboard.flat();
    expect(allButtons.length).toBeGreaterThanOrEqual(5);
    const texts = allButtons.map((b) => b.text);
    expect(texts.some((t) => t.includes('Screenshot'))).toBe(true);
    expect(texts.some((t) => t.includes('System Info'))).toBe(true);
    expect(texts.some((t) => t.includes('Devices'))).toBe(true);
    expect(texts.some((t) => t.includes('Memory'))).toBe(true);
    expect(texts.some((t) => t.includes('Help'))).toBe(true);
  });
});

describe('buildConfirmKeyboard', () => {
  it('should build keyboard with Confirm and Cancel buttons', () => {
    const keyboard = buildConfirmKeyboard('delete');
    expect(keyboard.inline_keyboard).toHaveLength(1);
    expect(keyboard.inline_keyboard[0]).toHaveLength(2);
    expect(keyboard.inline_keyboard[0][0].callback_data).toBe('confirm:delete');
    expect(keyboard.inline_keyboard[0][1].callback_data).toBe('confirm:cancel');
  });
});

describe('buildProgressBar', () => {
  it('should build 0% progress', () => {
    const bar = buildProgressBar(0, 10);
    expect(bar).toContain('0%');
    expect(bar).toContain('(0/10)');
    expect(bar).toContain('░'.repeat(10));
  });

  it('should build 50% progress', () => {
    const bar = buildProgressBar(5, 10);
    expect(bar).toContain('50%');
    expect(bar).toContain('(5/10)');
    expect(bar).toContain('█'.repeat(5));
    expect(bar).toContain('░'.repeat(5));
  });

  it('should build 100% progress', () => {
    const bar = buildProgressBar(10, 10);
    expect(bar).toContain('100%');
    expect(bar).toContain('(10/10)');
    expect(bar).toContain('█'.repeat(10));
  });

  it('should clamp current to total', () => {
    const bar = buildProgressBar(15, 10);
    expect(bar).toContain('100%');
    expect(bar).toContain('(10/10)');
  });

  it('should clamp current to 0', () => {
    const bar = buildProgressBar(-5, 10);
    expect(bar).toContain('0%');
    expect(bar).toContain('(0/10)');
  });

  it('should handle total = 0', () => {
    const bar = buildProgressBar(0, 0);
    expect(bar).toContain('0%');
  });

  it('should include label when provided', () => {
    const bar = buildProgressBar(3, 7, 'Running tests');
    expect(bar).toContain('Running tests');
  });
});

describe('parseCallbackData', () => {
  it('should parse prefix:value', () => {
    const result = parseCallbackData('action:screenshot');
    expect(result.prefix).toBe('action');
    expect(result.value).toBe('screenshot');
    expect(result.parts).toEqual(['action', 'screenshot']);
  });

  it('should parse prefix:value:subvalue', () => {
    const result = parseCallbackData('deploy:prod:us-east');
    expect(result.prefix).toBe('deploy');
    expect(result.value).toBe('prod:us-east');
    expect(result.parts).toEqual(['deploy', 'prod', 'us-east']);
  });

  it('should handle empty string', () => {
    const result = parseCallbackData('');
    expect(result.prefix).toBe('');
    expect(result.value).toBe('');
  });

  it('should handle prefix only', () => {
    const result = parseCallbackData('action');
    expect(result.prefix).toBe('action');
    expect(result.value).toBe('');
  });
});

describe('validateCallbackOrigin', () => {
  const validQuery: CallbackQuery = {
    id: '123',
    from: { id: 123456, first_name: 'Test' },
    message: { message_id: 1, chat: { id: 123456, type: 'private' } },
    data: 'action:help',
  };

  it('should return true when user ID matches', () => {
    expect(validateCallbackOrigin(validQuery, 123456)).toBe(true);
  });

  it('should return false when user ID does not match', () => {
    expect(validateCallbackOrigin(validQuery, 999999)).toBe(false);
  });

  it('should return false when from is missing', () => {
    const query: CallbackQuery = { id: '123', from: undefined as unknown as CallbackQuery['from'], data: 'test' };
    expect(validateCallbackOrigin(query, 123456)).toBe(false);
  });
});
