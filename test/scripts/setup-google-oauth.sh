#!/bin/bash

# Script to help set up Google OAuth credentials for Recipe Manager app
# This script will guide you through creating or retrieving OAuth 2.0 credentials

set -e

echo "========================================="
echo "Google OAuth Setup for Recipe Manager"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: gcloud CLI is not installed${NC}"
    echo "Please install it from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check authentication
echo "Checking gcloud authentication..."
ACCOUNT=$(gcloud config get-value account 2>/dev/null)
if [ -z "$ACCOUNT" ]; then
    echo -e "${YELLOW}No account found. Please authenticate first:${NC}"
    echo "Run: gcloud auth login"
    exit 1
fi
echo -e "${GREEN}Authenticated as: $ACCOUNT${NC}"
echo ""

# Get or set project
echo "Checking for Google Cloud project..."
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)

if [ -z "$PROJECT_ID" ]; then
    echo -e "${YELLOW}No default project set.${NC}"
    echo "Available projects:"
    gcloud projects list --format="table(projectId,name)" 2>/dev/null || {
        echo -e "${RED}Failed to list projects. Please ensure you have proper permissions.${NC}"
        echo "You may need to:"
        echo "1. Create a project at: https://console.cloud.google.com/projectcreate"
        echo "2. Re-authenticate: gcloud auth login"
        exit 1
    }

    echo ""
    read -p "Enter project ID (or 'new' to create one): " PROJECT_ID

    if [ "$PROJECT_ID" = "new" ]; then
        read -p "Enter new project ID (e.g., recipe-manager-12345): " NEW_PROJECT_ID
        read -p "Enter project name (e.g., Recipe Manager): " PROJECT_NAME

        echo "Creating project..."
        gcloud projects create "$NEW_PROJECT_ID" --name="$PROJECT_NAME" || {
            echo -e "${RED}Failed to create project${NC}"
            exit 1
        }
        PROJECT_ID=$NEW_PROJECT_ID
    fi

    gcloud config set project "$PROJECT_ID"
fi

echo -e "${GREEN}Using project: $PROJECT_ID${NC}"
echo ""

# Enable required APIs
echo "Enabling required APIs..."
gcloud services enable iamcredentials.googleapis.com 2>/dev/null || true
gcloud services enable cloudresourcemanager.googleapis.com 2>/dev/null || true

# Check for existing OAuth 2.0 clients
echo "Checking for existing OAuth 2.0 clients..."
echo ""

# Try to list OAuth clients using different methods
echo "Method 1: Checking via API..."
if gcloud auth application-default print-access-token &>/dev/null; then
    ACCESS_TOKEN=$(gcloud auth application-default print-access-token 2>/dev/null)

    # Try to list OAuth 2.0 clients
    RESPONSE=$(curl -s -H "Authorization: Bearer $ACCESS_TOKEN" \
        "https://iam.googleapis.com/v1/projects/$PROJECT_ID/clientConfigs" 2>/dev/null || echo "{}")

    if echo "$RESPONSE" | grep -q "error"; then
        echo -e "${YELLOW}Could not retrieve OAuth clients via API${NC}"
    else
        echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
    fi
fi

echo ""
echo "========================================="
echo -e "${YELLOW}Manual Setup Instructions:${NC}"
echo "========================================="
echo ""
echo "Since OAuth 2.0 client credentials cannot be directly retrieved via gcloud CLI,"
echo "please follow these steps to create or retrieve them:"
echo ""
echo "1. Go to Google Cloud Console:"
echo -e "   ${GREEN}https://console.cloud.google.com/apis/credentials?project=$PROJECT_ID${NC}"
echo ""
echo "2. Click 'CREATE CREDENTIALS' > 'OAuth client ID'"
echo ""
echo "3. If prompted, configure OAuth consent screen first:"
echo "   - User Type: External"
echo "   - App name: Recipe Manager"
echo "   - Support email: Your email"
echo "   - Authorized domains: recipes.help"
echo "   - Developer contact: Your email"
echo ""
echo "4. For OAuth client ID creation:"
echo "   - Application type: Web application"
echo "   - Name: Recipe Manager Web Client"
echo ""
echo "5. Add these Authorized redirect URIs:"
echo -e "   ${GREEN}https://powerful-salmon-99.clerk.accounts.dev/v1/oauth_callback${NC}"
echo -e "   ${GREEN}https://recipes.help/.clerk/oauth_callback${NC}"
echo ""
echo "6. After creation, you'll see:"
echo "   - Client ID: (copy this)"
echo "   - Client Secret: (copy this)"
echo ""
echo "7. Add these to your Clerk Dashboard:"
echo -e "   ${GREEN}https://dashboard.clerk.com${NC}"
echo "   Navigate to: Configure > SSO Connections > Google"
echo ""
echo "========================================="
echo -e "${YELLOW}Alternative: Download JSON Credentials${NC}"
echo "========================================="
echo ""
echo "You can also download the OAuth 2.0 credentials as JSON:"
echo "1. In the credentials page, click the download icon next to your OAuth client"
echo "2. Save the file as 'google-oauth-credentials.json'"
echo "3. Run this command to extract the values:"
echo ""
echo -e "${GREEN}cat google-oauth-credentials.json | jq '.web | {client_id, client_secret}'${NC}"
echo ""

# Create a simple extractor script
cat > extract-oauth-creds.sh << 'EOF'
#!/bin/bash
# Helper script to extract OAuth credentials from downloaded JSON

if [ -z "$1" ]; then
    echo "Usage: ./extract-oauth-creds.sh <path-to-credentials.json>"
    exit 1
fi

if [ ! -f "$1" ]; then
    echo "Error: File not found: $1"
    exit 1
fi

echo "Google OAuth Credentials:"
echo "========================="
CLIENT_ID=$(jq -r '.web.client_id // .installed.client_id' "$1" 2>/dev/null)
CLIENT_SECRET=$(jq -r '.web.client_secret // .installed.client_secret' "$1" 2>/dev/null)

if [ -z "$CLIENT_ID" ] || [ -z "$CLIENT_SECRET" ]; then
    echo "Error: Could not extract credentials from file"
    echo "Make sure the file is a valid OAuth 2.0 client JSON file"
    exit 1
fi

echo "Client ID: $CLIENT_ID"
echo "Client Secret: $CLIENT_SECRET"
echo ""
echo "Add these to Clerk Dashboard at:"
echo "https://dashboard.clerk.com > Configure > SSO Connections > Google"
EOF

chmod +x extract-oauth-creds.sh

echo "========================================="
echo -e "${GREEN}Helper script created: extract-oauth-creds.sh${NC}"
echo "========================================="
echo ""
echo "Use it after downloading your OAuth JSON file:"
echo "./extract-oauth-creds.sh <path-to-downloaded-credentials.json>"
echo ""

# Check if we can open the browser
if command -v open &> /dev/null; then
    echo ""
    read -p "Would you like to open the Google Cloud Console now? (y/n): " OPEN_CONSOLE
    if [ "$OPEN_CONSOLE" = "y" ] || [ "$OPEN_CONSOLE" = "Y" ]; then
        open "https://console.cloud.google.com/apis/credentials?project=$PROJECT_ID"
    fi
fi
