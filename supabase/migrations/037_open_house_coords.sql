-- Cached map coordinates for open houses. The map used to re-geocode every
-- address on every load (in-memory cache only, reset per lambda); now the
-- first map load after this migration geocodes each row once and stores the
-- result here. geocoded_address records the address the coords were computed
-- from, so editing a listing's address automatically triggers a re-geocode.
alter table open_houses
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists geocoded_address text;
