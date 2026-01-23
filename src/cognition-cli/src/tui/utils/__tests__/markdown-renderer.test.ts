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

  it('handles negative or very small width gracefully without infinite looping', () => {
    const markdown = 'This is a long sentence that should be wrapped.';
    // Use a very small width that would normally cause issues
    const lines = markdownToLines(markdown, -5);

    // It should produce some lines but definitely not an infinite number or crash
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.length).toBeLessThan(100);
  });

  it('handles indentation larger than width gracefully', () => {
    const markdown = '- Item 1\n- Item 2';
    // Indent for list is at least 2. With width 1, it might have issues if not handled.
    const lines = markdownToLines(markdown, 1);

    expect(lines.length).toBeGreaterThan(0);
    expect(lines.length).toBeLessThan(50);
  });

  describe('Diff highlighting', () => {
    it('detects and highlights standard unified diffs', () => {
      const diff =
        '```diff\n--- a/file.txt\n+++ b/file.txt\n@@ -1,1 +1,1 @@\n-old\n+new\n```';
      const lines = markdownToLines(diff, width);

      const oldLine = lines.find((l) =>
        l.chunks.some((c) => c.text === '-old')
      );
      const newLine = lines.find((l) =>
        l.chunks.some((c) => c.text === '+new')
      );

      expect(oldLine?.chunks[0].color).toBe(TUITheme.syntax.diff.remove);
      expect(newLine?.chunks[0].color).toBe(TUITheme.syntax.diff.add);
    });

    it('does NOT highlight git log output as a diff', () => {
      const gitLog =
        '```\ncommit 1234567890abcdef\nAuthor: John Doe <john@example.com>\nDate:   Mon Jan 1 00:00:00 2024 +0000\n\n    - fix: a bug\n    - feat: a feature\n    - docs: some docs\n```';
      const lines = markdownToLines(gitLog, width);

      const bulletLines = lines.filter((l) =>
        l.chunks.some(
          (c) => c.text.includes('- fix:') || c.text.includes('- feat:')
        )
      );

      expect(bulletLines.length).toBeGreaterThan(0);
      bulletLines.forEach((line) => {
        // Should use standard code block color, not diff remove color
        expect(line.chunks[0].color).not.toBe(TUITheme.syntax.diff.remove);
        expect(line.chunks[0].color).toBe(TUITheme.syntax.code.block);
      });
    });

    it('does NOT highlight git log with custom format as a diff', () => {
      const gitLog =
        '```\n7f3a2b1 Fix - some bug\n\ncommit 7f3a2b1234567890abcdef\nAuthor: John Doe <john@example.com>\nDate: Fri Jan 23 10:00:00 2026 +0000\n\n- item 1\n- item 2\n```';
      const lines = markdownToLines(gitLog, width);

      const bulletLines = lines.filter((l) =>
        l.chunks.some((c) => c.text.includes('- item'))
      );

      expect(bulletLines.length).toBe(2);
      bulletLines.forEach((line) => {
        expect(line.chunks[0].color).not.toBe(TUITheme.syntax.diff.remove);
      });
    });

    it('does NOT highlight git commit output as a diff', () => {
      const gitCommit =
        '```\n[main 7f3a2b1] feat: something\n 1 file changed, 1 insertion(+), 1 deletion(-)\n\nOn branch main\nYour branch is up to date with \'origin/main\'.\n\nChanges to be committed:\n  (use "git restore --staged <file>..." to unstage)\n\tmodified:   file.txt\n\n- some commit message line\n```';
      const lines = markdownToLines(gitCommit, width);

      const minusLine = lines.find((l) =>
        l.chunks.some((c) => c.text.includes('- some commit message line'))
      );

      expect(minusLine).toBeDefined();
      expect(minusLine!.chunks[0].color).not.toBe(TUITheme.syntax.diff.remove);
    });

    it('highlights git diff output in bash block', () => {
      const gitDiff = [
        '```bash',
        'diff --git a/file.ts b/file.ts',
        'index 1234567..89abcdef 100644',
        '--- a/file.ts',
        '+++ b/file.ts',
        '@@ -1,5 +1,5 @@',
        '-old line',
        '+new line',
        ' context line',
        '```',
      ].join('\n');

      const lines = markdownToLines(gitDiff, width);

      // Check for removal highlight
      const removeLine = lines.find((l) =>
        l.chunks.some((c) => c.text.includes('-old line'))
      );
      expect(removeLine).toBeDefined();
      expect(removeLine!.chunks[0].color).toBe(TUITheme.syntax.diff.remove);

      // Check for addition highlight
      const addLine = lines.find((l) =>
        l.chunks.some((c) => c.text.includes('+new line'))
      );
      expect(addLine).toBeDefined();
      expect(addLine!.chunks[0].color).toBe(TUITheme.syntax.diff.add);
    });

    it('highlights indented git diff output (e.g. from bash tool)', () => {
      const indentedDiff = [
        '```bash',
        '    diff --git a/file.ts b/file.ts',
        '    index 1234567..89abcdef 100644',
        '    --- a/file.ts',
        '    +++ b/file.ts',
        '    @@ -1,5 +1,5 @@',
        '    -old line',
        '    +new line',
        '     context line',
        '```',
      ].join('\n');

      const lines = markdownToLines(indentedDiff, width);

      // Check for removal highlight
      const removeLine = lines.find((l) =>
        l.chunks.some((c) => c.text.includes('-old line'))
      );
      expect(removeLine).toBeDefined();
      expect(removeLine!.chunks[0].color).toBe(TUITheme.syntax.diff.remove);

      // Check for addition highlight
      const addLine = lines.find((l) =>
        l.chunks.some((c) => c.text.includes('+new line'))
      );
      expect(addLine).toBeDefined();
      expect(addLine!.chunks[0].color).toBe(TUITheme.syntax.diff.add);
    });

    it('handles tricky context lines in indented diffs', () => {
      const indentedDiff = [
        '```bash',
        '    diff --git a/file.ts b/file.ts',
        '    @@ -1,5 +1,5 @@',
        '    +new line',
        '     + context line looks like add',
        '```',
      ].join('\n');

      const lines = markdownToLines(indentedDiff, width);

      const addLine = lines.find((l) =>
        l.chunks.some((c) => c.text.includes('+new line'))
      );
      expect(addLine).toBeDefined();
      expect(addLine!.chunks[0].color).toBe(TUITheme.syntax.diff.add);

      const contextLine = lines.find((l) =>
        l.chunks.some((c) => c.text.includes('+ context line'))
      );
      // Should NOT be green (Add)
      expect(contextLine).toBeDefined();
      expect(contextLine!.chunks[0].color).not.toBe(TUITheme.syntax.diff.add);
    });

    it('highlights explict diff block', () => {
      const gitDiff = [
        '```diff',
        'diff --git a/file.ts b/file.ts',
        'index 1234567..89abcdef 100644',
        '--- a/file.ts',
        '+++ b/file.ts',
        '@@ -1,5 +1,5 @@',
        '-old line',
        '+new line',
        ' context line',
        '```',
      ].join('\n');

      const lines = markdownToLines(gitDiff, width);

      const removeLine = lines.find((l) =>
        l.chunks.some((c) => c.text.includes('-old line'))
      );
      expect(removeLine).toBeDefined();
      expect(removeLine!.chunks[0].color).toBe(TUITheme.syntax.diff.remove);
    });

    it('highlights git diff output without language', () => {
      const fragment =
        '```\n-old line 1\n+new line 1\n-old line 2\n+new line 2\n```';
      const lines = markdownToLines(fragment, width);

      const oldLines = lines.filter((l) =>
        l.chunks.some((c) => c.text.startsWith('-old'))
      );
      expect(oldLines.length).toBe(2);
      oldLines.forEach((l) => {
        expect(l.chunks[0].color).toBe(TUITheme.syntax.diff.remove);
      });
    });

    it('does NOT highlight simple lists in code blocks as diffs', () => {
      const list = '```\n- Item 1\n- Item 2\n- Item 3\n```';
      const lines = markdownToLines(list, width);

      const itemLines = lines.filter((l) =>
        l.chunks.some((c) => c.text.startsWith('- Item'))
      );
      expect(itemLines.length).toBe(3);
      itemLines.forEach((l) => {
        expect(l.chunks[0].color).not.toBe(TUITheme.syntax.diff.remove);
      });
    });
  });

  describe('List and Item rendering', () => {
    it('renders list items on separate lines', () => {
      const markdown = '- Item 1\n- Item 2';
      const lines = markdownToLines(markdown, width);

      const item1Line = lines.find((l) =>
        l.chunks.some((c) => c.text === 'Item 1')
      );
      const item2Line = lines.find((l) =>
        l.chunks.some((c) => c.text === 'Item 2')
      );

      expect(item1Line).toBeDefined();
      expect(item2Line).toBeDefined();
      expect(lines.indexOf(item1Line!)).not.toBe(lines.indexOf(item2Line!));
    });

    it('renders tool progress style task lists correctly', () => {
      const markdown = '📋 Tasks:\n- Task 1\n- Task 2';
      const lines = markdownToLines(markdown, width);

      const headerLine = lines.find((l) =>
        l.chunks.some((c) => c.text === '📋 Tasks:')
      );
      const task1Line = lines.find((l) =>
        l.chunks.some((c) => c.text === 'Task 1')
      );
      const task2Line = lines.find((l) =>
        l.chunks.some((c) => c.text === 'Task 2')
      );

      expect(headerLine).toBeDefined();
      expect(task1Line).toBeDefined();
      expect(task2Line).toBeDefined();

      const headerIdx = lines.indexOf(headerLine!);
      const t1Idx = lines.indexOf(task1Line!);
      const t2Idx = lines.indexOf(task2Line!);

      expect(t1Idx).toBeGreaterThan(headerIdx);
      expect(t2Idx).toBeGreaterThan(t1Idx);
    });

    it('handles leading newlines in code blocks', () => {
      const markdown = '```sigma-tasks\n\n- Task 1\n```';
      const lines = markdownToLines(markdown, width);

      // Should have an empty first line for the leading \n in the code block
      expect(lines.length).toBeGreaterThan(1);
      expect(lines[0].chunks.length).toBe(0);
      expect(lines[1].chunks[0].text).toContain('- Task 1');
    });
  });
});
