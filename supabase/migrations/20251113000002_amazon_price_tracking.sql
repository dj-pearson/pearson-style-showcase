-- Migration: Amazon Price Tracking System
-- Created: 2025-11-13
-- Description: Add price history tracking for Amazon affiliate products

-- Price history table
CREATE TABLE IF NOT EXISTS amazon_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asin TEXT NOT NULL REFERENCES amazon_products(asin) ON DELETE CASCADE,
  price DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  availability TEXT, -- InStock, OutOfStock, etc.
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT DEFAULT 'manual', -- manual, api, scraper

  -- Indexes for fast queries
  CONSTRAINT price_history_unique UNIQUE (asin, recorded_at)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_price_history_asin ON amazon_price_history(asin, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_date ON amazon_price_history(recorded_at DESC);

-- Price alerts table
CREATE TABLE IF NOT EXISTS amazon_price_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asin TEXT NOT NULL REFERENCES amazon_products(asin) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  target_price DECIMAL(10,2) NOT NULL,
  current_price DECIMAL(10,2),
  alert_type TEXT DEFAULT 'below', -- below, above, percentage_drop
  percentage_threshold DECIMAL(5,2), -- for percentage_drop type
  is_active BOOLEAN DEFAULT true,
  last_checked_at TIMESTAMPTZ,
  triggered_at TIMESTAMPTZ,
  notification_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_alert_type CHECK (alert_type IN ('below', 'above', 'percentage_drop'))
);

-- Indexes for price alerts
CREATE INDEX IF NOT EXISTS idx_price_alerts_asin ON amazon_price_alerts(asin, is_active);
CREATE INDEX IF NOT EXISTS idx_price_alerts_email ON amazon_price_alerts(user_email, is_active);
CREATE INDEX IF NOT EXISTS idx_price_alerts_active ON amazon_price_alerts(is_active, last_checked_at)
  WHERE is_active = true;

-- Price statistics view
CREATE OR REPLACE VIEW amazon_price_stats AS
SELECT
  asin,
  COUNT(*) as data_points,
  MIN(price) as lowest_price,
  MAX(price) as highest_price,
  AVG(price) as average_price,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price) as median_price,
  STDDEV(price) as price_volatility,
  MIN(recorded_at) as first_recorded,
  MAX(recorded_at) as last_recorded
FROM amazon_price_history
GROUP BY asin;

-- Function to get price trend (up, down, stable)
CREATE OR REPLACE FUNCTION get_price_trend(p_asin TEXT, days INTEGER DEFAULT 7)
RETURNS TEXT AS $$
DECLARE
  recent_avg DECIMAL;
  older_avg DECIMAL;
  trend TEXT;
BEGIN
  -- Get average price from last N days
  SELECT AVG(price) INTO recent_avg
  FROM amazon_price_history
  WHERE asin = p_asin
    AND recorded_at >= NOW() - (days || ' days')::INTERVAL
    AND recorded_at >= NOW() - (days/2 || ' days')::INTERVAL;

  -- Get average price from N to 2N days ago
  SELECT AVG(price) INTO older_avg
  FROM amazon_price_history
  WHERE asin = p_asin
    AND recorded_at >= NOW() - (days * 2 || ' days')::INTERVAL
    AND recorded_at < NOW() - (days || ' days')::INTERVAL;

  IF recent_avg IS NULL OR older_avg IS NULL THEN
    RETURN 'unknown';
  END IF;

  IF recent_avg < older_avg * 0.95 THEN
    RETURN 'down';
  ELSIF recent_avg > older_avg * 1.05 THEN
    RETURN 'up';
  ELSE
    RETURN 'stable';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to check and trigger price alerts
CREATE OR REPLACE FUNCTION check_price_alerts()
RETURNS TABLE(alert_id UUID, asin TEXT, user_email TEXT, target_price DECIMAL, current_price DECIMAL) AS $$
BEGIN
  RETURN QUERY
  WITH current_prices AS (
    SELECT DISTINCT ON (ph.asin)
      ph.asin,
      ph.price as current_price
    FROM amazon_price_history ph
    ORDER BY ph.asin, ph.recorded_at DESC
  )
  SELECT
    pa.id as alert_id,
    pa.asin,
    pa.user_email,
    pa.target_price,
    cp.current_price
  FROM amazon_price_alerts pa
  JOIN current_prices cp ON pa.asin = cp.asin
  WHERE pa.is_active = true
    AND pa.notification_sent = false
    AND (
      (pa.alert_type = 'below' AND cp.current_price <= pa.target_price)
      OR (pa.alert_type = 'above' AND cp.current_price >= pa.target_price)
      OR (pa.alert_type = 'percentage_drop'
          AND pa.current_price IS NOT NULL
          AND ((pa.current_price - cp.current_price) / pa.current_price * 100) >= pa.percentage_threshold)
    );
