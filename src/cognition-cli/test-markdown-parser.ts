import { MarkdownParser } from './src/core/parsers/markdown-parser';
import { resolve } from 'path';

async function testParser() {
  const parser = new MarkdownParser();

  // Test on README.md
  const readmePath = resolve(__dirname, '../../README.md');

  console.log('🔍 Parsing README.md...\n');

  const doc = await parser.parse(readmePath);

  console.log(`✅ Document Hash: ${doc.hash}`);
  console.log(`✅ Title: ${doc.metadata.title}`);
  console.log(`✅ Total sections: ${doc.sections.length}\n`);

  console.log('📋 Top-level sections:');
  doc.sections.forEach((section, i) => {
    console.log(`  ${i + 1}. [H${section.level}] ${section.heading}`);
    console.log(`     Hash: ${section.structuralHash.substring(0, 12)}...`);
    console.log(`     Content length: ${section.content.length} chars`);
    console.log(`     Children: ${section.children.length}`);
    if (section.children.length > 0) {
      section.children.slice(0, 3).forEach((child, j) => {
        console.log(`       ${i + 1}.${j + 1}. [H${child.level}] ${child.heading}`);
      });
      if (section.children.length > 3) {
        console.log(`       ... and ${section.children.length - 3} more`);
      }
    }
    console.log();
  });

  // Find Vision/Mission sections
  console.log('🎯 Looking for mission-critical sections:');
  const missionKeywords = ['vision', 'mission', 'principles', 'goals'];

  function findSections(sections: any[], depth = 0): void {
    for (const section of sections) {
      const heading = section.heading.toLowerCase();
      const isImportant = missionKeywords.some(kw => heading.includes(kw));

      if (isImportant) {
        console.log(`  ${'  '.repeat(depth)}✨ [H${section.level}] ${section.heading}`);
        console.log(`  ${'  '.repeat(depth)}   Content preview: ${section.content.substring(0, 100)}...`);
      }

      if (section.children.length > 0) {
        findSections(section.children, depth + 1);
      }
    }
  }

  findSections(doc.sections);
}

testParser().catch(console.error);
