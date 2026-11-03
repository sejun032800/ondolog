-- cron 실행 실패 점검 (ROADMAP R53-5, 위임 `71-`). 읽기 전용 SELECT 하나. 사람이 SQL Editor에 붙여 실행한다.
-- 아무것도 쓰지 않는다. 배치 함수를 부르지 않는다(R34-3). cron 예약을 바꾸지 않는다.
-- 출력: 작업 이름 · 시각 · 상태 · 메시지 앞 120자만. 키 · URL · 프로젝트 ref · 개인 정보가 없다.
-- M4-2 운영 경보가 생기면 그쪽으로 옮긴다(R53-5).
--
-- 행 설명 (kind 열):
--   failed_7d   : 최근 7일 안에 status = 'failed' 인 실행 기록. 작업 이름 · 시작 시각(UTC) · 메시지 앞 120자. 없으면 한 줄도 나오지 않는다.
--   last_ok     : 작업마다 마지막 성공(status = 'succeeded') 시작 시각(UTC). 성공 기록이 없으면 '(성공 기록 없음)'.
--
-- 읽는 법: failed_7d 가 비어 있고 모든 작업의 last_ok 가 예약 주기에 맞게 최근이면 정상.
--          (expire-stories 15분 · retention-policy 매일 04:00Z · execute-dissolutions 매일 05:00Z)
select 'failed_7d' as kind,
       j.jobname,
       to_char(d.start_time at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS') || 'Z' as at_utc,
       left(coalesce(d.return_message, ''), 120) as detail
  from cron.job_run_details d
  join cron.job j on j.jobid = d.jobid
 where d.status = 'failed'
   and d.start_time >= now() - interval '7 days'
union all
select 'last_ok',
       j.jobname,
       coalesce((select to_char(max(d.start_time) at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS') || 'Z'
                   from cron.job_run_details d
                  where d.jobid = j.jobid and d.status = 'succeeded'), '(성공 기록 없음)'),
       ''
  from cron.job j
order by 1, 2, 3 desc;
