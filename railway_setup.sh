#!/bin/bash
# Quick setup script for Railway deployment
# This helps verify your setup before deploying

echo "=========================================="
echo "Railway Deployment Setup Check"
echo "=========================================="
echo ""

# Check if Railway CLI is installed
if command -v railway &> /dev/null; then
    echo "✓ Railway CLI is installed"
    railway --version
else
    echo "⚠ Railway CLI not found"
    echo "  Install with: npm install -g @railway/cli"
fi

echo ""
echo "Checking project structure..."
echo ""

# Check for required files
files=(
    "backend/main.py"
    "backend/config.py"
    "frontend/package.json"
    "requirements.txt"
    "railway_data_ingestion.py"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "✓ $file exists"
    else
        echo "✗ $file missing"
    fi
done

echo ""
echo "Checking environment variables..."
echo ""
echo "Required for Backend:"
echo "  - LLM_PROVIDER"
echo "  - OPENAI_API_KEY (or ANTHROPIC_API_KEY)"
echo "  - DATABASE_URL (provided automatically by Railway)"
echo ""
echo "Required for Frontend:"
echo "  - VITE_API_URL (set after backend deployment)"
echo ""
echo "=========================================="
echo "Next Steps:"
echo "1. Push your code to GitHub"
echo "2. Create Railway project"
echo "3. Add PostgreSQL database"
echo "4. Deploy backend service"
echo "5. Deploy frontend service"
echo "6. Run data ingestion"
echo ""
echo "See RAILWAY_DEPLOYMENT.md for detailed instructions"
echo "=========================================="
