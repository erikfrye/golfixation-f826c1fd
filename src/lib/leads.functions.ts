import { createServerFn } from "@tanstack/react-start";

export const submitLead = createServerFn({ method: "POST" })
  .inputValidator((input: { name: string; email: string }) => {
    const name = (input?.name ?? "").trim();
    const email = (input?.email ?? "").trim().toLowerCase();
    if (name.length < 2 || name.length > 100) throw new Error("Please enter your name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 200)
      throw new Error("Please enter a valid email address.");
    return { name, email };
  })
  .handler(async ({ data }) => {
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    await sendTemplateEmail("lead-inquiry", "erikfrye@gmail.com", {
      templateData: { name: data.name, email: data.email },
      replyTo: data.email,
      idempotencyKey: `lead-inquiry-${data.email}-${new Date().toISOString().slice(0, 13)}`,
    });
    return { ok: true };
  });
