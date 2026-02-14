// Token Manager — POL token generation, validation, revocation
import { v4 as uuidv4 } from 'uuid';

const TOKEN_VALIDITY_MS = 5 * 60 * 1000; // 5 minutes
const STORAGE_KEY = 'pol_tokens';
const ACTIVE_TOKEN_KEY = 'pol_active_token';

function formatTokenId() {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, '');
    const time = now.toISOString().slice(11, 19).replace(/:/g, '');
    const rand = uuidv4().slice(0, 4).toUpperCase();
    return `POL-${date}-${time}-${rand}`;
}

export function issueToken(walletAddress, confidenceScore, sessionId, challengeType) {
    const now = Date.now();
    const token = {
        tokenId: formatTokenId(),
        walletAddress,
        issuedAt: now,
        expiresAt: now + TOKEN_VALIDITY_MS,
        confidenceScore,
        sessionId,
        challengeType,
        status: 'active',
        version: '1.0',
    };

    // Store token
    const tokens = getAllTokens();
    tokens.push(token);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
    sessionStorage.setItem(ACTIVE_TOKEN_KEY, JSON.stringify(token));

    return token;
}

export function getActiveToken(walletAddress) {
    try {
        const raw = sessionStorage.getItem(ACTIVE_TOKEN_KEY);
        if (!raw) return null;
        const token = JSON.parse(raw);

        if (token.walletAddress !== walletAddress) return null;
        if (token.status !== 'active') return null;
        if (Date.now() >= token.expiresAt) {
            expireToken(token.tokenId);
            return null;
        }
        return token;
    } catch {
        return null;
    }
}

export function validateToken(tokenId) {
    const tokens = getAllTokens();
    const token = tokens.find((t) => t.tokenId === tokenId);

    if (!token) {
        return { valid: false, reason: 'Token not found.' };
    }
    if (token.status === 'revoked') {
        return { valid: false, reason: 'Token has been revoked.' };
    }
    if (Date.now() >= token.expiresAt) {
        expireToken(tokenId);
        return { valid: false, reason: 'Token has expired.' };
    }

    return {
        valid: true,
        token,
        remainingMs: token.expiresAt - Date.now(),
        remainingSeconds: Math.ceil((token.expiresAt - Date.now()) / 1000),
    };
}

export function revokeToken(tokenId) {
    const tokens = getAllTokens();
    const token = tokens.find((t) => t.tokenId === tokenId);
    if (token) {
        token.status = 'revoked';
        token.revokedAt = Date.now();
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
    }

    // Clear active token if it matches
    const active = getActiveTokenRaw();
    if (active && active.tokenId === tokenId) {
        sessionStorage.removeItem(ACTIVE_TOKEN_KEY);
    }
}

function expireToken(tokenId) {
    const tokens = getAllTokens();
    const token = tokens.find((t) => t.tokenId === tokenId);
    if (token) {
        token.status = 'expired';
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
    }

    const active = getActiveTokenRaw();
    if (active && active.tokenId === tokenId) {
        sessionStorage.removeItem(ACTIVE_TOKEN_KEY);
    }
}

function getActiveTokenRaw() {
    try {
        const raw = sessionStorage.getItem(ACTIVE_TOKEN_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function getAllTokens() {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

export function getTokenHistory(walletAddress, limit = 10) {
    const tokens = getAllTokens()
        .filter((t) => t.walletAddress === walletAddress)
        .sort((a, b) => b.issuedAt - a.issuedAt)
        .slice(0, limit);

    // Update statuses
    const now = Date.now();
    return tokens.map((t) => ({
        ...t,
        status: t.status === 'active' && now >= t.expiresAt ? 'expired' : t.status,
    }));
}

export function clearTokens() {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(ACTIVE_TOKEN_KEY);
}

export function getRemainingTime(token) {
    if (!token) return { minutes: 0, seconds: 0, totalSeconds: 0, expired: true };

    const remaining = Math.max(0, token.expiresAt - Date.now());
    const totalSeconds = Math.ceil(remaining / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return {
        minutes,
        seconds,
        totalSeconds,
        expired: remaining <= 0,
        formatted: `${minutes}:${seconds.toString().padStart(2, '0')}`,
    };
}
