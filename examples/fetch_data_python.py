#!/usr/bin/env python3
"""
Contoh script Python untuk mengambil data dari Manufacturing Process System API
"""

import requests
import json
from typing import Optional, Dict, List

class ManufacturingAPI:
    def __init__(self, base_url: str, api_key: Optional[str] = None):
        """
        Initialize API client
        
        Args:
            base_url: Base URL of the API server
            api_key: Optional API key for authentication (recommended for external access)
        """
        self.base_url = base_url.rstrip('/')
        self.token: Optional[str] = None
        self.api_key: Optional[str] = api_key
    
    def login(self, username: str, password: str) -> bool:
        """Login dan dapatkan session token (hanya jika tidak menggunakan API key)"""
        if self.api_key:
            print("⚠️  Menggunakan API key, login tidak diperlukan")
            return True
        try:
            response = requests.post(
                f"{self.base_url}/api/login",
                json={"username": username, "password": password}
            )
            response.raise_for_status()
            data = response.json()
            self.token = data["token"]
            print(f"✅ Login berhasil sebagai {data['user']['username']} ({data['user']['role']})")
            return True
        except requests.exceptions.RequestException as e:
            print(f"❌ Login gagal: {e}")
            if hasattr(e.response, 'text'):
                print(f"   Response: {e.response.text}")
            return False
    
    def _get_headers(self) -> Dict[str, str]:
        """Get headers dengan token atau API key"""
        if self.api_key:
            return {"x-api-key": self.api_key}
        if self.token:
            return {"x-session-token": self.token}
        raise Exception("Belum login atau tidak ada API key. Panggil login() atau set api_key saat init.")
    
    def get_recent_mo(self, limit: int = 100, offset: int = 0, 
                      mo_name: Optional[str] = None, 
                      ready: Optional[bool] = None,
                      state: Optional[str] = None) -> Dict:
        """Ambil data recent_mo"""
        params = {"limit": limit, "offset": offset}
        if mo_name:
            params["mo_name"] = mo_name
        if ready is not None:
            params["ready"] = "true" if ready else "false"
        if state:
            params["state"] = state
        
        response = requests.get(
            f"{self.base_url}/api/data/recent-mo",
            headers=self._get_headers(),
            params=params
        )
        response.raise_for_status()
        return response.json()
    
    def get_manufacturing_identity(self, limit: int = 100, offset: int = 0,
                                   mo_name: Optional[str] = None,
                                   sku: Optional[str] = None) -> Dict:
        """Ambil data manufacturing_identity"""
        params = {"limit": limit, "offset": offset}
        if mo_name:
            params["mo_name"] = mo_name
        if sku:
            params["sku"] = sku
        
        response = requests.get(
            f"{self.base_url}/api/data/manufacturing-identity",
            headers=self._get_headers(),
            params=params
        )
        response.raise_for_status()
        return response.json()
    
    def get_production_log(self, limit: int = 100, offset: int = 0,
                          mo_name: Optional[str] = None,
                          status: Optional[str] = None,
                          from_date: Optional[str] = None,
                          to_date: Optional[str] = None) -> Dict:
        """Ambil data production_log"""
        params = {"limit": limit, "offset": offset}
        if mo_name:
            params["mo_name"] = mo_name
        if status:
            params["status"] = status
        if from_date:
            params["from_date"] = from_date
        if to_date:
            params["to_date"] = to_date
        
        response = requests.get(
            f"{self.base_url}/api/data/production-log",
            headers=self._get_headers(),
            params=params
        )
        response.raise_for_status()
        return response.json()
    
    def get_all_recent_mo(self, **filters) -> List[Dict]:
        """Ambil semua data recent_mo dengan pagination otomatis"""
        all_data = []
        offset = 0
        limit = 100
        
        while True:
            result = self.get_recent_mo(limit=limit, offset=offset, **filters)
            all_data.extend(result["data"])
            
            if not result["pagination"]["has_more"]:
                break
            offset += limit
        
        return all_data
    
    def get_all_manufacturing_identity(self, **filters) -> List[Dict]:
        """Ambil semua data manufacturing_identity dengan pagination otomatis"""
        all_data = []
        offset = 0
        limit = 100
        
        while True:
            result = self.get_manufacturing_identity(limit=limit, offset=offset, **filters)
            all_data.extend(result["data"])
            
            if not result["pagination"]["has_more"]:
                break
            offset += limit
        
        return all_data


# Contoh penggunaan
if __name__ == "__main__":
    # Ganti dengan URL server Anda
    BASE_URL = "http://localhost:3000"  # atau "https://your-server.com"
    
    # Opsi 1: Menggunakan API Key (Recommended untuk external access)
    API_KEY = "mps_your_api_key_here"  # Ganti dengan API key Anda
    api = ManufacturingAPI(BASE_URL, api_key=API_KEY)
    
    # Opsi 2: Menggunakan Session Token (Login)
    # api = ManufacturingAPI(BASE_URL)
    # if not api.login("production", "password123"):
    #     exit(1)
    
    print("\n" + "="*50)
    print("Mengambil data Recent MO...")
    print("="*50)
    recent_mo = api.get_recent_mo(limit=10, ready=True)
    print(f"Total: {recent_mo['pagination']['total']}")
    for mo in recent_mo['data'][:5]:  # Tampilkan 5 pertama
        print(f"  - {mo['mo_name']}: {mo['product_name']} (Qty: {mo['product_qty']})")
    
    print("\n" + "="*50)
    print("Mengambil data Manufacturing Identity...")
    print("="*50)
    mi_data = api.get_manufacturing_identity(limit=10)
    print(f"Total: {mi_data['pagination']['total']}")
    for mi in mi_data['data'][:5]:
        print(f"  - {mi['mo_name']}: {mi['sku_name']} (Target: {mi['target_qty']}, Done: {mi['done_qty']})")
    
    print("\n" + "="*50)
    print("Mengambil data Production Log (start only)...")
    print("="*50)
    logs = api.get_production_log(limit=10, status="start")
    print(f"Total: {logs['pagination']['total']}")
    for log in logs['data'][:5]:
        print(f"  - {log['mo_name']}: {log['status']} at {log['create_at']}")
    
    print("\n" + "="*50)
    print("Mengambil semua data Recent MO (dengan pagination)...")
    print("="*50)
    all_mo = api.get_all_recent_mo(ready=True)
    print(f"Total records: {len(all_mo)}")
    
    # Simpan ke file JSON
    with open("recent_mo_export.json", "w") as f:
        json.dump(all_mo, f, indent=2)
    print("✅ Data disimpan ke recent_mo_export.json")

