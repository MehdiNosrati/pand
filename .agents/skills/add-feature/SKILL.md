---
name: add-feature
description: Step-by-step runbook for adding a full-stack feature in a Pand project.
---

# Add Feature Runbook

1. **Scaffold Entity & Routes**:
   Run `pand add entity <service> <Entity> --fields "<fieldDsl>" --web` (add `--ios` / `--android` if mobile apps are enabled).
2. **Customize Backend & Web UI**:
   - Edit `services/<service>/src/routes/<plural-kebab>.ts` for custom validation or domain rules.
   - Edit `apps/web/src/routes/<plural-kebab>.tsx` using **Methane UI** (`@methane-ui/ui/*` components like `<mth-card>`, `<mth-dialog>`, `<mth-button>`, `onmth-*` events, `.mth-*` layouts, and `--mth-*` tokens).
3. **Generate Migrations & Regenerate SDK**:
   Run `pand db generate && pand sdk gen`.
4. **Apply Migrations & Verify**:
   Run `pand db migrate && pand check`.
