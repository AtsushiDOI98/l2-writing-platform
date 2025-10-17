#!/bin/bash
echo "Starting warm-up for L2 Writing Platform..."

for i in {1..8}; do
  curl -s "https://l2-writing-platform.onrender.com/api/wcf" \
  -X POST -H "Content-Type: application/json" \
  -d '{"text":"warmup test"}' > /dev/null &
done

wait
echo "Warm-up complete!"
