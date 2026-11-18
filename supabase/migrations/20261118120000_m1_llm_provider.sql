-- 84-a-m1 (ROADMAP r124 R124-2 · R124-4 · R21-1): 모델 설정 값 갱신 - 이것 하나뿐(사전 허가 마이그레이션).
--
-- app_config.llm_provider: {"provider":"tbd","model":"tbd"}(010_app_config.sql) -> 코너 기본 모델 Sonnet 5.5.
--   생성 경로는 이 값이 코드 허용 목록(src/engine/corners/llmSafety.ts ALLOWED_LLM_MODELS) 안일 때만 LLM을 부른다(fail-closed).
--   값이 없거나 · tbd · 모르는 모델 · 형식 오류면 생성 거부(호출 0).
-- corners.llm_usage: 이미 있다(022_publish_path.sql) - 추가 0.
-- 이 파일이 하지 않는 것: 스키마 · 함수 · 정책 · 트리거 변경 · 다른 설정 키 · 데모 응답 표.
-- 행이 없으면 아무 일도 하지 않는다(update 0행) - 그때 생성 경로는 "값 없음"으로 거부한다.

update public.app_config
   set value = '{"provider":"anthropic","model":"claude-sonnet-5-5"}'::jsonb,
       description = '코너 생성 모델(84-a). 코드 허용 목록 안일 때만 생성 - Sonnet 5.5 기본 · Opus 5.5는 84-b 비교용'
 where key = 'llm_provider';
