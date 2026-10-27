ClassForge - Client Demo Test Flow
==================================

Demo URL: https://p2-mu-seven.vercel.app
Demo Date: Tomorrow (Client Demo)
Total Time: 10-15 minutes

STEP 1: LOGIN AS SUPER ADMIN (2 min)
-----------------------------------
1. Open https://p2-mu-seven.vercel.app/login
2. Email: superadmin@classforge.dev (or seeded admin email)
3. Password: (from environment / seed script)
4. Click Sign In
Expected: Dashboard loads; school list shows all schools

STEP 2: SCHOOL ADMIN DASHBOARD (3 min)
--------------------------------------
1. Switch to a school (click school in sidebar or use SchoolSwitcher)
2. Verify KPI cards show student/teacher/class counts
3. Verify attendance chart displays
4. Verify recent announcements load
5. Verify "Quick Actions" buttons respect role permissions

STEP 3: MULTI-ROLE SWITCH (3 min) - KEY DEMO
---------------------------------------------
1. Log in as a user with 2 roles (e.g., teacher@greenwood.dev who is also SCHOOL_ADMIN)
2. Show Teacher Dashboard (classes, timetable, assignments)
3. Click SchoolSwitcher (top-left) → select "School Admin" role
4. Verify dashboard reloads with school-wide data (not teacher-specific)
5. Click SchoolSwitcher again → back to Teacher
6. Verify teacher data returns

STEP 4: ROLE REMOVAL & FULL DELETION (2 min) - KEY DEMO
---------------------------------------------------------
1. As Super Admin, go to Platform → Schools → Admins
2. Remove a user's role
3. Attempt login as that user
4. Verify: "Invalid email or password" (account fully deleted)

STEP 5: FORGOT PASSWORD (2 min)
--------------------------------
1. Click "Forgot password?" on login page
2. Enter email
3. Verify success message
4. Check email inbox for reset link (if SMTP configured)

STEP 6: ATTENDANCE SETTINGS (1 min)
------------------------------------
1. As School Admin, go to Settings → Attendance
2. Change late threshold (e.g., 15 → 20 minutes)
3. Click Save
4. Verify success message

QUICK VERIFICATION CHECKLIST
-----------------------------
□ https://p2-mu-seven.vercel.app/login loads
□ Login with Super Admin credentials works
□ School selection works
□ Role switch (SchoolSwitcher) works without popup
□ Admin dashboard shows data (not stuck on loading)
□ Teacher dashboard shows teacher-specific data
□ Forgot password page loads
□ No console errors (F12 → Console)
□ Network tab shows 200 responses (not 403/500)

EMERGENCY ROLLBACK PLAN
-----------------------
If anything breaks during demo:
  vercel rollback --prod
  vercel ls --scope bhalkeankit-9894s-projects
