#!/usr/bin/env node
const { db, all, run } = require('../db');

async function columnExists(table, column) {
	const rows = await all(db, `PRAGMA table_info(${table});`);
	return rows.some(r => r.name === column);
}

async function main() {
	const exists = await columnExists('recent_mo', 'ready_for_production');
	if (!exists) {
		await run(db, `ALTER TABLE recent_mo ADD COLUMN ready_for_production INTEGER DEFAULT 0;`);
		console.log('✅ Column ready_for_production added to recent_mo.');
	} else {
		console.log('ℹ️ Column ready_for_production already exists. No action taken.');
	}
	db.close();
}

main().catch((err) => {
	console.error('❌ Migration failed:', err.message);
	try { db.close(); } catch (_) {}
	process.exit(1);
});




