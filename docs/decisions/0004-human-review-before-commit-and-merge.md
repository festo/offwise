# 0004: Human review before every commit and merge

**Status:** Accepted
**Date:** 2026-10-13

## Context
Most code in this repo is written by AI agents (Claude Code with Superpowers and the `frontend` and `backend` agents). Their default workflows stage and commit their own changes, and could push and merge them. We want a person to have read every change before it enters history, and no change to reach `main` without a human decision.

## Decision
1. **Agents never stage.** Agents do not change the git index: no `git add`, `git rm` (without `--cached` too), `git mv`, `git commit -a`/`--all`, `git commit <paths>`, `git stash`, `git restore --staged`, `git reset` of the index, or anything else that stages or unstages files. When a unit of work is done, the agent stops and hands over an unstaged working tree with a summary: the files changed and why, and the verification commands it ran with their results.
2. **A human reviews and stages.** A person reads the diff and stages exactly what they accept (`git add -p` or by file). Staging is the act of approval.
3. **Agents may commit only what is staged.** After the human has staged, an agent may run `git commit` (with a message and the attribution trailer) on the staged set, and must not alter the index first. The human may also commit themselves.
4. **Agents may push feature branches and open PRs; they never merge.** Pushing is allowed only for non-`main` branches whose commits were made under rule 3. Merging any PR into `main` requires an approving review from a human, enforced with GitHub branch protection on `main` (required review, no direct pushes, no bypass for admins). Agents never merge, enable auto-merge, or force-push.

## Consequences
- Agent-driven workflows pause at every commit point. Plans replace "commit" steps with "stop for human review", and `superpowers:subagent-driven-development` implementers report back without committing; the coordinating session waits for the human to stage before committing.
- Tasks should stay small enough that a human can review one diff at a time.
- `CLAUDE.md` and the `frontend` and `backend` agent definitions carry this rule so every session and subagent sees it.
- Commits that existed before this ADR are not re-reviewed by this rule; they are reviewed in their PR like everything else.
- Branch protection on `main` must be configured in GitHub by a repository admin.
- Optional hardening: a Claude Code `PreToolUse` hook in `.claude/settings.json` that blocks index-changing git commands, so the rule does not rely on agents following instructions.
