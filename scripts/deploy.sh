#!/bin/bash

# Deployment Script untuk Manufacturing Process System
# Usage: ./scripts/deploy.sh [production|staging]

set -e  # Exit on error

ENV=${1:-production}
APP_DIR="/var/www/UI_Warehouse_Production"
BACKUP_DIR="/var/backups/warehouse-production"

echo "🚀 Starting deployment for environment: $ENV"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run as root or with sudo"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    print_info "PM2 is not installed. Installing PM2..."
    npm install -g pm2
    print_success "PM2 installed"
fi

# Create backup directory
mkdir -p $BACKUP_DIR
print_success "Backup directory ready"

# Backup database if exists
if [ -f "$APP_DIR/warehouse_integrations.db" ]; then
    print_info "Backing up database..."
    DATE=$(date +%Y%m%d_%H%M%S)
    cp "$APP_DIR/warehouse_integrations.db" "$BACKUP_DIR/warehouse_integrations_$DATE.db"
    print_success "Database backed up to $BACKUP_DIR/warehouse_integrations_$DATE.db"
fi

# Navigate to app directory
if [ ! -d "$APP_DIR" ]; then
    print_error "App directory not found: $APP_DIR"
    print_info "Please clone or upload the application first"
    exit 1
fi

cd $APP_DIR
print_success "Changed to app directory: $APP_DIR"

# Install dependencies
print_info "Installing dependencies..."
npm install --production
print_success "Dependencies installed"

# Check if .env exists
if [ ! -f "$APP_DIR/.env" ]; then
    print_error ".env file not found!"
    print_info "Please create .env file with required configuration"
    print_info "See DEPLOYMENT.md for required environment variables"
    exit 1
fi

# Setup database if not exists
if [ ! -f "$APP_DIR/warehouse_integrations.db" ]; then
    print_info "Setting up database..."
    node scripts/setup_db.js
    print_success "Database initialized"
fi

# Run migrations
print_info "Running migrations..."
if [ -f "scripts/migrate_add_auth.js" ]; then
    node scripts/migrate_add_auth.js || true
fi
if [ -f "scripts/migrate_add_api_keys.js" ]; then
    node scripts/migrate_add_api_keys.js || true
fi
if [ -f "scripts/migrate_add_ready_flag.js" ]; then
    node scripts/migrate_add_ready_flag.js || true
fi
if [ -f "scripts/migrate_add_production_log.js" ]; then
    node scripts/migrate_add_production_log.js || true
fi
print_success "Migrations completed"

# Restart PM2
print_info "Restarting application with PM2..."
if pm2 list | grep -q "warehouse-ui"; then
    pm2 restart warehouse-ui
    print_success "Application restarted"
else
    pm2 start ecosystem.config.js
    pm2 save
    print_success "Application started"
fi

# Show PM2 status
print_info "PM2 Status:"
pm2 status

# Show logs
print_info "Recent logs:"
pm2 logs warehouse-ui --lines 10 --nostream

print_success "Deployment completed successfully!"
print_info "Check logs with: pm2 logs warehouse-ui"
print_info "Monitor with: pm2 monit"

