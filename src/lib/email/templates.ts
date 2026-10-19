export interface StaffInviteVars {
  name: string;
  tempPassword: string;
  schoolName: string;
  loginUrl: string;
}

/** HTML body for a new School Admin / Teacher invite sent from the Super Admin. */
export function staffInviteHtml(v: StaffInviteVars): string {
  return `
<!DOCTYPE html>
<html>
  <body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; color: #111827; padding: 24px;">
    <table role="presentation" width="100%" style="max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
      <tr>
        <td style="background: #1f2937; color: #fff; padding: 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 20px;">ClassForge</h1>
          <p style="margin: 6px 0 0; font-size: 13px; opacity: 0.9;">School Staff Account</p>
        </td>
      </tr>
      <tr>
        <td style="padding: 24px;">
          <h2 style="margin-top: 0; font-size: 18px;">Welcome to ${v.schoolName}</h2>
          <p>Hi <strong>${v.name}</strong>,</p>
          <p>A staff account has been created for you at <strong>${v.schoolName}</strong> by the Super Admin.</p>
          <p style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 16px 0; font-size: 15px; font-family: ui-monospace, SFMono-Regular, monospace; letter-spacing: 0.5px;">
            Temporary password: <strong>${v.tempPassword}</strong>
          </p>
          <p>
            <a href="${v.loginUrl}" style="background: #2563eb; color: #fff; text-decoration: none; padding: 10px 18px; border-radius: 6px; font-weight: 600; display: inline-block;">
              Sign in &amp; set a new password
            </a>
          </p>
          <p style="font-size: 13px; color: #6b7280;">
            This is a one-time temporary password. Change it after you sign in.<br>
            If you didn't request this, you can safely ignore this email.
          </p>
        </td>
      </tr>
      <tr>
        <td style="background: #f9fafb; padding: 16px; text-align: center; font-size: 12px; color: #9ca3af;">
          ClassForge · superadminclassforge@gmail.com
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();
}

/** Plain-text fallback for clients that do not render HTML. */
export function staffInviteText(v: StaffInviteVars): string {
  return `
ClassForge — School Staff Account

Hi ${v.name},

A staff account has been created for you at ${v.schoolName} by the Super Admin.

Temporary password: ${v.tempPassword}

Sign in and set a new password: ${v.loginUrl}

This is a one-time temporary password. Change it after you sign in.
If you didn't request this, you can safely ignore this email.

— ClassForge (superadminclassforge@gmail.com)
  `.trim();
}
