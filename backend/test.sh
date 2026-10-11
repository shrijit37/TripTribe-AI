k#!/usr/bin/env bash
set -euo pipefail

BASE="https://black-forest-labs-flux-1-schnell.hf.space"
PROMPT="A majestic fantasy castle in India"

# Submit an image-generation request.
RESPONSE=$(curl -fsS --max-time 30 \
  -X POST "$BASE/gradio_api/call/infer" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg p "$PROMPT" '{
    data: [$p, 0, true, 1024, 1024, 4]
  }')")

ID=$(jq -er '.event_id' <<< "$RESPONSE")

echo "Submitted: $ID"
echo "Waiting for the image..."

# Wait for the queued generation to finish.
curl -fsSN --max-time 240 \
  "$BASE/gradio_api/call/infer/$ID" \
  -o /tmp/flux-events.txt

# Extract the final result from the server-sent events.
DATA=$(sed -n 's/^data: //p' /tmp/flux-events.txt | tail -n 1)
IMAGE_URL=$(jq -er '.[0].url' <<< "$DATA")

# Resolve relative URLs, if returned.
case "$IMAGE_URL" in
  https://*|http://*) ;;
  /*) IMAGE_URL="$BASE$IMAGE_URL" ;;
  *) echo "Unexpected image URL: $IMAGE_URL" >&2; exit 1 ;;
esac

curl -fL "$IMAGE_URL" -o output.png
file output.png

echo "Saved image to output.png"
