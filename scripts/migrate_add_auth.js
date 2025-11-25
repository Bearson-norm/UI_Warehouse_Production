#!/usr/bin/env node
const crypto = require('crypto');
const { db, run, get } = require('../db');

function hashPassword(password) {
	return crypto.createHash('sha256').update(password).digest('hex');
}

async function tableExists(tableName) {
	const result = await get(db, `
		SELECT name FROM sqlite_master 
		WHERE type='table' AND name=?
	`, [tableName]);
	return !!result;
}

async function main() {
	console.log('🔄 Running migration: add authentication tables...');

	// Create users table
	const usersExists = await tableExists('users');
	if (!usersExists) {
		await run(db, `
			CREATE TABLE users (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				username TEXT UNIQUE NOT NULL,
				password TEXT NOT NULL,
				role TEXT NOT NULL CHECK(role IN ('production', 'warehouse')),
				created_at TEXT DEFAULT (datetime('now'))
			);
		`);
		console.log('✅ Created users table');
	} else {
		console.log('ℹ️  users table already exists');
	}

	// Create sessions table
	const sessionsExists = await tableExists('sessions');
	if (!sessionsExists) {
		await run(db, `
			CREATE TABLE sessions (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				session_token TEXT UNIQUE NOT NULL,
				user_id INTEGER NOT NULL,
				username TEXT NOT NULL,
				role TEXT NOT NULL,
				expires_at TEXT NOT NULL,
				created_at TEXT DEFAULT (datetime('now')),
				FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
			);
		`);
		await run(db, `CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);`);
		await run(db, `CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);`);
		await run(db, `CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);`);
		console.log('✅ Created sessions table');
	} else {
		console.log('ℹ️  sessions table already exists');
	}

	// Create default users if they don't exist
	const productionUser = await get(db, `SELECT id FROM users WHERE username = ?`, ['production']);
	if (!productionUser) {
		const hashedPassword = hashPassword('password123');
		await run(db, `
			INSERT INTO users (username, password, role)
			VALUES (?, ?, ?)
		`, ['production', hashedPassword, 'production']);
		console.log('✅ Created default production user (username: production, password: password123)');
	} else {
		console.log('ℹ️  production user already exists');
	}

	const warehouseUser = await get(db, `SELECT id FROM users WHERE username = ?`, ['warehouse']);
	if (!warehouseUser) {
		const hashedPassword = hashPassword('password123');
		await run(db, `
			INSERT INTO users (username, password, role)
			VALUES (?, ?, ?)
		`, ['warehouse', hashedPassword, 'warehouse']);
		console.log('✅ Created default warehouse user (username: warehouse, password: password123)');
	} else {
		console.log('ℹ️  warehouse user already exists');
	}

	console.log('✅ Migration completed successfully!');
	console.log('\n📝 Default credentials:');
	console.log('   Production: username=production, password=password123');
	console.log('   Warehouse: username=warehouse, password=password123');
	console.log('   ⚠️  Please change these passwords after first login!');
	
	db.close();
}

main().catch((err) => {
	console.error('❌ Migration failed:', err.message);
	console.error(err);
	db.close();
	process.exit(1);
});

