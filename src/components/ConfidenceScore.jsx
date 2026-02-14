import { useEffect, useState } from 'react';
import { getScoreColor } from '../services/scoring';

export default function ConfidenceScore({ result, onContinue }) {
    const [animatedScore, setAnimatedScore] = useState(0);
    const [showDetails, setShowDetails] = useState(false);

    useEffect(() => {
        if (!result) return;
        // Animate the score from 0 to actual value
        let start = 0;
        const target = result.score;
        const startTime = Date.now();
        const duration = 1500;

        const tick = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // ease-out
            const current = start + (target - start) * eased;
            setAnimatedScore(Math.round(current * 10) / 10);

            if (progress < 1) requestAnimationFrame(tick);
            else setShowDetails(true);
        };
        requestAnimationFrame(tick);
    }, [result]);

    if (!result) return null;

    const scoreColor = getScoreColor(result.score);
    const circumference = 2 * Math.PI * 65;
    const dashOffset = circumference * (1 - animatedScore / 100);

    const levelEmoji = {
        excellent: '🌟',
        good: '✅',
        acceptable: '⚠️',
        fail: '❌',
    };

    return (
        <div className="animate-fadeIn" style={{ textAlign: 'center' }}>
            {/* Big Score Gauge */}
            <div className="score-gauge" style={{ width: 180, height: 180, margin: '0 auto 20px' }}>
                <svg width="180" height="180" viewBox="0 0 180 180">
                    <circle className="score-gauge-track" cx="90" cy="90" r="65" />
                    <circle
                        className="score-gauge-fill"
                        cx="90" cy="90" r="65"
                        stroke={scoreColor}
                        strokeDasharray={circumference}
                        strokeDashoffset={dashOffset}
                        style={{ transition: 'stroke-dashoffset 1.5s ease-out' }}
                    />
                </svg>
                <div className="score-gauge-text">
                    <div className="score-gauge-value" style={{ color: scoreColor }}>
                        {animatedScore}%
                    </div>
                    <div className="score-gauge-label">confidence</div>
                </div>
            </div>

            {/* Verdict */}
            <div className="animate-fadeInUp stagger-2" style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '2rem' }}>
                    {levelEmoji[result.level] || '❓'}
                </div>
                <h3 style={{ fontWeight: 700, color: scoreColor, fontSize: '1.2rem', marginTop: '4px' }}>
                    {result.pass ? 'Verification Passed' : 'Verification Failed'}
                </h3>
                <p className="text-muted text-sm">
                    {result.identityMismatch && '🚫 Face does not match registered identity'}
                    {!result.identityMismatch && result.level === 'excellent' && 'Excellent — Very high confidence match'}
                    {!result.identityMismatch && result.level === 'good' && 'Good — Identity verified successfully'}
                    {!result.identityMismatch && result.level === 'acceptable' && 'Acceptable — Passed with lower confidence'}
                    {!result.identityMismatch && result.level === 'fail' && 'Insufficient confidence for verification'}
                </p>
            </div>

            {/* Score Breakdown */}
            {showDetails && result.breakdown && (
                <div className="glass-card-static animate-fadeInUp" style={{ textAlign: 'left', marginBottom: '20px' }}>
                    <h4 className="text-sm" style={{ fontWeight: 700, marginBottom: '14px', color: 'var(--text-secondary)' }}>
                        SCORE BREAKDOWN
                    </h4>
                    {Object.values(result.breakdown).map((item) => (
                        <div key={item.label} style={{ marginBottom: '12px' }}>
                            <div className="flex justify-between items-center mb-sm">
                                <span className="text-sm">{item.label}</span>
                                <span className="text-mono text-sm" style={{ color: getScoreColor(item.raw * 100) }}>
                                    {Math.round(item.raw * 100)}%
                                </span>
                            </div>
                            <div className="progress-bar">
                                <div
                                    className="progress-bar-fill"
                                    style={{
                                        width: `${Math.round(item.raw * 100)}%`,
                                        background: getScoreColor(item.raw * 100),
                                        transition: 'width 1s ease-out',
                                    }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Action Button */}
            <button
                className={`btn ${result.pass ? 'btn-success' : 'btn-primary'} btn-lg`}
                style={{ width: '100%' }}
                onClick={onContinue}
            >
                {result.pass ? '🔓 Access Dashboard' : '🔄 Try Again'}
            </button>
        </div>
    );
}
