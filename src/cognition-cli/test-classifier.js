import { DocumentClassifier } from './dist/core/analyzers/document-classifier.js';
import { MarkdownParser } from './dist/core/parsers/markdown-parser.js';
import { WorkflowExtractor } from './dist/core/analyzers/workflow-extractor.js';

async function testClassifier() {
  const classifier = new DocumentClassifier();
  const parser = new MarkdownParser();

  // Test 1: OPERATIONAL_LATTICE.md
  console.log('🧪 Testing OPERATIONAL_LATTICE.md classification...\n');
  const opDoc = await parser.parse(
    'docs/overlays/O5_operational/OPERATIONAL_LATTICE.md'
  );
  const opResult = classifier.classify(
    opDoc,
    'docs/overlays/O5_operational/OPERATIONAL_LATTICE.md'
  );

  console.log(`Type: ${opResult.type}`);
  console.log(`Confidence: ${(opResult.confidence * 100).toFixed(1)}%`);
  console.log(`Reasoning:`);
  opResult.reasoning.forEach((r) => console.log(`  - ${r}`));

  // Test 2: Extract operational patterns
  if (opResult.type === 'operational') {
    console.log('\n📋 Extracting operational patterns...\n');
    const extractor = new WorkflowExtractor();
    const patterns = extractor.extract(opDoc);

    console.log(`Found ${patterns.length} patterns:`);
    patterns.slice(0, 10).forEach((p, i) => {
      console.log(
        `\n${i + 1}. [${p.patternType}] ${p.text.substring(0, 80)}${p.text.length > 80 ? '...' : ''}`
      );
      console.log(`   Section: ${p.section}`);
      console.log(`   Weight: ${p.weight.toFixed(2)}`);
      if (p.metadata) {
        console.log(
          `   Metadata: ${JSON.stringify(p.metadata, null, 2).substring(0, 100)}`
        );
      }
    });

    if (patterns.length > 10) {
      console.log(`\n... and ${patterns.length - 10} more patterns`);
    }
  }

  // Test 3: VISION.md (should be strategic)
  console.log('\n\n🧪 Testing VISION.md classification...\n');
  const visionDoc = await parser.parse('../../VISION.md');
  const visionResult = classifier.classify(visionDoc, '../../VISION.md');

  console.log(`Type: ${visionResult.type}`);
  console.log(`Confidence: ${(visionResult.confidence * 100).toFixed(1)}%`);
  console.log(`Reasoning:`);
  visionResult.reasoning.forEach((r) => console.log(`  - ${r}`));
}

testClassifier().catch(console.error);
