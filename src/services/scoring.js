// Scoring Service — multi-factor confidence score calculation

const WEIGHTS = {
    faceDetection: 0.25,
    challengeAccuracy: 0.30,
    liveness: 0.25,
    faceMatch: 0.20,
};

const THRESHOLDS = {
    excellent: 95,
    good: 85,
    acceptable: 75,
    fail: 0,
};

export function calculateScore({ faceConfidence = 0, challengeAccuracy = 0, livenessScore = 0, matchScore = 0 }) {
    const weightedScore =
        faceConfidence * WEIGHTS.faceDetection +
        challengeAccuracy * WEIGHTS.challengeAccuracy +
        livenessScore * WEIGHTS.liveness +
        matchScore * WEIGHTS.faceMatch;

    const scorePercent = Math.round(weightedScore * 10000) / 100; // 0–100

    let level, pass;
    if (scorePercent >= THRESHOLDS.excellent) {
        level = 'excellent';
        pass = true;
    } else if (scorePercent >= THRESHOLDS.good) {
        level = 'good';
        pass = true;
    } else if (scorePercent >= THRESHOLDS.acceptable) {
        level = 'acceptable';
        pass = true;
    } else {
        level = 'fail';
        pass = false;
    }

    return {
        score: scorePercent,
        pass,
        level,
        breakdown: {
            faceDetection: {
                raw: Math.round(faceConfidence * 100) / 100,
                weighted: Math.round(faceConfidence * WEIGHTS.faceDetection * 10000) / 100,
                weight: WEIGHTS.faceDetection,
                label: 'Face Detection',
            },
            challengeAccuracy: {
                raw: Math.round(challengeAccuracy * 100) / 100,
                weighted: Math.round(challengeAccuracy * WEIGHTS.challengeAccuracy * 10000) / 100,
                weight: WEIGHTS.challengeAccuracy,
                label: 'Challenge Accuracy',
            },
            liveness: {
                raw: Math.round(livenessScore * 100) / 100,
                weighted: Math.round(livenessScore * WEIGHTS.liveness * 10000) / 100,
                weight: WEIGHTS.liveness,
                label: 'Liveness Score',
            },
            faceMatch: {
                raw: Math.round(matchScore * 100) / 100,
                weighted: Math.round(matchScore * WEIGHTS.faceMatch * 10000) / 100,
                weight: WEIGHTS.faceMatch,
                label: 'Identity Match',
            },
        },
    };
}

export function getScoreColor(score) {
    if (score >= 85) return '#10b981'; // green
    if (score >= 75) return '#f59e0b'; // yellow
    return '#ef4444'; // red
}

export function getScoreLabel(level) {
    const labels = {
        excellent: 'Excellent — Very High Confidence',
        good: 'Good — Verification Passed',
        acceptable: 'Acceptable — Passed with Warning',
        fail: 'Failed — Insufficient Confidence',
    };
    return labels[level] || 'Unknown';
}
