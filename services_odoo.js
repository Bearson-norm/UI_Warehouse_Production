const https = require('https');
const url = require('url');
const config = require('./config');

function postJson(endpointPath, payload, sessionId, timeoutMs = config.odoo.timeoutMs) {
	return new Promise((resolve, reject) => {
		const targetUrl = `${config.odoo.baseUrl}${endpointPath}`;
		const parsedUrl = url.parse(targetUrl);
		const options = {
			hostname: parsedUrl.hostname,
			port: parsedUrl.port || 443,
			path: parsedUrl.path,
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Cookie': `session_id=${sessionId}; session_id=${sessionId}`
			}
		};

		const req = https.request(options, (res) => {
			let responseData = '';
			res.on('data', chunk => responseData += chunk);
			res.on('end', () => {
				try {
					const json = JSON.parse(responseData);
					if (json.error) {
						return reject(Object.assign(new Error(json.error?.message || 'Odoo error'), { details: json }));
					}
					resolve(json.result ?? json);
				} catch (err) {
					reject(Object.assign(new Error('Failed to parse Odoo response'), { responseData: responseData.substring(0, 1000) }));
				}
			});
		});

		req.on('error', reject);
		req.setTimeout(timeoutMs, () => {
			req.destroy(new Error('Odoo request timeout'));
		});

		req.write(JSON.stringify(payload));
		req.end();
	});
}

async function searchRead(model, domain = [], fields = [], kwargs = {}, sessionId) {
	const payload = {
		jsonrpc: '2.0',
		method: 'call',
		params: {
			model,
			method: 'search_read',
			args: domain.length ? [domain] : [],
			kwargs: Object.assign({}, kwargs, fields?.length ? { fields } : {})
		}
	};
	return postJson(`/web/dataset/call_kw/${model}/search_read`, payload, sessionId || config.odoo.sessionId);
}

module.exports = {
	searchRead
};




