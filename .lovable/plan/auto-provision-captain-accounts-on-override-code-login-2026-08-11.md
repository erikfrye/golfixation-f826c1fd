# Auto-provision captain accounts on override-code login

## The problem

The override-code path calls the admin API to generate a magic-link token for the captain's email. That call only works for an email that already has an account — for a brand-new captain it fails, so the code appears "invalid" the very first time they try it. The email-code path works because it is explicitly allowed to create the user.

Confirmed in the code: `redeemOverrideCodeHandler` in `src/lib/captain.functions.ts` goes straight to `generateLink({ type: "magiclink" })`, while `src/routes/login.tsx` uses `shouldCreateUser: true` for the email flow.

## Is auto-creating accounts safe here?

Yes, with the current guardrails. The override flow already requires two things before anything is created:
- a valid tournament override code, and
- an email that the admin has already registered as a team captain on that tournament.

So an account is only ever created for an email an admin already put in the system. We are not opening self-serve signup. Every attempt (success or failure) is still written to the redemption log.

Two deliberate choices:
- Create the account only at redemption time, not when a team is imported. Importing 200 teams should not create 200 dormant accounts, and admins routinely fix typos in captain emails after import.
- Mark the created account as email-confirmed. The admin vouched for the address, and the captain has no password to set.

## What changes

`src/lib/captain.functions.ts` — inside `redeemOverrideCodeHandler`, after the team check passes and before generating the link:
1. Look up the email in the auth users list.
2. If absent, create the user with `admin.createUser({ email, email_confirm: true })`, tagging metadata so we know it came from an override redemption.
3. If creation fails because the user already exists (race), continue.
4. Then generate the magic-link token exactly as today.

Failures at this step get logged to `override_code_redemptions` with `failure_reason: "user_provision_failed"`, same shape as the existing failure branches.

No UI change, no schema change.

## Tests

`src/lib/__tests__/captain.functions.test.ts` — extend the admin mock with `createUser` / user-lookup stubs and add cases:
- new email: user is created, then the token is returned
- existing email: no create call, token returned
- create fails: throws and writes a failure redemption row
