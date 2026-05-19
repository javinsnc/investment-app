---
name: query-investment-db
description: Query the investment-app PostgreSQL database (Aiven cloud) that holds the current fund portfolio, prices, operations and personal-finance data. Use whenever the user asks about "la cartera", funds held, fund prices, asset class distribution (RV/RF/RM), operations, or any production data behind this app.
---

# query-investment-db

This app's data lives in a PostgreSQL database hosted on Aiven. Use this skill to
connect and query it directly (for inspection, debugging or one-off analysis).

## Connection string — ask the user

The connection string contains a database password, so it is **deliberately not
stored anywhere in this repo**. When this skill is needed, **ask the user for the
connection string** and use it only for that session. Never write it to a file,
never paste it into chat output, never commit it.

The URL the user provides normally uses `sslmode=verify-full`. That fails on this
machine because Aiven's CA root cert is not installed locally. Replace it with
`sslmode=require` (still encrypted) — or install Aiven's CA cert and pass
`sslrootcert=`.

## Running psql

`psql` is not on PATH. Use the Homebrew libpq build:

```bash
PSQL=/opt/homebrew/opt/libpq/bin/psql
URL="postgres://...@investment-app-db-...aivencloud.com:28535/defaultdb?sslmode=require"
"$PSQL" "$URL" -c "\dt"
```

## Schema (public)

| Table | What it holds |
|-------|---------------|
| `current_assets` | Current portfolio holdings — one row per fund |
| `asset_classes` | Lookup table: equity / fixed income / mixed |
| `prices` | Historical closing prices per ticker |
| `price_update_runs` | Log of price-refresh runs |
| `operations` | Buy/sell operations |
| `personal_finance_categories` | Personal-finance category catalogue |
| `personal_finance_category_mappings` | Category mapping rules |
| `personal_finance_transactions` | Personal-finance transactions |

`current_assets`: `id, name, ticker (= ISIN, unique), asset_type, average_price,
quantity, asset_class_id`.
- `asset_type` is the **vehicle** and is `'fund'` for every current holding.
- `asset_class_id` → FK to `asset_classes.id`, the **asset class** (RV/RF/RM).

`asset_classes`: `id, code, label`.

| id | code | label |
|----|------|-------|
| 1 | `equities` | equities (RV) |
| 2 | `fixed_income` | fixed income (RF) |
| 3 | `mixed` | mixed (RM) |

`prices`: `id, ticker, date, closing_price`.

## Classifying funds (RV / RF / RM)

The database does not derive the asset class — it must be set explicitly. To
classify a fund, look it up on **Morningstar by ISIN** (the `ticker`): a
"... Equity" category → `equities`, a "... Bond / Credit / Fixed Income"
category → `fixed_income`, a mixed/allocation category → `mixed`.

## Common queries

Portfolio with market value (latest price per ticker):

```sql
SELECT ca.ticker, ca.name, ac.label AS asset_class,
       ca.quantity, p.closing_price, p.date AS price_date,
       ROUND(ca.quantity * p.closing_price, 2) AS market_value
FROM current_assets ca
LEFT JOIN asset_classes ac ON ac.id = ca.asset_class_id
LEFT JOIN LATERAL (
  SELECT closing_price, date FROM prices
  WHERE prices.ticker = ca.ticker ORDER BY date DESC LIMIT 1
) p ON true
ORDER BY market_value DESC NULLS LAST;
```

Distribution by asset class (matches the "distribution by class" chart):

```sql
SELECT ac.label, COUNT(*) AS funds,
       ROUND(SUM(ca.quantity * p.closing_price), 2) AS market_value
FROM current_assets ca
JOIN asset_classes ac ON ac.id = ca.asset_class_id
LEFT JOIN LATERAL (
  SELECT closing_price FROM prices
  WHERE prices.ticker = ca.ticker ORDER BY date DESC LIMIT 1
) p ON true
GROUP BY ac.id, ac.label
ORDER BY market_value DESC;
```

## Safety

- Live production database. Default to **read-only** (`SELECT`) queries.
- Never run `UPDATE`/`DELETE`/`DROP`/`ALTER` unless the user explicitly asks.
- Never commit the connection string or print the password.
