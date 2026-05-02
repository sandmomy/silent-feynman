import { sendEmail, renderPurchaseReminderEmail, renderRegisterReminderEmail } from "./email.js";
import { findStaleRegistrations, findStalePurchases, markEmailReminderSent } from "./db.js";

const HOUR_MS = 3600 * 1000;
const DAY_MS = 24 * HOUR_MS;

export async function runReminderCron(env) {
  const base = env.PUBLIC_BASE_URL || "https://book.eugenemierak.com";
  const results = { register_no_purchase: 0, purchase_no_read: 0, errors: 0 };

  try {
    const stale = await findStaleRegistrations(env.DB, 48 * HOUR_MS, 14 * DAY_MS);
    for (const row of stale) {
      try {
        const { subject, html, text } = renderRegisterReminderEmail({
          displayName: row.display_name || row.username,
          checkoutUrl: base,
        });
        await sendEmail(env, { to: row.email, subject, html, text });
        await markEmailReminderSent(env.DB, row.username, "register_no_purchase_48h");
        results.register_no_purchase += 1;
      } catch (err) {
        console.error("register_reminder_failed", row.username, err?.message || err);
        results.errors += 1;
      }
    }
  } catch (err) {
    console.error("register_reminder_query_failed", err?.message || err);
    results.errors += 1;
  }

  try {
    const stalePurchases = await findStalePurchases(env.DB, 72 * HOUR_MS, 14 * DAY_MS);
    for (const row of stalePurchases) {
      try {
        const book = await env.DB.prepare(`SELECT slug, title FROM books WHERE book_id = ?`)
          .bind(row.book_id)
          .first();
        if (!book) continue;
        const readUrl = `${base}/library/${encodeURIComponent(book.slug)}?read=1`;
        const { subject, html, text } = renderPurchaseReminderEmail({
          displayName: row.display_name || row.username,
          chapterTitle: book.title,
          readUrl,
        });
        await sendEmail(env, { to: row.email, subject, html, text });
        await markEmailReminderSent(env.DB, row.username, "purchase_no_read_72h", row.book_id);
        results.purchase_no_read += 1;
      } catch (err) {
        console.error("purchase_reminder_failed", row.username, row.book_id, err?.message || err);
        results.errors += 1;
      }
    }
  } catch (err) {
    console.error("purchase_reminder_query_failed", err?.message || err);
    results.errors += 1;
  }

  return results;
}
