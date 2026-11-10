-- Trail Slice 3 seed: BOT Names as the first supported project (id 1).
-- Idempotent: safe to rerun.
INSERT INTO projects (id, slug, name, official_url, category, description, status)
VALUES (
  1,
  'bot-names',
  'BOT Names',
  'https://botn.in',
  'identity',
  'On-chain domain names on BOT Chain. Eligible action: mintDomain(string).',
  'supported'
)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  name = EXCLUDED.name,
  official_url = EXCLUDED.official_url,
  status = EXCLUDED.status;
SELECT setval(pg_get_serial_sequence('projects', 'id'), GREATEST((SELECT MAX(id) FROM projects), 1));

INSERT INTO supported_actions (
  project_id, version, chain_id, approved_target, function_selector,
  event_emitter, event_topic0, min_block, eligible_wallet_rule, sample_tx_hash, enabled
)
VALUES (
  1, 1, 677,
  '0xbeb7b2bd305f0d9412eb1f4c49541fd048c363ce',
  '0xc319a11f',
  '0xbeb7b2bd305f0d9412eb1f4c49541fd048c363ce',
  '0xcb748939c198a3ac8c51ea9027e77e3c96244f35ceda8277bd2af91c28a72416',
  20000000,
  'eoa',
  '0xa04b7f06a8566618ef6e42fe805c77eba9cfcdec7063f7123b3d8d3ffe024d38',
  true
)
ON CONFLICT DO NOTHING;
