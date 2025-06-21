#!/bin/bash
CHECKPOINT_NAME=$1
if [ -z "$CHECKPOINT_NAME" ]; then
  echo "Usage: ./scripts/checkpoint.sh create \"Checkpoint Name\""
  exit 1
fi
mkdir -p .checkpoints
touch ".checkpoints/$(echo $CHECKPOINT_NAME | tr ' ' '_' | tr -cd '[:alnum:]_')"
echo "Checkpoint created: $CHECKPOINT_NAME"
