#!/usr/bin/env node
/**
 * Sync authenticity data from Authenticity API to SQLite database.
 * Fetches authenticity data for warehouse RM based on transfer_id from recent_mo.
 * 
 * This script:
 * 1. Gets all recent_mo records with transfer_id
 * 2. For each transfer_id, fetches authenticity data from Authenticity API
 * 3. Inserts/updates authenticity_used_rm table
 */

const { db, run, all, get } = require('../db');
const { fetchWarehouseAuthenticities, fetchVendorBySerial } = require('../services_authenticity');

/**
 * Sync authenticity data for a specific transfer_id
 */
async function syncAuthenticityForTransfer(transferId) {
	try {
		// Fetch authenticity data from API
		const result = await fetchWarehouseAuthenticities(transferId);
		
		// Handle different response structures
		let authenticityData = [];
		if (Array.isArray(result)) {
			authenticityData = result;
		} else if (result.data && Array.isArray(result.data)) {
			authenticityData = result.data;
		} else if (result.authenticities && Array.isArray(result.authenticities)) {
			authenticityData = result.authenticities;
		}

		if (!authenticityData || authenticityData.length === 0) {
			return { success: true, count: 0, message: 'No authenticity data found' };
		}

		// Get transfer date from recent_mo
		const moRecord = await get(db, 'SELECT create_date FROM recent_mo WHERE transfer_id = ? LIMIT 1', [transferId]);
		const transferDate = moRecord?.create_date || new Date().toISOString();

		// Insert/update authenticity records
		let inserted = 0;
		for (const authItem of authenticityData) {
			// Extract authenticity code - adjust field name based on actual API response
			const authenticity = authItem.authenticity || authItem.authenticity_id || authItem.code || authItem.id;
			
			if (!authenticity) {
				continue; // Skip if no authenticity code
			}

			// Check if record already exists
			const existing = await get(db,
				'SELECT id FROM authenticity_used_rm WHERE transfer_id = ? AND authenticity = ?',
				[transferId, authenticity]
			);

			if (!existing) {
				// Insert new record
				await run(db, `
					INSERT INTO authenticity_used_rm (transfer_id, authenticity, transfer_date)
					VALUES (?, ?, ?)
				`, [transferId, authenticity, transferDate]);
				inserted++;
			}
		}

		return { success: true, count: inserted, message: `Synced ${inserted} authenticity record(s)` };
	} catch (err) {
		return { success: false, count: 0, message: err.message, error: err };
	}
}

/**
 * Sync vendor master data by roll number
 */
