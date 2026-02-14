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
let blinkState = { count: 0, eyeClosed: false, consecutiveClosedFrames: 0, openEAR: null };
let headPoseHistory = [];
let nodState = { count: 0, wasDown: false };
let smileTimer = 0;
let eyebrowState = {
    baseline: null,
    calibrationSamples: [],
    calibrated: false,
    raisedFrames: 0,
};

export function resetDetectionState() {
    blinkState = { count: 0, eyeClosed: false, consecutiveClosedFrames: 0, openEAR: null };
    headPoseHistory = [];
    nodState = { count: 0, wasDown: false };
    smileTimer = 0;
    eyebrowState = {
        baseline: null,
        calibrationSamples: [],
        calibrated: false,
        raisedFrames: 0,
    };
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

    // Adaptive threshold: calibrate from open-eye EAR if available
    // Default EAR threshold raised for better detection across webcams
    const EAR_THRESHOLD = blinkState.openEAR
        ? blinkState.openEAR * 0.7   // 70% of open-eye EAR as closed threshold
        : 0.25;                        // more lenient default (was 0.22)

    // Track open-eye baseline EAR (smooth average when eyes are clearly open)
    if (avgEAR > 0.28) {
        if (blinkState.openEAR === null) {
            blinkState.openEAR = avgEAR;
        } else {
            blinkState.openEAR = blinkState.openEAR * 0.9 + avgEAR * 0.1; // smooth
        }
    }

    if (avgEAR < EAR_THRESHOLD) {
        blinkState.consecutiveClosedFrames++;
        // Only need 1 consecutive closed frame (was 2 — too strict at high FPS)
        if (blinkState.consecutiveClosedFrames >= 1 && !blinkState.eyeClosed) {
            blinkState.eyeClosed = true;
        }
    } else {
        if (blinkState.eyeClosed && blinkState.consecutiveClosedFrames >= 1) {
            blinkState.count++;
            blinkState.eyeClosed = false;
        }
        blinkState.consecutiveClosedFrames = 0;
    }

    const REQUIRED_BLINKS = 2;
    return {
        detected: blinkState.count >= REQUIRED_BLINKS,
        count: blinkState.count,
        confidence: Math.min(blinkState.count / REQUIRED_BLINKS, 1),
        ear: Math.round(avgEAR * 1000) / 1000,
        threshold: Math.round(EAR_THRESHOLD * 1000) / 1000,
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

    // Calculate average Y distance between eyebrows and eyes
    const leftBrowY = leftEyebrow.reduce((s, p) => s + p.y, 0) / leftEyebrow.length;
    const rightBrowY = rightEyebrow.reduce((s, p) => s + p.y, 0) / rightEyebrow.length;
    const leftEyeY = leftEye.reduce((s, p) => s + p.y, 0) / leftEye.length;
    const rightEyeY = rightEye.reduce((s, p) => s + p.y, 0) / rightEye.length;

    const leftDist = leftEyeY - leftBrowY;
    const rightDist = rightEyeY - rightBrowY;
    const avgDist = (leftDist + rightDist) / 2;

    // Normalize distance by inter-eye distance (makes it resolution-independent)
    const leftEyeCenter = { x: leftEye.reduce((s, p) => s + p.x, 0) / leftEye.length };
    const rightEyeCenter = { x: rightEye.reduce((s, p) => s + p.x, 0) / rightEye.length };
    const interEyeDist = Math.abs(rightEyeCenter.x - leftEyeCenter.x);

    // Normalized brow-eye distance (resolution-independent)
    const normalizedDist = interEyeDist > 0 ? avgDist / interEyeDist : avgDist;

    // Calibration: collect multiple samples for a stable baseline
    const CALIBRATION_FRAMES = 8;
    if (!eyebrowState.calibrated) {
        eyebrowState.calibrationSamples.push(normalizedDist);
        if (eyebrowState.calibrationSamples.length >= CALIBRATION_FRAMES) {
            // Use median of calibration samples (more robust than mean)
            const sorted = [...eyebrowState.calibrationSamples].sort((a, b) => a - b);
            eyebrowState.baseline = sorted[Math.floor(sorted.length / 2)];
            eyebrowState.calibrated = true;
        }
        return { detected: false, confidence: 0, calibrating: true };
    }

    // Raise = current distance minus baseline (positive means eyebrows went up)
    const raise = normalizedDist - eyebrowState.baseline;

    // Use both relative threshold (15% of baseline) and absolute minimum
    const relativeThreshold = eyebrowState.baseline * 0.15;
    const absoluteMinThreshold = 0.03; // minimum normalized raise to count
    const RAISE_THRESHOLD = Math.max(relativeThreshold, absoluteMinThreshold);

    const isRaised = raise > RAISE_THRESHOLD;

    // Require a few consecutive raised frames to avoid false positives
    if (isRaised) {
        eyebrowState.raisedFrames++;
    } else {
        eyebrowState.raisedFrames = Math.max(0, eyebrowState.raisedFrames - 1);
    }

    const REQUIRED_RAISED_FRAMES = 3;
    const detected = eyebrowState.raisedFrames >= REQUIRED_RAISED_FRAMES;

    return {
        detected,
        confidence: Math.min(
            Math.max(raise / RAISE_THRESHOLD, 0),
            eyebrowState.raisedFrames / REQUIRED_RAISED_FRAMES,
            1
        ),
        raise: Math.round(raise * 1000) / 1000,
        baseline: Math.round(eyebrowState.baseline * 1000) / 1000,
    };
}

export function detectLookUp(detection) {
    if (!detection) return { detected: false, confidence: 0, pitch: 0 };

    const landmarks = detection.landmarks;
    const pose = estimateHeadPose(landmarks);
    const PITCH_THRESHOLD = -10; // Negative pitch = looking up

    const detected = pose.pitch < PITCH_THRESHOLD;
    const confidence = Math.min(Math.abs(Math.min(pose.pitch, 0)) / Math.abs(PITCH_THRESHOLD), 1);

    return {
        detected,
        confidence: Math.round(confidence * 100) / 100,
        pitch: Math.round(pose.pitch * 10) / 10,
    };
}

export function detectLookDown(detection) {
    if (!detection) return { detected: false, confidence: 0, pitch: 0 };

    const landmarks = detection.landmarks;
    const pose = estimateHeadPose(landmarks);
    const PITCH_THRESHOLD = 10; // Positive pitch = looking down

    const detected = pose.pitch > PITCH_THRESHOLD;
    const confidence = Math.min(Math.max(pose.pitch, 0) / PITCH_THRESHOLD, 1);

    return {
        detected,
        confidence: Math.round(confidence * 100) / 100,
        pitch: Math.round(pose.pitch * 10) / 10,
    };
}

// Main dispatcher: detect challenge action
export function detectChallengeAction(detection, challengeType, deltaTime = 0.033) {
    switch (challengeType) {
        case 'SMILE':
            return detectSmile(detection, deltaTime);
        case 'TURN_LEFT':
            return detectHeadTurn(detection, 'left');
        case 'TURN_RIGHT':
            return detectHeadTurn(detection, 'right');
        case 'OPEN_MOUTH':
            return detectMouthOpen(detection);
        case 'LOOK_UP':
            return detectLookUp(detection);
        case 'LOOK_DOWN':
            return detectLookDown(detection);
        default:
            return { detected: false, confidence: 0 };
    }
}

