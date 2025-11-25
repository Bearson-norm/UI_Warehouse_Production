# Deployment Script untuk Manufacturing Process System (PowerShell)
# Usage: .\scripts\deploy.ps1 [production|staging]

param(
    [string]$Environment = "production"
)

$ErrorActionPreference = "Stop"

$AppDir = "C:\var\www\UI_Warehouse_Production"
$BackupDir = "C:\var\backups\warehouse-production"

Write-Host "🚀 Starting deployment for environment: $Environment" -ForegroundColor Cyan

# Function to print colored output
function Print-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Print-Error {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

function Print-Info {
    param([string]$Message)
    Write-Host "ℹ️  $Message" -ForegroundColor Yellow
}

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Print-Success "Node.js installed: $nodeVersion"
} catch {
    Print-Error "Node.js is not installed. Please install Node.js first."
    exit 1
}

# Check if PM2 is installed
try {
    $pm2Version = pm2 --version
    Print-Success "PM2 installed: $pm2Version"
} catch {
    Print-Info "PM2 is not installed. Installing PM2..."
    npm install -g pm2
    Print-Success "PM2 installed"
}

# Create backup directory
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}
Print-Success "Backup directory ready"

# Backup database if exists
$dbPath = Join-Path $AppDir "warehouse_integrations.db"
if (Test-Path $dbPath) {
    Print-Info "Backing up database..."
    $date = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupPath = Join-Path $BackupDir "warehouse_integrations_$date.db"
    Copy-Item $dbPath $backupPath
    Print-Success "Database backed up to $backupPath"
}

# Navigate to app directory
if (-not (Test-Path $AppDir)) {
    Print-Error "App directory not found: $AppDir"
    Print-Info "Please clone or upload the application first"
    exit 1
}

Set-Location $AppDir
Print-Success "Changed to app directory: $AppDir"

# Install dependencies
Print-Info "Installing dependencies..."
npm install --production
Print-Success "Dependencies installed"

# Check if .env exists
$envPath = Join-Path $AppDir ".env"
if (-not (Test-Path $envPath)) {
    Print-Error ".env file not found!"
    Print-Info "Please create .env file with required configuration"
    Print-Info "See DEPLOYMENT.md for required environment variables"
    exit 1
}

# Setup database if not exists
if (-not (Test-Path $dbPath)) {
    Print-Info "Setting up database..."
    node scripts\setup_db.js
    Print-Success "Database initialized"
}

# Run migrations
Print-Info "Running migrations..."
$migrations = @(
    "scripts\migrate_add_auth.js",
    "scripts\migrate_add_api_keys.js",
    "scripts\migrate_add_ready_flag.js",
    "scripts\migrate_add_production_log.js"
)

foreach ($migration in $migrations) {
    $migrationPath = Join-Path $AppDir $migration
    if (Test-Path $migrationPath) {
        try {
            node $migrationPath
        } catch {
            # Continue even if migration fails (might already be applied)
        }
    }
}
Print-Success "Migrations completed"

# Restart PM2
Print-Info "Restarting application with PM2..."
$pm2List = pm2 list
if ($pm2List -match "warehouse-ui") {
    pm2 restart warehouse-ui
    Print-Success "Application restarted"
} else {
    pm2 start ecosystem.config.js
    pm2 save
    Print-Success "Application started"
}

# Show PM2 status
Print-Info "PM2 Status:"
pm2 status

# Show logs
Print-Info "Recent logs:"
pm2 logs warehouse-ui --lines 10 --nostream

Print-Success "Deployment completed successfully!"
Print-Info "Check logs with: pm2 logs warehouse-ui"
Print-Info "Monitor with: pm2 monit"

