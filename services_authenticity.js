const https = require('https');
const url = require('url');
const config = require('./config');

// Token management
let authToken = null;
let tokenExpiry = null;

async function getAuthToken() {
	// Check if we have a valid token
	if (authToken && tokenExpiry && Date.now() < tokenExpiry) {
		return authToken;
	}

	// Get new token
	return new Promise((resolve, reject) => {
		const targetUrl = `${config.authenticity.baseUrl}/get-token`;
		const parsedUrl = url.parse(targetUrl);
		const options = {
			hostname: parsedUrl.hostname,
			port: parsedUrl.port || 443,
			path: parsedUrl.path,
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			}
		};

		const req = https.request(options, (res) => {
			let data = '';
			res.on('data', chunk => data += chunk);
			res.on('end', () => {
				try {
					const json = JSON.parse(data || '{}');
					if (res.statusCode >= 400) {
						return reject(Object.assign(new Error(json.message || 'Failed to get token'), { statusCode: res.statusCode, details: json }));
					}
					// Token is typically in json.token or json.data.token
					const token = json.token || json.data?.token || json.access_token;
					if (!token) {
						return reject(new Error('Token not found in response'));
					}
					authToken = token;
					// Set expiry to 1 hour from now (or use exp from JWT if available)
					tokenExpiry = Date.now() + (60 * 60 * 1000);
					resolve(token);
				} catch (err) {
					reject(Object.assign(new Error('Failed to parse token response'), { raw: data?.substring(0, 1000) }));
				}
			});
		});

		req.on('error', reject);
		req.setTimeout(config.authenticity.timeoutMs, () => {
			req.destroy(new Error('Token request timeout'));
		});

		req.write(JSON.stringify({
			username: config.authenticity.username,
			password: config.authenticity.password
		}));
		req.end();
	});
}

function requestJson(method, endpointPath, body, { timeoutMs } = {}) {
	return new Promise(async (resolve, reject) => {
		try {
			// Get token first
			const token = await getAuthToken();
			
			const targetUrl = `${config.authenticity.baseUrl}${endpointPath}`;
			const parsedUrl = url.parse(targetUrl);
			const options = {
				hostname: parsedUrl.hostname,
				port: parsedUrl.port || 443,
				path: parsedUrl.path,
				method,
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`
				}
			};

			const req = https.request(options, (res) => {
				let data = '';
				res.on('data', chunk => data += chunk);
				res.on('end', () => {
					try {
						const json = JSON.parse(data || '{}');
						if (res.statusCode >= 400) {
							return reject(Object.assign(new Error(json.message || 'Authenticity API error'), { statusCode: res.statusCode, details: json }));
						}
						resolve(json);
					} catch (err) {
						reject(Object.assign(new Error('Failed to parse Authenticity API response'), { raw: data?.substring(0, 1000) }));
					}
				});
			});

			req.on('error', reject);
			req.setTimeout(timeoutMs || config.authenticity.timeoutMs, () => {
				req.destroy(new Error('Authenticity API request timeout'));
			});

			if (body) {
				req.write(JSON.stringify(body));
			}
			req.end();
		} catch (err) {
			reject(err);
		}
	});
}

// Helper functions for Authenticity API
async function fetchVendorMasterByRoll(roll) {
	return requestJson('GET', `/authenticity/vendor?serial=${encodeURIComponent(roll)}&limit=1&page=1`, null);
}

async function fetchAuthenticityByTransferId(transferId) {
	// Note: Adjust endpoint based on actual API structure
	// This is a placeholder - update based on actual API documentation
	return requestJson('GET', `/authenticity/warehouse?transfer_id=${encodeURIComponent(transferId)}`, null);
}

async function fetchLineAuthenticityByMo(moName) {
	// Note: Adjust endpoint based on actual API structure
	// This is a placeholder - update based on actual API documentation
	return requestJson('GET', `/authenticity/line?mo=${encodeURIComponent(moName)}`, null);
}

// Fetch authenticity data for warehouse RM (used in sync)
async function fetchWarehouseAuthenticities(transferId) {
	try {
		// Try to fetch authenticity data by transfer_id
		// Adjust endpoint based on actual API structure
		const result = await requestJson('GET', `/authenticity/warehouse?transfer_id=${encodeURIComponent(transferId)}`, null);
		return result;
	} catch (err) {
		// Return empty result if not found or error
		return { data: [], status: 'error', message: err.message };
	}
}

// Fetch vendor data by serial/roll number
async function fetchVendorBySerial(serial) {
	try {
		const result = await requestJson('GET', `/authenticity/vendor?serial=${encodeURIComponent(serial)}&limit=100&page=1`, null);
		// Log response for debugging
		if (process.env.DEBUG || process.env.NODE_ENV === 'development') {
			console.log(`[DEBUG] fetchVendorBySerial response for serial ${serial}:`, JSON.stringify(result).substring(0, 500));
		}
		return result;
	} catch (err) {
		console.error(`[ERROR] fetchVendorBySerial failed for serial ${serial}:`, err.message);
		return { data: [], status: 'error', message: err.message };
	}
}

// Fetch vendor data by delivery date
async function fetchVendorByDeliveryDate(deliveryDate) {
	try {
		const result = await requestJson('GET', `/authenticity/vendor?delivery_date=${encodeURIComponent(deliveryDate)}&limit=100&page=1`, null);
		return result;
	} catch (err) {
		return { data: [], status: 'error', message: err.message };
	}
}

module.exports = {
	fetchVendorMasterByRoll,
	fetchAuthenticityByTransferId,
	fetchLineAuthenticityByMo,
	fetchWarehouseAuthenticities,
	fetchVendorBySerial,
	fetchVendorByDeliveryDate,
	getAuthToken
};




