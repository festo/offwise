# Architecture Decision Records

Short records of decisions that shape the stack or architecture (e.g. choice of ORM, auth approach).

- File name: `NNNN-<kebab-title>.md`, numbered sequentially (`0001-...`).
- An ADR always states the decision as it currently stands. When a decision changes, edit the ADR in place: rewrite its Context, Decision and Consequences so they read as one current decision, and set `Updated` to the date of the change. Do not write superseding ADRs or keep the old decision in the text; `git log -p docs/decisions/<file>` shows how a decision evolved.
- A new decision that does not change an existing one gets a new ADR with the next number.
- A decision that is dropped entirely is marked `Withdrawn`, with a sentence saying why; its number is never reused.
- When an ADR changes, update the docs that restate it (`CLAUDE.md` files, specs, agent definitions) in the same change.

## Template

    # NNNN: <Title>

    **Status:** Proposed | Accepted | Withdrawn
    **Date:** YYYY-MM-DD
    **Updated:** YYYY-MM-DD (omit until the decision first changes)

    ## Context
    What forces us to decide, and what constraints apply.

    ## Decision
    What we chose.

    ## Consequences
    What gets easier, what gets harder, what we must now do.

## Open decisions

- None currently.
