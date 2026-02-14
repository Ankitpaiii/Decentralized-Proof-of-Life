import { useState, useCallback, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import RegistrationFlow from './components/RegistrationFlow';
import VerificationScreen from './components/VerificationScreen';
import Dashboard from './components/Dashboard';
import WalletConnect from './components/WalletConnect';
import * as walletService from './services/walletService';
import * as userStore from './services/userStore';
import * as tokenManager from './services/tokenManager';

const SCREENS = {
  LANDING: 'landing',
  REGISTER: 'register',
  WALLET_CHECK: 'wallet_check',
  VERIFY: 'verify',
  DASHBOARD: 'dashboard',
};

export default function App() {
  const [screen, setScreen] = useState(SCREENS.LANDING);
  const [walletAddress, setWalletAddress] = useState(null);
  const [activeToken, setActiveToken] = useState(null);
  const [fadeClass, setFadeClass] = useState('animate-fadeIn');

  // Check for existing wallet connection on mount
  useEffect(() => {
    const checkWallet = async () => {
      if (walletService.isMetaMaskInstalled() && window.ethereum.selectedAddress) {
        try {
          const addr = await walletService.connectWallet();
          setWalletAddress(addr);

          // Check for active token
          const token = tokenManager.getActiveToken(addr);
          if (token) {
            setActiveToken(token);
          }
        } catch {
          // Silently fail on auto-connect
        }
      }
    };
    checkWallet();

    // Set up wallet event listeners
    walletService.setupWalletListeners(
      (addr) => {
        setWalletAddress(addr);
        if (!addr) {
          setScreen(SCREENS.LANDING);
          setActiveToken(null);
        }
      },
      () => {
        // Chain changed - could add network validation here
      }
    );
  }, []);

  const transition = useCallback((nextScreen) => {
    setFadeClass('');
    requestAnimationFrame(() => {
      setScreen(nextScreen);
      setFadeClass('animate-fadeIn');
    });
  }, []);

  const handleRegister = () => {
    transition(SCREENS.REGISTER);
  };

  const handleVerify = async () => {
    if (!walletAddress) {
      transition(SCREENS.WALLET_CHECK);
      return;
    }

    // Check if registered
    const registered = await userStore.isRegistered(walletAddress);
    if (!registered) {
      transition(SCREENS.REGISTER);
      return;
    }

    transition(SCREENS.VERIFY);
  };

  const handleWalletConnect = (addr) => {
    setWalletAddress(addr);
  };

  const handleRegistrationComplete = () => {
    transition(SCREENS.VERIFY);
  };

  const handleVerificationComplete = (token) => {
    if (token) setActiveToken(token);
  };

  const handleDashboard = (token) => {
    if (token) setActiveToken(token);
    transition(SCREENS.DASHBOARD);
  };

  const handleLogout = () => {
    walletService.disconnectWallet();
    tokenManager.clearTokens();
    setWalletAddress(null);
    setActiveToken(null);
    transition(SCREENS.LANDING);
  };

  const handleReVerify = () => {
    transition(SCREENS.VERIFY);
  };

  const handleBack = () => {
    transition(SCREENS.LANDING);
  };

  const handleWalletCheckDone = async (addr) => {
    setWalletAddress(addr);
    const registered = await userStore.isRegistered(addr);
    if (registered) {
      transition(SCREENS.VERIFY);
    } else {
      transition(SCREENS.REGISTER);
    }
  };

  return (
    <div className={fadeClass} style={{ minHeight: '100vh' }}>
      {screen === SCREENS.LANDING && (
        <LandingPage
          onRegister={handleRegister}
          onVerify={handleVerify}
          walletAddress={walletAddress}
        />
      )}

      {screen === SCREENS.WALLET_CHECK && (
        <div className="page-wrapper">
          <div className="ambient-bg" />
          <div className="container" style={{ maxWidth: 480, padding: '60px 20px', position: 'relative', zIndex: 1 }}>
            <button className="btn btn-secondary btn-sm mb-lg" onClick={handleBack}>← Back</button>
            <h2 className="text-center" style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '20px' }}>
              Connect Wallet to Continue
            </h2>
            <WalletConnect onConnected={handleWalletCheckDone} walletAddress={walletAddress} />
          </div>
        </div>
      )}

      {screen === SCREENS.REGISTER && (
        <RegistrationFlow
          walletAddress={walletAddress}
          onWalletConnect={handleWalletConnect}
          onComplete={handleRegistrationComplete}
          onBack={handleBack}
        />
      )}

      {screen === SCREENS.VERIFY && (
        <VerificationScreen
          walletAddress={walletAddress}
          onComplete={handleVerificationComplete}
          onDashboard={handleDashboard}
          onBack={handleBack}
        />
      )}

      {screen === SCREENS.DASHBOARD && (
        <Dashboard
          walletAddress={walletAddress}
          token={activeToken}
          onLogout={handleLogout}
          onReVerify={handleReVerify}
        />
      )}
    </div>
  );
}
