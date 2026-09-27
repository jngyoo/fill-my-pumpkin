-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.

create table if not exists pumpkins (
  id text primary key,
  name text not null,
  owner_token text not null,
  created_at bigint not null
);

create table if not exists candies (
  id bigint generated always as identity primary key,
  pumpkin_id text not null references pumpkins(id) on delete cascade,
  candy text not null,
  sender text not null,
  text text not null,
  created_at bigint not null
);

create index if not exists candies_pumpkin on candies(pumpkin_id);

-- Row Level Security on, with no policies: the public anon key can't read or write anything.
-- Only the server (using the secret key, which bypasses RLS) can touch these tables,
-- so notes stay locked until Halloween no matter what someone does in the browser.
alter table pumpkins enable row level security;
alter table candies enable row level security;
