#!/usr/bin/env python3
"""
Google OAuth Setup Helper for Recipe Manager
This script helps you set up Google OAuth credentials for Clerk integration.
"""

import json
import sys
import subprocess
from pathlib import Path

# Colors for terminal output
RED = "\033[0;31m"
GREEN = "\033[0;32m"
YELLOW = "\033[1;33m"
BLUE = "\033[0;34m"
NC = "\033[0m"  # No Color


def print_header(title):
    """Print a formatted header"""
    print(f"\n{'=' * 50}")
    print(f"{BLUE}{title}{NC}")
    print("=" * 50)


def print_success(message):
    """Print success message in green"""
    print(f"{GREEN}✓ {message}{NC}")


def print_warning(message):
    """Print warning message in yellow"""
    print(f"{YELLOW}⚠ {message}{NC}")


def print_error(message):
    """Print error message in red"""
    print(f"{RED}✗ {message}{NC}")


def check_gcloud():
    """Check if gcloud is installed and authenticated"""
    try:
        result = subprocess.run(["which", "gcloud"], capture_output=True, text=True)
        if result.returncode != 0:
            return False, "gcloud CLI not installed"

        # Check authentication
        result = subprocess.run(
            ["gcloud", "config", "get-value", "account"], capture_output=True, text=True
        )
        account = result.stdout.strip()

        if not account:
            return False, "Not authenticated with gcloud"

        return True, f"Authenticated as {account}"
    except Exception as e:
        return False, str(e)


def get_project_id():
    """Get the current Google Cloud project ID"""
    try:
        result = subprocess.run(
            ["gcloud", "config", "get-value", "project"], capture_output=True, text=True
        )
        return result.stdout.strip() if result.returncode == 0 else None
    except Exception:
        return None


def extract_credentials_from_json(file_path):
    """Extract OAuth credentials from a downloaded JSON file"""
    try:
        with open(file_path, "r") as f:
            data = json.load(f)

        # Try to extract from web or installed application format
        if "web" in data:
            client_data = data["web"]
        elif "installed" in data:
            client_data = data["installed"]
        else:
            return None, None

        client_id = client_data.get("client_id")
        client_secret = client_data.get("client_secret")

        return client_id, client_secret
    except Exception as e:
        print_error(f"Error reading credentials file: {e}")
        return None, None


def create_env_file(client_id, client_secret):
    """Create or update .env.local file with OAuth credentials"""
    env_file = Path(".env.local")

    # Read existing content if file exists
    existing_content = []
    if env_file.exists():
        with open(env_file, "r") as f:
            existing_content = f.readlines()

    # Remove old OAuth entries if they exist
    filtered_content = [
        line
        for line in existing_content
        if not line.startswith("GOOGLE_CLIENT_ID")
        and not line.startswith("GOOGLE_CLIENT_SECRET")
    ]

    # Add new OAuth credentials
    filtered_content.append("\n# Google OAuth Credentials for Clerk\n")
    filtered_content.append(f"GOOGLE_CLIENT_ID={client_id}\n")
    filtered_content.append(f"GOOGLE_CLIENT_SECRET={client_secret}\n")

    # Write back to file
    with open(env_file, "w") as f:
        f.writelines(filtered_content)

    print_success(f"Credentials saved to {env_file}")


def main():
    print_header("Google OAuth Setup for Recipe Manager")

    # Check gcloud status
    print("\nChecking environment...")
    gcloud_ok, message = check_gcloud()
    if gcloud_ok:
        print_success(message)
        project_id = get_project_id()
        if project_id:
            print_success(f"Using project: {project_id}")
    else:
        print_warning(message)
        project_id = None

    # Provide setup instructions
    print_header("Setup Instructions")

    print("\n1. Go to Google Cloud Console:")
    if project_id:
        print(
            f"   {GREEN}https://console.cloud.google.com/apis/credentials?project={project_id}{NC}"
        )
    else:
        print(f"   {GREEN}https://console.cloud.google.com/apis/credentials{NC}")
        print(f"   {YELLOW}Note: You'll need to create or select a project first{NC}")

    print("\n2. Create OAuth 2.0 Client ID:")
    print("   • Click 'CREATE CREDENTIALS' > 'OAuth client ID'")
    print("   • Application type: Web application")
    print("   • Name: Recipe Manager Web Client")

    print("\n3. Configure OAuth consent screen (if needed):")
    print("   • User Type: External")
    print("   • App name: Recipe Manager")
    print("   • Authorized domains: recipes.help")

    print("\n4. Add these Authorized redirect URIs:")
    print(
        f"   {GREEN}• https://powerful-salmon-99.clerk.accounts.dev/v1/oauth_callback{NC}"
    )
    print(f"   {GREEN}• https://recipes.help/.clerk/oauth_callback{NC}")

    print("\n5. After creation, download the credentials JSON file")

    print_header("Credential Extraction")

    # Check for downloaded credentials files
    downloads_path = Path.home() / "Downloads"
    credential_files = list(downloads_path.glob("client_secret*.json")) + list(
        downloads_path.glob("credentials*.json")
    )

    if credential_files:
        print("\nFound potential credential files in Downloads:")
        for i, file in enumerate(credential_files, 1):
            print(f"  {i}. {file.name}")

        choice = input("\nSelect a file number (or press Enter to skip): ").strip()

        if choice and choice.isdigit():
            idx = int(choice) - 1
            if 0 <= idx < len(credential_files):
                client_id, client_secret = extract_credentials_from_json(
                    credential_files[idx]
                )
                if client_id and client_secret:
                    print_success("Successfully extracted credentials!")
                    print(f"\n{GREEN}Client ID:{NC} {client_id}")
                    print(f"{GREEN}Client Secret:{NC} {client_secret}")

                    save = input("\nSave to .env.local file? (y/n): ").strip().lower()
                    if save == "y":
                        create_env_file(client_id, client_secret)
                else:
                    print_error("Could not extract credentials from file")
    else:
        print("\nNo credential files found in Downloads folder.")
        print("After downloading from Google Cloud Console, you can:")

        # Provide manual extraction option
        file_path = input(
            "\nEnter path to credentials JSON file (or press Enter to skip): "
        ).strip()

        if file_path and Path(file_path).exists():
            client_id, client_secret = extract_credentials_from_json(file_path)
            if client_id and client_secret:
                print_success("Successfully extracted credentials!")
                print(f"\n{GREEN}Client ID:{NC} {client_id}")
                print(f"{GREEN}Client Secret:{NC} {client_secret}")

                save = input("\nSave to .env.local file? (y/n): ").strip().lower()
                if save == "y":
                    create_env_file(client_id, client_secret)
            else:
                print_error("Could not extract credentials from file")

    print_header("Next Steps")

    print("\n1. Add the credentials to Clerk Dashboard:")
    print(f"   {GREEN}https://dashboard.clerk.com{NC}")
    print("   Navigate to: Configure > SSO Connections > Google")

    print("\n2. In Clerk Dashboard:")
    print("   • Enable Google as an authentication provider")
    print("   • Add your Client ID and Client Secret")
    print("   • Save the configuration")

    print("\n3. Test the integration:")
    print("   • Visit your app at https://recipes.help")
    print("   • Try signing in with Google")

    print("\n" + "=" * 50)
    print(f"{GREEN}Setup helper complete!{NC}\n")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n{YELLOW}Setup interrupted by user{NC}")
        sys.exit(1)
    except Exception as e:
        print_error(f"Unexpected error: {e}")
        sys.exit(1)
