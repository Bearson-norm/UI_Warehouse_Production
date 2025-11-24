#!/usr/bin/env node

/**
 * Reusable helper to query Odoo stock.move records.
 * 
 * Import usage:
 *   const { fetchStockMoves } = require('./query_stock_move');
 *   const { records } = await fetchStockMoves({ dateFrom: '2025-01-01', dateTo: '2025-01-31' });
 * 
 * CLI usage:
 *   node scripts/query_stock_move.js --date-from "2025-01-01" --date-to "2025-01-31"
 *   node scripts/query_stock_move.js --state done --limit 50
 *   node scripts/query_stock_move.js --picking-id 1234
 */

const https = require('https');
const url = require('url');

// Try to load optional config
let config = null;
try {
    config = require('../config.js');
} catch (err) {
    // Config is optional; fallback to env/defaults
}

const SESSION_ID_1 = process.env.ODOO_SESSION_ID_1 || 'b921b72bbb45f74116f4e9d5773050f53bf00da8';
const SESSION_ID_2 = process.env.ODOO_SESSION_ID
    || (config && config.odoo && config.odoo.sessionId)
    || '6db7338ea468b85f725c1ee8c94a3be67d32dafb';
const COOKIE_HEADER = `cookies.txt; session_id=${SESSION_ID_1}; session_id=${SESSION_ID_2}`;

const ODOO_BASE_URL = (config && config.odoo && config.odoo.baseURL)
    || process.env.ODOO_API_URL
    || 'https://foomx.odoo.com';
const ODOO_URL = `${ODOO_BASE_URL}/web/dataset/call_kw/stock.move/search_read`;

const DEFAULT_OPTIONS = {
    limit: 200,
    offset: 0,
    dateField: 'create_date'
};

function normalizeDateValue(value, isStart) {
    if (!value) {
        return null;
    }
    if (value.length === 10) {
        return isStart ? `${value} 00:00:00` : `${value} 23:59:59`;
    }
    return value;
}

function buildDomain(options) {
    const domain = [];

    if (options.id) {
        domain.push(['id', '=', options.id]);
    }
    if (options.ids && Array.isArray(options.ids) && options.ids.length > 0) {
        domain.push(['id', 'in', options.ids]);
    }
    if (options.reference) {
        domain.push(['reference', 'ilike', options.reference]);
    }
    if (options.pickingId) {
        domain.push(['picking_id', '=', options.pickingId]);
    }
    if (options.origin) {
        domain.push(['origin', 'ilike', options.origin]);
    }
    if (options.state) {
        domain.push(['state', '=', options.state]);
    }
    if (options.productId) {
        domain.push(['product_id', '=', options.productId]);
    }
    if (options.productSku) {
        domain.push(['product_id', 'ilike', options.productSku]);
    }

    const dateField = options.dateField || DEFAULT_OPTIONS.dateField;
    if (options.date) {
        domain.push([dateField, '>=', normalizeDateValue(options.date, true)]);
        domain.push([dateField, '<=', normalizeDateValue(options.date, false)]);
    }
    if (options.dateFrom) {
        domain.push([dateField, '>=', normalizeDateValue(options.dateFrom, true)]);
    }
    if (options.dateTo) {
        domain.push([dateField, '<=', normalizeDateValue(options.dateTo, false)]);
    }

    return domain;
}

function buildRequestPayload(options) {
    const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
    const domain = buildDomain(mergedOptions);

    const fields = mergedOptions.fields && mergedOptions.fields.length > 0
        ? mergedOptions.fields
        : [
            'id',
            'name',
            'reference',
            'picking_id',
            'product_id',
            'product_uom_qty',
            'quantity_done',
            'product_uom',
            'state',
            'date',
            'origin',
            'date_expected',
            'location_id',
            'location_dest_id',
            'create_date',
            'write_date',
        ];

    return {
        jsonrpc: '2.0',
        method: 'call',
        params: {
            model: 'stock.move',
            method: 'search_read',
            args: domain.length > 0 ? [domain] : [],
            kwargs: {
                fields,
                limit: mergedOptions.limit,
                offset: mergedOptions.offset,
                order: mergedOptions.order || `${mergedOptions.dateField} desc`
            }
        }
    };
}

function executeRequest(payload) {
    const parsedUrl = url.parse(ODOO_URL);
    const requestBody = JSON.stringify(payload);

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

    return new Promise((resolve, reject) => {
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
                } catch (err) {
                    reject(new Error(`Failed to parse response: ${err.message}\nResponse: ${responseData}`));
                }
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        req.write(requestBody);
        req.end();
    });
}

async function fetchStockMoves(options = {}) {
    const payload = buildRequestPayload(options);
    const response = await executeRequest(payload);
    const records = Array.isArray(response.result) ? response.result : [];
    return {
        payload,
        response,
        records
    };
}

function parseCliArgs(argv) {
    const args = argv.slice(2);
    const options = {};

    for (let i = 0; i < args.length; i++) {
        const value = args[i + 1];
        switch (args[i]) {
            case '--id':
                options.id = parseInt(value, 10);
                i++;
                break;
            case '--ids':
                if (value) {
                    options.ids = value.split(',').map((item) => parseInt(item.trim(), 10)).filter(Boolean);
                    i++;
                }
                break;
            case '--reference':
                options.reference = value;
                i++;
                break;
            case '--picking-id':
                options.pickingId = parseInt(value, 10);
                i++;
                break;
            case '--origin':
                options.origin = value;
                i++;
                break;
            case '--state':
                options.state = value;
                i++;
                break;
            case '--product-id':
                options.productId = parseInt(value, 10);
                i++;
                break;
            case '--product-sku':
                options.productSku = value;
                i++;
                break;
            case '--date':
                options.date = value;
                i++;
                break;
            case '--date-from':
                options.dateFrom = value;
                i++;
                break;
            case '--date-to':
                options.dateTo = value;
                i++;
                break;
            case '--date-field':
                options.dateField = value;
                i++;
                break;
            case '--limit':
                options.limit = parseInt(value, 10);
                i++;
                break;
            case '--offset':
                options.offset = parseInt(value, 10);
                i++;
                break;
            case '--order':
                options.order = value;
                i++;
                break;
            case '--fields':
                if (value) {
                    options.fields = value.split(',').map((field) => field.trim()).filter(Boolean);
                    i++;
                }
                break;
        }
    }

    return options;
}

async function runCli() {
    try {
        const options = parseCliArgs(process.argv);
        const { records, payload } = await fetchStockMoves(options);

        console.log('=== Odoo stock.move query ===\n');
        console.log('URL:', ODOO_URL);
        console.log('Cookie:', COOKIE_HEADER.substring(0, 50) + '...');
        console.log('\nRequest payload:\n', JSON.stringify(payload, null, 2));
        console.log('\n--- Response ---\n');
        console.log(`Total records: ${records.length}\n`);
        console.log(JSON.stringify(records, null, 2));
    } catch (err) {
        console.error('Error fetching stock moves:', err.message);
        process.exitCode = 1;
    }
}

if (require.main === module) {
    runCli();
}

module.exports = {
    fetchStockMoves
};





