# Architecture Decision Records

Short records of decisions that shape the stack or architecture (e.g. choice of ORM, auth approach).

- File name: `NNNN-<kebab-title>.md`, numbered sequentially (`0001-...`).
- Never edit an accepted ADR's decision; supersede it with a new ADR and mark the old one `Superseded by NNNN`.

## Template

    # NNNN: <Title>

    **Status:** Proposed | Accepted | Superseded by NNNN
    **Date:** YYYY-MM-DD

    ## Context
    What forces us to decide, and what constraints apply.

    ## Decision
    What we chose.

    ## Consequences
    What gets easier, what gets harder, what we must now do.

## Open decisions

- ORM for PostgreSQL: decide before the first schema work.
