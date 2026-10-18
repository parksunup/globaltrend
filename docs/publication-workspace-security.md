# 작업 공간 권한 검증 기록

작업본 표는 RLS를 활성화하고 활성 팀원에게만 읽기를 허용합니다. 익명 역할에 표 접근 권한을 주지 않고 authenticated 직접 쓰기도 허용하지 않습니다. 공개·공개 취소 함수는 내부에서 admin membership을 검사합니다. 수정·요청·휴지통·복구는 editor 이상을 검사합니다. 모든 동작은 auth.uid, 실제 자료, revision을 검사하고 내부 review_events에 기록합니다.

공개 RPC는 SECURITY INVOKER이며 권한을 제한한 private SECURITY DEFINER core로 연결합니다. core는 public API 노출 스키마에 없고 익명 실행은 허용하지 않습니다. 함수 search_path를 고정했습니다. 운영 적용 후 익명 작업본 조회 불가·리뷰어 비공개·기존 공개 건수 보존을 확인했습니다.

Supabase advisor 확인 시 새 함수의 public SECURITY DEFINER 경고는 private boundary migration으로 해소했습니다. 참고: [함수 권한 경고 설명](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). 기존 collector backend 전용 표의 RLS policy 없음 INFO는 익명·팀 직접읽기를 막기 위한 기존 구성입니다. [해당 진단 설명](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). 기존 Auth의 유출 비밀번호 검사 비활성 경고는 이번 범위에서 설정을 변경하지 않았습니다. [비밀번호 보안 안내](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
