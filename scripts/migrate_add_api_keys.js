// Migration: Add api_keys table for external API access
const { db, run, get } = require('../db');

async function migrate() {
	console.log('🔄 Running migration: add API keys table...');
	
	try {
		// Create api_keys table
		await run(db, `
			CREATE TABLE IF NOT EXISTS api_keys (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				key_name TEXT NOT NULL,
				api_key TEXT UNIQUE NOT NULL,
				created_by TEXT NOT NULL,
				created_at TEXT DEFAULT (datetime('now')),
				last_used_at TEXT,
				is_active INTEGER DEFAULT 1,
				description TEXT
			)
		`);
		console.log('✅ Created api_keys table');

		// Create indexes
		await run(db, `CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(api_key)`);
		await run(db, `CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active)`);
		console.log('✅ Created indexes');

		console.log('✅ Migration completed successfully!');
		console.log('');
		console.log('📝 API keys dapat dibuat melalui halaman admin atau API endpoint.');
	} catch (error) {
		console.error('❌ Migration failed:', error);
		process.exit(1);
	}
}

if (require.main === module) {
	migrate().then(() => process.exit(0)).catch(err => {
		console.error(err);
		process.exit(1);
	});
}

module.exports = { migrate };



