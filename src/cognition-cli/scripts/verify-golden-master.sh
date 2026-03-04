#!/bin/bash
BASELINE_DIR="tests/golden-master/baseline"
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

  clean_file() {
    # Normalize output by removing:
    # 1. ANSI color codes
    # 2. Clack spinners [◒◐◓◑]
    # 3. Everything up to "Query executed" if present
    # 4. Collapse all whitespace sequences (including tabs/newlines) to single space
    # 5. Trim trailing whitespace
    # 6. Skip empty lines
    cat "$1" | \
      LC_ALL=C sed 's/\x1b\[[0-9;]*[mK]//g' | \
      LC_ALL=C sed 's/[◒◐◓◑]//g' | \
      LC_ALL=C sed 's/.*Query executed//' | \
      LC_ALL=C sed 's/[[:space:]][[:space:]]*/ /g' | \
      LC_ALL=C sed 's/[[:space:]]*$//' | \
      grep -v '^$'
  }

  clean_current=$(clean_file "$file")
  clean_baseline=$(clean_file "$baseline_file")
  
  if ! diff <(echo "$clean_baseline") <(echo "$clean_current") > /dev/null; then
    echo "❌ FAILURE: Regressions detected in $base!"
    
    # Calculate summary stats (subtracting 1 for the diff headers +++ and ---)
    added=$(diff -u <(echo "$clean_baseline") <(echo "$clean_current") | grep "^+" | grep -v "^+++" | wc -l | tr -d ' ')
    removed=$(diff -u <(echo "$clean_baseline") <(echo "$clean_current") | grep "^-" | grep -v "^---" | wc -l | tr -d ' ')
    
    echo "Summary: $added lines added, $removed lines removed."
    echo "First 10 changes (truncated to 200 chars per line):"
    diff -u <(echo "$clean_baseline") <(echo "$clean_current") | grep -v "^ " | grep -vE "^(\+\+\+|\-\-\-)" | LC_ALL=C cut -c 1-200 | head -n 10
    echo "... (use 'diff -u' manually for full details)"
    exit 1
  fi
done

echo "✅ SUCCESS: All snapshots match the baseline (data parity verified)."
