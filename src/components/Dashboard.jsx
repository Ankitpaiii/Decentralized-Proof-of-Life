import { useState, useEffect, useRef } from 'react';
import * as tokenManager from '../services/tokenManager';
import * as userStore from '../services/userStore';
import * as walletService from '../services/walletService';

export default function Dashboard({ walletAddress, token: initialToken, onLogout, onReVerify }) {
    const [token, setToken] = useState(initialToken);
    const [remaining, setRemaining] = useState(tokenManager.getRemainingTime(initialToken));
    const [history, setHistory] = useState([]);
    const [stats, setStats] = useState(null);
    const [showExpiredModal, setShowExpiredModal] = useState(false);
    const timerRef = useRef(null);

    // Load data
    useEffect(() => {
        const load = async () => {
            try {
                const hist = await userStore.getVerificationHistory(walletAddress, 10);
                setHistory(hist);
                const st = await userStore.getVerificationStats(walletAddress);
                setStats(st);
            } catch (e) {
                console.error('Dashboard data load error:', e);
            }
        };
        load();
    }, [walletAddress]);

    // Token countdown
    useEffect(() => {
        timerRef.current = setInterval(() => {
            const r = tokenManager.getRemainingTime(token);
            setRemaining(r);

            if (r.expired) {
                clearInterval(timerRef.current);
                setShowExpiredModal(true);
            }
        }, 1000);

        return () => clearInterval(timerRef.current);
    }, [token]);

    const handleRevoke = async () => {
        if (token) tokenManager.revokeToken(token.tokenId);
        await walletService.disconnectWallet();
        tokenManager.clearTokens();
        onLogout?.();
    };

    const handleLogout = async () => {
        await walletService.disconnectWallet();
        tokenManager.clearTokens();
        onLogout?.();
    };

    const getTimerColor = () => {
        if (remaining.totalSeconds > 180) return 'var(--accent-green)';
        if (remaining.totalSeconds > 60) return 'var(--accent-yellow)';
        return 'var(--accent-red)';
    };

    const secureResources = [
        { icon: '📄', title: 'Personal Documents', desc: '2 secured files', bg: 'rgba(139, 92, 246, 0.15)' },
        { icon: '🔐', title: 'Encrypted Files', desc: '4 encrypted items', bg: 'rgba(6, 182, 212, 0.15)' },
        { icon: '🏦', title: 'Financial Access', desc: 'Account verified', bg: 'rgba(16, 185, 129, 0.15)' },
        { icon: '⚙️', title: 'Settings', desc: 'Security preferences', bg: 'rgba(245, 158, 11, 0.15)' },
    ];

    return (
        <div className="page-wrapper">
            <div className="ambient-bg" />

            {/* Expired Modal */}
            {showExpiredModal && (
                <div className="overlay">
                    <div className="modal text-center">
                        <div style={{ fontSize: '3rem', marginBottom: '12px' }}>⏰</div>
                        <h3 style={{ fontWeight: 700, marginBottom: '8px' }}>Session Expired</h3>
                        <p className="text-muted text-sm mb-md">Your proof-of-life token has expired. Please verify again to continue.</p>
                        <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={onReVerify}>
                            🔄 Verify Again
                        </button>
                    </div>
                </div>
            )}

            <div className="container" style={{ padding: '30px 20px', position: 'relative', zIndex: 1 }}>
                {/* Dashboard Header */}
                <div className="glass-card-static mb-md animate-fadeIn" style={{ padding: '20px' }}>
                    <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: '12px' }}>
                        <div className="flex items-center gap-sm">
                            <span style={{ fontSize: '1.5rem' }}>🛡️</span>
                            <div>
                                <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Verified Dashboard</h2>
                                <div className="flex items-center gap-sm mt-sm" style={{ flexWrap: 'wrap' }}>
                                    <div className="badge badge-success">✓ Authenticated</div>
                                    <div className="wallet-badge" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                                        <span className="wallet-dot" />
                                        {walletService.truncateAddress(walletAddress)}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div className="text-xs text-muted">Token Expires In</div>
                            <div className="token-countdown" style={{ color: getTimerColor(), fontSize: '1.6rem' }}>
                                {remaining.formatted || '0:00'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                    {/* Token Info */}
                    <div className="token-card animate-fadeInUp stagger-1">
                        <h3 className="section-title text-sm" style={{ marginBottom: '14px' }}>
                            <span className="icon">🎫</span> Proof-of-Life Token
                        </h3>
                        {token && (
                            <div className="flex flex-col gap-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted text-sm">Token ID</span>
                                    <span className="token-id text-xs">{token.tokenId}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted text-sm">Status</span>
                                    <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>● Active</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted text-sm">Issued</span>
                                    <span className="text-sm">{new Date(token.issuedAt).toLocaleTimeString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted text-sm">Expires</span>
                                    <span className="text-sm">{new Date(token.expiresAt).toLocaleTimeString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted text-sm">Confidence</span>
                                    <span className="text-sm" style={{ fontWeight: 700, color: 'var(--accent-green)' }}>
                                        {Math.round(token.confidenceScore * 10) / 10}%
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Verification Details */}
                    <div className="glass-card-static animate-fadeInUp stagger-2">
                        <h3 className="section-title text-sm" style={{ marginBottom: '14px' }}>
                            <span className="icon">📊</span> Verification Details
                        </h3>
                        {token && (
                            <div className="flex flex-col gap-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted text-sm">Session</span>
                                    <span className="text-mono text-xs">{token.sessionId}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted text-sm">Challenge</span>
                                    <span className="text-sm">{token.challengeType?.replace('_', ' ') || '—'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted text-sm">Verified At</span>
                                    <span className="text-sm">{new Date(token.issuedAt).toLocaleString()}</span>
                                </div>
                            </div>
                        )}

                        {/* Stats */}
                        {stats && (
                            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                                    <div className="glass-card" style={{ padding: '10px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-violet)' }}>{stats.total}</div>
                                        <div className="text-xs text-muted">Total</div>
                                    </div>
                                    <div className="glass-card" style={{ padding: '10px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-green)' }}>{stats.successRate}%</div>
                                        <div className="text-xs text-muted">Success Rate</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Verification History */}
                {history.length > 0 && (
                    <div className="glass-card-static mt-md animate-fadeInUp stagger-3">
                        <h3 className="section-title text-sm" style={{ marginBottom: '14px' }}>
                            <span className="icon">📜</span> Verification History
                        </h3>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Date/Time</th>
                                        <th>Challenge</th>
                                        <th>Confidence</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.map((s, i) => (
                                        <tr key={i}>
                                            <td>{new Date(s.timestamp).toLocaleString()}</td>
                                            <td>{s.challengeType?.replace('_', ' ') || '—'}</td>
                                            <td>
                                                <span style={{
                                                    fontFamily: 'var(--font-mono)',
                                                    color: s.confidenceScore >= 85 ? 'var(--accent-green)' : s.confidenceScore >= 75 ? 'var(--accent-yellow)' : 'var(--accent-red)',
                                                }}>
                                                    {Math.round((s.confidenceScore || 0) * 10) / 10}%
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`badge ${s.success ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.7rem' }}>
                                                    {s.success ? '✓ Pass' : '✗ Fail'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Secure Resources */}
                <div className="glass-card-static mt-md animate-fadeInUp stagger-4">
                    <h3 className="section-title text-sm" style={{ marginBottom: '14px' }}>
                        <span className="icon">🔒</span> Secure Resources
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                        {secureResources.map((r) => (
                            <div key={r.title} className="resource-card">
                                <div className="resource-icon" style={{ background: r.bg }}>{r.icon}</div>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{r.title}</div>
                                    <div className="text-muted text-xs">{r.desc}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Actions */}
                <div className="glass-card-static mt-md animate-fadeInUp stagger-5">
                    <h3 className="section-title text-sm" style={{ marginBottom: '14px' }}>
                        <span className="icon">⚡</span> Actions
                    </h3>
                    <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
                        <button className="btn btn-primary" onClick={onReVerify}>
                            🔄 Re-Verify
                        </button>
                        <button className="btn btn-secondary" onClick={handleRevoke}>
                            🚫 Revoke Token
                        </button>
                        <button className="btn btn-danger" onClick={handleLogout}>
                            🚪 Logout
                        </button>
                    </div>
                </div>

                {/* Warning bar */}
                {remaining.totalSeconds > 0 && remaining.totalSeconds <= 60 && (
                    <div className="glass-card mt-md animate-pulse" style={{
                        padding: '12px',
                        borderColor: 'rgba(239, 68, 68, 0.4)',
                        textAlign: 'center',
                    }}>
                        <p style={{ color: 'var(--accent-red)', fontWeight: 600, fontSize: '0.9rem' }}>
                            ⚠️ Token expiring in {remaining.totalSeconds}s — Re-verify to maintain access
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
