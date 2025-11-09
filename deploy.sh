#!/bin/bash

#############################################
# RAF Bot V2 - Production Deployment Script
#############################################

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="raf-bot"
APP_DIR="/var/www/raf-bot"
BACKUP_DIR="/var/backups/raf-bot"
GIT_REPO="origin"
GIT_BRANCH="main"
PM2_APP_NAME="raf-bot"

# Functions
print_header() {
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}   RAF Bot V2 - Deployment Script${NC}"
    echo -e "${BLUE}============================================${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Check if running as appropriate user
check_user() {
    if [[ $EUID -eq 0 ]]; then
        print_error "This script should not be run as root!"
        exit 1
    fi
}

# Check if all required commands exist
check_requirements() {
    print_info "Checking requirements..."
    
    local requirements=("git" "node" "npm" "pm2")
    local missing=()
    
    for cmd in "${requirements[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            missing+=("$cmd")
        fi
    done
    
    if [ ${#missing[@]} -ne 0 ]; then
        print_error "Missing requirements: ${missing[*]}"
        print_info "Please install missing components and try again."
        exit 1
    fi
    
    print_success "All requirements met"
}

# Create backup of current deployment
create_backup() {
    print_info "Creating backup..."
    
    if [ ! -d "$APP_DIR" ]; then
        print_warning "App directory doesn't exist, skipping backup"
        return
    fi
    
    mkdir -p "$BACKUP_DIR"
    
    local backup_name="backup-$(date +%Y%m%d-%H%M%S).tar.gz"
    local backup_path="$BACKUP_DIR/$backup_name"
    
    cd "$APP_DIR" || exit 1
    
    tar -czf "$backup_path" \
        --exclude=node_modules \
        --exclude=logs \
        --exclude=temp \
        --exclude=.git \
        . 2>/dev/null
    
    if [ $? -eq 0 ]; then
        print_success "Backup created: $backup_name"
        
        # Delete old backups (older than 30 days)
        find "$BACKUP_DIR" -name "backup-*.tar.gz" -mtime +30 -delete 2>/dev/null
    else
        print_error "Failed to create backup"
        exit 1
    fi
}

# Pull latest code from repository
pull_latest() {
    print_info "Pulling latest code..."
    
    cd "$APP_DIR" || exit 1
    
    # Stash any local changes
    git stash &>/dev/null
    
    # Fetch latest changes
    git fetch "$GIT_REPO" "$GIT_BRANCH" &>/dev/null
    
    # Check if there are updates
    LOCAL=$(git rev-parse HEAD)
    REMOTE=$(git rev-parse "$GIT_REPO/$GIT_BRANCH")
    
    if [ "$LOCAL" = "$REMOTE" ]; then
        print_warning "Already up to date"
        return 1
    fi
    
    # Pull changes
    if git pull "$GIT_REPO" "$GIT_BRANCH" &>/dev/null; then
        print_success "Code updated successfully"
        return 0
    else
        print_error "Failed to pull latest code"
        exit 1
    fi
}

# Install/update dependencies
install_dependencies() {
    print_info "Installing dependencies..."
    
    cd "$APP_DIR" || exit 1
    
    # Clean install for production
    if [ -f "package-lock.json" ]; then
        npm ci --production &>/dev/null
    else
        npm install --production &>/dev/null
    fi
    
    if [ $? -eq 0 ]; then
        print_success "Dependencies installed"
    else
        print_error "Failed to install dependencies"
        exit 1
    fi
}

# Run database migrations
run_migrations() {
    print_info "Running database migrations..."
    
    cd "$APP_DIR" || exit 1
    
    # Check if migration script exists
    if [ -f "tools/smart-migrate-database.js" ]; then
        node tools/smart-migrate-database.js
        
        if [ $? -eq 0 ]; then
            print_success "Database migrations completed"
        else
            print_warning "Database migration had issues, check logs"
        fi
    else
        print_warning "No migration script found, skipping"
    fi
}

# Copy configuration files if they don't exist
setup_config() {
    print_info "Checking configuration..."
    
    cd "$APP_DIR" || exit 1
    
    # Copy config.json if it doesn't exist
    if [ ! -f "config.json" ]; then
        if [ -f "config.example.json" ]; then
            cp config.example.json config.json
            print_warning "Created config.json from example - PLEASE EDIT IT!"
        fi
    fi
    
    # Copy .env if it doesn't exist
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env
            print_warning "Created .env from example - PLEASE EDIT IT!"
        fi
    fi
    
    # Copy PM2 ecosystem file if it doesn't exist
    if [ ! -f "ecosystem.config.js" ]; then
        if [ -f "ecosystem.config.example.js" ]; then
            cp ecosystem.config.example.js ecosystem.config.js
            print_success "Created ecosystem.config.js"
        fi
    fi
}

# Set correct permissions
set_permissions() {
    print_info "Setting permissions..."
    
    cd "$APP_DIR" || exit 1
    
    # Create necessary directories
    mkdir -p logs uploads temp backups session
    
    # Set directory permissions
    find . -type d -exec chmod 755 {} \; 2>/dev/null
    
    # Set file permissions
    find . -type f -exec chmod 644 {} \; 2>/dev/null
    
    # Make scripts executable
    chmod +x *.sh 2>/dev/null
    chmod +x tools/*.js 2>/dev/null
    
    # Secure sensitive files
    chmod 600 .env 2>/dev/null
    chmod 600 config.json 2>/dev/null
    
    print_success "Permissions set"
}

# Restart application with PM2
restart_app() {
    print_info "Restarting application..."
    
    cd "$APP_DIR" || exit 1
    
    # Check if app is already running
    if pm2 list | grep -q "$PM2_APP_NAME"; then
        # Reload with 0-downtime
        pm2 reload "$PM2_APP_NAME" --update-env
        print_success "Application reloaded"
    else
        # Start fresh
        if [ -f "ecosystem.config.js" ]; then
            pm2 start ecosystem.config.js
        else
            pm2 start index.js --name "$PM2_APP_NAME"
        fi
        print_success "Application started"
    fi
    
    # Save PM2 configuration
    pm2 save &>/dev/null
}

# Health check
health_check() {
    print_info "Performing health check..."
    
    sleep 5  # Wait for app to start
    
    # Try to access health endpoint
    if curl -f -s -o /dev/null http://localhost:3100/health; then
        print_success "Health check passed"
    else
        print_warning "Health check failed - check application logs"
    fi
}

# Show deployment summary
show_summary() {
    echo ""
    print_header
    echo -e "${GREEN}Deployment completed successfully!${NC}"
    echo ""
    echo "Summary:"
    echo "  • Application: $PM2_APP_NAME"
    echo "  • Directory: $APP_DIR"
    echo "  • Branch: $GIT_BRANCH"
    echo ""
    echo "Useful commands:"
    echo "  • View status: pm2 status"
    echo "  • View logs: pm2 logs $PM2_APP_NAME"
    echo "  • Monitor: pm2 monit"
    echo "  • Stop: pm2 stop $PM2_APP_NAME"
    echo "  • Restart: pm2 restart $PM2_APP_NAME"
    echo ""
}

# Rollback to previous version
rollback() {
    print_header
    print_warning "Starting rollback..."
    
    # List available backups
    echo "Available backups:"
    ls -lh "$BACKUP_DIR"/backup-*.tar.gz 2>/dev/null | tail -5
    
    echo ""
    read -p "Enter backup filename (or 'cancel'): " backup_file
    
    if [ "$backup_file" = "cancel" ]; then
        print_info "Rollback cancelled"
        exit 0
    fi
    
    if [ ! -f "$BACKUP_DIR/$backup_file" ]; then
        print_error "Backup file not found"
        exit 1
    fi
    
    # Stop application
    pm2 stop "$PM2_APP_NAME" &>/dev/null
    
    # Extract backup
    cd "$APP_DIR" || exit 1
    tar -xzf "$BACKUP_DIR/$backup_file" .
    
    if [ $? -eq 0 ]; then
        print_success "Backup restored"
        
        # Restart application
        restart_app
        health_check
        
        print_success "Rollback completed"
    else
        print_error "Failed to restore backup"
        exit 1
    fi
}

# Main execution
main() {
    print_header
    
    # Parse arguments
    case "${1:-deploy}" in
        deploy)
            check_user
            check_requirements
            create_backup
            
            if pull_latest; then
                install_dependencies
                run_migrations
            fi
            
            setup_config
            set_permissions
            restart_app
            health_check
            show_summary
            ;;
            
        rollback)
            rollback
            ;;
            
        restart)
            restart_app
            health_check
            ;;
            
        backup)
            create_backup
            ;;
            
        health)
            health_check
            ;;
            
        *)
            echo "Usage: $0 {deploy|rollback|restart|backup|health}"
            echo ""
            echo "Commands:"
            echo "  deploy   - Deploy latest version (default)"
            echo "  rollback - Rollback to previous version"
            echo "  restart  - Restart application"
            echo "  backup   - Create backup only"
            echo "  health   - Check application health"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