async function syncVendorMasterByRoll(roll) {
	try {
		if (!roll || roll.trim().length === 0) {
			return { success: true, count: 0, message: 'No roll number provided' };
		}

		console.log(`  Fetching vendor data for roll: ${roll}`);
		// Fetch vendor data from API
		const result = await fetchVendorBySerial(roll);
		
		// Debug: log the raw response structure
		console.log(`  API Response type: ${typeof result}, isArray: ${Array.isArray(result)}`);
		if (result && typeof result === 'object') {
			console.log(`  API Response keys: ${Object.keys(result).join(', ')}`);
		}
		
		// Handle different response structures
		let vendorData = [];
		if (Array.isArray(result)) {
			vendorData = result;
		} else if (result.data && Array.isArray(result.data)) {
			vendorData = result.data;
		} else if (result.vendors && Array.isArray(result.vendors)) {
			vendorData = result.vendors;
		} else if (result.items && Array.isArray(result.items)) {
			vendorData = result.items;
		} else if (result.results && Array.isArray(result.results)) {
			vendorData = result.results;
		}

		console.log(`  Parsed vendor data count: ${vendorData.length}`);

		if (!vendorData || vendorData.length === 0) {
			console.log(`  No vendor data found in response`);
			return { success: true, count: 0, message: 'No vendor data found' };
		}

		let inserted = 0;
		let updated = 0;
		let skipped = 0;
		
		for (const vendorItem of vendorData) {
			// Debug: log first item structure
			if (inserted === 0 && updated === 0 && skipped === 0) {
				console.log(`  First item keys: ${Object.keys(vendorItem).join(', ')}`);
				console.log(`  First item sample: ${JSON.stringify(vendorItem).substring(0, 200)}`);
			}
			
			// Extract fields - adjust based on actual API response structure
			const rollNumber = vendorItem.roll || vendorItem.serial || vendorItem.roll_number || vendorItem.serial_number || roll;
			const authenticity = vendorItem.authenticity || vendorItem.authenticity_id || vendorItem.code || vendorItem.authenticity_code || null;
			const marketingCode = vendorItem.marketing_id || vendorItem.marketing_code || vendorItem.marketingCode || null;
			const tanggalKirim = vendorItem.delivery_date || vendorItem.tanggal_kirim || vendorItem.date_delivery || vendorItem.deliveryDate || null;
			const namaVendor = vendorItem.vendor_name || vendorItem.nama_vendor || vendorItem.vendor || vendorItem.vendorName || null;

			if (!authenticity) {
				console.log(`  Skipping item - no authenticity code found`);
				skipped++;
				continue; // Skip if no authenticity code
			}

			// Check if record already exists (by roll and authenticity)
			const existing = await get(db,
				'SELECT id FROM master_authenticity_vendor WHERE roll = ? AND authenticity = ?',
				[rollNumber, authenticity]
			);

			if (!existing) {
				// Insert new record
				try {
					await run(db, `
						INSERT INTO master_authenticity_vendor (roll, authenticity, marketing_code, tanggal_kirim, nama_vendor)
						VALUES (?, ?, ?, ?, ?)
					`, [rollNumber, authenticity, marketingCode, tanggalKirim, namaVendor]);
					inserted++;
					console.log(`  ✓ Inserted: roll=${rollNumber}, authenticity=${authenticity}`);
				} catch (insertErr) {
					console.error(`  ✗ Insert error: ${insertErr.message}`);
					throw insertErr;
				}
			} else {
				// Update existing record (in case data changed)
				try {
					await run(db, `
						UPDATE master_authenticity_vendor
						SET marketing_code = ?,
							tanggal_kirim = ?,
							nama_vendor = ?
						WHERE roll = ? AND authenticity = ?
					`, [marketingCode, tanggalKirim, namaVendor, rollNumber, authenticity]);
					updated++;
					console.log(`  ✓ Updated: roll=${rollNumber}, authenticity=${authenticity}`);
				} catch (updateErr) {
					console.error(`  ✗ Update error: ${updateErr.message}`);
					throw updateErr;
				}
			}
		}

		const message = `Synced ${inserted} inserted, ${updated} updated, ${skipped} skipped`;
		return { success: true, count: inserted + updated, inserted, updated, skipped, message };
	} catch (err) {
		console.error(`  ✗ Error in syncVendorMasterByRoll: ${err.message}`);
		console.error(`  Stack: ${err.stack}`);
		return { success: false, count: 0, message: err.message, error: err };
	}
}

/**
 * Purge old vendor master data (older than 7 days)
 */
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

async function purgeOldVendorMaster() {
	try {
		const cutoff = getCutoffDate7Days();
		const result = await run(db, `
			DELETE FROM master_authenticity_vendor
			WHERE created_at IS NOT NULL
			  AND datetime(created_at) < datetime(?)
		`, [cutoff]);

		return result?.changes || 0;
	} catch (err) {
		console.error('Error purging old vendor master data:', err);
		return 0;
	}
}

/**
 * Main sync function - syncs all transfer_ids from recent_mo and vendor master data
 */
