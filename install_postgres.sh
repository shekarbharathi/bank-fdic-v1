#!/bin/bash
# Script to install Homebrew and PostgreSQL on macOS

set -e  # Exit on error

echo "=========================================="
echo "FDIC Pipeline - PostgreSQL Setup Script"
echo "=========================================="
echo ""

# Check if Homebrew is installed
if ! command -v brew &> /dev/null; then
    echo "Homebrew not found. Installing Homebrew..."
    echo "This will require your password for sudo access."
    echo ""
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    # Add Homebrew to PATH (for Apple Silicon Macs)
    if [ -f /opt/homebrew/bin/brew ]; then
        echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
        eval "$(/opt/homebrew/bin/brew shellenv)"
    # For Intel Macs
    elif [ -f /usr/local/bin/brew ]; then
        echo 'eval "$(/usr/local/bin/brew shellenv)"' >> ~/.zprofile
        eval "$(/usr/local/bin/brew shellenv)"
    fi
else
    echo "✓ Homebrew is already installed"
fi

echo ""
echo "Installing PostgreSQL..."
brew install postgresql@15

echo ""
echo "Starting PostgreSQL service..."
brew services start postgresql@15

# Wait a moment for PostgreSQL to start
sleep 3

echo ""
echo "Creating 'fdic' database..."
createdb fdic || echo "Database 'fdic' may already exist or there was an error"

echo ""
echo "=========================================="
echo "PostgreSQL setup complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Create config.py from config.example.py"
echo "2. Update config.py with your PostgreSQL password"
echo "3. Run: python fdic_to_postgres.py"
echo ""
