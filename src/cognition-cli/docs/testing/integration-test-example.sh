#!/bin/bash
# Example script to run integration tests with eGemma

set -e  # Exit on error

echo "🚀 Starting eGemma Integration Test Workflow"
echo "==========================================="
echo

# 1. Check if eGemma is running
echo "1️⃣  Checking if eGemma is running..."
if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo "✅ eGemma is running"
else
    echo "❌ eGemma is not running"
    echo
    echo "To start eGemma:"
    echo "  cd ~/src/egemma"
    echo "  uv run uvicorn src.server:app --host localhost --port 8000"
    exit 1
fi

# 2. Check if chat model is loaded
echo
echo "2️⃣  Checking if chat model is loaded..."
HEALTH_JSON=$(curl -s http://localhost:8000/health)
MODEL_STATUS=$(echo "$HEALTH_JSON" | grep -o '"chat_model"[^}]*"status":"[^"]*"' | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

if [ "$MODEL_STATUS" = "loaded" ]; then
    echo "✅ Chat model is loaded"
else
    echo "❌ Chat model is not loaded (status: $MODEL_STATUS)"
    exit 1
fi

# 3. Check tool support
echo
echo "3️⃣  Checking tool support..."
SUPPORTS_TOOLS=$(echo "$HEALTH_JSON" | grep -o '"chat_model"[^}]*"supports_tools":[^,}]*' | grep -o '"supports_tools":[^,}]*' | cut -d':' -f2)

if [ "$SUPPORTS_TOOLS" = "true" ]; then
    echo "✅ Tool calling is supported"
else
    echo "❌ Tool calling is not supported"
    exit 1
fi

# 4. Set environment variables
echo
echo "4️⃣  Setting environment variables..."
export WORKBENCH_URL=http://localhost:8000/v1
export WORKBENCH_API_KEY=dummy-key
echo "✅ WORKBENCH_URL=$WORKBENCH_URL"
echo "✅ WORKBENCH_API_KEY=dummy-key"

# 5. Run integration tests
echo
echo "5️⃣  Running integration tests..."
echo "==========================================="
cd /Users/MHUSADZI/src/cogx/src/cognition-cli
npm run test:integration

# 6. Summary
echo
echo "==========================================="
echo "✅ Integration tests complete!"
echo
