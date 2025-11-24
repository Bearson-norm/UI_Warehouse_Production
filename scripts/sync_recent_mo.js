#!/usr/bin/env node
/**
 * Sync recent manufacturing orders to SQLite with required filters and enrichments.
 * Filters:
 *  - create_date in last 7 days (including today)
 *  - state != 'done'
 *  - group_worker in [6, 7]
 *  - note contains any of:
 *      "TEAM LIQUID - SHIFT 1", "TEAM LIQUID - SHIFT 2", "TEAM LIQUID - SHIFT 3"
 * Enrich:
 *  - transfer_id by matching to related picking (by origin/name)
 *  - auth_first, auth_last, leader_id, roll_number (left as columns; fill from authenticity/other sources when available)
 */
const { db, run } = require('../db');
const config = require('../config');
const { searchRead } = require('../services_odoo');

// Basic CLI args for session override
const args = process.argv.slice(2);
let sessionId = args.find(a => !a.startsWith('--') && a.length > 20) || config.odoo.sessionId || '';

function getDateRangeLast7Days() {
	const end = new Date();
	const start = new Date();
	start.setDate(end.getDate() - 6);
	const toIsoDate = (d) => d.toISOString().slice(0, 10);
	return {
		from: `${toIsoDate(start)} 00:00:00`,
		to: `${toIsoDate(end)} 23:59:59`
	};
}

async function fetchRecentMOs(sessId) {
	const range = getDateRangeLast7Days();
	const domain = [
		['create_date', '>=', range.from],
		['create_date', '<=', range.to],
		['state', '!=', 'done'],
		// group_worker is many2one, domain can check id equals any of [6,7]
		['group_worker', 'in', [6, 7]],
		'|', '|',
		['note', 'ilike', 'TEAM LIQUID - SHIFT 1'],
		['note', 'ilike', 'TEAM LIQUID - SHIFT 2'],
		['note', 'ilike', 'TEAM LIQUID - SHIFT 3']
	];

	const fields = [
		'id', 'name', 'state', 'group_worker', 'note',
		'product_id', 'product_qty', 'product_uom_id',
		'initial_qty_target', 'create_date', 'date_start', 'date_finished',
		'origin'
	];

	const kwargs = { limit: 500, order: 'create_date desc' };
	const result = await searchRead('mrp.production', domain, fields, kwargs, sessId);
	return Array.isArray(result) ? result : [];
}

function getCutoffDate7Days() {
	const now = new Date();
	const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
	const pad = (n) => String(n).padStart(2, '0');
	const yyyy = cutoff.getFullYear();
	const mm = pad(cutoff.getMonth() + 1);
	const dd = pad(cutoff.getDate());
	// Compare at end of day to be safe (remove anything strictly older than 7 days)
	return `${yyyy}-${mm}-${dd} 23:59:59`;
}

async function purgeOldRecentMO() {
	const cutoff = getCutoffDate7Days();
	const result = await run(db, `
		DELETE FROM recent_mo
		WHERE create_date IS NOT NULL
		  AND create_date < ?
	`, [cutoff]);
	return result?.changes || 0;
}

async function findRelatedTransferIdByMo(sessId, moName, origin) {
	// Try stock.picking by origin or reference containing MO name
	const domain = [
		'|',
		['origin', 'ilike', moName],
		origin ? ['origin', 'ilike', origin] : ['name', 'ilike', moName]
	];
	const fields = ['id', 'name', 'origin', 'scheduled_date', 'date_done', 'state', 'picking_type_id'];
	const kwargs = { limit: 1, order: 'id desc' };
	try {
		const rows = await searchRead('stock.picking', domain, fields, kwargs, sessId);
		if (Array.isArray(rows) && rows.length > 0) {
			return rows[0]?.id || null;
		}
	} catch (_) {
		// ignore lookup failures
	}
	return null;
}

async function upsertRecentMo(moRow, transferId) {
	const groupWorkerId = Array.isArray(moRow.group_worker) ? moRow.group_worker[0] : moRow.group_worker || null;
	const productId = Array.isArray(moRow.product_id) ? moRow.product_id[0] : moRow.product_id || null;
	const productName = Array.isArray(moRow.product_id) ? moRow.product_id[1] : null;
	const productUom = Array.isArray(moRow.product_uom_id) ? moRow.product_uom_id[1] : null;

	// Idempotent upsert: unique by mo_name
	await run(db, `
		INSERT INTO recent_mo (
			mo_id, mo_name, state, group_worker_id, note,
			product_id, product_name, product_uom, product_qty, initial_qty_target,
			create_date, date_start, date_finished, origin,
			transfer_id, auth_first, auth_last, leader_id, roll_number
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT (mo_name) DO NOTHING;
	`, [
		moRow.id,
		moRow.name,
		moRow.state || null,
		groupWorkerId,
		moRow.note || null,
		productId,
		productName,
		productUom,
		moRow.product_qty || null,
		moRow.initial_qty_target || null,
		moRow.create_date || null,
		moRow.date_start || null,
		moRow.date_finished || null,
		moRow.origin || null,
		transferId || null,
		null, // auth_first (to be filled from authenticity integration)
		null, // auth_last
		null, // leader_id (if available from your mapping)
		null  // roll_number (if available from your mapping)
	]);

	// If record with same mo_name exists, update ONLY Odoo fields
	// NEVER overwrite UI fields: auth_first, auth_last, leader_id, roll_number, ready_for_production
	// NEVER overwrite date_start/date_finished if already set by UI (keep existing values)
	await run(db, `
		UPDATE recent_mo
		SET state = ?,
			group_worker_id = ?,
			note = ?,
			product_id = ?,
			product_name = ?,
			product_uom = ?,
			product_qty = ?,
			initial_qty_target = ?,
			create_date = ?,
			origin = ?,
			transfer_id = COALESCE(?, transfer_id)
		WHERE mo_name = ?;
	`, [
		moRow.state || null,
		groupWorkerId,
		moRow.note || null,
		productId,
		productName,
		productUom,
		moRow.product_qty || null,
		moRow.initial_qty_target || null,
		moRow.create_date || null,
		moRow.origin || null,
		transferId || null,
		moRow.name
	]);
}

async function main() {
	const mos = await fetchRecentMOs(sessionId);
	console.log(`Found ${mos.length} MO(s) to sync.`);
	for (const mo of mos) {
		const transferId = await findRelatedTransferIdByMo(sessionId, mo.name, mo.origin || null);
		await upsertRecentMo(mo, transferId);
	}
	// Purge records older than 7 days by create_date
	try {
		const deleted = await purgeOldRecentMO();
		if (deleted > 0) {
			console.log(`🧹 Purged ${deleted} old recent_mo record(s) older than 7 days.`);
		}
	} catch (_) {
		// ignore purge failure to not block sync
	}
	console.log('✅ recent_mo sync completed.');
}

// Allow this script to be used as a module without exiting the parent process
async function runSync(session) {
	// allow override of session id
	if (session && typeof session === 'string' && session.length > 0) {
		sessionId = session;
	}
	if (!sessionId) {
		throw new Error('Odoo session ID is required. Provide as first arg or set ODOO_SESSION_ID.');
	}
	await main();
}

if (require.main === module) {
	runSync(sessionId).catch((err) => {
		console.error('❌ Sync failed:', err.message);
		process.exit(1);
	});
} else {
	module.exports = { runSync };
}


