import { SignJWT,jwtVerify } from "jose";

export type AccessTokenPayload = {
  userId: string;
  email: string;
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

  return new SignJWT({
    email : payload.email,
  })
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
  return {
    userId: payload.sub,
    email: payload.email
  };
  }
  catch{
    return null;
  }
}
