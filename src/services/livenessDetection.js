// Liveness Detection — EAR blink, smile, head pose, nod, eyebrow detection

// Eye Aspect Ratio for blink detection
function calculateEAR(eyeLandmarks) {
    // eyeLandmarks: array of 6 points [p1..p6] for each eye (from 68-point model)
    // EAR = (|p2-p6| + |p3-p5|) / (2 * |p1-p4|)
    const dist = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
    const v1 = dist(eyeLandmarks[1], eyeLandmarks[5]);
    const v2 = dist(eyeLandmarks[2], eyeLandmarks[4]);
    const h = dist(eyeLandmarks[0], eyeLandmarks[3]);
    return h > 0 ? (v1 + v2) / (2 * h) : 0;
}

// Mouth Aspect Ratio
function calculateMAR(mouthLandmarks) {
    const dist = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
    // Outer mouth: indices 0-11 from the 20-point mouth landmark set
    // Vertical opening: top lip to bottom lip
    const topLip = mouthLandmarks[14] || mouthLandmarks[3];
    const bottomLip = mouthLandmarks[18] || mouthLandmarks[9];
    const leftCorner = mouthLandmarks[0];
    const rightCorner = mouthLandmarks[6];

    const verticalDist = dist(topLip, bottomLip);
    const horizontalDist = dist(leftCorner, rightCorner);

    return horizontalDist > 0 ? verticalDist / horizontalDist : 0;
}

// Head pose estimation from landmarks
function estimateHeadPose(landmarks) {
    const nose = landmarks.getNose();
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();
    const jaw = landmarks.getJawOutline();

    const noseTip = nose[3];
    const leftEyeCenter = {
        x: leftEye.reduce((s, p) => s + p.x, 0) / leftEye.length,
        y: leftEye.reduce((s, p) => s + p.y, 0) / leftEye.length,
    };
    const rightEyeCenter = {
        x: rightEye.reduce((s, p) => s + p.x, 0) / rightEye.length,
        y: rightEye.reduce((s, p) => s + p.y, 0) / rightEye.length,
    };

    const eyeMidX = (leftEyeCenter.x + rightEyeCenter.x) / 2;
    const eyeMidY = (leftEyeCenter.y + rightEyeCenter.y) / 2;
    const eyeDistance = Math.abs(rightEyeCenter.x - leftEyeCenter.x);

    // Yaw (left-right)
    const yawRatio = eyeDistance > 0 ? (noseTip.x - eyeMidX) / eyeDistance : 0;
    const yaw = yawRatio * 60;

    // Pitch (up-down)
    const noseToEyeY = noseTip.y - eyeMidY;
    const pitchRatio = eyeDistance > 0 ? noseToEyeY / eyeDistance : 0;
    const pitch = (pitchRatio - 0.7) * 80;

    return { yaw, pitch };
}

// === Detection State ===
let blinkState = { count: 0, eyeClosed: false, consecutiveClosedFrames: 0 };
let headPoseHistory = [];
let nodState = { count: 0, wasDown: false };
let smileTimer = 0;
let eyebrowBaseline = null;

export function resetDetectionState() {
    blinkState = { count: 0, eyeClosed: false, consecutiveClosedFrames: 0 };
    headPoseHistory = [];
    nodState = { count: 0, wasDown: false };
    smileTimer = 0;
    eyebrowBaseline = null;
}

// === Challenge Detectors ===

export function detectBlink(detection) {
    if (!detection) return { detected: false, count: blinkState.count, confidence: 0 };

    const landmarks = detection.landmarks;
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();

    const leftEAR = calculateEAR(leftEye);
    const rightEAR = calculateEAR(rightEye);
    const avgEAR = (leftEAR + rightEAR) / 2;

    const EAR_THRESHOLD = 0.22;

    if (avgEAR < EAR_THRESHOLD) {
        blinkState.consecutiveClosedFrames++;
        if (blinkState.consecutiveClosedFrames >= 2 && !blinkState.eyeClosed) {
            blinkState.eyeClosed = true;
        }
    } else {
        if (blinkState.eyeClosed && blinkState.consecutiveClosedFrames >= 2) {
            blinkState.count++;
            blinkState.eyeClosed = false;
        }
        blinkState.consecutiveClosedFrames = 0;
    }

    return {
        detected: blinkState.count >= 2,
        count: blinkState.count,
        confidence: Math.min(blinkState.count / 2, 1),
        ear: Math.round(avgEAR * 1000) / 1000,
    };
}

