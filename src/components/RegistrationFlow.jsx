import { useState, useEffect } from 'react';
import WalletConnect from './WalletConnect';
import CameraCapture from './CameraCapture';
import * as userStore from '../services/userStore';
import * as walletService from '../services/walletService';

const STEPS = [
    { num: 1, label: 'Connect Wallet' },
    { num: 2, label: 'Camera Setup' },
    { num: 3, label: 'Face Capture' },
    { num: 4, label: 'Complete' },
];

export default function RegistrationFlow({ walletAddress, onWalletConnect, onComplete, onBack }) {
    const [currentStep, setCurrentStep] = useState(walletAddress ? 2 : 1);
    const [address, setAddress] = useState(walletAddress || '');
    const [alreadyRegistered, setAlreadyRegistered] = useState(false);
    const [registering, setRegistering] = useState(false);
    const [registrationData, setRegistrationData] = useState(null);
    const [error, setError] = useState('');

    // Check registration after wallet connect
    useEffect(() => {
        if (address && currentStep === 2) {
            checkRegistration(address);
        }
    }, [address, currentStep]);

    const checkRegistration = async (addr) => {
        try {
            const registered = await userStore.isRegistered(addr);
            setAlreadyRegistered(registered);
        } catch {
            setAlreadyRegistered(false);
        }
    };

    const handleWalletConnected = (addr) => {
        setAddress(addr);
        onWalletConnect?.(addr);
        setCurrentStep(2);
    };

    const handleEncodingCaptured = async (data) => {
        setRegistering(true);
        setError('');
        try {
            await userStore.registerUser(address, data.encoding, {
                qualityScore: data.qualityScore,
                framesUsed: data.framesUsed,
            });
            setRegistrationData({
                walletAddress: address,
                timestamp: new Date().toLocaleString(),
                qualityScore: Math.round(data.qualityScore * 100),
                framesUsed: data.framesUsed,
            });
            setCurrentStep(4);
        } catch (err) {
            setError(`Registration failed: ${err.message}`);
        } finally {
            setRegistering(false);
        }
    };

    const handleReRegister = () => {
        setAlreadyRegistered(false);
        setCurrentStep(3);
    };

    const stepClass = (step) => {
        if (step.num < currentStep) return 'completed';
        if (step.num === currentStep) return 'active';
        return '';
    };

    return (
        <div className="page-wrapper">
            <div className="ambient-bg" />
            <div className="container" style={{ maxWidth: 640, padding: '40px 20px', position: 'relative', zIndex: 1 }}>
                {/* Back Button */}
                <button className="btn btn-secondary btn-sm mb-lg" onClick={onBack}>
                    ← Back
                </button>

                <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '8px', textAlign: 'center' }}>
                    📝 <span className="text-gradient">Registration</span>
                </h2>
                <p className="text-muted text-sm text-center mb-lg">
                    One-time process linking your wallet to your facial biometrics
                </p>

                {/* Stepper */}
                <div className="stepper">
                    {STEPS.map((step, i) => (
                        <div key={step.num} style={{ display: 'flex', alignItems: 'center' }}>
                            <div className={`stepper-step ${stepClass(step)}`}>
                                <div className="stepper-circle">
                                    {step.num < currentStep ? '✓' : step.num}
                                </div>
                                <span className="stepper-label">{step.label}</span>
                            </div>
                            {i < STEPS.length - 1 && (
                                <div className={`stepper-line ${step.num < currentStep ? 'completed' : ''}`} />
                            )}
                        </div>
                    ))}
                </div>

                {error && (
                    <div className="glass-card mb-md animate-shake" style={{ padding: '14px', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                        <p style={{ color: 'var(--accent-red)', fontSize: '0.88rem' }}>⚠️ {error}</p>
                    </div>
                )}

                {/* Step 1: Wallet Connect */}
                {currentStep === 1 && (
                    <WalletConnect onConnected={handleWalletConnected} walletAddress={address} />
                )}

                {/* Step 2: Already registered check */}
                {currentStep === 2 && alreadyRegistered && (
                    <div className="glass-card-static text-center animate-fadeIn" style={{ maxWidth: 440, margin: '0 auto' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '12px' }}>ℹ️</div>
                        <h3 style={{ fontWeight: 700, marginBottom: '8px' }}>Already Registered</h3>
                        <p className="text-muted text-sm mb-md">
                            Wallet <span className="text-mono">{walletService.truncateAddress(address)}</span> is already registered.
                        </p>
                        <div className="flex flex-col gap-sm">
                            <button className="btn btn-primary" onClick={() => onComplete?.()}>
                                Go to Verification →
                            </button>
                        </div>
                        <p className="text-muted text-xs" style={{ marginTop: '12px' }}>
                            🔒 To re-register, verify your identity first from the Dashboard.
                        </p>
                    </div>
                )}

                {/* Step 2/3: Camera Setup & Capture */}
                {((currentStep === 2 && !alreadyRegistered) || currentStep === 3) && (
                    <div className="animate-fadeIn">
                        <CameraCapture
                            onEncodingCaptured={handleEncodingCaptured}
                            onQualityUpdate={() => {
                                if (currentStep === 2) setCurrentStep(3);
                            }}
                        />
                        {registering && (
                            <div className="flex items-center justify-center gap-sm mt-md">
                                <div className="spinner spinner-sm" />
                                <span className="text-muted text-sm">Saving registration...</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Step 4: Success */}
                {currentStep === 4 && registrationData && (
                    <div className="glass-card-static text-center animate-fadeIn" style={{ maxWidth: 440, margin: '0 auto' }}>
                        <div style={{ fontSize: '4rem', marginBottom: '12px' }} className="animate-successPop">✅</div>
                        <h3 style={{ fontWeight: 800, fontSize: '1.3rem', marginBottom: '8px' }}>Registration Successful!</h3>
                        <div className="flex flex-col gap-sm mt-md" style={{ textAlign: 'left' }}>
                            <div className="flex justify-between items-center" style={{ padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                                <span className="text-muted text-sm">Wallet</span>
                                <span className="text-mono text-sm">{walletService.truncateAddress(registrationData.walletAddress)}</span>
                            </div>
                            <div className="flex justify-between items-center" style={{ padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                                <span className="text-muted text-sm">Registered</span>
                                <span className="text-sm">{registrationData.timestamp}</span>
                            </div>
                            <div className="flex justify-between items-center" style={{ padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                                <span className="text-muted text-sm">Quality Score</span>
                                <span className="badge badge-success">{registrationData.qualityScore}%</span>
                            </div>
                            <div className="flex justify-between items-center" style={{ padding: '8px 0' }}>
                                <span className="text-muted text-sm">Frames Used</span>
                                <span className="text-sm">{registrationData.framesUsed}</span>
                            </div>
                        </div>

                        <div className="glass-card mt-md" style={{ padding: '12px', borderColor: 'rgba(6, 182, 212, 0.2)' }}>
                            <p className="text-sm" style={{ color: 'var(--accent-cyan)' }}>
                                💡 <strong>Tip:</strong> Use similar lighting conditions during verification for best accuracy.
                            </p>
                        </div>

                        <button className="btn btn-success btn-lg mt-lg" style={{ width: '100%' }} onClick={() => onComplete?.()}>
                            Go to Verification →
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
