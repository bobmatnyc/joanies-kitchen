# Joanie's Kitchen Go-Live Plan

**Public beta: Monday 2027-02-01 (goal G16).**
**Last updated:** 2026-10-28

The beta go/no-go checklist. The schedule is in [ROADMAP.md](ROADMAP.md). Every item must be done before sign-up opens. Items owned by Bob are marked.

## Sign-up safety gate (M1)

- [ ] #55 Error monitoring and alerting
- [ ] #56 `/api/health` and uptime checks
- [x] #57 Daily cost ceiling, with alert and hard stop
- [ ] #17 Rate limit on public semantic search
- [ ] #58 Account deletion and data export
- [ ] #59 Content reporting and moderation queue

## Foundation (M0)

- [ ] #54 CI and branch protection (branch protection: Bob)
- [ ] #9 / #7 Baseline migration (decision: Bob)
- [ ] #60 Staging
- [ ] #24 Model constant (retired OpenRouter model)
- [ ] #34 `reorderPhotos`
- [ ] #35 Support mailbox
- [ ] #38 Hero slideshow
- [ ] #26 Test-artifact history
- [ ] Neon backup and restore drill, with restore time recorded (issue to file)

## Already done

- [x] `/privacy` and `/terms` pages (#29)
- [x] Auth.js with Clerk removed (#21 / #22)
- [x] Server-action auth (#13 / #37)
- [x] Private-recipe visibility (#32 / #41)
- [x] `createRecipe` field allowlist (#33)
- [x] Search fix (#47)

## Rollback plan

1. Vercel instant rollback to the previous production deployment.
2. Revert the PR and redeploy.
3. Neon point-in-time restore for data problems.

Restore retention depends on the Neon plan. To verify: the plan's retention window.

## Launch-day steps

1. Confirm every item above is checked.
2. Promote the launch build from staging to production.
3. Check `/api/health`, sign-in and the uptime checks.
4. Confirm the cost ceiling and alerts are live.
5. Flip the sign-up gate.
