#!/bin/bash

# ================================================
# Production Server Update Script
# For Linux/Mac servers
# ================================================

echo "============================================"
echo "     RAF BOT PRODUCTION UPDATE"
echo "============================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="/var/www/raf-bot"
PM2_APP_NAME="raf-bot"
BACKUP_DIR="/var/backups/raf-bot"

# Check if running as correct user
if [ "$EUID" -eq 0 ]; then 
   echo -e "${RED}Please don't run as root${NC}"
   exit 1
fi

# Navigate to app directory
cd $APP_DIR || { echo -e "${RED}App directory not found${NC}"; exit 1; }

echo -e "${YELLOW}Current version:${NC}"
git describe --tags --abbrev=0 2>/dev/null || echo "No version tags"
echo ""

# Step 1: Backup
echo -e "${YELLOW}[1/6] Creating backup...${NC}"
mkdir -p $BACKUP_DIR
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.tar.gz"

# Create backup
tar -czf $BACKUP_FILE database/ .env config.json sessions/ 2>/dev/null
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Backup created: $BACKUP_FILE${NC}"
else
    echo -e "${YELLOW}⚠ Backup incomplete (some files may not exist)${NC}"
fi

# Step 2: Fetch updates
echo ""
echo -e "${YELLOW}[2/6] Fetching updates...${NC}"
git fetch origin

# Check for updates
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
    echo -e "${GREEN}Already up to date!${NC}"
    exit 0
fi

# Show what will be updated
echo -e "${YELLOW}Updates available:${NC}"
git log HEAD..origin/main --oneline

# Confirm update
echo ""
read -p "Continue with update? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Update cancelled${NC}"
    exit 0
fi

# Step 3: Pull updates
echo ""
echo -e "${YELLOW}[3/6] Pulling updates...${NC}"
git pull origin main
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Git pull failed. Please resolve conflicts manually${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Updates pulled${NC}"

# Step 4: Install dependencies
echo ""
echo -e "${YELLOW}[4/6] Installing dependencies...${NC}"
npm ci --production
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠ npm ci failed, trying npm install...${NC}"
    npm install --production
fi
echo -e "${GREEN}✓ Dependencies updated${NC}"

# Step 5: Run migrations
echo ""
echo -e "${YELLOW}[5/6] Running database migrations...${NC}"
if [ -f "scripts/migrate.js" ]; then
    node scripts/migrate.js
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Migrations completed${NC}"
    else
        echo -e "${YELLOW}⚠ Migration had issues, check logs${NC}"
    fi
else
    echo -e "${YELLOW}No migration script found${NC}"
fi

# Step 6: Restart application
echo ""
echo -e "${YELLOW}[6/6] Restarting application...${NC}"

# Check if PM2 is running
pm2 list | grep -q $PM2_APP_NAME
if [ $? -eq 0 ]; then
    pm2 restart $PM2_APP_NAME
    echo -e "${GREEN}✓ Application restarted${NC}"
    
    # Show logs
    echo ""
    echo -e "${YELLOW}Recent logs:${NC}"
    pm2 logs $PM2_APP_NAME --lines 10 --nostream
else
    echo -e "${YELLOW}PM2 app not found. Starting fresh...${NC}"
    pm2 start ecosystem.config.js
    pm2 save
fi

# Show new version
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}     UPDATE COMPLETED SUCCESSFULLY!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "${YELLOW}New version:${NC}"
git describe --tags --abbrev=0 2>/dev/null || git rev-parse --short HEAD
echo ""
echo -e "${YELLOW}Commands:${NC}"
echo "  pm2 status          - Check app status"
echo "  pm2 logs $PM2_APP_NAME     - View logs"
echo "  pm2 monit           - Monitor app"
echo ""
