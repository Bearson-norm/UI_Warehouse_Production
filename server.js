const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { db, all, run, get } = require('./db');
const config = require('./config');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Authentication helpers
function hashPassword(password) {
	return crypto.createHash('sha256').update(password).digest('hex');
}

function generateSessionToken() {
	return crypto.randomBytes(32).toString('hex');
}

function generateApiKey() {
	// Generate API key format: mps_<random_hex_32_chars>
	const randomBytes = crypto.randomBytes(16).toString('hex');
	return `mps_${randomBytes}`;
}

// Authentication middleware - supports both session token and API key
async function requireAuth(req, res, next) {
	const sessionToken = req.headers['x-session-token'];
	const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
	
	if (!sessionToken && !apiKey) {
		return res.status(401).json({ error: 'Unauthorized: No session token or API key provided' });
	}

	try {
		// Try API key first
		if (apiKey) {
			const keyRecord = await get(db, `
				SELECT * FROM api_keys
				WHERE api_key = ? AND is_active = 1
			`, [apiKey]);
			
			if (keyRecord) {
				// Update last_used_at
				await run(db, `
					UPDATE api_keys SET last_used_at = datetime('now')
					WHERE id = ?
				`, [keyRecord.id]);
				
				req.user = {
					id: null,
					username: 'api_key',
					role: 'api_key',
					apiKeyId: keyRecord.id,
					apiKeyName: keyRecord.key_name
				};
				return next();
			}
		}

		// Try session token
		if (sessionToken) {
			const session = await get(db, `
				SELECT s.*, u.role 
				FROM sessions s
				JOIN users u ON s.user_id = u.id
				WHERE s.session_token = ? AND s.expires_at > datetime('now')
			`, [sessionToken]);
			
			if (session) {
				req.user = {
					id: session.user_id,
					username: session.username,
					role: session.role
				};
				return next();
			}
		}

		return res.status(401).json({ error: 'Unauthorized: Invalid or expired session/API key' });
	} catch (error) {
		return res.status(500).json({ error: 'Authentication error: ' + error.message });
	}
}

// Role-based middleware
function requireRole(allowedRoles) {
	return (req, res, next) => {
		if (!req.user) {
			return res.status(401).json({ error: 'Unauthorized' });
		}
		if (!allowedRoles.includes(req.user.role)) {
			return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
		}
		next();
	};
}

// Timezone helper: format SQL datetime in target timezone (default Asia/Jakarta UTC+7 => 420 minutes)
function formatSqlDateInTz(date = new Date()) {
	const offsetMinutes = Number(process.env.TIMEZONE_OFFSET_MINUTES || 420); // minutes from UTC
	const utcMs = date.getTime() + (date.getTimezoneOffset() * 60000);
	const target = new Date(utcMs + (offsetMinutes * 60000));
	const pad = (n) => String(n).padStart(2, '0');
	const yyyy = target.getFullYear();
	const mm = pad(target.getMonth() + 1);
	const dd = pad(target.getDate());
	const HH = pad(target.getHours());
	const MM = pad(target.getMinutes());
	const SS = pad(target.getSeconds());
	return `${yyyy}-${mm}-${dd} ${HH}:${MM}:${SS}`;
}

// Helper to normalize leader_id as string (preserve leading zeros)
function normalizeLeaderId(leaderId) {
	if (leaderId === null || leaderId === undefined) return null;
	// Convert to string and preserve format
	const str = String(leaderId).trim();
	return str;
}

// Helper to format leader_id from database (in case it was stored as integer)
function formatLeaderIdFromDb(leaderId) {
	if (leaderId === null || leaderId === undefined) return null;
	const str = String(leaderId).trim();
	// If it's a pure number and less than 1000, pad to 3 digits to preserve format
	// This handles cases where "003" was stored as integer 3
	if (/^\d+$/.test(str) && parseInt(str, 10) < 1000) {
		return str.padStart(3, '0');
	}
	return str;
}
// In-process scheduler state for Odoo
const schedulerState = {
	running: false,
	intervalMs: (parseInt(process.env.SYNC_INTERVAL_MINUTES || '5', 10) || 5) * 60 * 1000,
	timerId: null,
	isSyncing: false,
	runCount: 0,
	lastRunAt: null,
	nextRunAt: null,
	lastResultOk: null,
	lastDurationSec: null,
	lastError: null,
	sessionId: null
};

// In-process scheduler state for Authenticity API
const authenticitySchedulerState = {
	running: false,
	intervalMs: (parseInt(process.env.AUTH_SYNC_INTERVAL_MINUTES || '10', 10) || 10) * 60 * 1000,
	timerId: null,
	isSyncing: false,
	runCount: 0,
	lastRunAt: null,
	nextRunAt: null,
	lastResultOk: null,
	lastDurationSec: null,
	lastError: null
};

function scheduleNext() {
	if (!schedulerState.running) return;
	const now = new Date();
	schedulerState.nextRunAt = new Date(now.getTime() + schedulerState.intervalMs);
	schedulerState.timerId = setTimeout(runOneSync, schedulerState.intervalMs);
}

async function runOneSync() {
	if (!schedulerState.running) return;
	if (schedulerState.isSyncing) {
		// skip overlapping
		scheduleNext();
		return;
	}
	const sessionId = schedulerState.sessionId || config.odoo.sessionId;
	if (!sessionId) {
		schedulerState.lastError = 'Missing ODOO_SESSION_ID (set in env or config.js)';
		schedulerState.lastResultOk = false;
		scheduleNext();
		return;
	}
	schedulerState.isSyncing = true;
	schedulerState.runCount += 1;
	const start = Date.now();
	try {
		const { runSync } = require('./scripts/sync_recent_mo');
		await runSync(sessionId);
		const duration = (Date.now() - start) / 1000;
		schedulerState.lastDurationSec = duration.toFixed(2);
		schedulerState.lastRunAt = new Date();
		schedulerState.lastResultOk = true;
		schedulerState.lastError = null;
	} catch (err) {
		schedulerState.lastDurationSec = ((Date.now() - start) / 1000).toFixed(2);
		schedulerState.lastRunAt = new Date();
		schedulerState.lastResultOk = false;
		schedulerState.lastError = err?.message || String(err);
		console.error('Odoo sync error (non-blocking):', err.message);
	} finally {
		schedulerState.isSyncing = false;
		scheduleNext();
	}
}

