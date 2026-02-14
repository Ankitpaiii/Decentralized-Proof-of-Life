// Anti-Replay Service — challenge ID dedup, timestamp validation, rate limiting

const usedChallengeIds = new Set();
const walletAttempts = new Map(); // wallet -> [timestamps]

const MAX_CHALLENGE_AGE_MS = 20_000; // 20 seconds
const MAX_ATTEMPTS_PER_HOUR = 10;
const MIN_VERIFICATION_TIME_MS = 2_000; // reject suspiciously fast verifications

export function validateChallenge(challenge) {
    const errors = [];

    // Check if challenge ID already used
    if (usedChallengeIds.has(challenge.id)) {
        errors.push('Challenge ID already used. Possible replay attack.');
    }

    // Check timestamp freshness
    const age = Date.now() - challenge.timestamp;
    if (age > MAX_CHALLENGE_AGE_MS) {
        errors.push('Challenge expired.');
    }

    if (age < 0) {
        errors.push('Challenge timestamp is in the future. Clock manipulation detected.');
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

export function markChallengeUsed(challengeId) {
    usedChallengeIds.add(challengeId);
}

export function isReplayAttempt(challengeId) {
    return usedChallengeIds.has(challengeId);
}

export function checkVerificationTiming(startTime, endTime) {
    const duration = endTime - startTime;

    if (duration < MIN_VERIFICATION_TIME_MS) {
        return {
            valid: false,
            reason: 'Verification completed too quickly. Possible automation.',
            duration,
        };
    }

    return { valid: true, duration };
}

export function checkRateLimit(walletAddress) {
    const now = Date.now();
    const oneHourAgo = now - 3600_000;

    if (!walletAttempts.has(walletAddress)) {
        walletAttempts.set(walletAddress, []);
    }

    const attempts = walletAttempts.get(walletAddress);
    // Remove old attempts
    const recentAttempts = attempts.filter((t) => t > oneHourAgo);
    walletAttempts.set(walletAddress, recentAttempts);

    if (recentAttempts.length >= MAX_ATTEMPTS_PER_HOUR) {
        return {
            allowed: false,
            reason: `Rate limit exceeded. Maximum ${MAX_ATTEMPTS_PER_HOUR} verifications per hour.`,
            remainingAttempts: 0,
            nextAvailableIn: Math.ceil((recentAttempts[0] + 3600_000 - now) / 1000),
        };
    }

    return {
        allowed: true,
        remainingAttempts: MAX_ATTEMPTS_PER_HOUR - recentAttempts.length,
    };
}

export function recordAttempt(walletAddress) {
    if (!walletAttempts.has(walletAddress)) {
        walletAttempts.set(walletAddress, []);
    }
    walletAttempts.get(walletAddress).push(Date.now());
}

export function clearUsedChallenges() {
    usedChallengeIds.clear();
}
