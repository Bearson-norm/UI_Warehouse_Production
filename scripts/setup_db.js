#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { db } = require('../db');

async function main() {
	const schemaPath = path.resolve(__dirname, '..', 'schema.sql');
	const sql = fs.readFileSync(schemaPath, 'utf8');
	await new Promise((resolve, reject) => {
		// serialize to ensure sequential execution
		db.serialize(() => {
			db.exec(sql, (err) => {
				if (err) return reject(err);
				return resolve();
			});
		});
	});
	console.log('✅ SQLite schema initialized.');
	// Close DB gracefully
	await new Promise((resolve) => db.close(() => resolve()));
	process.exit(0);
}

main().catch((err) => {
	console.error('❌ Failed to initialize database:', err.message);
	// Attempt close
	try { db.close(); } catch (_) {}
	process.exit(1);
});


