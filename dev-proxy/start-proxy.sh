#!/bin/bash
# Start Development SigV4 Proxy
# Usage: ./start-proxy.sh [port]

set -e

PORT=${1:-8080}
LAMBDA_URL="https://onourabnw45tm2rrq72gegkgai0codqj.lambda-url.us-west-2.on.aws"

echo "🔧 Starting SigV4 Development Proxy..."
echo "   Port: $PORT"
echo "   Lambda URL: $LAMBDA_URL"
echo

# Check if AWS credentials are available
if ! aws sts get-caller-identity &>/dev/null; then
    echo "❌ AWS credentials not found. Run 'aws configure' first."
    exit 1
fi

echo "✅ AWS credentials found"

# Install required Python packages if missing
if ! python3 -c "import boto3, requests" &>/dev/null; then
    echo "📦 Installing required packages..."
    pip3 install boto3 requests
fi

# Set environment variables and start proxy
export PROXY_PORT=$PORT
export LAMBDA_URL=$LAMBDA_URL

echo "🚀 Starting proxy on http://localhost:$PORT"
echo "   Press Ctrl+C to stop"
echo

python3 "$(dirname "$0")/sigv4_proxy.py"
