#!/bin/bash
echo "Starting multi-tool benchmark..."
for i in {1..5}; do
  echo "Task $i: starting heavy output..."
  # Simulate a tool that produces high-volume output
  seq 1 200 | while read line; do
    echo "Task $i: Line $line"
    # sleep 0.001
  done &
done
wait
echo "Benchmark complete."
