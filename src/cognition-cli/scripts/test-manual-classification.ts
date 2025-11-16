/**
 * Manual Document Classification Validator
 *
 * Tests all manual docs to ensure they meet 75% confidence threshold
 * before ingestion.
 */

import { MarkdownParser } from './src/core/parsers/markdown-parser.js';
import { DocumentClassifier } from './src/core/analyzers/document-classifier.js';
import fs from 'fs';
import path from 'path';

const CONFIDENCE_THRESHOLD = 0.75;

interface ValidationResult {
  file: string;
  confidence: number;
  type: string;
  passed: boolean;
  reasoning: string[];
}

async function validateManualDocs(): Promise<void> {
  const manualDir = './docs/manual';
  const parser = new MarkdownParser();
  const classifier = new DocumentClassifier();

  const results: ValidationResult[] = [];

  // Find all markdown files
  const files = findMarkdownFiles(manualDir);

  console.log('🔍 Validating Manual Document Classification');
  console.log('━'.repeat(70));
  console.log(`Threshold: ${CONFIDENCE_THRESHOLD * 100}%`);
  console.log(`Files found: ${files.length}\n`);

  for (const file of files) {
    const relativePath = path.relative(process.cwd(), file);

    // Parse and classify (parser reads from disk)
    const doc = await parser.parse(file);

    // Ensure sections array exists
    if (!doc.sections) {
      doc.sections = [];
    }

    // Debug: Show what metadata was extracted
    if (file.includes('README.md')) {
      console.log(
        '\n[DEBUG] README.md metadata:',
        JSON.stringify(doc.metadata, null, 2)
      );
    }

    const classification = classifier.classify(doc, relativePath);

    const passed = classification.confidence >= CONFIDENCE_THRESHOLD;

    results.push({
      file: relativePath,
      confidence: classification.confidence,
      type: classification.type,
      passed,
      reasoning: classification.reasoning,
    });

    // Display result
    const icon = passed ? '✅' : '❌';
    const confidenceStr = `${(classification.confidence * 100).toFixed(1)}%`;
    console.log(
      `${icon} ${confidenceStr.padEnd(6)} ${classification.type.padEnd(15)} ${path.basename(file)}`
    );
  }

  // Summary
  console.log('\n' + '━'.repeat(70));
  const passCount = results.filter((r) => r.passed).length;
  const failCount = results.filter((r) => !r.passed).length;

  console.log(`\n📊 Results: ${passCount} passed, ${failCount} failed`);

  if (failCount > 0) {
    console.log('\n⚠️  Failed Documents (need frontmatter):');
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`\n  ${r.file}`);
        console.log(`    Confidence: ${(r.confidence * 100).toFixed(1)}%`);
        console.log(`    Type: ${r.type}`);
        console.log(`    Reasoning: ${r.reasoning.join(', ')}`);
      });
  } else {
    console.log('\n✅ All documents meet confidence threshold!');
  }

  // Exit code
  process.exit(failCount > 0 ? 1 : 0);
}

function findMarkdownFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(currentPath: string) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files.sort();
}

// Run validation
validateManualDocs().catch((err) => {
  console.error('Validation failed:', err);
  process.exit(1);
});
