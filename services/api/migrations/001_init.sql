create table if not exists scenarios (
  id text primary key,
  name text not null,
  category text not null,
  prompt_template text not null,
  difficulty text not null,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id text primary key,
  user_id text not null,
  scenario_id text not null references scenarios(id),
  started_at timestamptz not null default now(),
  duration_sec integer not null default 0
);

create table if not exists messages (
  id text primary key,
  session_id text not null references sessions(id) on delete cascade,
  role text not null,
  content text not null,
  audio_url text,
  score_json jsonb,
  created_at timestamptz not null default now()
);

create table if not exists learning_plans (
  id text primary key,
  user_id text not null unique,
  weekly_goal_min integer not null,
  current_streak integer not null,
  plan_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into scenarios (id, name, category, prompt_template, difficulty)
values
  ('scn_airport', 'Airport Check-in', 'travel', 'You are an airport check-in staff. Keep it practical and encouraging.', 'easy'),
  ('scn_interview', 'Job Interview', 'career', 'You are an interviewer for a product manager role.', 'hard'),
  ('scn_coffee', 'Coffee Shop Order', 'daily', 'You are a friendly barista helping the learner order coffee.', 'easy')
on conflict (id) do nothing;

insert into learning_plans (id, user_id, weekly_goal_min, current_streak, plan_json)
values
  (
    'lp_1001',
    'u_1001',
    120,
    3,
    '{"weeklyFocus": "Improve fluency in work-related conversations", "suggestedScenarios": ["scn_interview", "scn_airport"]}'::jsonb
  )
on conflict (user_id) do nothing;
