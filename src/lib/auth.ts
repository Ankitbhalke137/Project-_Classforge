import { SignJWT,jwtVerify } from "jose";

export type SchoolMembershipClaim = {
  schoolId: string;
  schoolSlug: string;
  role: string;
};

export type AccessTokenPayload = {
  userId: string;
  email: string;
  isSuperAdmin?: boolean;
  memberships?: SchoolMembershipClaim[];
};
const ACCESS_TOKEN_EXPIRY = "15m";

function getSecretKey() : Uint8Array{
  const secret = process.env.JWT_SECRET;

  if(!secret || secret.length < 32){
  throw new Error("JWT_SECRET must be configured with atleast 32 characters.");
};
  return new TextEncoder().encode(secret);
};

export async function createAccessToken(payload:AccessTokenPayload): Promise<string>{
  const secretKey = getSecretKey();

  const claims: Record<string, unknown> = {
    email: payload.email,
  };
  if (typeof payload.isSuperAdmin === "boolean") {
    claims.isSuperAdmin = payload.isSuperAdmin;
  }
  if (Array.isArray(payload.memberships)) {
    claims.memberships = payload.memberships;
  }

  return new SignJWT(claims)
  .setProtectedHeader({alg: "HS256"})
  .setSubject(payload.userId)
  .setIssuedAt()
  .setExpirationTime(ACCESS_TOKEN_EXPIRY)
  .sign(secretKey)

}

export async function verifyAccessToken(token:string):Promise<AccessTokenPayload | null>{
  const secretKey = getSecretKey();
  try{
    const { payload } = await jwtVerify(token,secretKey,{
    algorithms: ["HS256"],
  });
  if(typeof payload.sub !== "string" || typeof payload.email !== "string"){
    return null;
  }

  const memberships: SchoolMembershipClaim[] = [];
  if (Array.isArray(payload.memberships)) {
    for (const m of payload.memberships) {
      if (
        m &&
        typeof m === "object" &&
        typeof (m as any).schoolId === "string" &&
        typeof (m as any).schoolSlug === "string" &&
        typeof (m as any).role === "string"
      ) {
        memberships.push({
          schoolId: (m as any).schoolId,
          schoolSlug: (m as any).schoolSlug,
          role: (m as any).role,
        });
      }
    }
  }

  return {
    userId: payload.sub,
    email: payload.email,
    isSuperAdmin: payload.isSuperAdmin === true,
    memberships,
  };
  }
  catch{
    return null;
  }
}

