import { connect } from '@lancedb/lancedb';
import path from 'path';

const RCA_ROOT = '/Users/MHUSADZI/src/rca-catalyst';

async function checkTable(dbPath: string, tableName: string) {
  try {
    const fullPath = path.join(RCA_ROOT, dbPath);
    const db = await connect(fullPath);
    const table = await db.openTable(tableName);
    const count = await table.countRows();
    console.log(`  ${tableName}: ${count} vectors`);
    return count;
  } catch (error) {
    console.log(`  ${tableName}: ERROR - ${(error as Error).message}`);
    return 0;
  }
}

async function main() {
  console.log('\nOLD document_concepts table:');
  const oldCount = await checkTable(
    '.open_cognition/lance/documents.lancedb',
    'document_concepts'
  );

  console.log('\nNEW pattern tables:');
  const sg = await checkTable(
    '.open_cognition/patterns.lancedb',
    'security_guidelines'
  );
  const mc = await checkTable(
    '.open_cognition/patterns.lancedb',
    'mission_concepts_multi_temp'
  );
  const op = await checkTable(
    '.open_cognition/patterns.lancedb',
    'operational_patterns'
  );
  const mp = await checkTable(
    '.open_cognition/patterns.lancedb',
    'mathematical_proofs'
  );
  const sp = await checkTable(
    '.open_cognition/patterns.lancedb',
    'structural_patterns'
  );
  const mi = await checkTable(
    '.open_cognition/patterns.lancedb',
    'mission_integrity'
  );

  console.log(`\nSummary:`);
  console.log(`  OLD: ${oldCount} vectors`);
  console.log(`  NEW: ${sg + mc + op + mp + sp + mi} vectors total`);
}

main();
