---
name: Workspace dependency relinking
description: A pnpm/Expo workspace quirk encountered when removing an unused native dependency.
---

After removing a workspace dependency, run a frozen forced pnpm install before judging the Expo preview; otherwise Metro can retain broken peer links even when TypeScript passes.

**Why:** A managed dependency removal left the Expo preview unable to resolve `expo` from `expo-router` until the workspace links were rebuilt.

**How to apply:** Use the package-management workflow for dependency changes, then perform a frozen forced reinstall and restart the affected workflows before preview verification.