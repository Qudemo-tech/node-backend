#!/bin/bash

# HeyGen Webhook Registration Script
# This script registers your webhook endpoint with HeyGen's official webhook system
# Documentation: https://docs.heygen.com/docs/using-heygens-webhook-events

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════╗"
echo "║     HeyGen Webhook Registration Tool             ║"
echo "╚═══════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check if API key is provided
if [ -z "$HEYGEN_API_KEY" ]; then
    echo -e "${RED}Error: HEYGEN_API_KEY environment variable is not set${NC}"
    echo ""
    echo "Usage:"
    echo "  export HEYGEN_API_KEY='your-api-key'"
    echo "  ./register-heygen-webhook.sh"
    echo ""
    exit 1
fi

# Get webhook URL (allow override)
if [ -z "$WEBHOOK_URL" ]; then
    echo -e "${YELLOW}Enter your webhook URL:${NC}"
    echo "Example: https://your-backend.com/api/qudemos/heygen-callback"
    read -p "> " WEBHOOK_URL
fi

echo ""
echo -e "${BLUE}Webhook URL:${NC} $WEBHOOK_URL"
echo ""

# Confirm
read -p "Register this webhook with HeyGen? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Cancelled.${NC}"
    exit 0
fi

echo ""
echo -e "${BLUE}🚀 Registering webhook with HeyGen...${NC}"
echo ""

# Register webhook
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    --location 'https://api.heygen.com/v1/webhook/endpoint.add' \
    --header 'Content-Type: application/json' \
    --header "X-Api-Key: $HEYGEN_API_KEY" \
    --data "{
        \"url\": \"$WEBHOOK_URL\",
        \"events\": [\"avatar_video.success\", \"avatar_video.fail\"]
    }")

# Extract body and status
HTTP_BODY=$(echo "$RESPONSE" | sed -e 's/HTTP_STATUS\:.*//g')
HTTP_STATUS=$(echo "$RESPONSE" | tr -d '\n' | sed -e 's/.*HTTP_STATUS://')

if [ "$HTTP_STATUS" -eq 200 ] || [ "$HTTP_STATUS" -eq 201 ]; then
    echo -e "${GREEN}✅ Webhook registered successfully!${NC}"
    echo ""
    echo -e "${BLUE}Response:${NC}"
    echo "$HTTP_BODY" | python3 -m json.tool 2>/dev/null || echo "$HTTP_BODY"
    echo ""
    
    # Extract and display important info
    ENDPOINT_ID=$(echo "$HTTP_BODY" | grep -o '"endpoint_id":"[^"]*"' | cut -d'"' -f4)
    SECRET=$(echo "$HTTP_BODY" | grep -o '"secret":"[^"]*"' | cut -d'"' -f4)
    
    if [ ! -z "$ENDPOINT_ID" ]; then
        echo -e "${GREEN}📋 Important Information:${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo -e "Endpoint ID: ${YELLOW}$ENDPOINT_ID${NC}"
        echo -e "Secret:      ${YELLOW}$SECRET${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo -e "${BLUE}💡 Save these values!${NC}"
        echo ""
        echo "Add to your .env file:"
        echo "  HEYGEN_WEBHOOK_ENDPOINT_ID=$ENDPOINT_ID"
        echo "  HEYGEN_WEBHOOK_SECRET=$SECRET"
        echo ""
    fi
    
    echo -e "${GREEN}🎉 Setup complete!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Ensure your backend stores heygen_video_id when generating videos"
    echo "  2. Test by generating an avatar video"
    echo "  3. Check backend logs for webhook events"
    echo ""
else
    echo -e "${RED}❌ Failed to register webhook${NC}"
    echo ""
    echo -e "${RED}Status Code: $HTTP_STATUS${NC}"
    echo ""
    echo -e "${YELLOW}Response:${NC}"
    echo "$HTTP_BODY" | python3 -m json.tool 2>/dev/null || echo "$HTTP_BODY"
    echo ""
    exit 1
fi

