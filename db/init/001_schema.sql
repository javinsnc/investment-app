-- Schema
CREATE TABLE IF NOT EXISTS assets (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  ticker TEXT NOT NULL,
  type TEXT NOT NULL,
  purchase_date DATE NOT NULL,
  purchase_price NUMERIC(18,8) NOT NULL,
  quantity NUMERIC(18,8) NOT NULL
);

CREATE TABLE IF NOT EXISTS prices (
  id SERIAL PRIMARY KEY,
  asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  closing_price NUMERIC(18,8) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_prices_asset_date ON prices(asset_id, date);
