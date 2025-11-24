#!/usr/bin/env node

/**
 * Script untuk query Odoo stock.picking API dengan session ID tertentu
 * Usage: node scripts/query_stock_picking_with_session.js [session_id]
 * 
 * Contoh:
 *   node scripts/query_stock_picking_with_session.js bc6b1450c0cd3b05e3ac199521e02f7b639e39ae
 * 
 * Atau set via environment variable:
 *   $env:ODOO_SESSION_ID="bc6b1450c0cd3b05e3ac199521e02f7b639e39ae"
 *   node scripts/query_stock_picking_with_session.js
 */

const https = require('https');
const url = require('url');

// Get session ID from command line argument or environment variable
const SESSION_ID = process.argv[2] 
    || process.env.ODOO_SESSION_ID 
    || 'bc6b1450c0cd3b05e3ac199521e02f7b639e39ae';

// Get base URL from environment or use default
const ODOO_BASE_URL = process.env.ODOO_API_URL || 'https://foomx.odoo.com';
const ODOO_URL = `${ODOO_BASE_URL}/web/dataset/call_kw/stock.picking/search_read`;

// Cookie header format: session_id=xxx; session_id=xxx
const COOKIE_HEADER = `session_id=${SESSION_ID}; session_id=${SESSION_ID}`;

// ------------------------------
// Arg parsing untuk filter waktu
// ------------------------------
const rawArgs = process.argv.slice(3);
let limit = 10;
let offset = 0;
let dateField = 'create_date'; // scheduled_date | date_done | create_date
let date = null;               // YYYY-MM-DD atau YYYY-MM-DD HH:MM:SS
let dateFrom = null;
let dateTo = null;
let stateFilter = null;        // draft, assigned, done, cancel, etc.
let jsonOnly = false;

function normalizeDate(val, isStart) {
    if (!val) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
        return isStart ? `${val} 00:00:00` : `${val} 23:59:59`;
    }
    return val;
}

for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    if (arg === '--json-only') {
        jsonOnly = true;
    } else if (arg.startsWith('--limit=')) {
        const v = parseInt(arg.split('=')[1], 10);
        if (!Number.isNaN(v) && v > 0) limit = v;
    } else if (arg.startsWith('--offset=')) {
        const v = parseInt(arg.split('=')[1], 10);
        if (!Number.isNaN(v) && v >= 0) offset = v;
    } else if (arg.startsWith('--date-field=')) {
        const v = arg.split('=')[1];
        if (['scheduled_date', 'date_done', 'create_date'].includes(v)) {
            dateField = v;
        }
    } else if (arg.startsWith('--date=')) {
        date = arg.split('=')[1];
    } else if (arg.startsWith('--date-from=')) {
        dateFrom = arg.split('=')[1];
    } else if (arg.startsWith('--date-to=')) {
        dateTo = arg.split('=')[1];
    } else if (arg.startsWith('--state=')) {
        stateFilter = arg.split('=')[1];
    }
}

// Build domain filter
const domain = [];
if (stateFilter) {
    domain.push(['state', '=', stateFilter]);
}
if (date) {
    domain.push([dateField, '>=', normalizeDate(date, true)]);
    domain.push([dateField, '<=', normalizeDate(date, false)]);
}
if (dateFrom) {
    domain.push([dateField, '>=', normalizeDate(dateFrom, true)]);
}
if (dateTo) {
    domain.push([dateField, '<=', normalizeDate(dateTo, false)]);
}

// Request payload - dengan domain waktu
const requestData = {
    "jsonrpc": "2.0",
    "method": "call",
    "params": {
        "model": "stock.picking",
        "method": "search_read",
        "args": domain.length > 0 ? [domain] : [],
        "kwargs": {
            "fields": [
                "id",
                "name",
                "origin",
                "partner_id",
                "scheduled_date",
                "date_done",
                "picking_type_id",
                "location_id",
                "location_dest_id",
                "state",
                "create_date",
                "move_ids_without_package"
            ],
            "limit": limit,
            "offset": offset,
            "order": `${dateField} desc`
        }
    }
};

// Parse URL
const parsedUrl = url.parse(ODOO_URL);

// Prepare request options
// Odoo kadang memerlukan User-Agent dan Referer untuk validasi session
const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || 443,
    path: parsedUrl.path,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Cookie': COOKIE_HEADER,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': `${ODOO_BASE_URL}/web`,
        'Origin': ODOO_BASE_URL
    }
};

// Convert request data to JSON string
const postData = JSON.stringify(requestData);

