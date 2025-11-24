#!/usr/bin/env node
const { db, run } = require('../db');

async function main() {
	// Create table if not exists
	await run(db, `
		CREATE TABLE IF NOT EXISTS production_log (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			mo_name TEXT,
			product_name TEXT,
			leader_id INTEGER,
			status TEXT,
			create_at TEXT DEFAULT (datetime('now'))
		);
	`);
	await run(db, `CREATE INDEX IF NOT EXISTS idx_pl_mo ON production_log(mo_name);`);
	console.log('✅ production_log ensured.');
	db.close();
}

main().catch((err) => {
	console.error('❌ Migration failed:', err.message);
	try { db.close(); } catch (_) {}
	process.exit(1);
});