// Authenticity scheduler functions
function scheduleNextAuthenticity() {
	if (!authenticitySchedulerState.running) return;
	const now = new Date();
	authenticitySchedulerState.nextRunAt = new Date(now.getTime() + authenticitySchedulerState.intervalMs);
	authenticitySchedulerState.timerId = setTimeout(runOneAuthenticitySync, authenticitySchedulerState.intervalMs);
}

async function runOneAuthenticitySync() {
	if (!authenticitySchedulerState.running) return;
	if (authenticitySchedulerState.isSyncing) {
		// skip overlapping
		scheduleNextAuthenticity();
		return;
	}
	authenticitySchedulerState.isSyncing = true;
	authenticitySchedulerState.runCount += 1;
	const start = Date.now();
	try {
		const { runSyncAuthenticity } = require('./scripts/sync_authenticity');
		const result = await runSyncAuthenticity();
		const duration = (Date.now() - start) / 1000;
		authenticitySchedulerState.lastDurationSec = duration.toFixed(2);
		authenticitySchedulerState.lastRunAt = new Date();
		authenticitySchedulerState.lastResultOk = result.success;
		authenticitySchedulerState.lastError = result.error || (result.errors && result.errors.length > 0 ? `${result.errors.length} error(s)` : null);
	} catch (err) {
		authenticitySchedulerState.lastDurationSec = ((Date.now() - start) / 1000).toFixed(2);
		authenticitySchedulerState.lastRunAt = new Date();
		authenticitySchedulerState.lastResultOk = false;
		authenticitySchedulerState.lastError = err?.message || String(err);
		console.error('Authenticity sync error (non-blocking):', err.message);
	} finally {
		authenticitySchedulerState.isSyncing = false;
		scheduleNextAuthenticity();
	}
}

