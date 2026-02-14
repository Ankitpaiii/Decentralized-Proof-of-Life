// Face Encoding Service — face-api.js initialization, detection, encoding, comparison
import * as faceapi from 'face-api.js';

let modelsLoaded = false;

export async function initModels() {
    if (modelsLoaded) return;
    const MODEL_URL = '/models';
    await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
    ]);
    modelsLoaded = true;
}

export function areModelsLoaded() {
    return modelsLoaded;
}

const DETECT_OPTIONS = new faceapi.TinyFaceDetectorOptions({
    inputSize: 416,
    scoreThreshold: 0.5,
});

export async function detectFace(videoEl) {
    if (!modelsLoaded) throw new Error('Models not loaded.');
    const detection = await faceapi
        .detectSingleFace(videoEl, DETECT_OPTIONS)
        .withFaceLandmarks()
        .withFaceDescriptor()
        .withFaceExpressions();
    return detection || null;
}

export async function extractEncoding(videoEl, numFrames = 5, intervalMs = 400) {
    const descriptors = [];

    for (let i = 0; i < numFrames; i++) {
        const detection = await detectFace(videoEl);
        if (detection) {
            descriptors.push(Array.from(detection.descriptor));
        }
        if (i < numFrames - 1) {
            await new Promise((r) => setTimeout(r, intervalMs));
        }
    }

    if (descriptors.length < 3) {
        throw new Error(`Insufficient face captures. Only ${descriptors.length}/${numFrames} frames captured.`);
    }

    // Average the descriptors
    const avgDescriptor = new Float32Array(128);
    for (const desc of descriptors) {
        for (let j = 0; j < 128; j++) {
            avgDescriptor[j] += desc[j];
        }
    }
    for (let j = 0; j < 128; j++) {
        avgDescriptor[j] /= descriptors.length;
    }

    return {
        encoding: Array.from(avgDescriptor),
        framesUsed: descriptors.length,
        totalAttempted: numFrames,
    };
}

export function compareFaces(encoding1, encoding2) {
    if (!encoding1 || !encoding2) return 0;
    const desc1 = new Float32Array(encoding1);
    const desc2 = new Float32Array(encoding2);
    const distance = faceapi.euclideanDistance(desc1, desc2);

    // Convert distance to similarity score (0-1, higher is better)
    // Typical same-person distance: <0.6, different person: >0.6
    const similarity = Math.max(0, 1 - distance);
    return Math.round(similarity * 1000) / 1000;
}

export function checkFaceQuality(detection, videoWidth, videoHeight) {
    if (!detection) {
        return {
            faceDetected: false,
            goodLighting: false,
            properDistance: false,
            frontalAngle: false,
            score: 0,
        };
    }

    const box = detection.detection.box;
    const faceArea = (box.width * box.height) / (videoWidth * videoHeight);
    const detectionScore = detection.detection.score;

    const faceDetected = detectionScore > 0.6;
    const properDistance = faceArea > 0.04 && faceArea < 0.6;
    const goodLighting = detectionScore > 0.7;

    // Check if face is roughly frontal using landmark symmetry
    const landmarks = detection.landmarks;
    const nose = landmarks.getNose();
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();

    const eyeMidX = (leftEye[0].x + rightEye[3].x) / 2;
    const noseTipX = nose[3].x;
    const asymmetry = Math.abs(eyeMidX - noseTipX) / box.width;
    const frontalAngle = asymmetry < 0.15;

    const qualityScore =
        (faceDetected ? 0.3 : 0) +
        (properDistance ? 0.25 : 0) +
        (goodLighting ? 0.25 : 0) +
        (frontalAngle ? 0.2 : 0);

    return {
        faceDetected,
        goodLighting,
        properDistance,
        frontalAngle,
        score: Math.round(qualityScore * 100) / 100,
        detectionScore: Math.round(detectionScore * 100) / 100,
        faceAreaPercent: Math.round(faceArea * 100),
    };
}

export function drawDetection(canvas, detection, displaySize) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!detection) return;

    faceapi.matchDimensions(canvas, displaySize);
    const resized = faceapi.resizeResults(detection, displaySize);

    // Draw face box
    const box = resized.detection.box;
    ctx.strokeStyle = '#8b5cf6';
    ctx.lineWidth = 2;
    ctx.strokeRect(box.x, box.y, box.width, box.height);

    // Draw landmarks
    const landmarks = resized.landmarks;
    const positions = landmarks.positions;
    ctx.fillStyle = 'rgba(6, 182, 212, 0.6)';
    for (const pt of positions) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
    }
}
