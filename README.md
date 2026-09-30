# Revanoq

Freight cost intelligence for modern supply chains.

## MVP architecture

Revanoq is deliberately built as a small, solo-founder-friendly stack:

- Next.js 16 App Router
- Supabase Auth + Postgres
- Row Level Security for workspace isolation
- No microservices
- No ERP/TMS integrations in the first pilot

## Core flow

```text
carrier invoice + shipment data + contract/rate rules
                         |
                         v
                      Revanoq
                         |
                         v
                 audit run + findings
                         |
                         v
                evidence-backed dispute
```

## Database model

- workspaces
- workspace_memberships
- carriers
- contracts
- rate_rules
- shipments
- invoices
- invoice_lines
- audit_runs
- audit_findings
- disputes

All workspace-scoped data is protected with Row Level Security.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Add the Supabase publishable key from the Revanoq project's Connect dialog.
3. Run `npm install`.
4. Run `npm run dev`.

Never commit a Supabase secret or service-role key.

## Current scope

This foundation does not yet implement invoice parsing, contract parsing,
rate calculation, file storage, or dispute sending. Those are the next MVP layer.
