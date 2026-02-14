import { useState } from 'react';

export default function LandingPage({ onRegister, onVerify, walletAddress }) {
    const [hoveredCard, setHoveredCard] = useState(null);

    const features = [
        { icon: '🛡️', title: 'Anti-Spoofing', desc: 'Random liveness challenges prevent photo & video replay attacks' },
        { icon: '🔗', title: 'Decentralized ID', desc: 'Your wallet address is your identity — no passwords needed' },
        { icon: '⏱️', title: 'Time-Bound Tokens', desc: '5-minute proof tokens ensure continuous presence verification' },
        { icon: '🔒', title: 'Privacy First', desc: 'Only mathematical face encodings stored, never raw images' },
    ];

    const steps = [
        { num: '01', title: 'Connect Wallet', desc: 'Link your MetaMask wallet as your decentralized identity' },
        { num: '02', title: 'Register Face', desc: 'One-time enrollment captures your facial biometric encoding' },
        { num: '03', title: 'Verify Liveness', desc: 'Complete random challenges to prove you\'re physically present' },
        { num: '04', title: 'Access Granted', desc: 'Receive a time-bound proof-of-life token for secure access' },
    ];

    return (
        <div className="page-wrapper">
            <div className="ambient-bg" />

            {/* Header */}
            <header style={{ padding: '20px 0', position: 'relative', zIndex: 1 }}>
                <div className="container flex justify-between items-center">
                    <div className="flex items-center gap-sm">
                        <span style={{ fontSize: '1.6rem' }}>🧬</span>
                        <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                            <span className="text-gradient">ProofOfLife</span>
                        </span>
                    </div>
                    {walletAddress && (
                        <div className="wallet-badge">
                            <span className="wallet-dot" />
                            <span>{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
                        </div>
                    )}
                </div>
            </header>

            {/* Hero Section */}
            <section style={{ padding: '60px 0 40px', position: 'relative', zIndex: 1 }}>
                <div className="container text-center">
                    <div className="animate-fadeInUp">
                        <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🛡️</div>
                        <h1 style={{ fontSize: '2.8rem', fontWeight: 900, lineHeight: 1.15, marginBottom: '16px' }}>
                            Decentralized<br />
                            <span className="text-gradient">Proof of Life</span>
                        </h1>
                        <p className="text-muted" style={{ fontSize: '1.1rem', maxWidth: '560px', margin: '0 auto 36px' }}>
                            Blockchain-based identity verification combining wallet signatures,
                            facial recognition, and liveness detection for secure, privacy-preserving authentication.
                        </p>
                    </div>

                    {/* CTA Buttons */}
                    <div className="flex justify-center gap-md animate-fadeInUp stagger-2" style={{ flexWrap: 'wrap' }}>
                        <button className="btn btn-primary btn-lg" onClick={onRegister}>
                            <span>📝</span> Register
                        </button>
                        <button className="btn btn-secondary btn-lg" onClick={onVerify}>
                            <span>🔍</span> Start Verification
                        </button>
                    </div>
                </div>
            </section>

            {/* Feature Cards */}
            <section style={{ padding: '40px 0', position: 'relative', zIndex: 1 }}>
                <div className="container">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                        {features.map((f, i) => (
                            <div
                                key={f.title}
                                className={`glass-card animate-fadeInUp stagger-${i + 1}`}
                                onMouseEnter={() => setHoveredCard(i)}
                                onMouseLeave={() => setHoveredCard(null)}
                                style={{
                                    cursor: 'default',
                                    transform: hoveredCard === i ? 'translateY(-4px)' : 'translateY(0)',
                                }}
                            >
                                <div style={{ fontSize: '2rem', marginBottom: '12px' }}>{f.icon}</div>
                                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '6px' }}>{f.title}</h3>
                                <p className="text-muted text-sm">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section style={{ padding: '40px 0 60px', position: 'relative', zIndex: 1 }}>
                <div className="container">
                    <h2 className="text-center" style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '32px' }}>
                        How It <span className="text-gradient">Works</span>
                    </h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
                        {steps.map((s, i) => (
                            <div key={s.num} className="glass-card-static animate-fadeInUp" style={{ animationDelay: `${i * 0.15}s`, animationFillMode: 'backwards' }}>
                                <div className="text-gradient" style={{ fontSize: '2rem', fontWeight: 900, fontFamily: 'var(--font-mono)', marginBottom: '8px' }}>
                                    {s.num}
                                </div>
                                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '6px' }}>{s.title}</h4>
                                <p className="text-muted text-sm">{s.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer style={{ padding: '20px 0', borderTop: '1px solid var(--border-color)', position: 'relative', zIndex: 1, marginTop: 'auto' }}>
                <div className="container text-center text-muted text-xs">
                    <p>Privacy-first authentication. Your biometric data never leaves your device as raw images.</p>
                </div>
            </footer>
        </div>
    );
}
