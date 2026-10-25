---
name: add-feature
description: Step-by-step runbook for adding a full-stack feature in a Pand project.
---

# Add Feature Runbook

1. **Scaffold Entity & Routes**:
   Run `pand add entity <service> <Entity> --fields "<fieldDsl>" --web` (add `--ios` / `--android` if mobile apps are enabled).
2. **Customize Business Logic**:
   Edit `services/<service>/src/routes/<plural-kebab>.ts` to add custom validation or domain rules.
3. **Generate Migrations & Regenerate SDK**:
   Run `pand db generate && pand sdk gen`.
4. **Apply Migrations & Verify**:
   Run `pand db migrate && pand check`.
