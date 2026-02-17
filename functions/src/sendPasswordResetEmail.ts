import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { getAuth } from "firebase-admin/auth";
import { getApps } from "firebase-admin/app";
import { initializeApp } from "firebase-admin/app";

if (getApps().length === 0) {
  initializeApp();
}

const sendgridApiKeySecret = defineSecret("SENDGRID_API_KEY");

const RESET_CONTINUE_URL = "https://insytiq.ai/auth";

export const sendCustomPasswordReset = onCall(
  {
    secrets: [sendgridApiKeySecret],
  },
  async (req) => {
    const email = typeof req.data?.email === "string" ? req.data.email.trim() : "";
    if (!email) {
      throw new HttpsError("invalid-argument", "Email is required.");
    }

    const auth = getAuth();
    let link: string;
    try {
      link = await auth.generatePasswordResetLink(email, {
        url: RESET_CONTINUE_URL,
        handleCodeInApp: false,
      });
    } catch (err: any) {
      const code = err?.code;
      if (code === "auth/user-not-found") {
        throw new HttpsError("not-found", "No account found with this email.");
      }
      throw new HttpsError("internal", "Could not generate reset link. Please try again.");
    }

    const apiKey = sendgridApiKeySecret.value();
    if (!apiKey) {
      throw new HttpsError("failed-precondition", "Email service is not configured. Please try again later.");
    }

    const msg = {
      to: email,
      from: {
        email: "no-reply@insytiq.ai",
        name: "INSYTIQ.AI",
      },
      subject: "Reset your INSYTIQ.AI password",
      html: `
        <p>Hello,</p>
        <p>Click the link below to reset your INSYTIQ.AI password:</p>
        <p><a href="${link}" style="color:#c0257a;font-weight:600;">Reset your password</a></p>
        <p>If you didn't request this, you can ignore this email.</p>
        <p>Thanks,<br/>INSYTIQ.AI team</p>
      `,
    };

    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ personalizations: [{ to: [{ email }] }], from: msg.from, subject: msg.subject, content: [{ type: "text/html", value: msg.html }] }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("SendGrid error:", res.status, text);
      throw new HttpsError("internal", "Could not send reset email. Please try again later.");
    }

    return { success: true };
  }
);