async function runSync() {
	try {
		// Step 1: Sync authenticity_used_rm from transfer_ids
		const transferRecords = await all(db, `
			SELECT DISTINCT transfer_id, mo_name
			FROM recent_mo
			WHERE transfer_id IS NOT NULL
			ORDER BY transfer_id DESC
		`);

		let processed = 0;
		let errors = [];

		if (transferRecords && transferRecords.length > 0) {
			console.log(`Found ${transferRecords.length} transfer_id(s) to sync`);
			
			for (const record of transferRecords) {
				const transferId = record.transfer_id;
				const moName = record.mo_name;

				console.log(`Processing transfer_id: ${transferId} (MO: ${moName})`);

				const result = await syncAuthenticityForTransfer(transferId);
				
				if (result.success) {
					processed++;
					if (result.count > 0) {
						console.log(`  ✓ ${result.message}`);
					}
				} else {
					errors.push({
						transfer_id: transferId,
						mo_name: moName,
						error: result.message
					});
					console.log(`  ✗ Error: ${result.message}`);
				}
			}
		} else {
			console.log('No transfer_ids found in recent_mo');
		}

		// Step 2: Sync vendor master data from roll numbers
		// Get unique roll numbers from recent_mo
		const rollRecords = await all(db, `
			SELECT DISTINCT roll_number as roll
			FROM recent_mo
			WHERE roll_number IS NOT NULL AND roll_number != ''
		`);

		let vendorProcessed = 0;
		let vendorErrors = [];

		if (rollRecords && rollRecords.length > 0) {
			console.log(`\nFound ${rollRecords.length} roll number(s) to sync vendor master data`);
			
			for (const record of rollRecords) {
				const roll = record.roll;
				if (!roll) {
					console.log(`  Skipping empty roll number`);
					continue;
				}

				console.log(`\nProcessing vendor master for roll: ${roll}`);

				const result = await syncVendorMasterByRoll(roll);
				
				if (result.success) {
					vendorProcessed++;
					if (result.count > 0) {
						console.log(`  ✓ ${result.message}`);
					} else {
						console.log(`  ⚠ ${result.message}`);
					}
				} else {
					vendorErrors.push({
						roll: roll,
						error: result.message
					});
					console.log(`  ✗ Error: ${result.message}`);
					if (result.error && result.error.stack) {
						console.log(`  Stack: ${result.error.stack}`);
					}
				}
			}
		} else {
			console.log('No roll numbers found to sync vendor master data');
		}

		// Step 3: Purge old vendor master data (older than 7 days)
		console.log('\nPurging old vendor master data (older than 7 days)...');
		const purged = await purgeOldVendorMaster();
		if (purged > 0) {
			console.log(`  ✓ Purged ${purged} old vendor master record(s)`);
		}

		return {
			success: true,
			processed,
			total: transferRecords?.length || 0,
			vendor_processed: vendorProcessed,
			vendor_total: rollRecords?.length || 0,
			purged,
			errors: errors.length > 0 ? errors : null,
			vendor_errors: vendorErrors.length > 0 ? vendorErrors : null
		};
	} catch (err) {
		console.error('Sync failed:', err);
		return {
			success: false,
			processed: 0,
			error: err.message
		};
	}
}

// Allow this script to be used as a module
async function runSyncAuthenticity() {
	return await runSync();
}

if (require.main === module) {
	runSyncAuthenticity()
		.then((result) => {
			if (result.success) {
				console.log(`\n✅ Authenticity sync completed.`);
				console.log(`   Transfer IDs processed: ${result.processed}/${result.total}`);
				if (result.vendor_processed !== undefined) {
					console.log(`   Vendor master processed: ${result.vendor_processed}/${result.vendor_total}`);
				}
				if (result.purged !== undefined) {
					console.log(`   Old records purged: ${result.purged}`);
				}
				if (result.errors) {
					console.log(`   Transfer errors: ${result.errors.length}`);
				}
				if (result.vendor_errors) {
					console.log(`   Vendor errors: ${result.vendor_errors.length}`);
				}
				process.exit(0);
			} else {
				console.error(`\n❌ Sync failed: ${result.error}`);
				process.exit(1);
			}
		})
		.catch((err) => {
			console.error('❌ Sync failed:', err.message);
			process.exit(1);
		});
} else {
	module.exports = { runSyncAuthenticity };
}

