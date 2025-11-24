#!/usr/bin/env node

/**
 * Standalone script to query Odoo mrp.production API with filtering options
 * Usage: 
 *   node scripts/query_mrp_production_filtered.js
 *   node scripts/query_mrp_production_filtered.js --mo-number "PROD/MO/19131"
 *   node scripts/query_mrp_production_filtered.js --product-id 456
 *   node scripts/query_mrp_production_filtered.js --sku "MIXBERI B7P2013"
 *   node scripts/query_mrp_production_filtered.js --date "2025-01-15"
 *   node scripts/query_mrp_production_filtered.js --date-from "2025-01-01" --date-to "2025-01-31"
 *   node scripts/query_mrp_production_filtered.js --all
 * 
 * Date format: YYYY-MM-DD or YYYY-MM-DD HH:MM:SS
 * 
 * Session ID priority:
 * 1. Environment variable ODOO_SESSION_ID
 * 2. Config file (config.js)
 * 3. Default hardcoded session ID
 */

const https = require('https');
const url = require('url');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
    moNumber: null,
    productId: null,
    sku: null,
    date: null,
    dateFrom: null,
    dateTo: null,
    all: false,
    limit: 100,
    offset: 0
};

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--mo-number' && args[i + 1]) {
        options.moNumber = args[i + 1];
        i++;
    } else if (args[i] === '--product-id' && args[i + 1]) {
        options.productId = parseInt(args[i + 1]);
        i++;
    } else if (args[i] === '--sku' && args[i + 1]) {
        options.sku = args[i + 1];
        i++;
    } else if (args[i] === '--date' && args[i + 1]) {
        options.date = args[i + 1];
        i++;
    } else if (args[i] === '--date-from' && args[i + 1]) {
        options.dateFrom = args[i + 1];
        i++;
    } else if (args[i] === '--date-to' && args[i + 1]) {
        options.dateTo = args[i + 1];
        i++;
    } else if (args[i] === '--all') {
        options.all = true;
        options.limit = 1000; // Large limit for getting all
    } else if (args[i] === '--limit' && args[i + 1]) {
        options.limit = parseInt(args[i + 1]);
        i++;
    } else if (args[i] === '--offset' && args[i + 1]) {
        options.offset = parseInt(args[i + 1]);
        i++;
    }
}

// Try to load config
let config = null;
try {
    config = require('../config.js');
} catch (e) {
    // Config not available, will use defaults
}

// Get session ID from environment, config, or default
const SESSION_ID_1 = process.env.ODOO_SESSION_ID_1 || 'b921b72bbb45f74116f4e9d5773050f53bf00da8';
const SESSION_ID_2 = process.env.ODOO_SESSION_ID 
    || (config && config.odoo && config.odoo.sessionId)
    || '6db7338ea468b85f725c1ee8c94a3be67d32dafb';
const COOKIE_HEADER = `cookies.txt; session_id=${SESSION_ID_1}; session_id=${SESSION_ID_2}`;

// Configuration
const ODOO_BASE_URL = (config && config.odoo && config.odoo.baseURL) 
    || process.env.ODOO_API_URL 
    || 'https://foomx.odoo.com';
const ODOO_URL = `${ODOO_BASE_URL}/web/dataset/call_kw/mrp.production/search_read`;

// Helper function to format date for Odoo
function formatDateForOdoo(dateStr) {
    // If date is just YYYY-MM-DD, add time to make it start/end of day
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return dateStr;
    }
    // If already has time, return as is
    return dateStr;
}

// Build domain filter
const domain = [];
if (options.moNumber) {
    domain.push(["name", "=", options.moNumber]);
}
if (options.productId) {
    domain.push(["product_id", "=", options.productId]);
}
if (options.sku) {
    // Search by SKU name (contains search)
    domain.push(["product_id", "ilike", options.sku]);
}
if (options.date) {
    // Filter by specific date (exact match on date part)
    const dateStr = formatDateForOdoo(options.date);
    domain.push(["create_date", ">=", dateStr + " 00:00:00"]);
    domain.push(["create_date", "<=", dateStr + " 23:59:59"]);
}
if (options.dateFrom) {
    // Filter from date (>=)
    const dateStr = formatDateForOdoo(options.dateFrom);
    domain.push(["create_date", ">=", dateStr.includes(' ') ? dateStr : dateStr + " 00:00:00"]);
}
if (options.dateTo) {
    // Filter to date (<=)
    const dateStr = formatDateForOdoo(options.dateTo);
    domain.push(["create_date", "<=", dateStr.includes(' ') ? dateStr : dateStr + " 23:59:59"]);
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
            "limit": options.limit,
            "offset": options.offset
        }
    }
};

