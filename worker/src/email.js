// Email sender. Primary provider: Resend (https://resend.com).
// Fallback: log to console (dev only). Production MUST set RESEND_API_KEY and RESEND_FROM.

async function sendViaResend(env, { to, subject, html, text }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.RESEND_FROM || "BookVoice <noreply@eugenemierak.com>",
      to: [to],
      subject,
      html,
      text,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`resend_${res.status}: ${body.slice(0, 200)}`);
  }
}

export async function sendEmail(env, payload) {
  if (!payload?.to || !payload?.subject) {
    throw new Error("email_missing_fields");
  }
  if (env.RESEND_API_KEY) {
    try {
      await sendViaResend(env, payload);
      return { ok: true, provider: "resend" };
    } catch (err) {
      console.error("email_resend_error", err?.message || err);
      if (env.ALLOW_EMAIL_FALLBACK === "true") {
        console.log("[EMAIL fallback]", payload.to, payload.subject, "\n", payload.text || payload.html);
        return { ok: true, provider: "fallback-log" };
      }
      throw err;
    }
  }
  // No provider configured → log (dev only)
  console.log("[EMAIL stub — no provider]", payload.to, payload.subject, "\n", payload.text || payload.html);
  return { ok: true, provider: "stub" };
}

export function renderPasswordResetEmail(displayName, resetUrl) {
  const safeName = (displayName || "there").replace(/[<>]/g, "");
  const text = `Hi ${safeName},

Someone asked to reset the password for your BookVoice account.

If this was you, open this link (valid for 1 hour):
${resetUrl}

If this wasn't you, ignore this email — your password stays the same.

— BookVoice
`;
  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;background:#0b0b0f;color:#f5f5f7;padding:24px">
<div style="max-width:560px;margin:0 auto;background:#131319;border-radius:16px;padding:32px;border:1px solid #1f1f27">
<h2 style="color:#2dd4bf;margin:0 0 16px">Reset your BookVoice password</h2>
<p>Hi ${safeName},</p>
<p>Someone asked to reset the password for your account. If this was you, click the button below (valid for <strong>1 hour</strong>).</p>
<p><a href="${resetUrl}" style="display:inline-block;background:#2dd4bf;color:#0b0b0f;font-weight:700;padding:12px 20px;border-radius:10px;text-decoration:none">Reset password</a></p>
<p style="color:#7c7c88;font-size:13px">Or copy this link:<br><code style="color:#2dd4bf">${resetUrl}</code></p>
<p style="color:#7c7c88;font-size:13px">If this wasn't you, ignore this email.</p>
</div></body></html>`;
  return { text, html };
}

export function renderPurchaseReceiptEmail({ displayName, chapterTitle, amountLabel, readUrl, coverUrl, baseUrl }) {
  const safeName = (displayName || "there").replace(/[<>]/g, "");
  const safeTitle = (chapterTitle || "Chapter").replace(/[<>]/g, "");
  const price = amountLabel || "€11.99";
  const subject = `Your chapter is ready — ${safeTitle}`;
  const text = `Hi ${safeName},

Thank you for your purchase.

Chapter: ${safeTitle}
Amount: ${price}
Author: Eugene Mierak

Open the chapter any time:
${readUrl}

Your library is saved in your account. Sign in from any device and keep reading where you left off.

— BookVoice
`;
  const cover = coverUrl || `${baseUrl || "https://book.eugenemierak.com"}/covers/frequency-vibes.jpg`;
  const html = `<!doctype html><html><body style="font-family:'Cormorant Garamond',Georgia,serif;background:#0b0b0f;color:#ebe1d2;padding:24px;margin:0">
<div style="max-width:560px;margin:0 auto;background:linear-gradient(180deg,#1c1712,#0e0b09);border-radius:16px;padding:40px 32px;border:1px solid rgba(201,169,97,0.25)">
  <div style="text-align:center;color:#d4a866;font-size:11px;letter-spacing:0.3em;text-transform:uppercase;margin-bottom:20px;font-family:'Manrope',sans-serif">Purchase complete</div>
  <div style="text-align:center;margin-bottom:24px">
    <img src="${cover}" alt="${safeTitle}" style="width:120px;height:150px;object-fit:cover;border-radius:6px;border:1px solid rgba(201,169,97,0.3);display:inline-block" />
  </div>
  <h1 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:28px;color:#ebe1d2;text-align:center;margin:0 0 8px;font-weight:600">The chapter is yours.</h1>
  <p style="font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;color:#bdafa0;text-align:center;margin:0 0 24px;font-size:16px">Thank you, ${safeName}. Your library has grown.</p>
  <div style="border-top:1px dashed rgba(201,169,97,0.2);padding:14px 0;display:flex;justify-content:space-between;font-family:'Manrope',sans-serif;color:#bdafa0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase">
    <span>Chapter</span><strong style="color:#ebe1d2;font-family:'Cormorant Garamond',Georgia,serif;font-size:15px;letter-spacing:0;text-transform:none">${safeTitle}</strong>
  </div>
  <div style="border-top:1px dashed rgba(201,169,97,0.2);padding:14px 0;display:flex;justify-content:space-between;font-family:'Manrope',sans-serif;color:#bdafa0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase">
    <span>Author</span><strong style="color:#ebe1d2;font-family:'Cormorant Garamond',Georgia,serif;font-size:15px;letter-spacing:0;text-transform:none">Eugene Mierak</strong>
  </div>
  <div style="border-top:1px dashed rgba(201,169,97,0.2);border-bottom:1px dashed rgba(201,169,97,0.2);padding:14px 0;margin-bottom:24px;display:flex;justify-content:space-between;font-family:'Manrope',sans-serif;color:#bdafa0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase">
    <span>Amount</span><strong style="color:#ebe1d2;font-family:'Cormorant Garamond',Georgia,serif;font-size:15px;letter-spacing:0;text-transform:none">${price}</strong>
  </div>
  <div style="text-align:center;margin-bottom:16px">
    <a href="${readUrl}" style="display:inline-block;background:#d4a866;color:#1a1310;font-family:'Manrope',sans-serif;font-weight:700;padding:14px 32px;border-radius:999px;text-decoration:none;font-size:12px;letter-spacing:0.14em;text-transform:uppercase">Start reading</a>
  </div>
  <p style="text-align:center;color:rgba(189,175,160,0.6);font-size:11px;font-family:'Manrope',sans-serif;margin:0">Sign in from any device to pick up where you left off.</p>
</div>
</body></html>`;
  return { subject, html, text };
}

export function renderPurchaseReminderEmail({ displayName, chapterTitle, readUrl }) {
  const safeName = (displayName || "there").replace(/[<>]/g, "");
  const safeTitle = (chapterTitle || "your chapter").replace(/[<>]/g, "");
  const subject = `${safeTitle} is waiting for you`;
  const text = `Hi ${safeName},

You bought ${safeTitle} a few days ago and we noticed you haven't opened it yet.

Open it here:
${readUrl}

Eugene narrates each chapter himself — give it a listen while you read.

— BookVoice
`;
  const html = `<!doctype html><html><body style="font-family:'Cormorant Garamond',Georgia,serif;background:#0b0b0f;color:#ebe1d2;padding:24px;margin:0">
<div style="max-width:520px;margin:0 auto;background:linear-gradient(180deg,#1c1712,#0e0b09);border-radius:16px;padding:36px 28px;border:1px solid rgba(201,169,97,0.25)">
  <h1 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:26px;color:#ebe1d2;margin:0 0 12px;font-weight:600">${safeTitle} is waiting.</h1>
  <p style="font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;color:#bdafa0;margin:0 0 20px;font-size:15px">Hi ${safeName}, you unlocked this chapter a few days ago. Open it when the moment feels right.</p>
  <div style="text-align:center;margin-bottom:8px">
    <a href="${readUrl}" style="display:inline-block;background:#d4a866;color:#1a1310;font-family:'Manrope',sans-serif;font-weight:700;padding:14px 28px;border-radius:999px;text-decoration:none;font-size:12px;letter-spacing:0.14em;text-transform:uppercase">Open the chapter</a>
  </div>
  <p style="text-align:center;color:rgba(189,175,160,0.55);font-size:11px;font-family:'Manrope',sans-serif;margin:14px 0 0">Eugene narrates each chapter himself — listen while you read.</p>
</div>
</body></html>`;
  return { subject, html, text };
}

export function renderRegisterReminderEmail({ displayName, checkoutUrl }) {
  const safeName = (displayName || "there").replace(/[<>]/g, "");
  const subject = `Your BookVoice account is ready`;
  const text = `Hi ${safeName},

You created a BookVoice account but haven't unlocked a chapter yet.

Eugene's first chapter is narrated in his own voice — start here:
${checkoutUrl}

— BookVoice
`;
  const html = `<!doctype html><html><body style="font-family:'Cormorant Garamond',Georgia,serif;background:#0b0b0f;color:#ebe1d2;padding:24px;margin:0">
<div style="max-width:520px;margin:0 auto;background:linear-gradient(180deg,#1c1712,#0e0b09);border-radius:16px;padding:36px 28px;border:1px solid rgba(201,169,97,0.25)">
  <h1 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:26px;color:#ebe1d2;margin:0 0 12px;font-weight:600">Ready when you are, ${safeName}.</h1>
  <p style="font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;color:#bdafa0;margin:0 0 20px;font-size:15px">Eugene narrates every chapter himself. Give your first one a listen while you read — it's a different kind of book.</p>
  <div style="text-align:center">
    <a href="${checkoutUrl}" style="display:inline-block;background:#d4a866;color:#1a1310;font-family:'Manrope',sans-serif;font-weight:700;padding:14px 28px;border-radius:999px;text-decoration:none;font-size:12px;letter-spacing:0.14em;text-transform:uppercase">Explore the catalog</a>
  </div>
</div>
</body></html>`;
  return { subject, html, text };
}

export function renderEmailVerificationEmail(displayName, verifyUrl) {
  const safeName = (displayName || "there").replace(/[<>]/g, "");
  const text = `Hi ${safeName},

Welcome to BookVoice. Please verify your email to finish setting up your account:

${verifyUrl}

This link is valid for 24 hours.

— BookVoice
`;
  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;background:#0b0b0f;color:#f5f5f7;padding:24px">
<div style="max-width:560px;margin:0 auto;background:#131319;border-radius:16px;padding:32px;border:1px solid #1f1f27">
<h2 style="color:#2dd4bf;margin:0 0 16px">Welcome to BookVoice</h2>
<p>Hi ${safeName},</p>
<p>Please confirm this is your email to finish setting up your account.</p>
<p><a href="${verifyUrl}" style="display:inline-block;background:#2dd4bf;color:#0b0b0f;font-weight:700;padding:12px 20px;border-radius:10px;text-decoration:none">Verify email</a></p>
<p style="color:#7c7c88;font-size:13px">Or copy this link:<br><code style="color:#2dd4bf">${verifyUrl}</code></p>
</div></body></html>`;
  return { text, html };
}
