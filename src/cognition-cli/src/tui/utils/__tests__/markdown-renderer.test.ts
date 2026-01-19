import { describe, it, expect } from 'vitest';
import { markdownToLines } from '../markdown-renderer.js';
import { TUITheme } from '../../theme.js';
import stripAnsi from 'strip-ansi';

describe('MarkdownRenderer', () => {
  const width = 40;

  it('renders plain text', () => {
    const lines = markdownToLines('Hello world', width);
    expect(lines).toHaveLength(1);
    expect(lines[0].chunks[0].text).toBe('Hello world');
  });

  it('renders bold and italic text', () => {
    const lines = markdownToLines('**Bold** and *italic*', width);
    expect(lines).toHaveLength(1);
    const chunks = lines[0].chunks;

    expect(chunks.find((c) => c.text === 'Bold')?.bold).toBe(true);
    expect(chunks.find((c) => c.text === 'italic')?.italic).toBe(true);
  });

  it('wraps long lines', () => {
    const longText =
      'This is a very long line that should definitely wrap given the width constraint of forty characters.';
    const lines = markdownToLines(longText, width);

    expect(lines.length).toBeGreaterThan(1);
    lines.forEach((line) => {
      const lineText = line.chunks.reduce(
        (acc, c) => acc + stripAnsi(c.text),
        ''
      );
      expect(lineText.length).toBeLessThanOrEqual(width);
    });
  });

  it('renders headings with correct colors', () => {
    const lines = markdownToLines('# Heading 1\n## Heading 2', width);

    // Heading 1
    const h1Line = lines.find((l) =>
      l.chunks.some((c) => c.text === 'Heading 1')
    );
    expect(h1Line).toBeDefined();
    const h1Chunk = h1Line?.chunks.find((c) => c.text === 'Heading 1');
    expect(h1Chunk?.color).toBe(TUITheme.syntax.heading.h1);
    expect(h1Chunk?.bold).toBe(true);

    // Heading 2
    const h2Line = lines.find((l) =>
      l.chunks.some((c) => c.text === 'Heading 2')
    );
    expect(h2Line).toBeDefined();
    const h2Chunk = h2Line?.chunks.find((c) => c.text === 'Heading 2');
    expect(h2Chunk?.color).toBe(TUITheme.syntax.heading.h2);
  });

  it('renders lists with indentation', () => {
    const lines = markdownToLines('- Item 1\n- Item 2\n  - Subitem', width);

    const subitemLine = lines.find((l) =>
      l.chunks.some((c) => c.text === 'Subitem')
    );
    expect(subitemLine).toBeDefined();

    // First chunk should be indentation
    const indentChunk = subitemLine?.chunks[0];
    expect(indentChunk?.text).toMatch(/^\s+$/);

    // Second chunk should be bullet
    const bulletChunk = subitemLine?.chunks[1];
    expect(bulletChunk?.text).toBe('- ');
  });

  it('renders inline code with custom color', () => {
    const customColor = '#ff00ff';
    const lines = markdownToLines('Use `code` here', width, {
      inlineCodeColor: customColor,
    });

    const codeChunk = lines[0].chunks.find((c) => c.text === 'code');
    expect(codeChunk?.color).toBe(customColor);
  });

  it('renders code blocks', () => {
    const lines = markdownToLines('```js\nconst x = 1;\n```', width);

    const codeLine = lines.find((l) =>
      l.chunks.some((c) => c.text === 'const x = 1;')
    );
    expect(codeLine).toBeDefined();
    expect(codeLine?.chunks[0].color).toBe(TUITheme.syntax.code.block);
  });

  it('wraps long lines within code blocks and preserves color', () => {
    const longCode = ('A'.repeat(width / 2) + ' ').repeat(3);
    const lines = markdownToLines('```\n' + longCode + '\n```', width, {
      codeBlockColor: '#ff0000',
    });

    expect(lines.length).toBeGreaterThan(1);
    lines.forEach((line) => {
      expect(line.chunks[0].color).toBe('#ff0000');
    });
  });

  it('handles empty input', () => {
    const lines = markdownToLines('', width);
    expect(lines).toEqual([]);
  });

  it('preserves multiple newlines between paragraphs', () => {
    const lines = markdownToLines('Para 1\n\nPara 2', width);

    const emptyLines = lines.filter((l) => l.chunks.length === 0);
    expect(emptyLines.length).toBeGreaterThanOrEqual(1);
  });

  it('supports headingDim option', () => {
    const lines = markdownToLines('# Title', width, { headingDim: true });

    const titleChunk = lines
      .find((l) => l.chunks.some((c) => c.text === 'Title'))
      ?.chunks.find((c) => c.text === 'Title');

    expect(titleChunk).toBeDefined();
    expect(titleChunk?.dim).toBe(true);
  });
});
