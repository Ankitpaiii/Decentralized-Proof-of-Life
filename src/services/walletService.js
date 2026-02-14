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

export function isMetaMaskInstalled() {
  return typeof window.ethereum !== 'undefined' && window.ethereum.isMetaMask;
}

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
