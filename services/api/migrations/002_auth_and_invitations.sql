create table if not exists users (
  id text primary key,
  email text not null unique,
  cefr_level text not null,
  native_lang text not null,
  created_at timestamptz not null default now()
);

create table if not exists auth_accounts (
  user_id text primary key references users(id) on delete cascade,
  password text not null,
  updated_at timestamptz not null default now()
);

create table if not exists invitations (
  code text primary key,
  max_uses integer not null,
  used_count integer not null default 0,
  created_at timestamptz not null default now(),
  created_by text not null,
  is_active boolean not null default true,
  expires_at timestamptz,
  note text
);

create index if not exists idx_invitations_created_at on invitations(created_at desc);
create index if not exists idx_invitations_active on invitations(is_active);

insert into users (id, email, cefr_level, native_lang, created_at)
values ('u_1001', 'demo@englishbuddy.ai', 'B1', 'zh-CN', now())
on conflict (id) do update set email = excluded.email;

insert into auth_accounts (user_id, password)
values ('u_1001', '123456')
on conflict (user_id) do update set password = excluded.password, updated_at = now();

insert into invitations (code, max_uses, used_count, created_by, is_active, expires_at, note)
values ('BUDDY2024MVP', 100, 0, 'u_1001', true, null, 'MVP default invite')
on conflict (code) do nothing;
