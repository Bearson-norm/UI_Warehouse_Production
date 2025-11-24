#!/usr/bin/env node
const { db, run } = require('../db');

async function addColumnIfMissing(table, column, type) {
	await run(db, `CREATE TABLE IF NOT EXISTS __dummy_check (x INTEGER);`);
	const exists = await new Promise((resolve, reject) => {
		db.all(`PRAGMA table_info(${table});`, (err, rows) => {
			if (err) return reject(err);
			resolve(rows.some(r => r.name === column));
		});
	});
	if (!exists) {
		await run(db, `ALTER TABLE ${table} ADD COLUMN ${column} ${type};`);
	}
}

async function recomputeAll() {
	// Compute target as initial_qty_target fallback to product_qty
	await run(db, `
		UPDATE recent_mo
		SET
			auth_used = CASE
				WHEN auth_first IS NOT NULL AND auth_last IS NOT NULL
				     AND auth_first GLOB '[0-9]*' AND auth_last GLOB '[0-9]*'
				THEN (CAST(auth_last AS INTEGER) - CAST(auth_first AS INTEGER) + 1)
				ELSE NULL
			END,
			loss_value = CASE
				WHEN COALESCE(initial_qty_target, product_qty) IS NOT NULL
				     AND auth_first IS NOT NULL AND auth_last IS NOT NULL
				     AND auth_first GLOB '[0-9]*' AND auth_last GLOB '[0-9]*'
				THEN (COALESCE(initial_qty_target, product_qty) - (CAST(auth_last AS INTEGER) - CAST(auth_first AS INTEGER) + 1))
				ELSE NULL
			END,
			percentage_loss = CASE
				WHEN COALESCE(initial_qty_target, product_qty) IS NOT NULL
				     AND COALESCE(initial_qty_target, product_qty) > 0
				     AND auth_first IS NOT NULL AND auth_last IS NOT NULL
				     AND auth_first GLOB '[0-9]*' AND auth_last GLOB '[0-9]*'
				THEN (100.0 * ((COALESCE(initial_qty_target, product_qty) - (CAST(auth_last AS INTEGER) - CAST(auth_first AS INTEGER) + 1)) / COALESCE(initial_qty_target, product_qty)))
				ELSE NULL
			END
	;`);
}

async function main() {
	await addColumnIfMissing('recent_mo', 'auth_used', 'REAL');
	await addColumnIfMissing('recent_mo', 'loss_value', 'REAL');
	await addColumnIfMissing('recent_mo', 'percentage_loss', 'REAL');
	await recomputeAll();
	console.log('✅ Columns auth_used, loss_value, percentage_loss added and computed.');
	db.close();
}

main().catch((err) => {
	console.error('❌ Migration failed:', err.message);
	try { db.close(); } catch (_) {}
	process.exit(1);
});








