#!/usr/bin/env node

/**
 * Script untuk query Odoo mrp.production API (Manufacturing Order) dengan session ID tertentu
 * Output dalam format JSON yang rapi
 * 
 * Usage: node scripts/query_mrp_production_with_session.js [session_id]
 * 
 * Contoh:
 *   node scripts/query_mrp_production_with_session.js bc6b1450c0cd3b05e3ac199521e02f7b639e39ae
 * 
 * Atau set via environment variable:
 *   $env:ODOO_SESSION_ID="bc6b1450c0cd3b05e3ac199521e02f7b639e39ae"
 *   node scripts/query_mrp_production_with_session.js
 * 
 * Opsi tambahan:
 *   --limit=N        : Limit jumlah record (default: 10)
 *   --offset=N       : Offset untuk pagination (default: 0)
 *   --state=STATE    : Filter berdasarkan state (draft, confirmed, progress, done, cancel)
 *   --json-only      : Hanya output JSON tanpa summary
 */

const https = require('https');
const url = require('url');

// Parse command line arguments
const args = process.argv.slice(2);
let sessionId = null;
let limit = 10;
let offset = 0;
let stateFilter = null;
let jsonOnly = false;

args.forEach(arg => {
    if (arg.startsWith('--limit=')) {
        limit = parseInt(arg.split('=')[1]) || 10;
    } else if (arg.startsWith('--offset=')) {
        offset = parseInt(arg.split('=')[1]) || 0;
    } else if (arg.startsWith('--state=')) {
        stateFilter = arg.split('=')[1];
    } else if (arg === '--json-only') {
        jsonOnly = true;
    } else if (!arg.startsWith('--')) {
        sessionId = arg;
    }
});

// Get session ID from command line, environment, or default
const SESSION_ID = sessionId 
    || process.env.ODOO_SESSION_ID 
    || 'bc6b1450c0cd3b05e3ac199521e02f7b639e39ae';

// Get base URL from environment or use default
const ODOO_BASE_URL = process.env.ODOO_API_URL || 'https://foomx.odoo.com';
const ODOO_URL = `${ODOO_BASE_URL}/web/dataset/call_kw/mrp.production/search_read`;

// Cookie header format: session_id=xxx; session_id=xxx
const COOKIE_HEADER = `session_id=${SESSION_ID}; session_id=${SESSION_ID}`;

// Build domain filter
const domain = [];
if (stateFilter) {
    domain.push(["state", "=", stateFilter]);
}

// Request payload
const requestData = {
    "jsonrpc": "2.0",
    "method": "call",
    "params": {
        "model": "mrp.production",
        "method": "search_read",
        "args": domain.length > 0 ? [domain] : [],
        "kwargs": {
            "fields": [
                "id",
                "name",
                "product_id",
                "product_qty",
                "product_uom_id",
                "initial_qty_target",
                "note",
                "group_worker",
                "date_start",
                "date_finished",
                "date_deadline",
                "state",
                "origin",
                "create_date"
            ],
            "limit": limit,
            "offset": offset
        }
    }
};

// Parse URL
const parsedUrl = url.parse(ODOO_URL);

// Prepare request options
const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || 443,
    path: parsedUrl.path,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Cookie': COOKIE_HEADER
    }
};

// Convert request data to JSON string
const postData = JSON.stringify(requestData);

// Display info (only if not json-only mode)
if (!jsonOnly) {
    console.log('=== Odoo MRP Production Query (Manufacturing Order) ===\n');
    console.log('Base URL:', ODOO_BASE_URL);
    console.log('Session ID:', SESSION_ID.substring(0, 20) + '...');
    console.log('Endpoint:', '/web/dataset/call_kw/mrp.production/search_read');
    if (stateFilter) {
        console.log('State Filter:', stateFilter);
    }
    console.log('Limit:', limit, '| Offset:', offset);
    console.log('\nRequest payload:');
    console.log(JSON.stringify(requestData, null, 2));
    console.log('\n--- Response ---\n');
}

// Make the request
const req = https.request(options, (res) => {
    let responseData = '';

    // Collect response data
    res.on('data', (chunk) => {
        responseData += chunk;
    });

    // Handle response end
    res.on('end', () => {
        try {
            // Try to parse as JSON
            const jsonResponse = JSON.parse(responseData);
            
            // Check for errors
            if (jsonResponse.error) {
                if (!jsonOnly) {
                    console.error('❌ API Error:');
                    console.error(JSON.stringify(jsonResponse.error, null, 2));
                } else {
                    console.error(JSON.stringify(jsonResponse, null, 2));
                }
                process.exit(1);
            }
            
            // If json-only mode, just output the JSON
            if (jsonOnly) {
                console.log(JSON.stringify(jsonResponse, null, 2));
                return;
            }
            
            // Display result with summary
            if (jsonResponse.result && Array.isArray(jsonResponse.result)) {
                console.log(`Status Code: ${res.statusCode}`);
                console.log(`✅ Found ${jsonResponse.result.length} record(s):\n`);
                
                // Display summary
                jsonResponse.result.forEach((mo, index) => {
                    const productName = mo.product_id ? mo.product_id[1] : 'N/A';
                    const uom = mo.product_uom_id ? mo.product_uom_id[1] : '';
                    
                    console.log(`${index + 1}. Manufacturing Order: ${mo.name || 'N/A'}`);
                    console.log(`   ID: ${mo.id}`);
                    console.log(`   Product: ${productName}`);
                    console.log(`   Quantity: ${mo.product_qty || 0} ${uom}`);
                    if (mo.initial_qty_target) {
                        console.log(`   Target: ${mo.initial_qty_target} ${uom}`);
                    }
                    console.log(`   State: ${mo.state || 'N/A'}`);
                    console.log(`   Origin: ${mo.origin || 'N/A'}`);
                    if (mo.date_start) {
                        console.log(`   Start: ${mo.date_start}`);
                    }
                    if (mo.date_finished) {
                        console.log(`   Finished: ${mo.date_finished}`);
                    }
                    if (mo.date_deadline) {
                        console.log(`   Deadline: ${mo.date_deadline}`);
                    }
                    if (mo.group_worker) {
                        console.log(`   Group Worker: ${mo.group_worker}`);
                    }
                    if (mo.note) {
                        console.log(`   Note: ${mo.note.substring(0, 50)}${mo.note.length > 50 ? '...' : ''}`);
                    }
                    console.log('');
                });
                
                // Display full JSON
                console.log('\n--- Full JSON Response ---\n');
                console.log(JSON.stringify(jsonResponse, null, 2));
            } else {
                console.log('Response:');
                console.log(JSON.stringify(jsonResponse, null, 2));
            }
        } catch (e) {
            // If not JSON, just print raw response
            if (!jsonOnly) {
                console.log('Raw Response:');
                console.log(responseData);
                console.error('\n❌ Error parsing JSON:', e.message);
            } else {
                console.error(responseData);
            }
            process.exit(1);
        }
    });
});

// Handle errors
req.on('error', (error) => {
    if (!jsonOnly) {
        console.error('❌ Error making request:', error.message);
    } else {
        console.error(JSON.stringify({ error: error.message }, null, 2));
    }
    process.exit(1);
});

req.on('timeout', () => {
    if (!jsonOnly) {
        console.error('❌ Request timeout');
    } else {
        console.error(JSON.stringify({ error: 'Request timeout' }, null, 2));
    }
    req.destroy();
    process.exit(1);
});

// Set timeout (30 seconds)
req.setTimeout(30000);

// Send the request
req.write(postData);
req.end();




