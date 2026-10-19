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

/**
 * Swap a refresh token for a new one.
 *
 * The old row is deleted rather than marked revoked, so a token can only ever be
 * used once. Returns null when the token is unknown, already used, revoked or
 * expired — all four mean the same thing to the caller.
 *
 * Named `consume…` rather than `use…` so the React Hooks lint rule does not
 * mistake it for a component hook.
 */
export async function consumeRefreshToken(
    token: string
): Promise<{userId:string,familyId:string} | null> {
    const stored = await prisma.refreshToken.findUnique({
        where:{tokenHash: hashRefreshToken(token)}
    });

    if(!stored) return null;
    if(stored.revokedAt !== null) return null;
    if(stored.expiresAt.getTime() < Date.now()) {
        await prisma.refreshToken.delete({where:{id: stored.id}});
        return null;
    }

    await prisma.refreshToken.delete({where:{id: stored.id}});
    return {userId: stored.userId, familyId: stored.familyId};
}

/** Sign every token out for a user, used on logout. */
export async function deleteRefreshTokens(userId: string): Promise<void> {
    await prisma.refreshToken.deleteMany({where:{userId}});
}