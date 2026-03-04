#!/bin/bash
BASELINE_DIR="test-results/baseline"
CURRENT_DIR="test-results/golden-master"

echo "Comparing current snapshots against baseline (ignoring progress dots)..."

# Run the test script to update current snapshots
./scripts/test-cli-golden-master.sh > /dev/null

# For each file in current snapshots
for file in "$CURRENT_DIR"/*; do
  base=$(basename "$file")
  baseline_file="$BASELINE_DIR/$base"
  
  if [ ! -f "$baseline_file" ]; then
    echo "⚠️  WARNING: New snapshot found: $base (no baseline yet)"
    continue
  fi

  # Clean both files for comparison:
  # 1. Remove Clack spinner frames [◒◐◓◑]
  # 2. Remove "Executing query" and progress dots (.)
  # 3. Remove ANSI color codes
  # 4. Remove trailing whitespace
  
  clean_file() {
    # Replace the progress line with a placeholder or just remove the patterns
    # Clack spinners: [◒◐◓◑]
    # Progress dots: any sequence of "  . " or "Executing query"
    cat "$1" | \
      sed 's/\x1b\[[0-9;]*[mK]//g' | \
      sed 's/[◒◐◓◑]//g' | \
      sed 's/Executing query//g' | \
      sed 's/ \.* / /g' | \
      sed 's/^\.*$//g' | \
      sed 's/[[:space:]]*$//' | \
      grep -v '^$'
  }

  clean_current=$(clean_file "$file")
  clean_baseline=$(clean_file "$baseline_file")
  
  if ! diff <(echo "$clean_baseline") <(echo "$clean_current") > /dev/null; then
    echo "❌ FAILURE: Regressions detected in $base!"
    # Show the diff without progress clutter
    diff -u <(echo "$clean_baseline") <(echo "$clean_current")
    exit 1
  fi
done

echo "✅ SUCCESS: All snapshots match the baseline (data parity verified)."
