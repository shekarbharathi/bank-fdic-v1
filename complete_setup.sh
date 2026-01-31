#!/bin/bash
# Script to complete PostgreSQL setup and run initial data load

set -e

echo "=========================================="
echo "Completing FDIC Pipeline Setup"
echo "=========================================="
echo ""

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL (psql) not found in PATH"
    echo ""
    echo "Please complete the manual installation steps first:"
    echo "1. Install Homebrew: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
    echo "2. Install PostgreSQL: brew install postgresql@15"
    echo "3. Start PostgreSQL: brew services start postgresql@15"
    echo "4. Add PostgreSQL to PATH (if needed):"
    echo "   For Apple Silicon: export PATH=\"/opt/homebrew/opt/postgresql@15/bin:\$PATH\""
    echo "   For Intel: export PATH=\"/usr/local/opt/postgresql@15/bin:\$PATH\""
    echo ""
    exit 1
fi

echo "✓ PostgreSQL is installed"
echo ""

# Check if database exists, create if not
if psql -lqt | cut -d \| -f 1 | grep -qw fdic; then
    echo "✓ Database 'fdic' already exists"
else
    echo "Creating database 'fdic'..."
    createdb fdic
    echo "✓ Database 'fdic' created"
fi

echo ""
echo "=========================================="
echo "Setup complete! Running initial data load..."
echo "=========================================="
echo ""

# Activate virtual environment and run the script
source venv/bin/activate
python fdic_to_postgres.py

echo ""
echo "=========================================="
echo "Initial data load complete!"
echo "=========================================="
