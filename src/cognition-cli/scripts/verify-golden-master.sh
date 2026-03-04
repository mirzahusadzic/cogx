#!/bin/bash
BASELINE_DIR="test-results/baseline"
CURRENT_DIR="test-results/golden-master"

echo "Comparing current snapshots against baseline..."

# Run the test script to update current snapshots
./scripts/test-cli-golden-master.sh > /dev/null

# Diff the directories
diff -r "$BASELINE_DIR" "$CURRENT_DIR"

if [ $? -eq 0 ]; then
    echo "✅ SUCCESS: All snapshots match the baseline perfectly."
else
    echo "❌ FAILURE: Regressions detected! See diff above."
    exit 1
fi
