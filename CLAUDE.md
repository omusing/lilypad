# Lilypad

## Project Specs

All project specifications live in [`specs/`](specs/). Start with the index:

- [specs/README.md](specs/README.md) — index and overview
- [specs/01-vision.md](specs/01-vision.md) — project vision, goals, target users
- [specs/02-features.md](specs/02-features.md) — feature specifications
- [specs/03-architecture.md](specs/03-architecture.md) — tech stack, folder structure, patterns
- [specs/04-design-system.md](specs/04-design-system.md) — colors, typography, components

## Writing conventions

- Never use em dashes (—) anywhere: in code, comments, specs, copy, or commit messages.
- Use a regular hyphen (-) as a word or sentence separator instead.

## Design decisions and spec discipline

`specs/` is the source of truth. gstack design docs in `~/.gstack/` are working notes only.

Any session that evaluates alternatives and selects one must produce two outputs before it is done:
1. An ADR in `specs/decisions/` documenting the options considered and the choice made.
2. Updated spec file(s) reflecting the selected option.

This applies regardless of which skill is running or what artifacts that skill generates.
The session is not done until the specs are current.

## Dev Commands

```bash
npx expo start        # start dev server (try Expo Go first)
npx expo start --ios  # iOS simulator
npx expo lint         # lint
```

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
