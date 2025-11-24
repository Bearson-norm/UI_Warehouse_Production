/**
 * Contoh script Node.js untuk mengambil data dari Manufacturing Process System API
 */

const axios = require('axios');

class ManufacturingAPI {
  constructor(baseUrl, apiKey = null) {
    /**
     * Initialize API client
     * @param {string} baseUrl - Base URL of the API server
     * @param {string|null} apiKey - Optional API key for authentication (recommended for external access)
     */
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = null;
    this.apiKey = apiKey;
  }

  async login(username, password) {
    if (this.apiKey) {
      console.log('⚠️  Menggunakan API key, login tidak diperlukan');
      return true;
    }
    try {
      const response = await axios.post(`${this.baseUrl}/api/login`, {
        username,
        password
      });
      this.token = response.data.token;
      console.log(`✅ Login berhasil sebagai ${response.data.user.username} (${response.data.user.role})`);
      return true;
    } catch (error) {
      console.error('❌ Login gagal:', error.response?.data?.error || error.message);
      return false;
    }
  }

  _getHeaders() {
    if (this.apiKey) {
      return { 'x-api-key': this.apiKey };
    }
    if (this.token) {
      return { 'x-session-token': this.token };
    }
    throw new Error('Belum login atau tidak ada API key. Panggil login() atau set apiKey saat init.');
  }

  async getRecentMO(options = {}) {
    const {
      limit = 100,
      offset = 0,
      mo_name,
      ready,
      state
    } = options;

    const params = { limit, offset };
    if (mo_name) params.mo_name = mo_name;
    if (ready !== undefined) params.ready = ready ? 'true' : 'false';
    if (state) params.state = state;

    try {
      const response = await axios.get(`${this.baseUrl}/api/data/recent-mo`, {
        headers: this._getHeaders(),
        params
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || error.message);
    }
  }

  async getManufacturingIdentity(options = {}) {
    const {
      limit = 100,
      offset = 0,
      mo_name,
      sku
    } = options;

    const params = { limit, offset };
    if (mo_name) params.mo_name = mo_name;
    if (sku) params.sku = sku;

    try {
      const response = await axios.get(`${this.baseUrl}/api/data/manufacturing-identity`, {
        headers: this._getHeaders(),
        params
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || error.message);
    }
  }

  async getProductionLog(options = {}) {
    const {
      limit = 100,
      offset = 0,
      mo_name,
      status,
      from_date,
      to_date
    } = options;

    const params = { limit, offset };
    if (mo_name) params.mo_name = mo_name;
    if (status) params.status = status;
    if (from_date) params.from_date = from_date;
    if (to_date) params.to_date = to_date;

    try {
      const response = await axios.get(`${this.baseUrl}/api/data/production-log`, {
        headers: this._getHeaders(),
        params
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || error.message);
    }
  }

  async getAllRecentMO(filters = {}) {
    const allData = [];
    let offset = 0;
    const limit = 100;

    while (true) {
      const result = await this.getRecentMO({ ...filters, limit, offset });
      allData.push(...result.data);

      if (!result.pagination.has_more) {
        break;
      }
      offset += limit;
    }

    return allData;
  }

  async getAllManufacturingIdentity(filters = {}) {
    const allData = [];
    let offset = 0;
    const limit = 100;

    while (true) {
      const result = await this.getManufacturingIdentity({ ...filters, limit, offset });
      allData.push(...result.data);

      if (!result.pagination.has_more) {
        break;
      }
      offset += limit;
    }

    return allData;
  }
}

// Contoh penggunaan
async function main() {
  // Ganti dengan URL server Anda
  const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

  // Opsi 1: Menggunakan API Key (Recommended untuk external access)
  const API_KEY = process.env.API_KEY || 'mps_your_api_key_here'; // Ganti dengan API key Anda
  const api = new ManufacturingAPI(BASE_URL, API_KEY);

  // Opsi 2: Menggunakan Session Token (Login)
  // const api = new ManufacturingAPI(BASE_URL);
  // const loggedIn = await api.login('production', 'password123');
  // if (!loggedIn) {
  //   process.exit(1);
  // }

  console.log('\n' + '='.repeat(50));
  console.log('Mengambil data Recent MO...');
  console.log('='.repeat(50));
  const recentMO = await api.getRecentMO({ limit: 10, ready: true });
  console.log(`Total: ${recentMO.pagination.total}`);
  recentMO.data.slice(0, 5).forEach(mo => {
    console.log(`  - ${mo.mo_name}: ${mo.product_name} (Qty: ${mo.product_qty})`);
  });

  console.log('\n' + '='.repeat(50));
  console.log('Mengambil data Manufacturing Identity...');
  console.log('='.repeat(50));
  const miData = await api.getManufacturingIdentity({ limit: 10 });
  console.log(`Total: ${miData.pagination.total}`);
  miData.data.slice(0, 5).forEach(mi => {
    console.log(`  - ${mi.mo_name}: ${mi.sku_name} (Target: ${mi.target_qty}, Done: ${mi.done_qty})`);
  });

  console.log('\n' + '='.repeat(50));
  console.log('Mengambil data Production Log (start only)...');
  console.log('='.repeat(50));
  const logs = await api.getProductionLog({ limit: 10, status: 'start' });
  console.log(`Total: ${logs.pagination.total}`);
  logs.data.slice(0, 5).forEach(log => {
    console.log(`  - ${log.mo_name}: ${log.status} at ${log.create_at}`);
  });

  console.log('\n' + '='.repeat(50));
  console.log('Mengambil semua data Recent MO (dengan pagination)...');
  console.log('='.repeat(50));
  const allMO = await api.getAllRecentMO({ ready: true });
  console.log(`Total records: ${allMO.length}`);

  // Simpan ke file JSON
  const fs = require('fs');
  fs.writeFileSync('recent_mo_export.json', JSON.stringify(allMO, null, 2));
  console.log('✅ Data disimpan ke recent_mo_export.json');
}

// Jalankan jika dipanggil langsung
if (require.main === module) {
  main().catch(error => {
    console.error('Error:', error.message);
    process.exit(1);
  });
}

module.exports = ManufacturingAPI;

