import { NextResponse } from "next/server";
import { z } from "zod";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createAccessToken } from "@/lib/auth"; 
import { ACCESS_TOKEN_COOKIE,REFRESH_TOKEN_COOKIE,ACCESS_TOKEN_MAX_AGE,REFRESH_TOKEN_MAX_AGE,authCookieOptions } from "@/lib/auth-cookies";
import { createStoredRefreshToken } from "@/lib/refresh-tokens";
import { checkLoginRateLimit, createRateLimitResponse, resetLoginRateLimit } from "@/lib/rate-limit";
import { generateCsrfToken, setCsrfCookie, validateOrigin } from "@/lib/csrf";
import { withUserContext } from "@/lib/tenant-context";

const loginSchema = z.object({
  email: z
  .string()
  .trim()
  .email()
  .transform((email) => email.toLowerCase()),

  password: z.string().min(1),
});

export async function POST(request:Request){
  try{
    // 1. Origin validation: block cross-origin requests from untrusted origins
    const originCheck = validateOrigin(request);
    if (!originCheck.valid) {
      return NextResponse.json(
        { message: originCheck.reason ?? "Untrusted origin." },
        { status: 403 }
      );
    }

    const body : unknown = await request.json().catch(()=>null);

    // 2. Extract raw email if present to apply account-level rate limiting
    const rawEmail = (body && typeof body === "object" && "email" in body)
      ? (body as Record<string, unknown>).email
      : undefined;

    // 3. Enforce Rate Limiting BEFORE expensive credential verification
    const rateLimit = await checkLoginRateLimit(request, rawEmail);
    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit);
    }

    const parsed = loginSchema.safeParse(body);

    if(!parsed.success){
      return NextResponse.json(
        {message: "Please provide a valid email and password"},
        {status:400}
      );
    }
    const {email,password} = parsed.data;
    const baseUser = await prisma.user.findUnique({
      where: { email },
    });
    if(!baseUser || !(await compare(password, baseUser.passwordHash))){
      return NextResponse.json(
        {message: "Invalid email or password"},
        {status:401}
      );
    }

    // Resolve user's active memberships using user-scoped bootstrap context under RLS
    const user = await withUserContext(baseUser.id, async (tx) => {
      return tx.user.findUnique({
        where: { id: baseUser.id },
        include: {
          memberships: {
            where: { status: "ACTIVE" },
            include: {
              tenant: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  status: true,
                },
              },
            },
          },
        },
      });
    });

    if (!user) {
      return NextResponse.json(
        { message: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Login succeeded: reset rate limit attempts for this account
    await resetLoginRateLimit(request, email);

    const schools = user.memberships.filter((memberships) => memberships.tenant.status === "ACTIVE")
    .map((memberships) => ({
      schoolId: memberships.tenant.id,
      schoolSlug : memberships.tenant.slug,
      schoolName : memberships.tenant.name,
      role : memberships.role,
      // The client reads this to decide whether the school is read-only. Without
      // it a suspended school looks writable.
      status : memberships.tenant.status
    }));

    const isSuperAdmin = user.platformRole === "SUPER_ADMIN";

    if(!isSuperAdmin && schools.length === 0){
      return NextResponse.json(
        {message: "Your account has no active school membership."},
        {status: 403}
      );
    }

    const accessToken = await createAccessToken({
      userId : user.id,
      email : user.email,
      isSuperAdmin,
      memberships: schools.map((s) => ({
        schoolId: s.schoolId,
        schoolSlug: s.schoolSlug,
        role: s.role,
      })),
    });
    const {token: refreshToken} = await createStoredRefreshToken(user.id);

    // Generate CSRF token bound to this user session
    const csrfToken = generateCsrfToken(user.id);

    const response = NextResponse.json({
      user : {
        id : user.id,
        name : user.name,
        email : user.email,
        isSuperAdmin,
      },
      schools,
      csrfToken,
    });
    response.cookies.set(ACCESS_TOKEN_COOKIE,accessToken,{...authCookieOptions,maxAge : ACCESS_TOKEN_MAX_AGE});
    response.cookies.set(REFRESH_TOKEN_COOKIE,refreshToken,{...authCookieOptions,maxAge : REFRESH_TOKEN_MAX_AGE});
    setCsrfCookie(response, csrfToken);

    return response;


  }
  catch(error){
    console.error("Login error:",error);

    return NextResponse.json(
      {message: "Unable to login right now."},
      {status:500}
    );
  }
}