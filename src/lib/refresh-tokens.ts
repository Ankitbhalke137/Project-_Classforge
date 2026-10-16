import { createHash,randomBytes,randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { REFRESH_TOKEN_MAX_AGE } from "@/lib/auth-cookies";

export function generateRefreshTokens():string{
    return randomBytes(32).toString("base64url");
}

export function hashRefreshToken(token:string): string {
    return createHash("sha256")
        .update(token)
        .digest("hex");
}

export async function createStoredRefreshToken(
    userId : string,
    familyId : string = randomUUID()
): Promise<{token:string,familyId:string}>{
    const token = generateRefreshTokens();
    const tokenHash = hashRefreshToken(token);
    const expiresAt = new Date(
        Date.now() + REFRESH_TOKEN_MAX_AGE*1000
    );

    await prisma.refreshToken.create({
        data:{
            tokenHash,
            userId,
            familyId,
            expiresAt
        }
    });
    return {token,familyId}
}