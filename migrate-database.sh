#!/bin/bash

# RAF-BOT V2 - Database Migration Tool for Linux/Ubuntu
# Compatible with Ubuntu 20.04 and above

echo ""
echo "============================================"
echo "  RAF-BOT V2 - Database Migration Tool"
echo "============================================"
echo ""
echo "This tool will:"
echo "1. Backup your current database"
echo "2. Detect missing columns"
echo "3. Add any missing fields automatically"
echo "4. Preserve all existing data"
echo ""
echo "Press Ctrl+C to cancel or press Enter to continue..."
read -n 1 -s

echo ""
echo "Starting migration..."
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed!"
    echo "Please install Node.js first: sudo apt install nodejs"
    exit 1
fi

# Try the new comprehensive migration script first
if [ -f "scripts/migrate-database.js" ]; then
    echo "Running comprehensive migration..."
    node scripts/migrate-database.js
elif [ -f "tools/smart-migrate-database.js" ]; then
    # Fall back to the old migration if new one doesn't exist
    echo "Running standard migration..."
    node tools/smart-migrate-database.js
else
    echo "Error: No migration script found!"
    echo "Please ensure you're in the project root directory."
    exit 1
fi

EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Migration completed successfully!"
    echo ""
    echo "You can now:"
    echo "1. Restart the application: pm2 restart raf-bot"
    echo "2. Or continue using the web interface at /migrate"
else
    echo "❌ Migration failed with exit code $EXIT_CODE"
    echo "Please check the error messages above."
fi
echo ""
echo "Press Enter to exit..."
read -n 1 -s
