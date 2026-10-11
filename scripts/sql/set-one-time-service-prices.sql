-- Run in the Supabase SQL Editor. Updates the draft only.
-- INR prices: Standard / Premium / Luxury.
-- Normal: 500 / 800 / 1200
-- Premium: 800 / 1200 / 1500
-- Premium+: 1500 / 2000 / 3000
DO $$
DECLARE
  state_data jsonb;
  service_id text;
  service_index integer;
  tier_index integer;
  price_row record;
  class_price record;
  class_prices jsonb;
BEGIN
  SELECT payload INTO STRICT state_data
  FROM app_private.platform_state
  WHERE id = true
  FOR UPDATE;

  FOREACH service_id IN ARRAY ARRAY[
    'svc-interior-detail',
    'svc-paint-correction',
    'svc-paint-protection',
    'svc-wheel-care'
  ] LOOP
    SELECT (ordinality - 1)::integer INTO STRICT service_index
    FROM jsonb_array_elements(state_data #> '{draft,services}')
         WITH ORDINALITY AS services(service, ordinality)
    WHERE service->>'id' = service_id;

    FOR price_row IN
      SELECT * FROM (
        VALUES
          ('normal',        500,  800, 1200),
          ('premium',       800, 1200, 1500),
          ('premium_plus', 1500, 2000, 3000)
      ) AS prices(code, standard, premium, luxury)
    LOOP
      SELECT (ordinality - 1)::integer INTO STRICT tier_index
      FROM jsonb_array_elements(
        state_data #> ARRAY[
          'draft', 'services', service_index::text, 'tiers'
        ]
      ) WITH ORDINALITY AS tiers(tier, ordinality)
      WHERE tier->>'code' = price_row.code;

      class_prices := jsonb_build_object(
        'standard', price_row.standard * 100,
        'premium',  price_row.premium * 100,
        'luxury',   price_row.luxury * 100
      );

      FOR class_price IN
        SELECT key, value FROM jsonb_each(class_prices)
      LOOP
        state_data := jsonb_set(
          state_data,
          ARRAY[
            'draft', 'services', service_index::text,
            'tiers', tier_index::text,
            'prices', class_price.key, 'one_time'
          ],
          class_price.value
        );
      END LOOP;
    END LOOP;
  END LOOP;

  state_data := jsonb_set(
    state_data,
    '{draftVersion}',
    to_jsonb(COALESCE((state_data->>'draftVersion')::integer, 0) + 1)
  );

  UPDATE app_private.platform_state
  SET payload = state_data
  WHERE id = true;
END $$;

-- Verify all 36 prices in INR after the update.
SELECT
  service->>'name' AS service,
  tier->>'name' AS tier,
  (tier #>> '{prices,standard,one_time}')::numeric / 100 AS standard_inr,
  (tier #>> '{prices,premium,one_time}')::numeric / 100 AS premium_inr,
  (tier #>> '{prices,luxury,one_time}')::numeric / 100 AS luxury_inr
FROM app_private.platform_state
CROSS JOIN LATERAL jsonb_array_elements(payload #> '{draft,services}') AS s(service)
CROSS JOIN LATERAL jsonb_array_elements(service->'tiers') AS t(tier)
WHERE id = true AND service->>'id' IN (
  'svc-interior-detail', 'svc-paint-correction',
  'svc-paint-protection', 'svc-wheel-care'
)
ORDER BY service->>'name', CASE tier->>'code'
  WHEN 'normal' THEN 1 WHEN 'premium' THEN 2 ELSE 3 END;
