-- Tables required by the integrated system

-- 1) recent_mo: MO created today up to 7 days back, not done, group worker 6/7,
--    notes contains specific shift text; enriched with transfer_id and authenticity fields
CREATE TABLE IF NOT EXISTS recent_mo (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	mo_id INTEGER,
	mo_name TEXT,
	state TEXT,
	ready_for_production INTEGER DEFAULT 0, -- 0: not ready, 1: ready
	group_worker_id INTEGER,
	note TEXT,
	product_id INTEGER,
	product_name TEXT,
	product_uom TEXT,
	product_qty REAL,
	initial_qty_target REAL,
	auth_used REAL,
	loss_value REAL,
	percentage_loss REAL,
	create_date TEXT,
	date_start TEXT,
	date_finished TEXT,
	origin TEXT,
	transfer_id INTEGER,
	auth_first TEXT,
	auth_last TEXT,
	leader_id INTEGER,
	roll_number TEXT,
	created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_recent_mo_name ON recent_mo(mo_name);
CREATE INDEX IF NOT EXISTS idx_recent_mo_transfer ON recent_mo(transfer_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_recent_mo_name ON recent_mo(mo_name);

-- 3) master authenticity vendor
CREATE TABLE IF NOT EXISTS master_authenticity_vendor (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	roll TEXT,
	authenticity TEXT,
	marketing_code TEXT,
	tanggal_kirim TEXT,
	nama_vendor TEXT,
	created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mav_roll ON master_authenticity_vendor(roll);
CREATE INDEX IF NOT EXISTS idx_mav_auth ON master_authenticity_vendor(authenticity);

-- 4) authenticity used by warehouse RM
CREATE TABLE IF NOT EXISTS authenticity_used_rm (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	transfer_id INTEGER,
	authenticity TEXT,
	transfer_date TEXT,
	created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_auth_rm_transfer ON authenticity_used_rm(transfer_id);
CREATE INDEX IF NOT EXISTS idx_auth_rm_auth ON authenticity_used_rm(authenticity);

-- 5) authenticity used by line production
CREATE TABLE IF NOT EXISTS authenticity_used_line (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	mo_name TEXT,
	sku_barcode TEXT,
	auth_first_code TEXT,
	auth_last_code TEXT,
	created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_auth_line_mo ON authenticity_used_line(mo_name);

-- 6) manufacturing_identity
CREATE TABLE IF NOT EXISTS manufacturing_identity (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	mo_name TEXT,
	sku TEXT,
	sku_name TEXT,
	target_qty REAL,
	done_qty REAL,
	leader_name TEXT,
	started_at TEXT,
	finished_at TEXT,
	created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mi_mo ON manufacturing_identity(mo_name);

-- production_log: logs start/end commands issued from UI
CREATE TABLE IF NOT EXISTS production_log (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	mo_name TEXT,
	product_name TEXT,
	leader_id INTEGER,
	status TEXT, -- 'start' or 'end'
	create_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pl_mo ON production_log(mo_name);


