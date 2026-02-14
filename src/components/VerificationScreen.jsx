import { useState, useRef, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Timer from './Timer';
import ChallengeDisplay from './ChallengeDisplay';
import ConfidenceScore from './ConfidenceScore';
import * as faceService from '../services/faceEncodingService';
import * as livenessDetection from '../services/livenessDetection';
import { generateChallenge } from '../services/challengeGenerator';
import { calculateScore } from '../services/scoring';
import { compareFaces } from '../services/faceEncodingService';
import * as antiReplay from '../services/antiReplay';
import * as tokenManager from '../services/tokenManager';
import * as userStore from '../services/userStore';
import * as walletService from '../services/walletService';

const PHASES = {
    INIT: 'init',
    CAMERA: 'camera',
    CHALLENGE: 'challenge',
    DETECTING: 'detecting',
    ANALYZING: 'analyzing',
    RESULTS: 'results',
};

export default function VerificationScreen({ walletAddress, onComplete, onBack, onDashboard }) {
    const [phase, setPhase] = useState(PHASES.INIT);
    const [error, setError] = useState('');
    const [challenge, setChallenge] = useState(null);
    const [sessionId] = useState(() => `VER-${Date.now()}-${uuidv4().slice(0, 4).toUpperCase()}`);
    const [detectionResult, setDetectionResult] = useState(null);
    const [scoreResult, setScoreResult] = useState(null);
    const [token, setToken] = useState(null);
    const [challengeProgress, setChallengeProgress] = useState(0);
    const [faceDetected, setFaceDetected] = useState(false);
    const [registeredEncoding, setRegisteredEncoding] = useState(null);

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);
    const animFrameRef = useRef(null);
    const sessionStartRef = useRef(Date.now());
    const cameraInitializedRef = useRef(false);
    const phaseRef = useRef(phase);
    const challengeRef = useRef(challenge);

    // Keep refs in sync so the detection loop doesn't go stale
    useEffect(() => { phaseRef.current = phase; }, [phase]);
    useEffect(() => { challengeRef.current = challenge; }, [challenge]);

    // Cleanup camera only on unmount
    useEffect(() => {
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((t) => t.stop());
                streamRef.current = null;
            }
            if (animFrameRef.current) {
                cancelAnimationFrame(animFrameRef.current);
                animFrameRef.current = null;
            }
        };
    }, []);

    // Phase 1: Init — check wallet and registration
    useEffect(() => {
        const init = async () => {
            try {
                if (!walletAddress) {
                    setError('No wallet connected. Please connect your wallet first.');
                    return;
                }

                const user = await userStore.getUser(walletAddress);
                if (!user) {
                    setError('This wallet is not registered. Please register first.');
                    return;
                }

                // Rate limit check
                const rateCheck = antiReplay.checkRateLimit(walletAddress);
                if (!rateCheck.allowed) {
                    setError(rateCheck.reason);
                    return;
                }

                setRegisteredEncoding(user.faceEncoding);
                setPhase(PHASES.CAMERA);
            } catch (err) {
                setError(`Initialization error: ${err.message}`);
            }
        };
        init();
    }, [walletAddress]);

    // Phase 2: Camera init — runs once when phase becomes CAMERA
    useEffect(() => {
        if (phase !== PHASES.CAMERA) return;
        if (cameraInitializedRef.current) return; // Don't re-init if already running

        let cancelled = false;

        const initCamera = async () => {
            try {
                await faceService.initModels();

                // Stop any existing stream before creating new one
                if (streamRef.current) {
                    streamRef.current.getTracks().forEach((t) => t.stop());
                }

                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
                });

                if (cancelled) {
                    stream.getTracks().forEach((t) => t.stop());
                    return;
                }

                streamRef.current = stream;
                cameraInitializedRef.current = true;

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                }

                // Wait a moment then start challenge
                setTimeout(() => {
                    if (!cancelled) {
                        const ch = generateChallenge(10);
                        setChallenge(ch);
                        livenessDetection.resetDetectionState();
                        setPhase(PHASES.CHALLENGE);
                    }
                }, 1500);
            } catch (err) {
                if (!cancelled) {
                    setError(`Camera error: ${err.message}`);
                }
            }
        };
        initCamera();

        // Note: NO cleanup that kills the stream here — that's handled by unmount effect
        return () => { cancelled = true; };
    }, [phase]);

    // Phase 3: Challenge + Detection loop
    const lastDetectionRef = useRef(null);

    const runDetectionLoop = useCallback(async () => {
        // Use refs to get latest values without re-creating this callback
        if (!videoRef.current || !canvasRef.current) return;
        if (phaseRef.current !== PHASES.CHALLENGE) return;

        try {
            const detection = await faceService.detectFace(videoRef.current);
            const vw = videoRef.current.videoWidth;
            const vh = videoRef.current.videoHeight;

            if (vw === 0 || vh === 0) {
                // Video not ready yet, retry
                animFrameRef.current = requestAnimationFrame(runDetectionLoop);
                return;
            }

            const displaySize = { width: vw, height: vh };
            if (canvasRef.current) {
                canvasRef.current.width = displaySize.width;
                canvasRef.current.height = displaySize.height;
                faceService.drawDetection(canvasRef.current, detection, displaySize);
            }

            setFaceDetected(!!detection);
            lastDetectionRef.current = detection;

            const currentChallenge = challengeRef.current;
            if (detection && currentChallenge) {
                const result = livenessDetection.detectChallengeAction(detection, currentChallenge.type, 0.033);
                setChallengeProgress(Math.round((result.confidence || 0) * 100));

                if (result.detected) {
                    setDetectionResult(result);
                    setPhase(PHASES.ANALYZING);
                    return; // Stop loop
                }
            }
        } catch (err) {
            console.warn('Detection loop error:', err);
        }

        // Only continue if still in CHALLENGE phase
        if (phaseRef.current === PHASES.CHALLENGE) {
            animFrameRef.current = requestAnimationFrame(runDetectionLoop);
        }
    }, []); // No deps — uses refs for latest values

    useEffect(() => {
        if (phase === PHASES.CHALLENGE) {
            // Small delay to ensure video element is attached and playing
            const timeout = setTimeout(() => {
                animFrameRef.current = requestAnimationFrame(runDetectionLoop);
            }, 100);
            return () => clearTimeout(timeout);
        } else {
            // Cancel detection loop when leaving CHALLENGE phase
            if (animFrameRef.current) {
                cancelAnimationFrame(animFrameRef.current);
                animFrameRef.current = null;
            }
        }
    }, [phase, runDetectionLoop]);

    // Phase 4: Analyze results
    useEffect(() => {
        if (phase !== PHASES.ANALYZING) return;

        const analyze = async () => {
            try {
                // Anti-replay validation
                const validation = antiReplay.validateChallenge(challenge);
                if (!validation.valid) {
                    setError(validation.errors.join(' '));
                    return;
                }

                // Timing check
                const timingCheck = antiReplay.checkVerificationTiming(sessionStartRef.current, Date.now());
                if (!timingCheck.valid) {
                    setError(timingCheck.reason);
                    return;
                }

                // Face match
                let matchScore = 0.85; // Default decent score
                if (registeredEncoding && lastDetectionRef.current) {
                    const currentEncoding = Array.from(lastDetectionRef.current.descriptor);
                    matchScore = compareFaces(registeredEncoding, currentEncoding);
                }

                // Calculate confidence
                const faceConfidence = lastDetectionRef.current
                    ? lastDetectionRef.current.detection.score
                    : 0;
                const challengeAccuracy = detectionResult?.confidence || 0;
                const livenessScore = faceConfidence * 0.5 + (detectionResult?.confidence || 0) * 0.5;

                const score = calculateScore({
                    faceConfidence,
                    challengeAccuracy,
                    livenessScore,
                    matchScore,
                });

                // Mark challenge as used
                antiReplay.markChallengeUsed(challenge.id);
                antiReplay.recordAttempt(walletAddress);

                // Record session
                await userStore.addVerificationSession({
                    sessionId,
                    walletAddress,
                    challengeType: challenge.type,
                    challengeId: challenge.id,
                    success: score.pass,
                    confidenceScore: score.score,
                    matchScore,
                    livenessScore,
                    duration: (Date.now() - sessionStartRef.current) / 1000,
                });

                await userStore.updateUserVerification(walletAddress, score.pass);

                // Issue token if passed
                if (score.pass) {
                    const tok = tokenManager.issueToken(walletAddress, score.score, sessionId, challenge.type);
                    setToken(tok);
                }

                setScoreResult(score);
                setPhase(PHASES.RESULTS);
            } catch (err) {
                setError(`Analysis error: ${err.message}`);
            }
        };
        analyze();
    }, [phase]);

    const handleTimeout = () => {
        // Record failed session
        userStore.addVerificationSession({
            sessionId,
            walletAddress,
            challengeType: challenge?.type,
            challengeId: challenge?.id,
            success: false,
            confidenceScore: 0,
            failureReason: 'timeout',
            duration: (Date.now() - sessionStartRef.current) / 1000,
        });

        if (challenge) {
            antiReplay.markChallengeUsed(challenge.id);
            antiReplay.recordAttempt(walletAddress);
        }

        userStore.updateUserVerification(walletAddress, false);

        setScoreResult({ score: 0, pass: false, level: 'fail', breakdown: null });
        setPhase(PHASES.RESULTS);
    };

    const handleRetry = () => {
        setChallenge(null);
        setDetectionResult(null);
        setScoreResult(null);
        setToken(null);
        setChallengeProgress(0);
        setFaceDetected(false);
        setError('');
        sessionStartRef.current = Date.now();
        cameraInitializedRef.current = false; // allow camera to re-init

        // Stop old stream so a fresh one can be created
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
        }

        // Re-init
        const init = async () => {
            const user = await userStore.getUser(walletAddress);
            if (user) {
                setRegisteredEncoding(user.faceEncoding);
                setPhase(PHASES.CAMERA);
            }
        };
        init();
    };

    const handleContinue = () => {
        if (scoreResult?.pass) {
            onDashboard?.(token);
        } else {
            handleRetry();
        }
    };

    return (
        <div className="page-wrapper">
            <div className="ambient-bg" />
            <div className="container" style={{ maxWidth: 640, padding: '40px 20px', position: 'relative', zIndex: 1 }}>
                {/* Header */}
                <div className="flex justify-between items-center mb-lg">
                    <button className="btn btn-secondary btn-sm" onClick={onBack}>← Back</button>
                    {walletAddress && (
                        <div className="wallet-badge">
                            <span className="wallet-dot" />
                            <span>{walletService.truncateAddress(walletAddress)}</span>
                        </div>
                    )}
                </div>

                <h2 className="text-center" style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '20px' }}>
                    🔍 <span className="text-gradient">Verification</span>
                </h2>

                {error && (
                    <div className="glass-card mb-md animate-shake" style={{ padding: '14px', borderColor: 'rgba(239, 68, 68, 0.3)', textAlign: 'center' }}>
                        <p style={{ color: 'var(--accent-red)', fontSize: '0.88rem' }}>⚠️ {error}</p>
                        <button className="btn btn-sm btn-secondary mt-sm" onClick={onBack}>Go Back</button>
                    </div>
                )}

                {!error && (
                    <>
                        {/* Camera View */}
                        {(phase === PHASES.CAMERA || phase === PHASES.CHALLENGE) && (
                            <div className="animate-fadeIn">
                                <div className="camera-container mb-md">
                                    <video ref={videoRef} playsInline muted />
                                    <canvas ref={canvasRef} />
                                    {phase === PHASES.CAMERA && (
                                        <div className="camera-overlay" style={{ background: 'rgba(0,0,0,0.4)', flexDirection: 'column', gap: '8px' }}>
                                            <div className="spinner" />
                                            <p className="text-sm" style={{ color: '#fff' }}>Preparing verification...</p>
                                        </div>
                                    )}
                                    {/* Face detection indicator */}
                                    {phase === PHASES.CHALLENGE && (
                                        <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 5 }}>
                                            <div className={`badge ${faceDetected ? 'badge-success' : 'badge-danger'}`}>
                                                {faceDetected ? '✅ Face Detected' : '❌ No Face'}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Challenge + Timer */}
                                {phase === PHASES.CHALLENGE && challenge && (
                                    <div className="animate-fadeInUp">
                                        <ChallengeDisplay challenge={challenge} />

                                        <div className="flex justify-center mt-md mb-md">
                                            <Timer duration={challenge.timerSeconds} onTimeout={handleTimeout} />
                                        </div>

                                        {/* Progress bar */}
                                        <div style={{ marginBottom: '8px' }}>
                                            <div className="flex justify-between text-sm text-muted mb-sm">
                                                <span>Challenge Progress</span>
                                                <span>{challengeProgress}%</span>
                                            </div>
                                            <div className="progress-bar">
                                                <div
                                                    className="progress-bar-fill"
                                                    style={{
                                                        width: `${challengeProgress}%`,
                                                        background: challengeProgress >= 100 ? '#10b981' : undefined,
                                                    }}
                                                />
                                            </div>
                                        </div>

                                        <p className="text-muted text-xs text-center">
                                            Session: <span className="text-mono">{sessionId}</span>
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Analyzing */}
                        {phase === PHASES.ANALYZING && (
                            <div className="text-center animate-fadeIn" style={{ padding: '40px 0' }}>
                                <div className="spinner" style={{ margin: '0 auto 16px' }} />
                                <p style={{ fontWeight: 600 }}>Analyzing verification data...</p>
                                <p className="text-muted text-sm mt-sm">Computing confidence score</p>
                            </div>
                        )}

                        {/* Results */}
                        {phase === PHASES.RESULTS && scoreResult && (
                            <ConfidenceScore result={scoreResult} onContinue={handleContinue} />
                        )}

                        {/* Init loading */}
                        {phase === PHASES.INIT && !error && (
                            <div className="text-center animate-fadeIn" style={{ padding: '40px 0' }}>
                                <div className="spinner" style={{ margin: '0 auto 16px' }} />
                                <p className="text-muted">Checking registration status...</p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
