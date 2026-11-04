-- 웹 체험판(ondolog.netlify.app) 익명 응답 로그. 앱 데이터와 무관. 이름·생년월일은 받지 않는다.
-- 웹(anon)은 INSERT만 가능, 조회·수정·삭제 불가. 한 세션의 진행 단계마다 한 행(event)씩 쌓는다.
create table public.demo_responses (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  session_id uuid not null,
  event text not null check (event in ('start','result','consent_view','login','core_override','invite','finish')),
  device text check (device in ('mobile','desktop')),
  age_band text check (age_band in ('under14','14-19','20-24','25-29','30-34','35-39','40+')),
  gender text check (gender in ('male','female','other')),
  mbti text check (mbti ~ '^[EI][SN][FT][JP]$'),
  mbti_path text check (mbti_path in ('known','quick')),
  quick_ei text check (quick_ei in ('A','B')),
  quick_sn text check (quick_sn in ('A','B')),
  quick_ft text check (quick_ft in ('A','B')),
  quick_jp text check (quick_jp in ('A','B')),
  q1 text check (q1 in ('A','B','C')),
  q2 text check (q2 in ('A','B','C')),
  q3 text check (q3 in ('A','B','C')),
  q4 text check (q4 in ('A','B','C')),
  q5 text check (q5 in ('A','B','C')),
  enneagram_core smallint check (enneagram_core between 1 and 9),
  enneagram_override smallint check (enneagram_override between 1 and 9),
  attachment text check (attachment in ('secure','anxious','avoidant','fearful')),
  love_type_code text check (char_length(love_type_code) <= 8),
  big_o smallint check (big_o between 0 and 100),
  big_c smallint check (big_c between 0 and 100),
  big_e smallint check (big_e between 0 and 100),
  big_a smallint check (big_a between 0 and 100),
  big_n smallint check (big_n between 0 and 100),
  stern_intimacy smallint check (stern_intimacy between 0 and 100),
  stern_passion smallint check (stern_passion between 0 and 100),
  stern_commitment smallint check (stern_commitment between 0 and 100),
  engine_version text check (char_length(engine_version) <= 16)
);
comment on table public.demo_responses is '웹 체험판 익명 응답 로그(투자자 데모·통계용). 앱 데이터와 분리. anon은 INSERT만, 조회는 대시보드/서비스 키로만.';
create index demo_responses_session_idx on public.demo_responses (session_id);
create index demo_responses_event_idx on public.demo_responses (event, created_at);

alter table public.demo_responses enable row level security;
revoke all on public.demo_responses from anon, authenticated;
grant insert on public.demo_responses to anon;
create policy demo_responses_anon_insert on public.demo_responses
  for insert to anon with check (true);