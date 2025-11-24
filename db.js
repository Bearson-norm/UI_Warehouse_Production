const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const config = require('./config');

const sqlitePath =
	(config && typeof config.sqlitePath === 'string' && config.sqlitePath.trim())
		? config.sqlitePath
		: 'warehouse_integrations.db';

const dbFile = path.resolve(process.cwd(), sqlitePath);

// Ensure directory exists
const dirName = path.dirname(dbFile);
if (!fs.existsSync(dirName)) {
	fs.mkdirSync(dirName, { recursive: true });
}

const db = new sqlite3.Database(dbFile);

// Promisified helpers
function run(dbInstance, sql, params = []) {
	return new Promise((resolve, reject) => {
		dbInstance.run(sql, params, function (err) {
			if (err) return reject(err);
			resolve(this);
		});
	});
}

function all(dbInstance, sql, params = []) {
	return new Promise((resolve, reject) => {
		dbInstance.all(sql, params, function (err, rows) {
			if (err) return reject(err);
			resolve(rows);
		});
	});
}

function get(dbInstance, sql, params = []) {
	return new Promise((resolve, reject) => {
		dbInstance.get(sql, params, function (err, row) {
			if (err) return reject(err);
			resolve(row);
		});
	});
}

module.exports = {
	db,
	run,
	all,
	get
};