export function detectSmile(detection, deltaTime = 0.033) {
    if (!detection) return { detected: false, confidence: 0, duration: smileTimer };

    const expressions = detection.expressions;
    const happyScore = expressions.happy || 0;
    const SMILE_THRESHOLD = 0.6;
    const REQUIRED_DURATION = 1.5;

    if (happyScore > SMILE_THRESHOLD) {
        smileTimer += deltaTime;
    } else {
        smileTimer = Math.max(0, smileTimer - deltaTime * 0.5);
    }

    return {
        detected: smileTimer >= REQUIRED_DURATION,
        confidence: Math.min(smileTimer / REQUIRED_DURATION, 1),
        duration: Math.round(smileTimer * 100) / 100,
        happyScore: Math.round(happyScore * 100) / 100,
    };
}

export function detectHeadTurn(detection, direction = 'left') {
    if (!detection) return { detected: false, confidence: 0, angle: 0 };

    const landmarks = detection.landmarks;
    const pose = estimateHeadPose(landmarks);
    const ANGLE_THRESHOLD = 20;

    let detected = false;
    let confidence = 0;

    if (direction === 'left') {
        detected = pose.yaw < -ANGLE_THRESHOLD;
        confidence = Math.min(Math.abs(Math.min(pose.yaw, 0)) / ANGLE_THRESHOLD, 1);
    } else {
        detected = pose.yaw > ANGLE_THRESHOLD;
        confidence = Math.min(Math.max(pose.yaw, 0) / ANGLE_THRESHOLD, 1);
    }

    return {
        detected,
        confidence: Math.round(confidence * 100) / 100,
        angle: Math.round(pose.yaw * 10) / 10,
    };
}

export function detectNod(detection) {
    if (!detection) return { detected: false, count: nodState.count, confidence: 0 };

    const landmarks = detection.landmarks;
    const pose = estimateHeadPose(landmarks);

    headPoseHistory.push(pose.pitch);
    if (headPoseHistory.length > 30) headPoseHistory.shift();

    const PITCH_DOWN_THRESHOLD = 8;
    const PITCH_UP_THRESHOLD = -5;

    if (pose.pitch > PITCH_DOWN_THRESHOLD && !nodState.wasDown) {
        nodState.wasDown = true;
    } else if (pose.pitch < PITCH_UP_THRESHOLD && nodState.wasDown) {
        nodState.count++;
        nodState.wasDown = false;
    }

    return {
        detected: nodState.count >= 2,
        count: nodState.count,
        confidence: Math.min(nodState.count / 2, 1),
        pitch: Math.round(pose.pitch * 10) / 10,
    };
}

export function detectMouthOpen(detection) {
    if (!detection) return { detected: false, confidence: 0 };

    const mouth = detection.landmarks.getMouth();
    const mar = calculateMAR(mouth);
    const MOUTH_THRESHOLD = 0.35;

    return {
        detected: mar > MOUTH_THRESHOLD,
        confidence: Math.min(mar / MOUTH_THRESHOLD, 1),
        mar: Math.round(mar * 1000) / 1000,
    };
}

export function detectEyebrowRaise(detection) {
    if (!detection) return { detected: false, confidence: 0 };

    const landmarks = detection.landmarks;
    const leftEyebrow = landmarks.getLeftEyeBrow();
    const rightEyebrow = landmarks.getRightEyeBrow();
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();

    const leftBrowY = leftEyebrow.reduce((s, p) => s + p.y, 0) / leftEyebrow.length;
    const rightBrowY = rightEyebrow.reduce((s, p) => s + p.y, 0) / rightEyebrow.length;
    const leftEyeY = leftEye.reduce((s, p) => s + p.y, 0) / leftEye.length;
    const rightEyeY = rightEye.reduce((s, p) => s + p.y, 0) / rightEye.length;

    const leftDist = leftEyeY - leftBrowY;
    const rightDist = rightEyeY - rightBrowY;
    const avgDist = (leftDist + rightDist) / 2;

    if (eyebrowBaseline === null) {
        eyebrowBaseline = avgDist;
        return { detected: false, confidence: 0 };
    }

    const raise = avgDist - eyebrowBaseline;
    const RAISE_THRESHOLD = eyebrowBaseline * 0.2;

    return {
        detected: raise > RAISE_THRESHOLD,
        confidence: Math.min(Math.max(raise / RAISE_THRESHOLD, 0), 1),
    };
}

// Main dispatcher: detect challenge action
export function detectChallengeAction(detection, challengeType, deltaTime = 0.033) {
    switch (challengeType) {
        case 'BLINK_TWICE':
            return detectBlink(detection);
        case 'SMILE':
            return detectSmile(detection, deltaTime);
        case 'TURN_LEFT':
            return detectHeadTurn(detection, 'left');
        case 'TURN_RIGHT':
            return detectHeadTurn(detection, 'right');
        case 'OPEN_MOUTH':
            return detectMouthOpen(detection);
        case 'RAISE_EYEBROWS':
            return detectEyebrowRaise(detection);
        case 'NOD':
            return detectNod(detection);
        default:
            return { detected: false, confidence: 0 };
    }
}
