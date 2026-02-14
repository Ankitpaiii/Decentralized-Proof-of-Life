import { useState, useRef, useEffect, useCallback } from 'react';
import * as faceService from '../services/faceEncodingService';

export default function CameraCapture({ onEncodingCaptured, onQualityUpdate }) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);
    const animFrameRef = useRef(null);

    const [cameraReady, setCameraReady] = useState(false);
    const [modelsReady, setModelsReady] = useState(false);
    const [quality, setQuality] = useState({ faceDetected: false, goodLighting: false, properDistance: false, frontalAngle: false });
    const [capturing, setCapturing] = useState(false);
    const [countdown, setCountdown] = useState(null);
    const [captureProgress, setCaptureProgress] = useState(0);
    const [error, setError] = useState('');

    // Initialize camera
    useEffect(() => {
        const initCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
                });
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                    setCameraReady(true);
                }
            } catch (err) {
                setError(err.name === 'NotAllowedError'
                    ? 'Camera access denied. Please enable camera permissions in your browser settings.'
                    : `Camera error: ${err.message}`);
            }
        };

        const initModels = async () => {
            try {
                await faceService.initModels();
                setModelsReady(true);
            } catch (err) {
                setError(`Failed to load face detection models: ${err.message}`);
            }
        };

        initCamera();
        initModels();

        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((t) => t.stop());
            }
            if (animFrameRef.current) {
                cancelAnimationFrame(animFrameRef.current);
            }
        };
    }, []);

    // Detection loop
    const runDetection = useCallback(async () => {
        if (!videoRef.current || !canvasRef.current || !cameraReady || !modelsReady || capturing) return;

        const detection = await faceService.detectFace(videoRef.current);
        const displaySize = { width: videoRef.current.videoWidth, height: videoRef.current.videoHeight };

        if (canvasRef.current) {
            canvasRef.current.width = displaySize.width;
            canvasRef.current.height = displaySize.height;
            faceService.drawDetection(canvasRef.current, detection, displaySize);
        }

        const q = faceService.checkFaceQuality(detection, displaySize.width, displaySize.height);
        setQuality(q);
        onQualityUpdate?.(q);

        animFrameRef.current = requestAnimationFrame(runDetection);
    }, [cameraReady, modelsReady, capturing, onQualityUpdate]);

    useEffect(() => {
        if (cameraReady && modelsReady && !capturing) {
            animFrameRef.current = requestAnimationFrame(runDetection);
        }
        return () => {
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        };
    }, [cameraReady, modelsReady, capturing, runDetection]);

    // Capture encoding with countdown
    const startCapture = async () => {
        // Countdown 3-2-1
        for (let i = 3; i > 0; i--) {
            setCountdown(i);
            await new Promise((r) => setTimeout(r, 1000));
        }
        setCountdown(null);
        setCapturing(true);
        setCaptureProgress(0);

        try {
            const totalFrames = 5;
            const descriptors = [];

            for (let i = 0; i < totalFrames; i++) {
                setCaptureProgress(((i + 1) / totalFrames) * 100);
                const detection = await faceService.detectFace(videoRef.current);
                if (detection) descriptors.push(Array.from(detection.descriptor));
                await new Promise((r) => setTimeout(r, 400));
            }

            if (descriptors.length < 3) {
                throw new Error(`Only captured ${descriptors.length} valid frames. Please ensure good lighting and face visibility.`);
            }

            // Average descriptors
            const encoding = new Float32Array(128);
            for (const desc of descriptors) {
                for (let j = 0; j < 128; j++) encoding[j] += desc[j];
            }
            for (let j = 0; j < 128; j++) encoding[j] /= descriptors.length;

            onEncodingCaptured?.({
                encoding: Array.from(encoding),
                framesUsed: descriptors.length,
                qualityScore: quality.score || 0.9,
            });
        } catch (err) {
            setError(err.message);
            setCapturing(false);
        }
    };

    const allChecksPass = quality.faceDetected && quality.properDistance && quality.frontalAngle;

    return (
        <div className="animate-fadeIn">
            {/* Privacy Notice */}
            <div className="glass-card-static mb-md" style={{ padding: '12px 16px', borderColor: 'rgba(6, 182, 212, 0.2)' }}>
                <p className="text-sm" style={{ color: 'var(--accent-cyan)' }}>
                    🔒 <strong>Privacy:</strong> Only mathematical face encodings are stored. Your image is never saved.
                </p>
            </div>

            {error && (
                <div className="glass-card mb-md animate-shake" style={{ padding: '14px', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                    <p style={{ color: 'var(--accent-red)', fontSize: '0.88rem' }}>⚠️ {error}</p>
                    <button className="btn btn-sm btn-secondary mt-sm" onClick={() => setError('')}>Dismiss</button>
                </div>
            )}

            {/* Camera View */}
            <div className="camera-container" style={{ marginBottom: '16px' }}>
                <video ref={videoRef} playsInline muted />
                <canvas ref={canvasRef} />
                {!cameraReady && (
                    <div className="camera-overlay" style={{ background: 'rgba(0,0,0,0.8)', flexDirection: 'column', gap: '12px' }}>
                        <div className="spinner" />
                        <p className="text-sm text-muted">Initializing camera...</p>
                    </div>
                )}
                {cameraReady && !quality.faceDetected && !capturing && (
                    <div className="camera-overlay">
                        <div className="face-guide" />
                    </div>
                )}
                {cameraReady && quality.faceDetected && !capturing && (
                    <div className="camera-overlay">
                        <div className="face-guide detected" />
                    </div>
                )}
                {countdown !== null && (
                    <div className="camera-overlay" style={{ background: 'rgba(0,0,0,0.5)' }}>
                        <div style={{ fontSize: '5rem', fontWeight: 900, color: '#fff', animation: 'countUp 0.5s ease-out' }}>
                            {countdown}
                        </div>
                    </div>
                )}
                {capturing && (
                    <div className="camera-overlay" style={{ background: 'rgba(0,0,0,0.3)', flexDirection: 'column', gap: '8px' }}>
                        <div className="spinner" />
                        <p style={{ color: '#fff', fontWeight: 600 }}>Capturing... {Math.round(captureProgress)}%</p>
                    </div>
                )}
            </div>

            {/* Quality Indicators */}
            <div className="quality-grid">
                <div className={`quality-item ${quality.faceDetected ? 'pass' : 'fail'}`}>
                    <span className="quality-icon">{quality.faceDetected ? '✅' : '❌'}</span>
                    <span>Face Detected</span>
                </div>
                <div className={`quality-item ${quality.goodLighting ? 'pass' : 'fail'}`}>
                    <span className="quality-icon">{quality.goodLighting ? '✅' : '⚠️'}</span>
                    <span>Good Lighting</span>
                </div>
                <div className={`quality-item ${quality.properDistance ? 'pass' : 'fail'}`}>
                    <span className="quality-icon">{quality.properDistance ? '✅' : '❌'}</span>
                    <span>Proper Distance</span>
                </div>
                <div className={`quality-item ${quality.frontalAngle ? 'pass' : 'fail'}`}>
                    <span className="quality-icon">{quality.frontalAngle ? '✅' : '❌'}</span>
                    <span>Frontal Angle</span>
                </div>
            </div>

            {/* Loading state for models */}
            {!modelsReady && (
                <div className="flex items-center justify-center gap-sm mt-md text-muted text-sm">
                    <div className="spinner spinner-sm" />
                    <span>Loading face detection models...</span>
                </div>
            )}

            {/* Capture Button */}
            <button
                className="btn btn-primary btn-lg mt-md"
                style={{ width: '100%' }}
                onClick={startCapture}
                disabled={!allChecksPass || !modelsReady || capturing}
            >
                {capturing ? (
                    <>
                        <span className="spinner spinner-sm" /> Capturing Face Data...
                    </>
                ) : (
                    <>📸 Capture Face Encoding</>
                )}
            </button>

            {!allChecksPass && modelsReady && cameraReady && (
                <p className="text-muted text-sm text-center mt-sm">
                    Position your face in the frame and ensure good lighting to proceed.
                </p>
            )}
        </div>
    );
}