// Parse URL
const parsedUrl = url.parse(ODOO_URL);

// Prepare request options
const requestOptions = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || 443,
    path: parsedUrl.path,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Cookie': COOKIE_HEADER
    }
};

// Function to make API request
function makeRequest(requestData) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(requestData);
        
        const req = https.request(requestOptions, (res) => {
            let responseData = '';

            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                try {
                    const jsonResponse = JSON.parse(responseData);
                    
                    if (jsonResponse.error) {
                        reject(new Error(JSON.stringify(jsonResponse.error)));
                        return;
                    }
                    
                    resolve(jsonResponse);
                } catch (e) {
                    reject(new Error(`Parse error: ${e.message}\nResponse: ${responseData}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.write(postData);
        req.end();
    });
}

// Main execution
(async () => {
    try {
        console.log('=== Odoo MRP Production Query (Manufacturing Order) ===\n');
        console.log('URL:', ODOO_URL);
        console.log('Cookie:', COOKIE_HEADER.substring(0, 50) + '...');
        
        if (options.moNumber) {
            console.log('Filter: MO Number =', options.moNumber);
        }
        if (options.productId) {
            console.log('Filter: Product ID =', options.productId);
        }
        if (options.sku) {
            console.log('Filter: SKU contains =', options.sku);
        }
        if (options.date) {
            console.log('Filter: Create Date =', options.date);
        }
        if (options.dateFrom) {
            console.log('Filter: Create Date From =', options.dateFrom);
        }
        if (options.dateTo) {
            console.log('Filter: Create Date To =', options.dateTo);
        }
        if (options.all) {
            console.log('Mode: Get all records (limit:', options.limit, ')');
        }
        
        console.log('\nRequest payload:');
        console.log(JSON.stringify(requestData, null, 2));
        console.log('\n--- Response ---\n');

        const response = await makeRequest(requestData);
        
        if (response.result && Array.isArray(response.result)) {
            console.log(`Found ${response.result.length} record(s):\n`);
            
            // Display summary table
            console.log('Summary:');
            console.log('─'.repeat(100));
            console.log('| MO Number        | Product ID | SKU/Product Name              | Qty  | State    |');
            console.log('─'.repeat(100));
            
            response.result.forEach(mo => {
                const moNumber = mo.name || 'N/A';
                const productId = mo.product_id ? mo.product_id[0] : 'N/A';
                const productName = mo.product_id ? mo.product_id[1] : 'N/A';
                const qty = mo.product_qty || 0;
                const state = mo.state || 'N/A';
                
                // Truncate long names
                const displayName = productName.length > 30 ? productName.substring(0, 27) + '...' : productName;
                
                console.log(`| ${moNumber.padEnd(16)} | ${String(productId).padEnd(10)} | ${displayName.padEnd(29)} | ${String(qty).padEnd(4)} | ${state.padEnd(8)} |`);
            });
            console.log('─'.repeat(100));
            
            // Display full JSON
            console.log('\n--- Full JSON Response ---\n');
            console.log(JSON.stringify(response, null, 2));
            
            // Display extracted data
            console.log('\n--- Extracted Data (MO Number + SKU) ---\n');
            response.result.forEach(mo => {
                console.log(`MO Number: ${mo.name}`);
                if (mo.product_id) {
                    console.log(`  Product ID: ${mo.product_id[0]}`);
                    console.log(`  SKU/Product Name: ${mo.product_id[1]}`);
                }
                console.log(`  Quantity: ${mo.product_qty}`);
                console.log(`  State: ${mo.state}`);
                console.log(`  Date Start: ${mo.date_start || 'N/A'}`);
                console.log(`  Date Finished: ${mo.date_finished || 'N/A'}`);
                console.log('─'.repeat(50));
            });
            
        } else {
            console.log(JSON.stringify(response, null, 2));
        }
        
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
})();

