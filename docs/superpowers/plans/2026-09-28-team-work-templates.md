# 팀 업무 양식과 제출 검증 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 법제 담당과 동향 담당이 별도 브랜치에서 표준 양식으로 조사 결과를 작성하고 Pull Request에서 자동 검증받게 한다.

**Architecture:** 실제 조사 내용과 Supabase는 건드리지 않고 `data/` 템플릿, Node 기반 검증기, GitHub Issue·PR·CI 설정을 추가한다. 저장소 문서 세 곳과 배포용 `/guide` 페이지가 동일한 작업 순서를 안내하게 한다.

**Tech Stack:** Node.js, TypeScript, Next.js, pnpm, GitHub Actions

**Spec:** `docs/superpowers/specs/2026-09-28-team-work-templates-design.md`

## Global Constraints

- 실제 법률·번역·동향 조사 결과를 만들지 않는다.
- Supabase schema, seed, 인증과 환경변수를 변경하지 않는다.
- 외부 URL 접속 여부를 CI에서 검사하지 않는다.
- 확인하지 못한 값은 추정하지 않고 `unreviewed`, `in_review`, `verified`, `blocked` 상태로 표현한다.
- README, architecture, 팀 온보딩 문서와 `/guide` 페이지의 작업 순서를 일치시킨다.

## Review Focus

- 템플릿만 있는 초기 상태에서도 데이터 검사가 성공해야 한다.
- 실제 결과 파일에 필수 열이나 필드가 빠지면 데이터 검사가 실패해야 한다.
- 중복 ID, HTTP URL과 잘못된 상태값은 명확한 오류로 실패해야 한다.
- 담당자의 필수 세트 중 Markdown, CSV·JSON 또는 검토 메모가 빠지면 실패해야 한다.
- 기존 Next.js 앱의 타입 검사와 빌드가 계속 성공해야 한다.

---

### Task 1: 데이터 템플릿과 검증기

**Files:**
- Create: `data/README.md`
- Create: `data/legal/README.md`
- Create: `data/legal/instruments.template.md`
- Create: `data/legal/instruments.template.csv`
- Create: `data/legal/review-notes.template.md`
- Create: `data/trends/README.md`
- Create: `data/trends/source-configs/source.template.md`
- Create: `data/trends/source-configs/source.template.json`
- Create: `data/trends/review-notes.template.md`
- Create: `scripts/validate-team-data.mjs`
- Create: `tests/validate-team-data.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `validateLegalData(rootDir: string): string[]`, `validateTrendData(rootDir: string): string[]`, `validateTeamData(rootDir: string): string[]`
- CLI: `node scripts/validate-team-data.mjs [rootDir]`, exit code 0 on success and 1 with readable errors on failure

- [ ] Write Node tests for template-only success, missing companion files, missing fields, duplicate IDs, non-HTTPS URLs and invalid statuses.
- [ ] Run `node --test tests/validate-team-data.test.mjs` and confirm the missing module or assertions fail.
- [ ] Add the templates and minimal exported validation functions.
- [ ] Add `test`, `typecheck`, and `validate:data` scripts to `package.json`.
- [ ] Run `pnpm test` and `pnpm validate:data` and confirm both pass.
- [ ] Commit the task.

### Task 2: GitHub 작업·검증 양식

**Files:**
- Create: `.github/ISSUE_TEMPLATE/legal-research.yml`
- Create: `.github/ISSUE_TEMPLATE/trend-research.yml`
- Create: `.github/pull_request_template.md`
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `pnpm test`, `pnpm typecheck`, `pnpm validate:data`, `pnpm build`
- Produces: 법제·동향 Issue 입력 양식, 공통 PR 체크리스트, PR/push CI

- [ ] Add Issue forms with fixed output paths, forbidden areas and completion checks.
- [ ] Add a PR template for official URLs, uncertainties, changed files and verification commands.
- [ ] Add CI using pinned Node setup, pnpm cache and the four project checks.
- [ ] Validate YAML structure by inspection and run all four commands locally.
- [ ] Commit the task.

### Task 3: 문서와 배포용 가이드 동기화

**Files:**
- Modify: `README.md`
- Modify: `architecture.md`
- Modify: `docs/team-onboarding.md`
- Modify: `app/guide/page.tsx`

**Interfaces:**
- Consumes: Task 1 template paths and Task 2 branch/PR workflow
- Produces: 네 곳에서 동일한 쉬운 작업 안내

- [ ] Update the README with the lead-first template merge and member branch sequence.
- [ ] Update architecture with the repository contract and the boundary between research and implementation.
- [ ] Update onboarding with exact branch names, template-copy steps and local validation command.
- [ ] Update `/guide` with the same branch order and plain-language template instructions.
- [ ] Run text searches to confirm all four surfaces name both member branches and `pnpm validate:data` where appropriate.
- [ ] Run tests, typecheck and build.
- [ ] Commit the task.

### Task 4: 전체 검증과 인계

**Files:**
- Modify only files needed to fix verification failures.

**Interfaces:**
- Consumes: all earlier tasks
- Produces: a clean, reviewable branch ready for PR

- [ ] Run `pnpm test`.
- [ ] Run `pnpm validate:data`.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm build`.
- [ ] Run `git diff --check` and inspect `git status --short`.
- [ ] Review the branch diff against the spec and confirm Supabase files are unchanged.
- [ ] Commit any verification fixes and prepare the PR summary.
