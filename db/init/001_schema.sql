CREATE TABLE IF NOT EXISTS operations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  ticker TEXT NOT NULL,
  asset_type TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('BUY','SELL')),
  op_date DATE NOT NULL,
  price NUMERIC(18,8) NOT NULL,
  quantity NUMERIC(18,8) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_operations_ticker ON operations(ticker);
CREATE INDEX IF NOT EXISTS idx_operations_date ON operations(op_date);

CREATE TABLE IF NOT EXISTS current_assets (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  ticker TEXT NOT NULL UNIQUE,
  asset_type TEXT NOT NULL,
  average_price NUMERIC(18,8) NOT NULL,
  quantity NUMERIC(18,8) NOT NULL
);

CREATE TABLE IF NOT EXISTS prices (
  id SERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  date DATE NOT NULL,
  closing_price NUMERIC(18,8) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_prices_ticker_date ON prices(ticker, date);
