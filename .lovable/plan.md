# 6-digit login codes

Good catch — the backend does expose an "Email OTP length" setting, so we don't need to build a custom code system. This is a two-part change: one setting you flip, one small code change I make.

## Step 1 — You: set the code length

In your project's backend settings (Cloud -> Users -> Auth settings -> One-time codes), set **Email OTP length** to `6`. Optionally confirm the OTP expiry there too.

## Step 2 — Me: match the app to 6 digits

- `src/routes/login.tsx`: change `OTP_LENGTH` from 8 to 6 and drop the two extra `InputOTPSlot`s so the input renders six boxes. Auto-submit still fires when six digits are entered.
- `src/lib/email-templates/magic-link.tsx`: no structural change needed (it prints whatever code the backend sends), but I'll tighten the code block's letter-spacing so a 6-digit code stays centered and doesn't look stretched.
- `docs/quick-start-guide.md`: update any wording that says 8-digit code.

## Notes

- Existing codes already emailed at 8 digits stop working after the switch; anyone mid-login just requests a new code.
- No database or auth-flow changes, and the magic-link button in the email keeps working exactly as it does today.
- If the setting won't accept 6 for some reason, tell me and I'll fall back to keeping 8 rather than hand-rolling a custom code table.
