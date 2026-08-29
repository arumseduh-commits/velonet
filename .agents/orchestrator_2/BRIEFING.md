# BRIEFING — 2026-08-30T01:48:12+07:00

## Mission
Lead and coordinate the full implementation of Window of Availability Scheduling, Realtime Live Proctor & Gamified Leaderboard ala Quizizz, Student fast progress sync API, and strict compliance with AGENTS.md.

## 🔒 My Identity
- Archetype: teamwork_preview_orchestrator
- Roles: orchestrator, user_liaison, human_reporter, successor
- Working directory: c:\UBIG\VeloNet\.agents\orchestrator_2
- Original parent: parent
- Original parent conversation ID: 65e4582e-df31-4643-97dc-e6348751e026

## 🔒 My Workflow
- **Pattern**: Project Orchestrator
- **Scope document**: c:\UBIG\VeloNet\PROJECT.md
1. **Decompose**: Survey full codebase, decompose into cohesive milestones with interface contracts.
2. **Dispatch & Execute**:
   - Survey (3 Explorers / Spec Miners) -> Synthesize PROJECT.md
   - Parallel tracks: Implementation Track (Milestones M1, M2, M3) & E2E Testing Track
   - For each milestone: Explorer -> Worker -> Reviewer -> Challenger -> Auditor -> Gate
   - Final milestone: E2E test verification + build check + git push
3. **On failure**: Retry -> Replace -> Skip -> Redistribute -> Redesign
4. **Succession**: At 16 spawns, write handoff.md, spawn successor
- **Work items**:
  1. Survey & Codebase mapping [in-progress]
  2. M1: Window of Availability Scheduling (Prisma, DB Push, Admin CRUD, Student Restrictions & Countdown) [pending]
  3. M2: Student Realtime Progress Synchronization API & Runner Hook [pending]
  4. M3: Realtime Live Proctor & Gamified Leaderboard ala Quizizz (/admin/exams/[quizId]/proctor) [pending]
  5. M4: Final Integration, E2E Verification, Build & GitHub Push [pending]
- **Current phase**: 0 (Survey)
- **Current focus**: Codebase survey and project mapping

## 🔒 Key Constraints
- NEVER write source code directly (dispatch-only orchestrator).
- Custom UI Dialogs Standard: useDialog from @/components/ui/DialogProvider, NEVER native alert/confirm/prompt.
- 100% Mobile responsiveness (< 640px).
- Mandatory build verification (`npm run build`).
- Git commit and push to main.
- Never reuse subagents after handoff.
- Binary veto on Forensic Auditor violations.

## Current Parent
- Conversation ID: 65e4582e-df31-4643-97dc-e6348751e026
- Updated: 2026-08-30T01:48:12+07:00

## Key Decisions Made
- Starting survey with 3 parallel explorers to map Prisma schema, Admin exam management, Student exam runner, and live proctor architecture.

## Team Roster
| Agent | Type | Work Item | Status | Conv ID |
|-------|------|-----------|--------|---------|

## Succession Status
- Succession required: no
- Spawn count: 0 / 16
- Pending subagents: none
- Predecessor: none
- Successor: not yet spawned

## Active Timers
- Heartbeat cron: task-9
- Safety timer: none

## Artifact Index
- c:\UBIG\VeloNet\.agents\ORIGINAL_REQUEST.md — Original specification
- c:\UBIG\VeloNet\.agents\orchestrator_2\plan.md — Orchestration plan
- c:\UBIG\VeloNet\.agents\orchestrator_2\progress.md — Liveness & status tracking
- c:\UBIG\VeloNet\PROJECT.md — Global project plan and milestones
