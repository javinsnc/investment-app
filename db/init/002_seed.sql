INSERT INTO operations (name, ticker, asset_type, side, op_date, price, quantity) VALUES
('Apple Inc.', 'AAPL', 'stock', 'BUY', CURRENT_DATE - INTERVAL '35 days', 180.00, 50),
('Bitcoin', 'BTC', 'crypto', 'BUY', CURRENT_DATE - INTERVAL '32 days', 42000.00, 0.5),
('EUR/USD', 'EURUSD', 'forex', 'BUY', CURRENT_DATE - INTERVAL '30 days', 1.0800, 10000);

DO $$
DECLARE
  start_date DATE := CURRENT_DATE - INTERVAL '39 days';
  d DATE;
BEGIN
  d := start_date;
  WHILE d <= CURRENT_DATE LOOP
    INSERT INTO prices(ticker, date, closing_price) VALUES ('AAPL', d, 180 + (RANDOM() * 10));
    INSERT INTO prices(ticker, date, closing_price) VALUES ('BTC', d, 44000 + (RANDOM() * 4000));
    INSERT INTO prices(ticker, date, closing_price) VALUES ('EURUSD', d, 1.08 + (RANDOM() * 0.02));
    d := d + INTERVAL '1 day';
  END LOOP;
END $$;