// Display info
if (!jsonOnly) {
    console.log('=== Odoo Stock Picking Query ===\n');
    console.log('Base URL:', ODOO_BASE_URL);
    console.log('Session ID:', SESSION_ID.substring(0, 20) + '...');
    console.log('Endpoint:', '/web/dataset/call_kw/stock.picking/search_read');
    console.log('Date Field:', dateField);
    if (stateFilter) console.log('State Filter:', stateFilter);
    if (date) console.log('Date:', date);
    if (dateFrom) console.log('Date From:', dateFrom);
    if (dateTo) console.log('Date To:', dateTo);
    console.log('Limit:', limit, '| Offset:', offset);
    console.log('Cookie Header:', COOKIE_HEADER.substring(0, 80) + '...');
    console.log('\nRequest payload:');
    console.log(JSON.stringify(requestData, null, 2));
    console.log('\n--- Response ---\n');
}

// Make the request
const req = https.request(options, (res) => {
    let responseData = '';

    // Log response status
    console.log(`Status Code: ${res.statusCode}`);
    if (res.statusCode !== 200) {
        console.log(`Response Headers:`, JSON.stringify(res.headers, null, 2));
    }
    console.log('\n--- Response Body ---\n');

    // Collect response data
    res.on('data', (chunk) => {
        responseData += chunk;
    });

    // Handle response end
    res.on('end', () => {
        try {
            // Try to parse as JSON for pretty printing
            const jsonResponse = JSON.parse(responseData);
            
            // Check for errors
            if (jsonResponse.error) {
                if (!jsonOnly) {
                    console.error('❌ API Error:');
                    console.error(JSON.stringify(jsonResponse.error, null, 2));
                    
                    // Tambahkan informasi tambahan jika session expired
                    if (jsonResponse.error.message && jsonResponse.error.message.includes('Session expired')) {
                        console.error('\n⚠️  MENGAPA SESSION EXPIRED?');
                        console.error('Kemungkinan penyebab:');
                        console.error('1. Session ID memang sudah expired di server Odoo (meskipun ID masih sama)');
                        console.error('   - Session timeout (default 7 hari)');
                        console.error('   - User logout dari browser');
                        console.error('   - Session di-reset oleh Odoo');
                        console.error('2. Session ID tidak valid atau tidak ditemukan di database Odoo');
                        console.error('3. Cookie format tidak sesuai dengan yang diharapkan Odoo');
                        console.error('\n💡 SOLUSI:');
                        console.error('- Dapatkan session ID baru dengan login ke Odoo');
                        console.error('- Gunakan session ID yang masih aktif (belum logout)');
                        console.error('- Periksa apakah session ID benar-benar masih valid di browser');
                    }
                } else {
                    console.error(JSON.stringify(jsonResponse, null, 2));
                }
                process.exit(1);
            }
            
            // Display result
            if (jsonResponse.result && Array.isArray(jsonResponse.result)) {
                if (jsonOnly) {
                    // Output hanya JSON array dari result
                    console.log(JSON.stringify(jsonResponse.result, null, 2));
                    return;
                }

                console.log(`✅ Found ${jsonResponse.result.length} record(s):\n`);

                // Tampilkan ringkasan fokus ke transfer_id (id) dan tanggal
                jsonResponse.result.forEach((picking, index) => {
                    console.log(`${index + 1}. Transfer: ${picking.name || 'N/A'}`);
                    console.log(`   transfer_id (id): ${picking.id}`);
                    console.log(`   State: ${picking.state || 'N/A'}`);
                    console.log(`   Scheduled: ${picking.scheduled_date || 'N/A'}`);
                    console.log(`   Done: ${picking.date_done || 'N/A'}`);
                    console.log(`   Created: ${picking.create_date || 'N/A'}`);
                    console.log('');
                });

                // JSON lengkap
                console.log('\n--- Full JSON Response ---\n');
                console.log(JSON.stringify(jsonResponse, null, 2));
            } else {
                console.log('Response:');
                console.log(JSON.stringify(jsonResponse, null, 2));
            }
        } catch (e) {
            // If not JSON, just print raw response
            console.log('Raw Response:');
            console.log(responseData);
            console.error('\n❌ Error parsing JSON:', e.message);
            process.exit(1);
        }
    });
});

// Handle errors
req.on('error', (error) => {
    console.error('❌ Error making request:', error.message);
    process.exit(1);
});

req.on('timeout', () => {
    console.error('❌ Request timeout');
    req.destroy();
    process.exit(1);
});

// Set timeout (30 seconds)
req.setTimeout(30000);

// Send the request
req.write(postData);
req.end();




