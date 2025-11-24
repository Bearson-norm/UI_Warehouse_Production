#!/usr/bin/env node

/**
 * Standalone script to query Odoo stock.picking API
 * Usage: node scripts/query_stock_picking.js
 * 
 * Session ID priority:
 * 1. Environment variable ODOO_SESSION_ID
 * 2. Config file (config.js)
 * 3. Default hardcoded session ID
 */

const https = require('https');
const url = require('url');
const path = require('path');

// Try to load config
let config = null;
try {
    config = require('../config.js');
} catch (e) {
    // Config not available, will use defaults
}

// Get session ID from environment, config, or default
// Support multiple session IDs like in curl: cookies.txt; session_id=xxx; session_id=yyy
const SESSION_ID_1 = process.env.ODOO_SESSION_ID_1 || 'b921b72bbb45f74116f4e9d5773050f53bf00da8';
const SESSION_ID_2 = process.env.ODOO_SESSION_ID 
    || (config && config.odoo && config.odoo.sessionId)
    || '6db7338ea468b85f725c1ee8c94a3be67d32dafb';
const COOKIE_HEADER = `cookies.txt; session_id=${SESSION_ID_1}; session_id=${SESSION_ID_2}`;

// Configuration
const ODOO_BASE_URL = (config && config.odoo && config.odoo.baseURL) 
    || process.env.ODOO_API_URL 
    || 'https://foomx.odoo.com';
const ODOO_URL = `${ODOO_BASE_URL}/web/dataset/call_kw/stock.picking/search_read`;

// Request payload
const requestData = {
    "jsonrpc": "2.0",
    "method": "call",
    "params": {
        "model": "stock.picking",
        "method": "search_read",
        "args": [],
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
            "limit": 10,
            "offset": 0
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

// Make the request
console.log('=== Odoo Stock Picking Query ===\n');
console.log('URL:', ODOO_URL);
console.log('Cookie:', COOKIE_HEADER.substring(0, 50) + '...');
console.log('\nRequest payload:');
console.log(JSON.stringify(requestData, null, 2));
console.log('\n--- Response ---\n');

const req = https.request(options, (res) => {
    let responseData = '';

    // Log response status
    console.log(`Status Code: ${res.statusCode}`);
    if (res.statusCode !== 200) {
        console.log(`Response Headers:`, res.headers);
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
                console.error('API Error:', JSON.stringify(jsonResponse.error, null, 2));
                process.exit(1);
            }
            
            // Display result
            if (jsonResponse.result && Array.isArray(jsonResponse.result)) {
                console.log(`Found ${jsonResponse.result.length} record(s):\n`);
                console.log(JSON.stringify(jsonResponse, null, 2));
            } else {
                console.log(JSON.stringify(jsonResponse, null, 2));
            }
        } catch (e) {
            // If not JSON, just print raw response
            console.log('Raw Response:');
            console.log(responseData);
            console.error('\nError parsing JSON:', e.message);
            process.exit(1);
        }
    });
});

// Handle errors
req.on('error', (error) => {
    console.error('Error making request:', error.message);
    process.exit(1);
});

// Send the request
req.write(postData);
req.end();

