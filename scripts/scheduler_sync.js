#!/usr/bin/env node
/**
 * Scheduler untuk auto-sync data Odoo setiap 5 menit
 * Menjalankan sync_recent_mo.js secara otomatis dengan interval yang ditentukan
 * 
 * Usage:
 *   node scripts/scheduler_sync.js [session_id]
 *   
 * Environment:
 *   ODOO_SESSION_ID - Odoo session ID (bisa dari env atau arg)
 *   SYNC_INTERVAL_MINUTES - Interval sync dalam menit (default: 5)
 */

const { spawn } = require('child_process');
const path = require('path');
const config = require('../config');

// Parse args
const args = process.argv.slice(2);
let sessionId = args.find(a => !a.startsWith('--') && a.length > 20) || config.odoo.sessionId;

if (!sessionId) {
	console.error('❌ Odoo session ID is required.');
	console.error('   Provide as first argument or set ODOO_SESSION_ID environment variable.');
	console.error('   Example: node scripts/scheduler_sync.js <session_id>');
	process.exit(1);
}

// Get interval from env or default to 5 minutes
const intervalMinutes = parseInt(process.env.SYNC_INTERVAL_MINUTES || '5', 10);
const intervalMs = intervalMinutes * 60 * 1000;

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║         Odoo MO Sync Scheduler - Auto Refresh                 ║');
console.log('╚════════════════════════════════════════════════════════════════╝');
console.log(`📅 Interval: ${intervalMinutes} menit`);
console.log(`🔑 Session ID: ${sessionId.substring(0, 20)}...`);
console.log(`⏰ Started at: ${new Date().toLocaleString('id-ID')}`);
console.log('');

let syncCount = 0;
let lastSyncTime = null;
let isRunning = false;

function runSync() {
	if (isRunning) {
		console.log('⚠️  Sync masih berjalan, skip...');
		return;
	}

	isRunning = true;
	syncCount++;
	const startTime = new Date();
	
	console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
	console.log(`🔄 Sync #${syncCount} dimulai: ${startTime.toLocaleString('id-ID')}`);
	console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

	const syncScript = path.join(__dirname, 'sync_recent_mo.js');
	const child = spawn('node', [syncScript, sessionId], {
		stdio: 'inherit',
		shell: true
	});

	child.on('close', (code) => {
		const endTime = new Date();
		const duration = ((endTime - startTime) / 1000).toFixed(2);
		
		if (code === 0) {
			console.log(`✅ Sync #${syncCount} selesai dalam ${duration}s`);
			lastSyncTime = endTime;
			const nextSync = new Date(endTime.getTime() + intervalMs);
			console.log(`⏭️  Sync berikutnya: ${nextSync.toLocaleString('id-ID')}`);
		} else {
			console.error(`❌ Sync #${syncCount} gagal dengan code ${code} (${duration}s)`);
		}
		
		isRunning = false;
	});

	child.on('error', (err) => {
		console.error(`❌ Error menjalankan sync: ${err.message}`);
		isRunning = false;
	});
}

// Run sync immediately on start
console.log('▶️  Menjalankan sync pertama kali...');
runSync();

// Schedule periodic sync
const intervalId = setInterval(() => {
	runSync();
}, intervalMs);

// Graceful shutdown
process.on('SIGINT', () => {
	console.log('\n\n🛑 Menerima signal SIGINT, menghentikan scheduler...');
	clearInterval(intervalId);
	
	if (lastSyncTime) {
		console.log(`📊 Total sync: ${syncCount}`);
		console.log(`🕐 Sync terakhir: ${lastSyncTime.toLocaleString('id-ID')}`);
	}
	
	console.log('👋 Scheduler dihentikan.');
	process.exit(0);
});

process.on('SIGTERM', () => {
	console.log('\n\n🛑 Menerima signal SIGTERM, menghentikan scheduler...');
	clearInterval(intervalId);
	process.exit(0);
});

// Keep process alive
console.log('\n💡 Tekan Ctrl+C untuk menghentikan scheduler.\n');



