-- Sample assets
INSERT INTO assets (name, ticker, type, purchase_date, purchase_price, quantity) VALUES
('Apple Inc.', 'AAPL', 'stock', '2024-01-15', 180.00, 50),
('Bitcoin', 'BTC', 'crypto', '2024-02-01', 42000.00, 0.5),
('EUR/USD', 'EURUSD', 'forex', '2024-03-10', 1.0800, 10000);

-- Generate 40 days of prices ending today
DO $$
DECLARE
  start_date DATE := CURRENT_DATE - INTERVAL '39 days';
  d DATE;
BEGIN
  d := start_date;
  WHILE d <= CURRENT_DATE LOOP
    -- AAPL: oscillate around 185
    INSERT INTO prices(asset_id, date, closing_price)
      VALUES (1, d, 180 + (RANDOM() * 10));
    -- BTC: oscillate around 45k
    INSERT INTO prices(asset_id, date, closing_price)
      VALUES (2, d, 44000 + (RANDOM() * 4000));
    -- EURUSD: small moves around 1.09
    INSERT INTO prices(asset_id, date, closing_price)
      VALUES (3, d, 1.08 + (RANDOM() * 0.02));
    d := d + INTERVAL '1 day';
  END LOOP;
END $$;
