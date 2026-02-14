import { useState } from 'react';
import * as walletService from '../services/walletService';

export default function WalletConnect({ onConnected, walletAddress }) {
    const [status, setStatus] = useState(walletAddress ? 'connected' : 'disconnected');
    const [error, setError] = useState('');
    const [address, setAddress] = useState(walletAddress || '');
    const [networkName, setNetworkName] = useState('');

    const handleConnect = async () => {
        setError('');
        setStatus('connecting');

        if (!walletService.isMetaMaskInstalled()) {
            setStatus('no-metamask');
            setError('MetaMask is not installed.');
            return;
        }

        try {
            // Use connectWalletFresh to force MetaMask account picker
            const addr = await walletService.connectWalletFresh();
            setAddress(addr);

            const chainId = await walletService.getNetworkId();
            setNetworkName(walletService.getNetworkName(chainId));

            setStatus('connected');
            onConnected?.(addr);
        } catch (err) {
            setError(err.message);
            setStatus('error');
        }
    };

    return (
        <div className="glass-card-static" style={{ maxWidth: 440, margin: '0 auto', textAlign: 'center' }}>
            {status === 'connected' ? (
                <div className="animate-fadeIn">
                    <div style={{ fontSize: '3rem', marginBottom: '12px' }}>✅</div>
                    <h3 style={{ fontWeight: 700, marginBottom: '8px' }}>Wallet Connected</h3>
                    <div className="wallet-badge" style={{ justifyContent: 'center', margin: '12px auto' }}>
                        <span className="wallet-dot" />
                        <span>{walletService.truncateAddress(address)}</span>
                    </div>
                    {networkName && (
                        <div className="badge badge-info mt-sm" style={{ display: 'inline-flex' }}>
                            🌐 {networkName}
                        </div>
                    )}
                </div>
            ) : (
                <div className="animate-fadeIn">
                    <div style={{ fontSize: '3.5rem', marginBottom: '16px' }}>🦊</div>
                    <h3 style={{ fontWeight: 700, fontSize: '1.15rem', marginBottom: '8px' }}>Connect Your Wallet</h3>
                    <p className="text-muted text-sm mb-md">
                        Your wallet address will serve as your permanent decentralized identity.
                    </p>

                    {status === 'no-metamask' && (
                        <div className="glass-card mb-md" style={{ padding: '14px', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                            <p style={{ color: 'var(--accent-red)', fontSize: '0.88rem', marginBottom: '8px' }}>
                                ⚠️ MetaMask not detected
                            </p>
                            <a
                                href="https://metamask.io/download/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-sm btn-secondary"
                            >
                                Install MetaMask →
                            </a>
                        </div>
                    )}

                    {error && status === 'error' && (
                        <div className="glass-card mb-md animate-shake" style={{ padding: '14px', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                            <p style={{ color: 'var(--accent-red)', fontSize: '0.85rem' }}>⚠️ {error}</p>
                        </div>
                    )}

                    <button
                        className="btn btn-primary btn-lg"
                        onClick={handleConnect}
                        disabled={status === 'connecting'}
                        style={{ width: '100%' }}
                    >
                        {status === 'connecting' ? (
                            <>
                                <span className="spinner spinner-sm" /> Connecting...
                            </>
                        ) : (
                            <>🦊 Connect MetaMask</>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}