// Authentication endpoints (public)
app.post('/api/login', async (req, res) => {
	try {
		const { username, password } = req.body || {};
		if (!username || !password) {
			return res.status(400).json({ error: 'Username and password are required' });
		}
		const user = await get(db, `SELECT id, username, password, role FROM users WHERE username = ?`, [username]);
		if (!user) {
			return res.status(401).json({ error: 'Invalid username or password' });
		}
		const hashedPassword = hashPassword(password);
		if (user.password !== hashedPassword) {
			return res.status(401).json({ error: 'Invalid username or password' });
		}
		// Create session (expires in 24 hours)
		const token = generateSessionToken();
		const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
		await run(db, `
			INSERT INTO sessions (session_token, user_id, username, role, expires_at)
			VALUES (?, ?, ?, ?, ?)
		`, [token, user.id, user.username, user.role, expiresAt]);
		res.json({
			ok: true,
			token,
			user: {
				username: user.username,
				role: user.role
			}
		});
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

app.post('/api/logout', requireAuth, async (req, res) => {
	try {
		const token = req.headers['x-session-token'];
		await run(db, `DELETE FROM sessions WHERE session_token = ?`, [token]);
		res.json({ ok: true });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

app.get('/api/auth/me', requireAuth, (req, res) => {
	res.json({
		user: {
			username: req.user.username,
			role: req.user.role
		}
	});
});

// API Key Management (Admin only - requires user session, not API key)
app.get('/api/admin/api-keys', requireAuth, requireRole(['production', 'warehouse']), async (req, res) => {
	try {
		// Only allow user session, not API key
		if (req.user.role === 'api_key') {
			return res.status(403).json({ error: 'API keys cannot manage other API keys' });
		}
		const keys = await all(db, `
			SELECT id, key_name, api_key, created_by, created_at, last_used_at, is_active, description
			FROM api_keys
			ORDER BY created_at DESC
		`);
		res.json({ ok: true, data: keys });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

app.post('/api/admin/api-keys', requireAuth, requireRole(['production', 'warehouse']), async (req, res) => {
	try {
		// Only allow user session, not API key
		if (req.user.role === 'api_key') {
			return res.status(403).json({ error: 'API keys cannot create other API keys' });
		}
		const { key_name, description } = req.body || {};
		if (!key_name || !key_name.trim()) {
			return res.status(400).json({ error: 'key_name is required' });
		}
		const apiKey = generateApiKey();
		await run(db, `
			INSERT INTO api_keys (key_name, api_key, created_by, description)
			VALUES (?, ?, ?, ?)
		`, [key_name.trim(), apiKey, req.user.username, description || null]);
		res.json({
			ok: true,
			api_key: apiKey,
			message: 'API key created successfully. Save this key - it will not be shown again!'
		});
	} catch (error) {
		if (error.message.includes('UNIQUE constraint')) {
			return res.status(400).json({ error: 'API key already exists (unlikely but possible)' });
		}
		res.status(500).json({ error: error.message });
	}
});

app.delete('/api/admin/api-keys/:id', requireAuth, requireRole(['production', 'warehouse']), async (req, res) => {
	try {
		// Only allow user session, not API key
		if (req.user.role === 'api_key') {
			return res.status(403).json({ error: 'API keys cannot delete other API keys' });
		}
		const id = parseInt(req.params.id, 10);
		if (!Number.isFinite(id)) {
			return res.status(400).json({ error: 'Invalid API key ID' });
		}
		const result = await run(db, `DELETE FROM api_keys WHERE id = ?`, [id]);
		if (result.changes === 0) {
			return res.status(404).json({ error: 'API key not found' });
		}
		res.json({ ok: true, message: 'API key deleted successfully' });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

app.post('/api/admin/api-keys/:id/toggle', requireAuth, requireRole(['production', 'warehouse']), async (req, res) => {
	try {
		// Only allow user session, not API key
		if (req.user.role === 'api_key') {
			return res.status(403).json({ error: 'API keys cannot toggle other API keys' });
		}
		const id = parseInt(req.params.id, 10);
		if (!Number.isFinite(id)) {
			return res.status(400).json({ error: 'Invalid API key ID' });
		}
		const key = await get(db, `SELECT is_active FROM api_keys WHERE id = ?`, [id]);
		if (!key) {
			return res.status(404).json({ error: 'API key not found' });
		}
		const newStatus = key.is_active ? 0 : 1;
		await run(db, `UPDATE api_keys SET is_active = ? WHERE id = ?`, [newStatus, id]);
		res.json({ ok: true, is_active: newStatus === 1, message: `API key ${newStatus === 1 ? 'activated' : 'deactivated'}` });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

// API: scheduler status (Odoo)
app.get('/api/scheduler/status', requireAuth, requireRole(['production', 'warehouse']), (req, res) => {
	const s = schedulerState;
	res.json({
		running: s.running,
		isSyncing: s.isSyncing,
		interval_minutes: Math.round(s.intervalMs / 60000),
		run_count: s.runCount,
		last_run_at: s.lastRunAt ? s.lastRunAt.toISOString() : null,
		next_run_at: s.nextRunAt ? s.nextRunAt.toISOString() : null,
		last_ok: s.lastResultOk,
		last_duration_sec: s.lastDurationSec,
		last_error: s.lastError
	});
});

// API: start scheduler (Odoo)
app.post('/api/scheduler/start', requireAuth, requireRole(['production', 'warehouse']), (req, res) => {
	const minutes = parseInt(req.body?.interval_minutes, 10);
	if (Number.isFinite(minutes) && minutes > 0) {
		schedulerState.intervalMs = minutes * 60 * 1000;
	}
	// Allow overriding session id via API body
	const sess = req.body?.session_id;
	if (sess && typeof sess === 'string' && sess.trim().length > 0) {
		schedulerState.sessionId = sess.trim();
	}
	if (!(schedulerState.sessionId || config.odoo.sessionId)) {
		return res.status(400).json({ error: 'Missing ODOO_SESSION_ID. Provide session_id in body or set env/config.' });
	}
	if (schedulerState.running) {
		return res.json({ ok: true, message: 'Scheduler already running' });
	}
	schedulerState.running = true;
	// run immediately
	setTimeout(runOneSync, 10);
	scheduleNext();
	return res.json({ ok: true, running: true, interval_minutes: Math.round(schedulerState.intervalMs / 60000) });
});

// API: stop scheduler (Odoo)
app.post('/api/scheduler/stop', requireAuth, requireRole(['production', 'warehouse']), (req, res) => {
	if (!schedulerState.running) {
		return res.json({ ok: true, message: 'Scheduler already stopped' });
	}
	schedulerState.running = false;
	if (schedulerState.timerId) {
		clearTimeout(schedulerState.timerId);
		schedulerState.timerId = null;
	}
	schedulerState.nextRunAt = null;
	return res.json({ ok: true, running: false });
});

// API: Authenticity scheduler status
app.get('/api/scheduler/authenticity/status', requireAuth, requireRole(['production', 'warehouse']), (req, res) => {
	const s = authenticitySchedulerState;
	res.json({
		running: s.running,
		isSyncing: s.isSyncing,
		interval_minutes: Math.round(s.intervalMs / 60000),
		run_count: s.runCount,
		last_run_at: s.lastRunAt ? s.lastRunAt.toISOString() : null,
		next_run_at: s.nextRunAt ? s.nextRunAt.toISOString() : null,
		last_ok: s.lastResultOk,
		last_duration_sec: s.lastDurationSec,
		last_error: s.lastError
	});
});

// API: start Authenticity scheduler
app.post('/api/scheduler/authenticity/start', requireAuth, requireRole(['production', 'warehouse']), (req, res) => {
	const minutes = parseInt(req.body?.interval_minutes, 10);
	if (Number.isFinite(minutes) && minutes > 0) {
		authenticitySchedulerState.intervalMs = minutes * 60 * 1000;
	}
	if (authenticitySchedulerState.running) {
		return res.json({ ok: true, message: 'Authenticity scheduler already running' });
	}
	authenticitySchedulerState.running = true;
	// run immediately
	setTimeout(runOneAuthenticitySync, 10);
	scheduleNextAuthenticity();
	return res.json({ ok: true, running: true, interval_minutes: Math.round(authenticitySchedulerState.intervalMs / 60000) });
});

// API: stop Authenticity scheduler
app.post('/api/scheduler/authenticity/stop', requireAuth, requireRole(['production', 'warehouse']), (req, res) => {
	if (!authenticitySchedulerState.running) {
		return res.json({ ok: true, message: 'Authenticity scheduler already stopped' });
	}
	authenticitySchedulerState.running = false;
	if (authenticitySchedulerState.timerId) {
		clearTimeout(authenticitySchedulerState.timerId);
		authenticitySchedulerState.timerId = null;
	}
	authenticitySchedulerState.nextRunAt = null;
	return res.json({ ok: true, running: false });
});

// API: Get all schedulers status (combined)
app.get('/api/scheduler/all/status', requireAuth, requireRole(['production', 'warehouse']), (req, res) => {
	const odoo = schedulerState;
	const auth = authenticitySchedulerState;
	res.json({
		odoo: {
			running: odoo.running,
			isSyncing: odoo.isSyncing,
			interval_minutes: Math.round(odoo.intervalMs / 60000),
			run_count: odoo.runCount,
			last_run_at: odoo.lastRunAt ? odoo.lastRunAt.toISOString() : null,
			next_run_at: odoo.nextRunAt ? odoo.nextRunAt.toISOString() : null,
			last_ok: odoo.lastResultOk,
			last_duration_sec: odoo.lastDurationSec,
			last_error: odoo.lastError
		},
		authenticity: {
			running: auth.running,
			isSyncing: auth.isSyncing,
			interval_minutes: Math.round(auth.intervalMs / 60000),
			run_count: auth.runCount,
			last_run_at: auth.lastRunAt ? auth.lastRunAt.toISOString() : null,
			next_run_at: auth.nextRunAt ? auth.nextRunAt.toISOString() : null,
			last_ok: auth.lastResultOk,
			last_duration_sec: auth.lastDurationSec,
			last_error: auth.lastError
		}
	});
});

// API: recent MO options (not yet marked ready) - Warehouse only
app.get('/api/mo-options', requireAuth, requireRole(['warehouse']), async (req, res) => {
	try {
		const rows = await all(db, `
			SELECT mo_name, product_name, note, group_worker_id, create_date
			FROM recent_mo
			WHERE COALESCE(ready_for_production, 0) = 0
			ORDER BY datetime(create_date) DESC
			LIMIT 200
		`);
		res.json({ data: rows });
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
});

// API: list MO that are ready for production
app.get('/api/ready-mo', requireAuth, async (req, res) => {
	try {
		const rows = await all(db, `
			SELECT mo_name, product_name, product_uom, product_qty, auth_first, roll_number, create_date
			FROM recent_mo
			WHERE COALESCE(ready_for_production, 0) = 1
				AND (date_start IS NULL OR TRIM(date_start) = '')
			ORDER BY datetime(create_date) DESC
			LIMIT 500
		`);
		res.json({ data: rows });
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
});

// Running MOs (already started)
app.get('/api/running-mo', requireAuth, async (req, res) => {
	try {
		const rows = await all(db, `
			SELECT mo_name, product_name, product_uom, product_qty, auth_first, auth_last, roll_number, date_start
			FROM recent_mo
			WHERE date_start IS NOT NULL AND TRIM(date_start) <> ''
			  AND (date_finished IS NULL OR TRIM(date_finished) = '')
			  AND (state IS NULL OR LOWER(state) <> 'done')
			ORDER BY datetime(date_start) DESC
			LIMIT 200
		`);
		res.json({ data: rows });
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
});

// API: details for a ready MO (prefill for start production)
app.get('/api/ready-mo-details', requireAuth, async (req, res) => {
	try {
		const moName = String(req.query.mo_name || '').trim();
		if (!moName) return res.status(400).json({ error: 'mo_name required' });
		const row = await get(db, `
			SELECT mo_name, product_name, initial_qty_target, product_qty, product_uom, auth_first, roll_number, date_start
			FROM recent_mo
			WHERE mo_name = ? AND COALESCE(ready_for_production, 0) = 1
			LIMIT 1
		`, [moName]);
		if (!row) return res.status(404).json({ error: 'MO not found or not ready' });
		const target_qty = row.initial_qty_target ?? row.product_qty ?? null;
		res.json({
			data: {
				mo_name: row.mo_name,
				product_name: row.product_name,
				sku_name: row.product_name,
				target_qty,
				product_uom: row.product_uom,
				auth_first: row.auth_first,
				roll_number: row.roll_number,
				date_start: row.date_start
			}
		});
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
});

// API: start production -> set date_start and log - Production only
app.post('/api/start-production', requireAuth, requireRole(['production']), async (req, res) => {
	try {
		const { mo_name, leader_id } = req.body || {};
		if (!mo_name || !leader_id) {
			return res.status(400).json({ error: 'mo_name and leader_id are required' });
		}
		// Normalize leader_id to preserve format (leading zeros)
		const normalizedLeaderId = normalizeLeaderId(leader_id);
		
		const row = await get(db, `
			SELECT mo_name, product_name, product_id, initial_qty_target, product_qty FROM recent_mo
			WHERE mo_name = ? AND COALESCE(ready_for_production, 0) = 1
			LIMIT 1
		`, [mo_name]);
		if (!row) return res.status(404).json({ error: 'MO not found or not ready' });

		const now = formatSqlDateInTz(new Date());
		// Store leader_id as string to preserve format
		await run(db, `
			UPDATE recent_mo SET date_start = ?, state = COALESCE(NULLIF(state, ''), 'progress'), leader_id = ?
			WHERE mo_name = ?
		`, [now, normalizedLeaderId, mo_name]);

		await run(db, `
			INSERT INTO production_log (mo_name, product_name, leader_id, status, create_at)
			VALUES (?, ?, ?, 'start', ?)
		`, [mo_name, row.product_name || null, normalizedLeaderId, now]);

		// Insert or update manufacturing_identity
		const targetQty = row.initial_qty_target ?? row.product_qty ?? null;
		const existing = await get(db, `SELECT id FROM manufacturing_identity WHERE mo_name = ?`, [mo_name]);
		if (existing) {
			await run(db, `
				UPDATE manufacturing_identity
				SET sku = ?, sku_name = ?, target_qty = ?, leader_name = ?, started_at = ?
				WHERE mo_name = ?
			`, [String(row.product_id || ''), row.product_name || null, targetQty, normalizedLeaderId, now, mo_name]);
		} else {
			await run(db, `
				INSERT INTO manufacturing_identity (mo_name, sku, sku_name, target_qty, leader_name, started_at)
				VALUES (?, ?, ?, ?, ?, ?)
			`, [mo_name, String(row.product_id || ''), row.product_name || null, targetQty, normalizedLeaderId, now]);
		}

		res.json({ ok: true, date_start: now });
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
});

// Changeover: set end_auth for current (new_auth - 1) and start_auth for next (new_auth) - Production only
app.post('/api/changeover', requireAuth, requireRole(['production']), async (req, res) => {
	try {
		const { current_mo, next_mo, new_auth, roll_number } = req.body || {};
		if (!current_mo || !next_mo || !new_auth) {
			return res.status(400).json({ error: 'current_mo, next_mo, and new_auth are required' });
		}
		// Validate current running MO and get leader_id
		const current = await get(db, `
			SELECT mo_name, product_name, leader_id FROM recent_mo
			WHERE mo_name = ? AND date_start IS NOT NULL AND TRIM(date_start) <> ''
			LIMIT 1
		`, [current_mo]);
		if (!current) return res.status(404).json({ error: 'Current MO not running' });
		
		// Get leader_id from current MO (from recent_mo or from production_log start entry)
		let leaderId = current.leader_id;
		if (!leaderId) {
			// Fallback: get from production_log where status='start' for this MO
			const startLog = await get(db, `
				SELECT leader_id FROM production_log
				WHERE mo_name = ? AND status = 'start'
				ORDER BY create_at DESC
				LIMIT 1
			`, [current_mo]);
			if (startLog && startLog.leader_id) {
				leaderId = startLog.leader_id;
			}
		}
		// Format leader_id to preserve leading zeros
		leaderId = formatLeaderIdFromDb(leaderId);
		// Validate next MO ready (not started yet)
		const next = await get(db, `
			SELECT mo_name, product_name FROM recent_mo
			WHERE mo_name = ?
				AND COALESCE(ready_for_production, 0) = 1
				AND (date_start IS NULL OR TRIM(date_start) = '')
			LIMIT 1
		`, [next_mo]);
		if (!next) return res.status(404).json({ error: 'Next MO not found or not ready' });

		// Parse authenticity number as integer
		const parsed = Number(new_auth);
		if (!Number.isFinite(parsed)) {
			return res.status(400).json({ error: 'new_auth must be a numeric code' });
		}
		const endAuth = String(parsed - 1);
		const startAuth = String(parsed);

		// Apply updates
		const now = formatSqlDateInTz(new Date());
		await run(db, `
			UPDATE recent_mo SET auth_last = ?, date_finished = ?, state = 'done'
			WHERE mo_name = ?
		`, [endAuth, now, current_mo]);

		await run(db, `
			UPDATE recent_mo SET auth_first = ?, date_start = ?, state = COALESCE(NULLIF(state, ''), 'progress')
			WHERE mo_name = ?
		`, [startAuth, now, next_mo]);

		// Optionally set new roll number for next MO if provided
		if (roll_number && String(roll_number).trim().length > 0) {
			await run(db, `
				UPDATE recent_mo SET roll_number = ?
				WHERE mo_name = ?
			`, [String(roll_number).trim(), next_mo]);
		}

		// Log changeover entries:
		// 1. End entry for current MO
		await run(db, `
			INSERT INTO production_log (mo_name, product_name, leader_id, status, create_at)
			VALUES (?, ?, ?, 'end', ?)
		`, [current_mo, current.product_name || null, leaderId, now]);
		
		// 2. Start entry for next MO (using same leader_id from current MO)
		await run(db, `
			INSERT INTO production_log (mo_name, product_name, leader_id, status, create_at)
			VALUES (?, ?, ?, 'start', ?)
		`, [next_mo, next.product_name || null, leaderId, now]);
		
		// Update leader_id in recent_mo for next MO
		if (leaderId) {
			await run(db, `
				UPDATE recent_mo SET leader_id = ?
				WHERE mo_name = ?
			`, [leaderId, next_mo]);
		}

		// Update manufacturing_identity for current MO (finished)
		const currentMoData = await get(db, `
			SELECT product_id, auth_first FROM recent_mo WHERE mo_name = ?
		`, [current_mo]);
		if (currentMoData) {
			const currentDoneQty = currentMoData.auth_first && endAuth ? (Number(endAuth) - Number(currentMoData.auth_first) + 1) : null;
			await run(db, `
				UPDATE manufacturing_identity
				SET finished_at = ?, done_qty = ?
				WHERE mo_name = ?
			`, [now, currentDoneQty, current_mo]);
		}

		// Insert/update manufacturing_identity for next MO (started)
		const nextMoData = await get(db, `
			SELECT product_id, product_name, initial_qty_target, product_qty FROM recent_mo WHERE mo_name = ?
		`, [next_mo]);
		if (nextMoData) {
			const nextTargetQty = nextMoData.initial_qty_target ?? nextMoData.product_qty ?? null;
			const existingNext = await get(db, `SELECT id FROM manufacturing_identity WHERE mo_name = ?`, [next_mo]);
			if (existingNext) {
				await run(db, `
					UPDATE manufacturing_identity
					SET sku = ?, sku_name = ?, target_qty = ?, leader_name = ?, started_at = ?, finished_at = NULL, done_qty = NULL
					WHERE mo_name = ?
				`, [String(nextMoData.product_id || ''), nextMoData.product_name || null, nextTargetQty, leaderId || '', now, next_mo]);
			} else {
				await run(db, `
					INSERT INTO manufacturing_identity (mo_name, sku, sku_name, target_qty, leader_name, started_at)
					VALUES (?, ?, ?, ?, ?, ?)
				`, [next_mo, String(nextMoData.product_id || ''), nextMoData.product_name || null, nextTargetQty, leaderId || '', now]);
			}
		}

		res.json({ ok: true, current_end_auth: endAuth, next_start_auth: startAuth });
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
});

// End production: finalize running MO with provided authenticity → auth_last = authenticity - 1, set date_finished - Production only
app.post('/api/end-production', requireAuth, requireRole(['production']), async (req, res) => {
	try {
		const { mo_name, authenticity, roll_number } = req.body || {};
		if (!mo_name || !authenticity) {
			return res.status(400).json({ error: 'mo_name and authenticity are required' });
		}
		const running = await get(db, `
			SELECT mo_name, product_name, leader_id FROM recent_mo
			WHERE mo_name = ? AND date_start IS NOT NULL AND TRIM(date_start) <> ''
			LIMIT 1
		`, [mo_name]);
		if (!running) return res.status(404).json({ error: 'MO not running' });
		
		// Get leader_id from running MO (from recent_mo or from production_log start entry)
		let leaderId = running.leader_id;
		if (!leaderId) {
			// Fallback: get from production_log where status='start' for this MO
			const startLog = await get(db, `
				SELECT leader_id FROM production_log
				WHERE mo_name = ? AND status = 'start'
				ORDER BY create_at DESC
				LIMIT 1
			`, [mo_name]);
			if (startLog && startLog.leader_id) {
				leaderId = startLog.leader_id;
			}
		}
		// Format leader_id to preserve leading zeros
		leaderId = formatLeaderIdFromDb(leaderId);
		const parsed = Number(authenticity);
		if (!Number.isFinite(parsed)) {
			return res.status(400).json({ error: 'authenticity must be a numeric code' });
		}
		const endAuth = String(parsed - 1);
		const now = formatSqlDateInTz(new Date());
		await run(db, `
			UPDATE recent_mo SET auth_last = ?, date_finished = ?
			WHERE mo_name = ?
		`, [endAuth, now, mo_name]);
		// Optionally update roll number at end
		if (roll_number && String(roll_number).trim().length > 0) {
			await run(db, `
				UPDATE recent_mo SET roll_number = ?
				WHERE mo_name = ?
			`, [String(roll_number).trim(), mo_name]);
		}
		await run(db, `
			INSERT INTO production_log (mo_name, product_name, leader_id, status, create_at)
			VALUES (?, ?, ?, 'end', ?)
		`, [mo_name, running.product_name || null, leaderId, now]);
		
		// Update manufacturing_identity with finished_at and done_qty
		const runningData = await get(db, `
			SELECT product_id, auth_first FROM recent_mo WHERE mo_name = ?
		`, [mo_name]);
		if (runningData) {
			const doneQty = runningData.auth_first && endAuth ? (Number(endAuth) - Number(runningData.auth_first) + 1) : null;
			await run(db, `
				UPDATE manufacturing_identity
				SET finished_at = ?, done_qty = ?
				WHERE mo_name = ?
			`, [now, doneQty, mo_name]);
		}
		
		res.json({ ok: true, end_auth: endAuth, date_finished: now });
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
});

// API: register MO as ready with auth_first and roll_number - Warehouse only
app.post('/api/register-mo', requireAuth, requireRole(['warehouse']), async (req, res) => {
	try {
		const { mo_name, auth_first, roll_number, run_mid_production } = req.body || {};
		if (!mo_name) {
			return res.status(400).json({ error: 'mo_name is required' });
		}
		const exists = await get(db, `SELECT mo_name FROM recent_mo WHERE mo_name = ?`, [mo_name]);
		if (!exists) {
			return res.status(404).json({ error: 'MO not found in recent_mo' });
		}
		if (run_mid_production) {
			// Mark ready only; no auth/roll required
			await run(db, `
				UPDATE recent_mo
				SET ready_for_production = 1
				WHERE mo_name = ?
			`, [mo_name]);
		} else {
			if (!auth_first || !roll_number) {
				return res.status(400).json({ error: 'auth_first and roll_number are required unless run_mid_production is true' });
			}
			await run(db, `
				UPDATE recent_mo
				SET auth_first = ?, roll_number = ?, ready_for_production = 1
				WHERE mo_name = ?
			`, [auth_first, roll_number, mo_name]);
		}
		res.json({ ok: true });
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
});

// ============================================
// DATA EXPORT API ENDPOINTS (for external access)
// ============================================

// API: Get recent_mo data
app.get('/api/data/recent-mo', requireAuth, async (req, res) => {
	try {
		const limit = parseInt(req.query.limit || '100', 10);
		const offset = parseInt(req.query.offset || '0', 10);
		const mo_name = req.query.mo_name;
		const ready = req.query.ready; // 'true' or 'false'
		const state = req.query.state; // filter by state

		let sql = 'SELECT * FROM recent_mo WHERE 1=1';
		const params = [];

		if (mo_name) {
			sql += ' AND mo_name = ?';
			params.push(mo_name);
		}
		if (ready === 'true') {
			sql += ' AND COALESCE(ready_for_production, 0) = 1';
		} else if (ready === 'false') {
			sql += ' AND COALESCE(ready_for_production, 0) = 0';
		}
		if (state) {
			sql += ' AND state = ?';
			params.push(state);
		}

		sql += ' ORDER BY datetime(create_date) DESC LIMIT ? OFFSET ?';
		params.push(limit, offset);

		const rows = await all(db, sql, params);
		
		// Get total count for pagination
		let countSql = 'SELECT COUNT(*) as total FROM recent_mo WHERE 1=1';
		const countParams = [];
		if (mo_name) {
			countSql += ' AND mo_name = ?';
			countParams.push(mo_name);
		}
		if (ready === 'true') {
			countSql += ' AND COALESCE(ready_for_production, 0) = 1';
		} else if (ready === 'false') {
			countSql += ' AND COALESCE(ready_for_production, 0) = 0';
		}
		if (state) {
			countSql += ' AND state = ?';
			countParams.push(state);
		}
		const countResult = await get(db, countSql, countParams);

		res.json({
			ok: true,
			data: rows,
			pagination: {
				total: countResult?.total || 0,
				limit,
				offset,
				has_more: (offset + rows.length) < (countResult?.total || 0)
			}
		});
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
});

// API: Get manufacturing_identity data
app.get('/api/data/manufacturing-identity', requireAuth, async (req, res) => {
	try {
		const limit = parseInt(req.query.limit || '100', 10);
		const offset = parseInt(req.query.offset || '0', 10);
		const mo_name = req.query.mo_name;
		const sku = req.query.sku;
		const created_at_from = req.query.created_at_from; // YYYY-MM-DD or YYYY-MM-DD HH:MM:SS
		const created_at_to = req.query.created_at_to;
		const finished_at_from = req.query.finished_at_from;
		const finished_at_to = req.query.finished_at_to;

		let sql = 'SELECT * FROM manufacturing_identity WHERE 1=1';
		const params = [];

		if (mo_name) {
			sql += ' AND mo_name = ?';
			params.push(mo_name);
		}
		if (sku) {
			sql += ' AND sku = ?';
			params.push(sku);
		}
		if (created_at_from) {
			sql += ' AND datetime(created_at) >= ?';
			params.push(created_at_from);
		}
		if (created_at_to) {
			sql += ' AND datetime(created_at) <= ?';
			params.push(created_at_to);
		}
		if (finished_at_from) {
			sql += ' AND datetime(finished_at) >= ?';
			params.push(finished_at_from);
		}
		if (finished_at_to) {
			sql += ' AND datetime(finished_at) <= ?';
			params.push(finished_at_to);
		}

		sql += ' ORDER BY datetime(created_at) DESC LIMIT ? OFFSET ?';
		params.push(limit, offset);

		const rows = await all(db, sql, params);
		
		// Get total count
		let countSql = 'SELECT COUNT(*) as total FROM manufacturing_identity WHERE 1=1';
		const countParams = [];
		if (mo_name) {
			countSql += ' AND mo_name = ?';
			countParams.push(mo_name);
		}
		if (sku) {
			countSql += ' AND sku = ?';
			countParams.push(sku);
		}
		if (created_at_from) {
			countSql += ' AND datetime(created_at) >= ?';
			countParams.push(created_at_from);
		}
		if (created_at_to) {
			countSql += ' AND datetime(created_at) <= ?';
			countParams.push(created_at_to);
		}
		if (finished_at_from) {
			countSql += ' AND datetime(finished_at) >= ?';
			countParams.push(finished_at_from);
		}
		if (finished_at_to) {
			countSql += ' AND datetime(finished_at) <= ?';
			countParams.push(finished_at_to);
		}
		const countResult = await get(db, countSql, countParams);

		res.json({
			ok: true,
			data: rows,
			pagination: {
				total: countResult?.total || 0,
				limit,
				offset,
				has_more: (offset + rows.length) < (countResult?.total || 0)
			}
		});
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
});

// API: Get production_log data
app.get('/api/data/production-log', requireAuth, async (req, res) => {
	try {
		const limit = parseInt(req.query.limit || '100', 10);
		const offset = parseInt(req.query.offset || '0', 10);
		const mo_name = req.query.mo_name;
		const status = req.query.status; // 'start' or 'end'
		const from_date = req.query.from_date; // YYYY-MM-DD or YYYY-MM-DD HH:MM:SS
		const to_date = req.query.to_date;

		let sql = 'SELECT * FROM production_log WHERE 1=1';
		const params = [];

		if (mo_name) {
			sql += ' AND mo_name = ?';
			params.push(mo_name);
		}
		if (status) {
			sql += ' AND status = ?';
			params.push(status);
		}
		if (from_date) {
			sql += ' AND datetime(create_at) >= ?';
			params.push(from_date);
		}
		if (to_date) {
			sql += ' AND datetime(create_at) <= ?';
			params.push(to_date);
		}

		sql += ' ORDER BY datetime(create_at) DESC LIMIT ? OFFSET ?';
		params.push(limit, offset);

		const rows = await all(db, sql, params);
		
		// Get total count
		let countSql = 'SELECT COUNT(*) as total FROM production_log WHERE 1=1';
		const countParams = [];
		if (mo_name) {
			countSql += ' AND mo_name = ?';
			countParams.push(mo_name);
		}
		if (status) {
			countSql += ' AND status = ?';
			countParams.push(status);
		}
		if (from_date) {
			countSql += ' AND datetime(create_at) >= ?';
			countParams.push(from_date);
		}
		if (to_date) {
			countSql += ' AND datetime(create_at) <= ?';
			countParams.push(to_date);
		}
		const countResult = await get(db, countSql, countParams);

		res.json({
			ok: true,
			data: rows,
			pagination: {
				total: countResult?.total || 0,
				limit,
				offset,
				has_more: (offset + rows.length) < (countResult?.total || 0)
			}
		});
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
});

// API: Get master_authenticity_vendor data
app.get('/api/data/master-authenticity-vendor', requireAuth, async (req, res) => {
	try {
		const limit = parseInt(req.query.limit || '100', 10);
		const offset = parseInt(req.query.offset || '0', 10);
		const roll = req.query.roll;
		const authenticity = req.query.authenticity;

		let sql = 'SELECT * FROM master_authenticity_vendor WHERE 1=1';
		const params = [];

		if (roll) {
			sql += ' AND roll = ?';
			params.push(roll);
		}
		if (authenticity) {
			sql += ' AND authenticity = ?';
			params.push(authenticity);
		}

		sql += ' ORDER BY datetime(created_at) DESC LIMIT ? OFFSET ?';
		params.push(limit, offset);

		const rows = await all(db, sql, params);
		
		// Get total count
		let countSql = 'SELECT COUNT(*) as total FROM master_authenticity_vendor WHERE 1=1';
		const countParams = [];
		if (roll) {
			countSql += ' AND roll = ?';
			countParams.push(roll);
		}
		if (authenticity) {
			countSql += ' AND authenticity = ?';
			countParams.push(authenticity);
		}
		const countResult = await get(db, countSql, countParams);

		res.json({
			ok: true,
			data: rows,
			pagination: {
				total: countResult?.total || 0,
				limit,
				offset,
				has_more: (offset + rows.length) < (countResult?.total || 0)
			}
		});
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
});

// API: Get authenticity_used_rm data
// Note: Data diambil dari recent_mo jika tabel authenticity_used_rm kosong
// Data di-format sesuai struktur authenticity_used_rm untuk kompatibilitas
app.get('/api/data/authenticity-used-rm', requireAuth, async (req, res) => {
	try {
		const limit = parseInt(req.query.limit || '100', 10);
		const offset = parseInt(req.query.offset || '0', 10);
		const transfer_id = req.query.transfer_id;
		const authenticity = req.query.authenticity;

		// First, try to get from authenticity_used_rm table
		let sql = 'SELECT * FROM authenticity_used_rm WHERE 1=1';
		const params = [];

		if (transfer_id) {
			sql += ' AND transfer_id = ?';
			params.push(transfer_id);
		}
		if (authenticity) {
			sql += ' AND authenticity = ?';
			params.push(authenticity);
		}

		sql += ' ORDER BY datetime(created_at) DESC LIMIT ? OFFSET ?';
		params.push(limit, offset);

		const rows = await all(db, sql, params);
		
		// If no data in authenticity_used_rm, get from recent_mo
		if (rows.length === 0) {
			// Get data from recent_mo where transfer_id is not null and has authenticity data
			let recentMoSql = `
				SELECT 
					transfer_id,
					auth_first as authenticity,
					COALESCE(date_start, created_at) as transfer_date,
					COALESCE(date_start, created_at) as created_at
				FROM recent_mo
				WHERE transfer_id IS NOT NULL
				  AND ((auth_first IS NOT NULL AND TRIM(auth_first) <> '')
				   OR (auth_last IS NOT NULL AND TRIM(auth_last) <> ''))
			`;
			const recentMoParams = [];

			if (transfer_id) {
				recentMoSql += ' AND transfer_id = ?';
				recentMoParams.push(transfer_id);
			}
			if (authenticity) {
				recentMoSql += ' AND (auth_first = ? OR auth_last = ?)';
				recentMoParams.push(authenticity, authenticity);
			}

			recentMoSql += ' ORDER BY datetime(COALESCE(date_start, created_at)) DESC LIMIT ? OFFSET ?';
			recentMoParams.push(limit, offset);

			const recentMoRows = await all(db, recentMoSql, recentMoParams);
			
			// Format data to match authenticity_used_rm structure
			// Generate sequential IDs starting from a high number to avoid conflicts
			const formattedRows = recentMoRows.map((row, index) => ({
				id: 1000000 + offset + index, // Generate temporary ID to avoid null
				transfer_id: row.transfer_id,
				authenticity: row.authenticity,
				transfer_date: row.transfer_date,
				created_at: row.created_at
			}));

			// Get total count from recent_mo
			let countSql = `
				SELECT COUNT(*) as total
				FROM recent_mo
				WHERE transfer_id IS NOT NULL
				  AND ((auth_first IS NOT NULL AND TRIM(auth_first) <> '')
				   OR (auth_last IS NOT NULL AND TRIM(auth_last) <> ''))
			`;
			const countParams = [];
			if (transfer_id) {
				countSql += ' AND transfer_id = ?';
				countParams.push(transfer_id);
			}
			if (authenticity) {
				countSql += ' AND (auth_first = ? OR auth_last = ?)';
				countParams.push(authenticity, authenticity);
			}
			const countResult = await get(db, countSql, countParams);

			return res.json({
				ok: true,
				data: formattedRows,
				pagination: {
					total: countResult?.total || 0,
					limit,
					offset,
					has_more: (offset + formattedRows.length) < (countResult?.total || 0)
				},
				_source: 'recent_mo' // Indicate data source
			});
		}

		// If data exists in authenticity_used_rm, return it
		let countSql = 'SELECT COUNT(*) as total FROM authenticity_used_rm WHERE 1=1';
		const countParams = [];
		if (transfer_id) {
			countSql += ' AND transfer_id = ?';
			countParams.push(transfer_id);
		}
		if (authenticity) {
			countSql += ' AND authenticity = ?';
			countParams.push(authenticity);
		}
		const countResult = await get(db, countSql, countParams);

		res.json({
			ok: true,
			data: rows,
			pagination: {
				total: countResult?.total || 0,
				limit,
				offset,
				has_more: (offset + rows.length) < (countResult?.total || 0)
			},
			_source: 'authenticity_used_rm' // Indicate data source
		});
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
});

// API: Get authenticity_used_line data
// Note: Data diambil dari recent_mo karena authenticity_used_line mungkin kosong
// Data di-format sesuai struktur authenticity_used_line untuk kompatibilitas
app.get('/api/data/authenticity-used-line', requireAuth, async (req, res) => {
	try {
		const limit = parseInt(req.query.limit || '100', 10);
		const offset = parseInt(req.query.offset || '0', 10);
		const mo_name = req.query.mo_name;
		const sku_barcode = req.query.sku_barcode;

		// First, try to get from authenticity_used_line table
		let sql = 'SELECT * FROM authenticity_used_line WHERE 1=1';
		const params = [];

		if (mo_name) {
			sql += ' AND mo_name = ?';
			params.push(mo_name);
		}
		if (sku_barcode) {
			sql += ' AND sku_barcode = ?';
			params.push(sku_barcode);
		}

		sql += ' ORDER BY datetime(created_at) DESC LIMIT ? OFFSET ?';
		params.push(limit, offset);

		const rows = await all(db, sql, params);
		
		// If no data in authenticity_used_line, get from recent_mo
		if (rows.length === 0) {
			// Get data from recent_mo where auth_first or auth_last is not null
			let recentMoSql = `
				SELECT 
					mo_name,
					product_name as sku_barcode,
					auth_first as auth_first_code,
					auth_last as auth_last_code,
					COALESCE(date_start, created_at) as created_at
				FROM recent_mo
				WHERE (auth_first IS NOT NULL AND TRIM(auth_first) <> '')
				   OR (auth_last IS NOT NULL AND TRIM(auth_last) <> '')
			`;
			const recentMoParams = [];

			if (mo_name) {
				recentMoSql += ' AND mo_name = ?';
				recentMoParams.push(mo_name);
			}
			if (sku_barcode) {
				recentMoSql += ' AND product_name LIKE ?';
				recentMoParams.push(`%${sku_barcode}%`);
			}

			recentMoSql += ' ORDER BY datetime(COALESCE(date_start, created_at)) DESC LIMIT ? OFFSET ?';
			recentMoParams.push(limit, offset);

			const recentMoRows = await all(db, recentMoSql, recentMoParams);
			
			// Format data to match authenticity_used_line structure
			const formattedRows = recentMoRows.map(row => ({
				id: null, // No ID from recent_mo
				mo_name: row.mo_name,
				sku_barcode: row.sku_barcode,
				auth_first_code: row.auth_first_code,
				auth_last_code: row.auth_last_code,
				created_at: row.created_at
			}));

			// Get total count from recent_mo
			let countSql = `
				SELECT COUNT(*) as total
				FROM recent_mo
				WHERE (auth_first IS NOT NULL AND TRIM(auth_first) <> '')
				   OR (auth_last IS NOT NULL AND TRIM(auth_last) <> '')
			`;
			const countParams = [];
			if (mo_name) {
				countSql += ' AND mo_name = ?';
				countParams.push(mo_name);
			}
			if (sku_barcode) {
				countSql += ' AND product_name LIKE ?';
				countParams.push(`%${sku_barcode}%`);
			}
			const countResult = await get(db, countSql, countParams);

			return res.json({
				ok: true,
				data: formattedRows,
				pagination: {
					total: countResult?.total || 0,
					limit,
					offset,
					has_more: (offset + formattedRows.length) < (countResult?.total || 0)
				},
				_source: 'recent_mo' // Indicate data source
			});
		}

		// If data exists in authenticity_used_line, return it
		let countSql = 'SELECT COUNT(*) as total FROM authenticity_used_line WHERE 1=1';
		const countParams = [];
		if (mo_name) {
			countSql += ' AND mo_name = ?';
			countParams.push(mo_name);
		}
		if (sku_barcode) {
			countSql += ' AND sku_barcode = ?';
			countParams.push(sku_barcode);
		}
		const countResult = await get(db, countSql, countParams);

		res.json({
			ok: true,
			data: rows,
			pagination: {
				total: countResult?.total || 0,
				limit,
				offset,
				has_more: (offset + rows.length) < (countResult?.total || 0)
			},
			_source: 'authenticity_used_line' // Indicate data source
		});
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
});

// UI pages
app.get('/', (req, res) => {
	res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
	res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/admin', (req, res) => {
	res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
	console.log(`Manufacturing_Process_System running on http://localhost:${PORT}`);
});


