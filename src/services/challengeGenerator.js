// Challenge Generator — random liveness challenges with unique IDs
import { v4 as uuidv4 } from 'uuid';

const CHALLENGE_POOL = [
    {
        type: 'SMILE',
        instruction: 'Smile',
        icon: '😊',
        detectionMethod: 'expression',
        duration: 2,
        difficulty: 'easy',
    },
    {
        type: 'TURN_LEFT',
        instruction: 'Turn Head Left',
        icon: '👈',
        detectionMethod: 'head_pose',
        angleThreshold: 25,
        difficulty: 'medium',
    },
    {
        type: 'TURN_RIGHT',
        instruction: 'Turn Head Right',
        icon: '👉',
        detectionMethod: 'head_pose',
        angleThreshold: 25,
        difficulty: 'medium',
    },
    {
        type: 'OPEN_MOUTH',
        instruction: 'Open Your Mouth',
        icon: '😮',
        detectionMethod: 'mouth_opening',
        threshold: 0.5,
        difficulty: 'easy',
    },
    {
        type: 'LOOK_UP',
        instruction: 'Look Up',
        icon: '⬆️',
        detectionMethod: 'head_pitch',
        angleThreshold: 15,
        difficulty: 'easy',
    },
    {
        type: 'LOOK_DOWN',
        instruction: 'Look Down',
        icon: '⬇️',
        detectionMethod: 'head_pitch',
        angleThreshold: 15,
        difficulty: 'easy',
    },
];

export function generateChallenge(timerSeconds = 10) {
    // Use crypto-secure random if available
    let randomIndex;
    if (window.crypto && window.crypto.getRandomValues) {
        const arr = new Uint32Array(1);
        window.crypto.getRandomValues(arr);
        randomIndex = arr[0] % CHALLENGE_POOL.length;
    } else {
        randomIndex = Math.floor(Math.random() * CHALLENGE_POOL.length);
    }

    const selected = CHALLENGE_POOL[randomIndex];
    const now = Date.now();

    return {
        id: uuidv4(),
        ...selected,
        timestamp: now,
        expiryTime: now + timerSeconds * 1000,
        timerSeconds,
    };
}

export function getChallengePool() {
    return CHALLENGE_POOL.map((c) => ({ type: c.type, instruction: c.instruction, icon: c.icon }));
}
