# Changesets

This folder is managed by [`@changesets/cli`](https://github.com/changesets/changesets). When a PR introduces a user-visible change, add a changeset describing it:

```bash
npx changeset
```

The CLI prompts for the bump type (`patch` / `minor` / `major`) and a short summary, then writes a markdown file in this directory. Commit it alongside your PR.

When the PR lands on `main`, the Release workflow either:

1. Opens or updates a **Version Packages** PR that consumes the changesets, bumps `package.json`, and updates `CHANGELOG.md`, **or**
2. If the Version Packages PR is already open and you merged it, runs `npm publish` to ship the new version.

See [`docs/common-questions.md`](https://github.com/changesets/changesets/blob/main/docs/common-questions.md) in the changesets repo for the full reference.
