import {
  loadCommands,
  filterCommands,
  expandCommand,
} from '../src/tui/commands/loader.js';

async function test() {
  console.log('🔧 Testing Command Loader\n');
  console.log('='.repeat(50) + '\n');

  // Test loading
  const result = await loadCommands(process.cwd());

  console.log(`✅ Loaded: ${result.commands.size} commands`);
  console.log(`⚠️  Warnings: ${result.warnings.length}`);
  console.log(`❌ Errors: ${result.errors.length}\n`);

  if (result.warnings.length > 0) {
    console.log('Warnings:');
    result.warnings.forEach((w) => console.log(`  - ${w.file}: ${w.warning}`));
    console.log('');
  }

  if (result.errors.length > 0) {
    console.log('Errors:');
    result.errors.forEach((e) => console.log(`  - ${e.file}: ${e.error}`));
    console.log('');
  }

  // List first 10 commands
  console.log('Commands (first 10):');
  Array.from(result.commands.values())
    .slice(0, 10)
    .forEach((c) => {
      console.log(`  /${c.name}`);
      if (c.description) {
        console.log(
          `    ${c.description.slice(0, 60)}${c.description.length > 60 ? '...' : ''}`
        );
      }
      if (c.category) {
        console.log(`    Category: ${c.category}`);
      }
      console.log('');
    });

  // Test filtering
  console.log('='.repeat(50));
  console.log('\n🔍 Testing Filter:\n');

  const tests = ['quest', 'analyze', 'security', 'check'];
  tests.forEach((prefix) => {
    const filtered = filterCommands(prefix, result.commands);
    console.log(`  "${prefix}" → ${filtered.length} matches`);
    filtered.forEach((c) => console.log(`    - ${c.name}`));
    console.log('');
  });

  // Test expansion
  console.log('='.repeat(50));
  console.log('\n📝 Testing Expansion:\n');

  const testCommand = Array.from(result.commands.keys())[0];
  if (testCommand) {
    const expanded = expandCommand(
      `/${testCommand} src/cli.ts main`,
      result.commands
    );
    if (expanded) {
      console.log(`  Command: /${testCommand} src/cli.ts main`);
      console.log(`  Expanded (first 200 chars):`);
      console.log(
        `  ${expanded.slice(0, 200)}${expanded.length > 200 ? '...' : ''}\n`
      );
    }
  }

  // Test with placeholders
  const questStart = result.commands.get('quest-start');
  if (questStart) {
    console.log('  Testing placeholder expansion:');
    const expanded = expandCommand(
      '/quest-start implementing slash commands',
      result.commands
    );
    if (expanded) {
      console.log(
        `  Original content length: ${questStart.content.length} chars`
      );
      console.log(`  Expanded length: ${expanded.length} chars`);
      console.log(
        `  Has "User provided context": ${expanded.includes('User provided context')}`
      );
      console.log('');
    }
  }

  console.log('='.repeat(50));
  console.log('\n✅ All tests complete!\n');

  // Summary
  console.log('Summary:');
  console.log(`  Total commands: ${result.commands.size}`);
  console.log(
    `  Categories: ${new Set(Array.from(result.commands.values()).map((c) => c.category)).size}`
  );
  console.log(
    `  With descriptions: ${Array.from(result.commands.values()).filter((c) => c.description).length}`
  );
  console.log('');
}

test().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
