/**
 * Drives a real browser through the frontend.
 *
 *   npm run test:ui
 *
 * A curl of a page cannot tell whether the frontend works, because the auth
 * guard renders a loader until the client-side session store has hydrated — the
 * real content only exists once the page has run in a browser. So this signs
 * in through the actual form, walks the platform and school screens, and fails
 * on any console error, unhandled page error or error boundary.
 *
 * It also exercises the three screens that read the new endpoints, so a
 * frontend that calls an endpoint the backend does not have is caught here
 * rather than by a person clicking around.
 */
import { chromium, type ConsoleMessage, type Page } from "playwright";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const prisma = new PrismaClient();

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const EMAIL = (process.env.SUPER_ADMIN_EMAIL ?? "").trim().toLowerCase();
const PASSWORD = process.env.SUPER_ADMIN_PASSWORD ?? "";

let passed = 0;
let failed = 0;
const consoleErrors: string[] = [];

function check(label: string, condition: boolean, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  \x1b[32mPASS\x1b[0m ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failed += 1;
    console.log(`  \x1b[31mFAIL\x1b[0m ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function section(title: string) {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
}

/** Watches a page for anything that would show up as a broken screen. */
function watch(page: Page) {
  page.on("console", (message: ConsoleMessage) => {
    if (message.type() !== "error") return;
    const text = message.text();
    // A failed fetch for a resource the screen does not need is noise only if
    // it is a 404 for a page asset. Everything else is worth knowing.
    if (text.includes("Download the React DevTools")) return;
    // Chrome reports this when a context is closed mid-request. It is the
    // browser tearing down, not the application failing.
    if (text.includes("ERR_NETWORK_IO_SUSPENDED")) return;
    consoleErrors.push(text);
  });
  page.on("pageerror", (error) => {
    consoleErrors.push(`pageerror: ${error.message}`);
  });
}

/** The error boundary leaves its own text in the document. */
async function hasErrorBoundary(page: Page): Promise<boolean> {
  const body = await page.textContent("body");
  if (!body) return true;
  return (
    body.includes("Application error") ||
    body.includes("Internal Server Error") ||
    body.includes("Unhandled Runtime Error")
  );
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForLoadState("networkidle");
}

/** The access token the browser is holding, for the direct API calls. */
async function accessToken(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  return cookies.find((cookie) => cookie.name === "access_token")?.value ?? "";
}

/** Opens a page and waits for it to settle, then reports what happened. */
async function visit(page: Page, path: string, expect?: string) {
  const before = consoleErrors.length;
  await page.goto(`${BASE_URL}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);

  const status = page.url();
  const body = (await page.textContent("body")) ?? "";
  const broken = await hasErrorBoundary(page);
  const newErrors = consoleErrors.slice(before);

  check(`GET ${path} loads`, !page.url().includes("/login"), `landed on ${new URL(page.url()).pathname}`);
  check(`GET ${path} has no error boundary`, !broken);
  check(`GET ${path} logs no console errors`, newErrors.length === 0, newErrors.join(" | "));

  if (expect) {
    check(`GET ${path} shows "${expect}"`, body.includes(expect), status);
  }

  return body;
}

async function main() {
  if (!EMAIL || !PASSWORD) {
    console.error("SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be set.");
    process.exit(1);
  }

  console.log(`Driving a browser at ${BASE_URL}\n`);

  // The system Chrome is used rather than a downloaded Chromium, so the test
  // does not need a browser download to run.
  const browser = await chromium.launch({ channel: "chrome" });
  const context = await browser.newContext();
  const page = await context.newPage();
  watch(page);

  try {
    /* ---------------------------------------------------------------- */
    section("1. Sign in through the form");

    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
    const loginBody = (await page.textContent("body")) ?? "";
    check("the sign-in form is on screen", loginBody.includes("Welcome Back"));
    check(
      "the demo accounts panel is gone",
      !loginBody.includes("Demo accounts") && !loginBody.includes("Demo@12345"),
    );

    await signIn(page, EMAIL, PASSWORD);
    check("signing in lands on the platform area", page.url().includes("/platform"), page.url());
    check(
      "the signed-in account is a Super Admin",
      ((await page.textContent("body")) ?? "").includes("Super Admin"),
    );

    const superToken = await accessToken(page);
    check("the browser is holding an access token", superToken.length > 0);

    /* ---------------------------------------------------------------- */
    section("2. Platform screens");

    await visit(page, "/platform", "Super Admin");
    await visit(page, "/platform/schools", "Platform schools");
    await visit(page, "/platform/admins", "School admins");
    await visit(page, "/platform/settings");

    /* ---------------------------------------------------------------- */
    section("3. The schools screen can edit a school");

    await page.goto(`${BASE_URL}/platform/schools`, { waitUntil: "networkidle" });
    await page.waitForTimeout(700);

    const provisionButton = page.getByRole("button", { name: /provision new school/i });
    check("the Provision button is on screen", (await provisionButton.count()) > 0);

    if ((await provisionButton.count()) > 0) {
      await provisionButton.first().click();
      await page.waitForTimeout(600);

      const slug = `ui-check-${Date.now().toString(36)}`;
      await page.getByLabel(/school name/i).fill("UI Check School");
      const slugField = page.getByLabel(/url slug/i);
      if ((await slugField.count()) > 0) await slugField.fill(slug);

      const submit = page.getByRole("button", { name: /provision school/i });
      await submit.click();

      // A dev-mode compile of the route can take a while, so wait for the
      // result rather than for a fixed number of milliseconds.
      await page
        .getByText(/is ready/i)
        .first()
        .waitFor({ timeout: 60000 })
        .catch(() => undefined);

      const body = (await page.textContent("body")) ?? "";
      check(
        "provisioning a school succeeds and says so",
        body.includes("is ready") && body.includes("UI Check School"),
      );

      // The new school should now be in the list.
      await page.goto(`${BASE_URL}/platform/schools`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1200);
      const listBody = (await page.textContent("body")) ?? "";
      check("the new school appears in the list", listBody.includes("UI Check School"));
      check("the new school has its URL", listBody.includes(`/${slug}`));

      // And it should be editable — this is the PATCH the button used to 404 on.
      const editButton = page.getByRole("button", { name: /^Edit$/ }).first();
      if ((await editButton.count()) > 0) {
        await editButton.click();
        await page.waitForTimeout(600);

        const nameField = page.getByLabel(/school name/i).last();
        if ((await nameField.count()) > 0) await nameField.fill("UI Check School Renamed");
        await page.getByRole("button", { name: /save changes/i }).click();

        await page
          .getByText(/UI Check School Renamed/i)
          .first()
          .waitFor({ timeout: 60000 })
          .catch(() => undefined);

        const afterEdit = (await page.textContent("body")) ?? "";
        check(
          "renaming a school works and is not a 404",
          afterEdit.includes("UI Check School Renamed") &&
            !afterEdit.includes("not connected yet"),
          afterEdit.includes("not connected yet") ? "still the old 404 message" : "",
        );

        // The old 404 message would be here. Its absence is the proof that
        // PATCH /api/platform/schools/:id now answers.
        check(
          "the old 'not connected yet' message is gone",
          !afterEdit.includes("not connected yet"),
        );
      }
    }

    /* ---------------------------------------------------------------- */
    section("4. The admins screen can grant access");

    await page.goto(`${BASE_URL}/platform/admins`, { waitUntil: "networkidle" });
    await page.waitForTimeout(900);

    const addButton = page.getByRole("button", { name: /invite school admin/i }).first();
    check("the Invite school admin button is on screen", (await addButton.count()) > 0);

    if ((await addButton.count()) > 0) {
      const body = (await page.textContent("body")) ?? "";
      check(
        "the page no longer says email delivery is not connected",
        !body.includes("email delivery is not connected yet"),
      );
      check(
        "the page says the password is emailed",
        body.includes("emailed to them"),
      );
    }

    /* ---------------------------------------------------------------- */
    section("5. The school area");

    // A school with a School Admin, so the school screens have someone to
    // render for.
    const schoolSlug = `ui-school-${Date.now().toString(36)}`;
    const adminEmail = `ui-admin-${Date.now().toString(36)}@example.com`;
    const adminPassword = "UiCheck@12345";

    const created = await fetch(`${BASE_URL}/api/platform/schools`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `access_token=${superToken}` },
      body: JSON.stringify({ name: "UI Check School", slug: schoolSlug }),
    });
    check("a school can be provisioned for the school screens", created.status === 201, `got ${created.status}`);

    const schoolId = (await created.json())?.id as string;
    const invited = await fetch(`${BASE_URL}/api/platform/admins`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `access_token=${superToken}` },
      body: JSON.stringify({
        name: "UI Check Admin",
        email: adminEmail,
        schoolId,
        role: "SCHOOL_ADMIN",
      }),
    });
    check("a school admin can be created", invited.status === 201, `got ${invited.status}`);

    const invitedBody = await invited.json();

    // Sign in as that admin in a second browser context.
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    watch(adminPage);

    // Capture what the screen actually sends, so a failed save says whether
    // the screen sent the wrong value or the server lost it.
    let sentPreferences: unknown = null;
    adminPage.on("request", (request) => {
      if (request.url().includes("notification-preferences") && request.method() === "PUT") {
        try {
          sentPreferences = JSON.parse(request.postData() ?? "null");
        } catch {
          sentPreferences = request.postData();
        }
      }
    });

    try {
      await signIn(adminPage, adminEmail, invitedBody?.temporaryPassword as string);
      const adminToken = await accessToken(adminPage);
      check(
        "the new admin signs in with the emailed password",
        adminPage.url().includes(`/${schoolSlug}`) || adminPage.url().includes("/dashboard"),
        adminPage.url(),
      );

      await visit(adminPage, `/${schoolSlug}/dashboard`, "Academic year");
      await visit(adminPage, `/${schoolSlug}/students`);
      await visit(adminPage, `/${schoolSlug}/teachers`);
      await visit(adminPage, `/${schoolSlug}/attendance`);
      await visit(adminPage, `/${schoolSlug}/announcements`);
      await visit(adminPage, `/${schoolSlug}/settings`);

      /* -------------------------------------------------------------- */
      section("6. The notification preferences save for real");

      await adminPage.goto(`${BASE_URL}/${schoolSlug}/settings`, { waitUntil: "networkidle" });
      await adminPage.waitForTimeout(1200);

      // The settings screen is tabbed, so the notifications panel has to be
      // opened before its switches are on the page.
      const notificationsTab = adminPage.getByRole("button", { name: /notification/i }).first();
      if ((await notificationsTab.count()) > 0) {
        await notificationsTab.click();
        await adminPage.waitForTimeout(1200);
      }
      check(
        "the notifications tab can be opened",
        ((await adminPage.textContent("body")) ?? "").includes("Notification Channels"),
      );

      const emailToggle = adminPage.getByRole("checkbox", { name: /email notifications/i });
      check("the email notifications switch is on screen", (await emailToggle.count()) > 0);
      if ((await emailToggle.count()) > 0) {
        const before = await emailToggle.isChecked();
        await emailToggle.setChecked(!before);

        // Wait for the save to actually come back before reading the screen,
        // rather than hoping it finished in time.
        const putDone = adminPage.waitForResponse(
          (response) =>
            response.url().includes("notification-preferences") &&
            response.request().method() === "PUT",
          { timeout: 30000 },
        );
        await adminPage.getByRole("button", { name: /save changes/i }).first().click();
        await putDone;
        await adminPage.waitForTimeout(500);

        const body = (await adminPage.textContent("body")) ?? "";
        check(
          "saving the preferences reports success",
          body.includes("Notification preferences saved"),
        );
        check(
          "the screen no longer says the save is not persisted",
          !body.includes("will not be persisted"),
        );
        check(
          "the screen sent the flipped value to the server",
          (sentPreferences as { emailNotifications?: boolean } | null)?.emailNotifications === !before,
          `sent=${JSON.stringify(sentPreferences)}`,
        );

        // Reload and confirm the choice was actually kept. The settings screen
        // opens on the first tab after a reload, so the notifications tab has
        // to be opened again before the switch can be looked at — and the
        // load has to come back before the switch can be read.
        await adminPage.reload({ waitUntil: "networkidle" });
        await adminPage.waitForTimeout(1200);
        const tabAgain = adminPage.getByRole("button", { name: /notification/i }).first();
        if ((await tabAgain.count()) > 0) {
          const loadDone = adminPage.waitForResponse(
            (response) =>
              response.url().includes("notification-preferences") &&
              response.request().method() === "GET",
            { timeout: 30000 },
          );
          await tabAgain.click();
          await loadDone;
          await adminPage.waitForTimeout(500);
        }
        const after = adminPage.getByRole("checkbox", { name: /email notifications/i });
        check("the switch is still on screen after a reload", (await after.count()) > 0);
        if ((await after.count()) > 0) {
          // Read the stored value straight from the API as well, so a failure
          // says which half is wrong: the save, or the screen.
          const stored = await fetch(
            `${BASE_URL}/api/t/${schoolSlug}/notification-preferences`,
            { headers: { Cookie: `access_token=${adminToken}` } },
          ).then((response) => response.json() as Promise<{ emailNotifications: boolean }>);

          check(
            "the choice survives a reload — it was really saved",
            (await after.isChecked()) === !before,
            `checkbox=${await after.isChecked()} stored=${stored?.emailNotifications} expected=${!before}`,
          );
        }
      }
    } finally {
      await adminContext.close();
    }

    /* ---------------------------------------------------------------- */
    section("7. The browser console stayed clean");

    check(
      "no console errors across the whole run",
      consoleErrors.length === 0,
      consoleErrors.slice(0, 3).join(" | "),
    );

    /* ---------------------------------------------------------------- */
    section("8. Cleanup");

    // The test created a school and a few accounts. Remove them so the
    // database is left as it was found. The pooler drops idle connections
    // during a long browser run, so the client is reconnected and retried.
    let removedSchools = 0;
    let removedUsers = 0;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await prisma.$connect();
        removedSchools = (
          await prisma.tenant.deleteMany({
            where: {
              OR: [
                { slug: { startsWith: "ui-check-" } },
                { slug: { startsWith: "ui-school-" } },
              ],
            },
          })
        ).count;
        removedUsers = (
          await prisma.user.deleteMany({
            where: { email: { endsWith: "@example.com" } },
          })
        ).count;
        break;
      } catch (error) {
        if (attempt === 3) {
          console.log(`  could not clean up: ${(error as Error).message}`);
        } else {
          await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
        }
      }
    }
    console.log(`  removed ${removedSchools} test schools and ${removedUsers} test accounts`);
  } finally {
    await browser.close();
  }

  console.log(
    `\n\x1b[1mResult:\x1b[0m \x1b[32m${passed} passed\x1b[0m, ${
      failed > 0 ? `\x1b[31m${failed} failed\x1b[0m` : `${failed} failed`
    }`,
  );
  process.exit(failed > 0 ? 1 : 0);
}

main()
  .catch((error) => {
    console.error("\nThe browser run itself failed:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
