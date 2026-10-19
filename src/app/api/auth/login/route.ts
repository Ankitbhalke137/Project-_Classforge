import { NextResponse } from "next/server";
import { z } from "zod";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createAccessToken } from "@/lib/auth"; 
import { ACCESS_TOKEN_COOKIE,REFRESH_TOKEN_COOKIE,ACCESS_TOKEN_MAX_AGE,REFRESH_TOKEN_MAX_AGE,authCookieOptions } from "@/lib/auth-cookies";
import { createStoredRefreshToken } from "@/lib/refresh-tokens";

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
    const body : unknown = await request.json().catch(()=>null);
    const parsed = loginSchema.safeParse(body);

    if(!parsed.success){
      return NextResponse.json(
        {message: "Please provide a valid email and password"},
        {status:400}
      );
    }
    const {email,password} = parsed.data;
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          where : {status: "ACTIVE"},
          include: {
            tenant: {
              select: {
                id: true,
                name: true,
                slug: true,
                status: true
              },
            },
          },
        },
      },
    });
    if(!user || !(await compare(password,user.passwordHash))){
      return NextResponse.json(
        {message: "Invalid email or password"},
        {status:401}
      );
    }
    const schools = user.memberships.filter((memberships) => memberships.tenant.status === "ACTIVE")
    .map((memberships) => ({
      schoolId: memberships.tenant.id,
      schoolSlug : memberships.tenant.slug,
      schoolName : memberships.tenant.name,
      role : memberships.role
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
      email : user.email
    });
    const {token: refreshToken} = await createStoredRefreshToken(user.id);

    const response = NextResponse.json({
      user : {
        id : user.id,
        name : user.name,
        email : user.email,
        isSuperAdmin,
      },
      schools,
    });
    response.cookies.set(ACCESS_TOKEN_COOKIE,accessToken,{...authCookieOptions,maxAge : ACCESS_TOKEN_MAX_AGE});
    response.cookies.set(REFRESH_TOKEN_COOKIE,refreshToken,{...authCookieOptions,maxAge : REFRESH_TOKEN_MAX_AGE});

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