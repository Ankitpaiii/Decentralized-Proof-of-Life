// Wallet Service — MetaMask connection and interaction via ethers.js
import { BrowserProvider } from 'ethers';

let provider = null;
let signer = null;
let currentAddress = null;

const NETWORK_NAMES = {
  '1': 'Ethereum Mainnet',
  '5': 'Goerli Testnet',
  '11155111': 'Sepolia Testnet',
  '137': 'Polygon Mainnet',
  '80001': 'Mumbai Testnet',
  '56': 'BSC Mainnet',
  '31337': 'Localhost',
};

const LOGOUT_FLAG_KEY = 'pol_logged_out';

export function isMetaMaskInstalled() {
  return typeof window.ethereum !== 'undefined' && window.ethereum.isMetaMask;
}

// Standard connect — used for auto-reconnect on page load only
export async function connectWallet() {
  if (!isMetaMaskInstalled()) {
    throw new Error('MetaMask is not installed. Please install MetaMask to continue.');
  }

  try {
    provider = new BrowserProvider(window.ethereum);
    const accounts = await provider.send('eth_requestAccounts', []);
    signer = await provider.getSigner();
    currentAddress = await signer.getAddress();
    return currentAddress;
  } catch (err) {
    if (err.code === 4001) {
      throw new Error('Connection rejected. Please approve the MetaMask connection to continue.');
    }
    throw new Error(`Failed to connect wallet: ${err.message}`);
  }
}

// Fresh connect — forces MetaMask to show account picker (allows switching accounts)
export async function connectWalletFresh() {
  if (!isMetaMaskInstalled()) {
    throw new Error('MetaMask is not installed. Please install MetaMask to continue.');
  }

  try {
    provider = new BrowserProvider(window.ethereum);

    // wallet_requestPermissions forces MetaMask to re-show the account picker
    await provider.send('wallet_requestPermissions', [{ eth_accounts: {} }]);

    // After user picks an account, get it
    const accounts = await provider.send('eth_accounts', []);
    if (!accounts || accounts.length === 0) {
      throw new Error('No account selected. Please select an account in MetaMask.');
    }

    signer = await provider.getSigner();
    currentAddress = await signer.getAddress();

    // Clear logout flag on successful connection
    clearLogoutFlag();

    return currentAddress;
  } catch (err) {
    if (err.code === 4001) {
      throw new Error('Connection rejected. Please approve the MetaMask connection to continue.');
    }
    throw new Error(`Failed to connect wallet: ${err.message}`);
  }
}

export function getWalletAddress() {
  return currentAddress;
}

export async function signMessage(message) {
  if (!signer) throw new Error('Wallet not connected.');
  return await signer.signMessage(message);
}

export async function getNetworkId() {
  if (!provider) throw new Error('Wallet not connected.');
  const network = await provider.getNetwork();
  return network.chainId.toString();
}

export function getNetworkName(chainId) {
  return NETWORK_NAMES[chainId] || `Chain ${chainId}`;
}

export function truncateAddress(address) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function disconnectWallet() {
  provider = null;
  signer = null;
  currentAddress = null;

  // Set logout flag so auto-connect on page load is skipped
  sessionStorage.setItem(LOGOUT_FLAG_KEY, 'true');

  // Attempt to revoke MetaMask permissions so it forgets this dApp
  if (isMetaMaskInstalled()) {
    try {
      window.ethereum.request({
        method: 'wallet_revokePermissions',
        params: [{ eth_accounts: {} }],
      }).catch(() => {
        // wallet_revokePermissions may not be supported in older MetaMask versions — safe to ignore
      });
    } catch {
      // Silently ignore if method not available
    }
  }
}

// Logout flag helpers — prevents auto-connect after intentional logout
export function wasLoggedOut() {
  return sessionStorage.getItem(LOGOUT_FLAG_KEY) === 'true';
}

export function clearLogoutFlag() {
  sessionStorage.removeItem(LOGOUT_FLAG_KEY);
}

// Listen for account/chain changes
export function setupWalletListeners(onAccountChange, onChainChange) {
  if (!window.ethereum) return;

  window.ethereum.on('accountsChanged', (accounts) => {
    if (accounts.length === 0) {
      disconnectWallet();
      onAccountChange?.(null);
    } else {
      currentAddress = accounts[0];
      onAccountChange?.(accounts[0]);
    }
  });

  window.ethereum.on('chainChanged', (chainId) => {
    const id = parseInt(chainId, 16).toString();
    onChainChange?.(id);
  });
}
