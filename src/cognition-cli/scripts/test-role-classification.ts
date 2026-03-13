import { PGCManager } from '../src/core/pgc/manager.js';
import { RoleClassifier } from '../src/core/services/role-classifier.js';
import fs from 'fs-extra';
import path from 'path';

async function main() {
  const projectRoot = process.cwd();
  console.log(`🚀 Starting role classification E2E test in: ${projectRoot}`);

  const pgc = new PGCManager(projectRoot);
  const classifier = RoleClassifier.loadFromProject(projectRoot);

  console.log('📦 Reading structural_patterns manifest...');
  const manifest = await pgc.overlays.getManifest('structural_patterns');

  if (!manifest || Object.keys(manifest).length === 0) {
    console.error(
      '❌ No structural_patterns manifest found. Run "cognition-cli overlay generate structural_patterns" first.'
    );
    process.exit(1);
  }

  const roleGroups: Record<
    string,
    Array<{ symbol: string; filePath: string }>
  > = {};
  let totalPatterns = 0;

  const roleConfig = classifier.getConfig();
  console.log(`🔍 Classifying ${Object.keys(manifest).length} symbols...`);

  for (const [symbol, entry] of Object.entries(manifest)) {
    const parsed = pgc.overlays.parseManifestEntry(entry);
    const filePath = parsed.filePath || '';

    const role = classifier.classify(symbol, filePath);

    if (!roleGroups[role]) {
      roleGroups[role] = [];
    }
    roleGroups[role].push({ symbol, filePath });
    totalPatterns++;
  }

  const sortedRoles = Object.entries(roleGroups).sort(
    ([, a], [, b]) => b.length - a.length
  );

  const output = {
    type: 'structural',
    totalPatterns,
    roles: sortedRoles.map(([role, symbols]) => {
      const config = roleConfig.roles.find((r) => r.id === role);
      return {
        role,
        description: config?.description,
        count: symbols.length,
        symbols: symbols.map((s) => ({
          symbol: s.symbol,
          filePath: s.filePath,
        })),
      };
    }),
    generatedAt: new Date().toISOString(),
  };

  const outputPath = path.join(projectRoot, 'patterns-test.json');
  await fs.writeJson(outputPath, output, { spaces: 2 });

  console.log(`\n✅ Classification complete!`);
  console.log(`📊 Total patterns: ${totalPatterns}`);
  console.log(`📂 Output saved to: ${outputPath}`);

  console.log('\n📈 Distribution:');
  for (const [role, symbols] of sortedRoles) {
    const percentage = ((symbols.length / totalPatterns) * 100).toFixed(1);
    console.log(
      `  - ${role.padEnd(20)}: ${symbols.length.toString().padStart(5)} (${percentage}%)`
    );
  }
}

main().catch((error) => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});
