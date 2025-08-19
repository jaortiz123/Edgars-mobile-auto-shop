## Agent Guardrails

- **Work only in feature branches**: `feature/cursor/<slug>`
- **Max changes per PR**: 8 files / 300 LOC
- **Print intended touch-paths before editing**
- **Abort if paths overlap an open PR**
- **No API/DB schema changes unless task specifies**
- **No secrets in code or logs**; redact `email`, `phone`, `JWT` in logs
- **Off-limits**: `/api/payments/*`
