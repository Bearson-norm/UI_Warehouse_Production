// Centralized configuration for Odoo and Authenticity APIs and SQLite DB location
try { require('dotenv').config(); } catch (_) {}

module.exports = {
	// SQLite database file path
	sqlitePath: process.env.SQLITE_PATH || './warehouse_integrations.db',

	// Odoo configuration
	odoo: {
		baseUrl: process.env.ODOO_API_URL || 'https://foomx.odoo.com',
		// Provide session id via env or CLI argument; scripts accept override
		sessionId: process.env.ODOO_SESSION_ID || '',
		timeoutMs: Number(process.env.ODOO_TIMEOUT_MS || 30000)
	},

	// Authenticity API configuration
	authenticity: {
		baseUrl: process.env.AUTH_BASE_URL || 'https://warehouse.foomid.id',
		username: process.env.AUTH_USERNAME || 'foom',
		password: process.env.AUTH_PASSWORD || 'foom',
		timeoutMs: Number(process.env.AUTH_TIMEOUT_MS || 20000),
		// Token will be stored in memory and refreshed as needed
		token: null,
		tokenExpiry: null
	}
};




