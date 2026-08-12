#!/bin/bash
# Deployment script for danpearson.net Edge Functions to Coolify
# Usage: ./deploy-coolify.sh [environment] [--build|--test-local]
# Example: ./deploy-coolify.sh production
#
# Function code lives in supabase/functions at the repository root, not in
# danpearson-edge-functions. Local builds therefore use the repository root as
# the build context:
#   docker build -f danpearson-edge-functions/Dockerfile .
# Env files (.env, .env.<environment>) are still read from danpearson-edge-functions.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-production}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Runtime directory (danpearson-edge-functions): holds .env files and the Dockerfile.
RUNTIME_DIR="$(dirname "$SCRIPT_DIR")"
# Repository root: the Docker build context, because the Dockerfile copies
# supabase/functions, which is the single source of truth for function code.
REPO_ROOT="$(dirname "$RUNTIME_DIR")"
DOCKERFILE="$RUNTIME_DIR/Dockerfile"

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}danpearson.net Edge Functions Deployment${NC}"
echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# Load environment-specific configuration
ENV_FILE="$RUNTIME_DIR/.env.$ENVIRONMENT"
if [ -f "$ENV_FILE" ]; then
    echo -e "${GREEN}✓ Loading environment from: $ENV_FILE${NC}"
    export $(cat "$ENV_FILE" | grep -v '^#' | xargs)
else
    echo -e "${YELLOW}⚠ No environment file found at: $ENV_FILE${NC}"
    echo -e "${YELLOW}⚠ Using .env file${NC}"
    ENV_FILE="$RUNTIME_DIR/.env"
    if [ -f "$ENV_FILE" ]; then
        export $(cat "$ENV_FILE" | grep -v '^#' | xargs)
    else
        echo -e "${RED}✗ No .env file found!${NC}"
        exit 1
    fi
fi

# Validate required environment variables
echo -e "${BLUE}Validating environment variables...${NC}"
REQUIRED_VARS=(
    "SUPABASE_URL"
    "SUPABASE_ANON_KEY"
    "SUPABASE_SERVICE_ROLE_KEY"
)

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo -e "${RED}✗ Required environment variable $var is not set${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ $var is set${NC}"
done

# Check if Coolify webhook URL is configured
if [ -z "$COOLIFY_WEBHOOK_URL" ]; then
    echo -e "${YELLOW}⚠ COOLIFY_WEBHOOK_URL not set. Manual deployment required.${NC}"
    MANUAL_DEPLOY=true
else
    echo -e "${GREEN}✓ COOLIFY_WEBHOOK_URL is configured${NC}"
    MANUAL_DEPLOY=false
fi

# Build Docker image locally (optional, for testing)
if [ "$2" == "--build" ]; then
    echo -e "${BLUE}Building Docker image locally...${NC}"
    # Build context is the repository root; the Dockerfile copies both
    # supabase/functions and danpearson-edge-functions/server.ts.
    cd "$REPO_ROOT"
    docker build -f "$DOCKERFILE" -t danpearson-edge-functions:test .
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Docker image built successfully${NC}"
    else
        echo -e "${RED}✗ Docker build failed${NC}"
        exit 1
    fi
fi

# Test locally (optional)
if [ "$2" == "--test-local" ]; then
    echo -e "${BLUE}Testing locally...${NC}"
    cd "$REPO_ROOT"

    # Build first so the tag exists even when --build was not passed.
    docker build -f "$DOCKERFILE" -t danpearson-edge-functions:test .

    # Start container
    docker run -d \
        --name danpearson-functions-test \
        -p 8000:8000 \
        -e SUPABASE_URL="$SUPABASE_URL" \
        -e SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" \
        -e SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
        danpearson-edge-functions:test
    
    # Wait for container to start
    sleep 5
    
    # Test health endpoint
    echo -e "${BLUE}Testing health endpoint...${NC}"
    if curl -f http://localhost:8000/_health; then
        echo -e "${GREEN}✓ Health check passed${NC}"
    else
        echo -e "${RED}✗ Health check failed${NC}"
        docker logs danpearson-functions-test
        docker stop danpearson-functions-test
        docker rm danpearson-functions-test
        exit 1
    fi
    
    # Cleanup
    docker stop danpearson-functions-test
    docker rm danpearson-functions-test
    
    echo -e "${GREEN}✓ Local test passed${NC}"
fi

# Deploy to Coolify
if [ "$MANUAL_DEPLOY" = false ]; then
    echo -e "${BLUE}Triggering Coolify deployment...${NC}"
    
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$COOLIFY_WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d "{
            \"branch\": \"main\",
            \"message\": \"Deploy edge functions - $(date)\"
        }")
    
    if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "201" ]; then
        echo -e "${GREEN}✓ Deployment triggered successfully${NC}"
    else
        echo -e "${RED}✗ Failed to trigger deployment (HTTP $RESPONSE)${NC}"
        exit 1
    fi
    
    # Wait for deployment
    echo -e "${BLUE}Waiting for deployment to complete...${NC}"
    sleep 30
    
    # Verify deployment
    echo -e "${BLUE}Verifying deployment...${NC}"
    MAX_RETRIES=10
    RETRY_DELAY=10
    
    for i in $(seq 1 $MAX_RETRIES); do
        echo -e "${BLUE}Attempt $i of $MAX_RETRIES...${NC}"
        
        HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://functions.danpearson.net/_health)
        
        if [ "$HEALTH_RESPONSE" = "200" ]; then
            echo -e "${GREEN}✓ Deployment successful! Health check passed.${NC}"
            
            # Display health data
            echo -e "${BLUE}Health check response:${NC}"
            curl -s https://functions.danpearson.net/_health | jq '.'
            
            # Success!
            echo ""
            echo -e "${GREEN}======================================${NC}"
            echo -e "${GREEN}✓ Deployment completed successfully!${NC}"
            echo -e "${GREEN}======================================${NC}"
            echo -e "${GREEN}🔗 https://functions.danpearson.net${NC}"
            echo ""
            
            exit 0
        fi
        
        echo -e "${YELLOW}Health check returned $HEALTH_RESPONSE, retrying in ${RETRY_DELAY}s...${NC}"
        sleep $RETRY_DELAY
    done
    
    echo -e "${RED}✗ Deployment verification failed after $MAX_RETRIES attempts${NC}"
    exit 1
    
else
    echo -e "${YELLOW}======================================${NC}"
    echo -e "${YELLOW}Manual Deployment Required${NC}"
    echo -e "${YELLOW}======================================${NC}"
    echo ""
    echo -e "${YELLOW}Please complete these steps in Coolify:${NC}"
    echo ""
    echo "1. Go to your Coolify dashboard"
    echo "2. Navigate to the danpearson-edge-functions service"
    echo "3. Confirm Build Context is the repository root and Dockerfile Location"
    echo "   is danpearson-edge-functions/Dockerfile"
    echo "4. Click 'Deploy' or 'Redeploy'"
    echo "5. Wait for the deployment to complete"
    echo "6. Verify: https://functions.danpearson.net/_health"
    echo ""
fi
