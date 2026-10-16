export const ACCESS_TOKEN_COOKIE = "access_token";
export const REFRESH_TOKEN_COOKIE = "refresh_token";

export const ACCESS_TOKEN_MAX_AGE = 15*60;
export const REFRESH_TOKEN_MAX_AGE = 7*24*60*60;

export const authCookieOptions = {
  httpOnly : true,
  secure : process.env.NODE_ENV === "production",
  sameSite : "lax" as const,
  path : "/"
}