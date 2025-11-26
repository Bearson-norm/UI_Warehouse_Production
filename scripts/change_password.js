#!/usr/bin/env node
/**
 * Script to change user password
 * Usage: node scripts/change_password.js <username> <new_password>
 * Example: node scripts/change_password.js production Admin123
 */

const crypto = require('crypto');
const { db, run, get } = require('../db');

function hashPassword(password) {
	return crypto.createHash('sha256').update(password).digest('hex');
}

async function main() {
	const args = process.argv.slice(2);
	
	if (args.length < 2) {
		console.error('❌ Usage: node scripts/change_password.js <username> <new_password>');
		console.error('   Example: node scripts/change_password.js production Admin123');
		process.exit(1);
	}

	const username = args[0];
	const newPassword = args[1];

	if (!username || !newPassword) {
		console.error('❌ Username and password are required');
		process.exit(1);
	}

	try {
		// Check if user exists
		const user = await get(db, `SELECT id, username FROM users WHERE username = ?`, [username]);
		
		if (!user) {
			console.error(`❌ User '${username}' not found`);
			process.exit(1);
		}

		// Hash the new password
		const hashedPassword = hashPassword(newPassword);

		// Update password
		await run(db, `UPDATE users SET password = ? WHERE username = ?`, [hashedPassword, username]);

		console.log(`✅ Password updated successfully for user '${username}'`);
		console.log(`   New password: ${newPassword}`);
		console.log(`   Hash: ${hashedPassword}`);
		
		db.close();
		process.exit(0);
	} catch (error) {
		console.error('❌ Error updating password:', error.message);
		db.close();
		process.exit(1);
	}
}

main();


