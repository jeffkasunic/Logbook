# Logbook

A React + TypeScript web app version of the original Logbook spreadsheet: a daily time log by
category, weekly goals, and a quarterly plan.

**Try it:** https://jeffkasunic.com/logbook

New users start with an empty current quarter; **Settings → Load sample data** fills it with made-up examples.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # static site in dist/
npm run typecheck
```

This uses the hosted Cognito and API backend. To run against your own, change the
constants at the top of `src/lib/auth.ts` and `src/lib/api.ts` and deploy `lambda/`.

## Structure

```
src/
  types.ts            data model (Quarter, Category, DayEntry, …)
  Session.tsx         sign-in and first load, then renders the app
  store.tsx           reducer + context; sends each change to the API
  lib/auth.ts         Cognito hosted sign-in (code flow + PKCE)
  lib/api.ts          calls to the Logbook API
  data/sample.ts      made-up example data for "Load sample data"
  lib/dates.ts        UTC-safe ISO date helpers, 13-week quarters
  lib/calc.ts         totals, weekly sums, stats, hours parsing
  lib/colors.ts       category colours and goal heat steps
  components/         DailyLog, WeeklySummary, WeeklyChart,
                      QuarterStrip, PlanView, PlanSections, SetupView (Edit tab),
                      SettingsView, Sortable, NumCell
```

## Accounts and data

Anyone can sign up, and each account has its own private log.

AWS services used:

- **Amazon Cognito:** user pool and hosted sign-in page. The app signs in with
  the authorization code flow and PKCE, so there's no client secret
  (`src/lib/auth.ts`).
- **Amazon API Gateway:** HTTP API with a JWT authorizer. It rejects any request
  without a valid Cognito token before the Lambda runs.
- **AWS Lambda:** one Node.js function for the whole API (`lambda/index.mjs`). It
  takes the user ID from the verified token, never from the request, so users
  can only reach their own data.
- **Amazon DynamoDB:** one table, `logbook`, partitioned by user ID. Each quarter
  and each day is its own item, so an edit saves only what changed.

