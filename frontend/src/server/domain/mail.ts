import "server-only";
import { Resend } from "resend";
import { missing, optional } from "@/server/env";
import type { ComposedResponse } from "@/server/domain/compose";

/**
 * The email hand-off (PRODUCT.md: "built to be handed over").
 * Renders the *same* composed payload `/result` shows — text plus themed
 * route-insert HTML (DESIGN.md map stock) — and sends it through Resend.
 * Code-rendered on purpose: Resend template variables cap at 2,000 chars
 * and 50 vars, which a 60-day itinerary blows past (see plan/schema
 * MAX_DAYS). The matching Resend template `triptribe-itinerary` exists for
 * preview/manual sends only. Without `RESEND_API_KEY` the caller is told
 * plainly, not failed opaquely.
 */

export const isMailConfigured = (): boolean => !missing("RESEND_API_KEY");

const fromAddress = (): string =>
  optional("RESEND_FROM") ?? "TripTribe <onboarding@resend.dev>";

const planText = (plan: ComposedResponse): string => {
  const lines: string[] = [
    `Your ${plan.trip.days}-day plan for ${plan.city.name}`,
    "",
    plan.city.description,
    "",
  ];
  for (const day of plan.itinerary) {
    lines.push(`Day ${day.day} — ${day.weekday ?? ""}`);
    for (const stop of day.activities) {
      lines.push(`  ${stop.arriveAt}–${stop.departAt} ${stop.place}`);
      if (stop.description) lines.push(`    ${stop.description}`);
    }
    for (const role of ["breakfast", "lunch", "dinner"] as const) {
      const meal = day.meals[role];
      if (meal) lines.push(`  ${role}: ${meal.place}`);
    }
    lines.push("");
  }
  lines.push(`Estimated total: ${plan.Budget.total} (${plan.Budget.currency})`);
  if (plan.Tips.length) {
    lines.push("", "Tips:");
    for (const tip of plan.Tips) lines.push(`- ${tip}`);
  }
  lines.push(
    "",
    "Every figure above is an estimate, not a booking or a quote.",
  );
  return lines.join("\n");
};

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const planHtml = (plan: ComposedResponse): string => {
  // Route-insert on map stock (DESIGN.md): vermilion band, prussian CTA
  // colour, dashed route dividers. Table layout + inline styles only.
  const days = plan.itinerary
    .map(
      (day) => `
      <h2 style="margin:20px 0 8px;font-size:20px;line-height:24px;font-weight:700;letter-spacing:0.04em;color:#14181c;">DAY ${day.day} — ${escapeHtml((day.weekday ?? "").toUpperCase())}</h2>
      <ul style="margin:0 0 8px;padding-left:20px;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:14px;line-height:22px;color:#14181c;">
        ${day.activities
          .map(
            (stop) => `
          <li><strong>${escapeHtml(String(stop.arriveAt))}–${escapeHtml(String(stop.departAt))} ${escapeHtml(stop.place)}</strong>${
            stop.description ? ` — ${escapeHtml(stop.description)}` : ""
          }</li>`,
          )
          .join("")}
        ${(["breakfast", "lunch", "dinner"] as const)
          .map((role) => {
            const meal = day.meals[role];
            return meal ? `<li>${role}: <strong>${escapeHtml(meal.place)}</strong></li>` : "";
          })
          .join("")}
      </ul>`,
    )
    .join("");
  const tips = plan.Tips.length
    ? `<h2 style="margin:20px 0 8px;font-size:20px;line-height:24px;font-weight:700;letter-spacing:0.04em;color:#14181c;">TIPS</h2><ul style="margin:0;padding-left:20px;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:14px;line-height:22px;color:#14181c;">${plan.Tips.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>`
    : "";
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Your ${plan.trip.days}-day plan for ${escapeHtml(plan.city.name)}</title></head>
<body style="margin:0;padding:0;background-color:#e7e6e0;">
  <p style="margin:12px 0 0;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:14px;line-height:21px;color:#3d454c;">Estimated total: <strong>${escapeHtml(plan.Budget.total ?? "")} (${escapeHtml(plan.Budget.currency)})</strong></p>
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background-color:#efeee9;border:1px solid rgba(20,24,28,0.16);border-radius:4px;overflow:hidden;font-family:'Barlow Semi Condensed','Arial Narrow',Arial,sans-serif;">
<tr><td style="height:8px;background-color:#b8341a;">&nbsp;</td></tr>
<tr><td style="padding:24px 32px 0;">
  <p style="margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:0.16em;color:#b8341a;">ROUTE INSERT — ${plan.trip.days} DAYS</p>
  <h1 style="margin:0 0 8px;font-size:32px;line-height:34px;font-weight:700;color:#14181c;">Your plan for ${escapeHtml(plan.city.name)}</h1>
  <p style="margin:0;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:14px;line-height:21px;color:#3d454c;">${escapeHtml(plan.city.description)}</p>
</td></tr>
<tr><td style="padding:20px 32px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:2px dashed rgba(20,24,28,0.34);font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>
<tr><td style="padding:4px 32px 0;">${days}${tips}</td></tr>
<tr><td style="padding:24px 32px 28px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:2px dashed rgba(20,24,28,0.34);font-size:0;line-height:0;">&nbsp;</td></tr></table>
  <p style="margin:16px 0 0;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:12px;line-height:19px;color:#525a61;"><em>Every figure above is an estimate, not a booking or a quote.</em></p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
};

export const sendPlanEmail = async ({
  to,
  plan,
}: {
  to: string;
  plan: ComposedResponse;
}): Promise<{ id: string }> => {
  const key = optional("RESEND_API_KEY");
  if (!key) throw new Error("RESEND_API_KEY is not configured");
  const resend = new Resend(key);
  const { data, error } = await resend.emails.send({
    from: fromAddress(),
    to,
    subject: `Your ${plan.trip.days}-day plan for ${plan.city.name}`,
    text: planText(plan),
    html: planHtml(plan),
  });
  if (error) throw new Error(error.message);
  return { id: data?.id ?? "sent" };
};