END;
$$ LANGUAGE plpgsql;

-- Function to record price and update product
CREATE OR REPLACE FUNCTION record_product_price(
  p_asin TEXT,
  p_price DECIMAL,
  p_availability TEXT DEFAULT 'InStock'
)
RETURNS UUID AS $$
DECLARE
  history_id UUID;
BEGIN
  -- Insert into price history
  INSERT INTO amazon_price_history (asin, price, availability, recorded_at)
  VALUES (p_asin, p_price, p_availability, NOW())
  ON CONFLICT (asin, recorded_at) DO UPDATE
    SET price = EXCLUDED.price,
        availability = EXCLUDED.availability
  RETURNING id INTO history_id;

  -- Update current price in amazon_products
  UPDATE amazon_products
  SET
    price = p_price,
    last_seen_at = NOW()
  WHERE asin = p_asin;

  RETURN history_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update amazon_price_alerts.updated_at
CREATE OR REPLACE FUNCTION update_price_alert_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER price_alert_update_timestamp
  BEFORE UPDATE ON amazon_price_alerts
  FOR EACH ROW
  EXECUTE FUNCTION update_price_alert_timestamp();

-- RLS Policies
ALTER TABLE amazon_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE amazon_price_alerts ENABLE ROW LEVEL SECURITY;

-- Public can read price history
CREATE POLICY "Anyone can view price history"
  ON amazon_price_history FOR SELECT
  USING (true);

-- Users can view their own alerts
CREATE POLICY "Users can view own alerts"
  ON amazon_price_alerts FOR SELECT
  USING (true);

-- Users can create their own alerts
CREATE POLICY "Users can create alerts"
  ON amazon_price_alerts FOR INSERT
  WITH CHECK (true);

-- Users can update their own alerts
CREATE POLICY "Users can update own alerts"
  ON amazon_price_alerts FOR UPDATE
  USING (true);

-- Users can delete their own alerts
CREATE POLICY "Users can delete own alerts"
  ON amazon_price_alerts FOR DELETE
  USING (true);

-- Insert some sample historical data for testing
DO $$
DECLARE
  test_asin TEXT;
  days_back INTEGER;
  base_price DECIMAL;
  price_variation DECIMAL;
BEGIN
  -- Get a sample ASIN from amazon_products
  SELECT asin INTO test_asin
  FROM amazon_products
  LIMIT 1;

  IF test_asin IS NOT NULL THEN
    base_price := 29.99;

    -- Generate 30 days of price history
    FOR days_back IN REVERSE 30..0 LOOP
      price_variation := (RANDOM() * 10 - 5); -- Random variation between -5 and +5

      INSERT INTO amazon_price_history (asin, price, recorded_at)
      VALUES (
        test_asin,
        base_price + price_variation,
        NOW() - (days_back || ' days')::INTERVAL
      )
      ON CONFLICT DO NOTHING;
    END LOOP;

    RAISE NOTICE 'Sample price history created for ASIN: %', test_asin;
  END IF;
END $$;

-- Comments for documentation
COMMENT ON TABLE amazon_price_history IS 'Historical price tracking for Amazon products';
COMMENT ON TABLE amazon_price_alerts IS 'User-configured price alerts for Amazon products';
COMMENT ON VIEW amazon_price_stats IS 'Aggregated price statistics per product';
COMMENT ON FUNCTION get_price_trend IS 'Calculate price trend (up/down/stable) over specified days';
COMMENT ON FUNCTION check_price_alerts IS 'Find alerts that should be triggered based on current prices';
COMMENT ON FUNCTION record_product_price IS 'Record a new price point and update product table';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Amazon Price Tracking System installed successfully!';
  RAISE NOTICE 'Tables created: amazon_price_history, amazon_price_alerts';
  RAISE NOTICE 'Functions created: get_price_trend, check_price_alerts, record_product_price';
END $$;
