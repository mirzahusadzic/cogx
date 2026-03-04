#!/bin/bash
# Golden Master test for PGC Pattern Managers
# Usage: ./scripts/test-cli-golden-master.sh

OUTPUT_DIR="test-results/golden-master"
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# Set environment variables
export CI=1
export NO_COLOR=1
export COLUMNS=1000

echo "Starting Golden Master snapshots..."

# Helper to run and clean
run_and_clean() {
  local cmd="$1"
  local output="$2"
  echo "Running: $cmd"
  eval "$cmd" > "$output" 2>/dev/null
  if [ -f "$output" ]; then
    perl -pi -e 's/[◒◐◓◑]//g' "$output"
    perl -pi -e 's/\x1b\[[0-9;]*[mK]//g' "$output"
    perl -pi -e 's/\s+$//' "$output"
  fi
}

# Concepts
run_and_clean "node dist/cli.js concepts list --json" "$OUTPUT_DIR/concepts_list.json"
run_and_clean "node dist/cli.js concepts top 5 --json" "$OUTPUT_DIR/concepts_top_5.json"
run_and_clean "node dist/cli.js concepts search Operational --json" "$OUTPUT_DIR/concepts_search_Operational.json"
run_and_clean "node dist/cli.js concepts by-section \"Operational Patterns\" --json" "$OUTPUT_DIR/concepts_by_section_Operational_Patterns.json"
run_and_clean "node dist/cli.js concepts inspect \"Rigorous types\" --json" "$OUTPUT_DIR/concepts_inspect_Rigorous_types.json"

# Patterns
run_and_clean "node dist/cli.js patterns list --json" "$OUTPUT_DIR/patterns_list.json"
run_and_clean "node dist/cli.js patterns find-similar StructuralPatternsManager --top-k 3 --json" "$OUTPUT_DIR/patterns_find_similar_StructuralPatternsManager.json"
run_and_clean "node dist/cli.js patterns analyze --json" "$OUTPUT_DIR/patterns_analyze.json"
run_and_clean "node dist/cli.js patterns inspect StructuralPatternsManager --json" "$OUTPUT_DIR/patterns_inspect_StructuralPatternsManager.json"
run_and_clean "node dist/cli.js patterns graph StructuralPatternsManager --json" "$OUTPUT_DIR/patterns_graph_StructuralPatternsManager.json"
run_and_clean "node dist/cli.js patterns compare StructuralPatternsManager LineagePatternsManager --json" "$OUTPUT_DIR/patterns_compare_StructuralPatternsManager_LineagePatternsManager.json"

# Security
run_and_clean "node dist/cli.js security list --json" "$OUTPUT_DIR/security_list.json"
run_and_clean "node dist/cli.js security list --type attack_vector --json" "$OUTPUT_DIR/security_list_type_attack_vector.json"
run_and_clean "node dist/cli.js security list --severity high --json" "$OUTPUT_DIR/security_list_severity_high.json"
run_and_clean "node dist/cli.js security attacks --json" "$OUTPUT_DIR/security_attacks.json"
run_and_clean "node dist/cli.js security coverage-gaps --json" "$OUTPUT_DIR/security_coverage_gaps.json"
run_and_clean "node dist/cli.js security boundaries --json" "$OUTPUT_DIR/security_boundaries.json"
run_and_clean "node dist/cli.js security cves --json" "$OUTPUT_DIR/security_cves.json"
run_and_clean "node dist/cli.js security query encryption --json" "$OUTPUT_DIR/security_query_encryption.json"

# Lattice (No --json as requested)
run_and_clean "node dist/cli.js lattice \"O2[attack_vector] ~ O4[principle]\"" "$OUTPUT_DIR/lattice_O2_attack_vector_O4_principle.txt"
run_and_clean "node dist/cli.js lattice \"O1 - O2\"" "$OUTPUT_DIR/lattice_O1_minus_O2.txt"
run_and_clean "node dist/cli.js lattice \"O4 | O5\"" "$OUTPUT_DIR/lattice_O4_union_O5.txt"
run_and_clean "node dist/cli.js lattice \"O2 & O4\"" "$OUTPUT_DIR/lattice_O2_intersect_O4.txt"
# run_and_clean "node dist/cli.js lattice \"O1 ~ O3\"" "$OUTPUT_DIR/lattice_O1_tilde_O3.txt"

run_and_clean "node dist/cli.js lattice \"O3\" --limit 10 --json" "$OUTPUT_DIR/lattice_O3.json"
echo "Golden Master snapshots updated in: $OUTPUT_DIR"
