import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { Contract, ethers } from 'ethers';
import { isAddress, formatUnits, parseUnits } from 'viem';

import { Header } from './Header';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { publicClient } from '../lib/publicClient';
import {
  CETH_ABI,
  CETH_ADDRESS,
  CUSDT_ABI,
  CUSDT_ADDRESS,
  STAKING_ABI,
  STAKING_ADDRESS,
} from '../config/contracts';
import { decryptEuint64 } from '../lib/zama';
import '../styles/EncryptFi.css';

type TokenKey = 'cETH' | 'cUSDT';

const DECIMALS = 6;
const ZERO_HANDLE = ethers.ZeroHash;

function isConfiguredAddress(address: string): boolean {
  return isAddress(address);
}

function asAddress(address: string): `0x${string}` {
  return address as `0x${string}`;
}

function isEmptyAbi(abi: readonly unknown[]): boolean {
  return abi.length === 0;
}

export function EncryptFiApp() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const signerPromise = useEthersSigner();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();

  const configured =
    isConfiguredAddress(CETH_ADDRESS) &&
    isConfiguredAddress(CUSDT_ADDRESS) &&
    isConfiguredAddress(STAKING_ADDRESS) &&
    !isEmptyAbi(CETH_ABI) &&
    !isEmptyAbi(CUSDT_ABI) &&
    !isEmptyAbi(STAKING_ABI);

  const [walletHandles, setWalletHandles] = useState<{ cETH?: string; cUSDT?: string }>({});
  const [stakedHandles, setStakedHandles] = useState<{ cETH?: string; cUSDT?: string }>({});
  const [walletClear, setWalletClear] = useState<{ cETH?: bigint; cUSDT?: bigint }>({});
  const [stakedClear, setStakedClear] = useState<{ cETH?: bigint; cUSDT?: bigint }>({});

  const [stakeInput, setStakeInput] = useState<{ cETH: string; cUSDT: string }>({ cETH: '', cUSDT: '' });
  const [unstakeInput, setUnstakeInput] = useState<{ cETH: string; cUSDT: string }>({ cETH: '', cUSDT: '' });

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const networkLabel = useMemo(() => {
    if (!isConnected) return 'Not connected';
    if (chainId === 11155111) return 'Sepolia';
    return `Chain ${chainId}`;
  }, [chainId, isConnected]);

  const refreshEncrypted = useCallback(async () => {
    if (!configured || !address) return;

    setError(null);
    try {
      const [cEthBal, cUsdtBal, stakedCeth, stakedCusdt] = await Promise.all([
        publicClient.readContract({
          address: asAddress(CETH_ADDRESS),
          abi: CETH_ABI,
          functionName: 'confidentialBalanceOf',
          args: [address],
        }) as Promise<string>,
        publicClient.readContract({
          address: asAddress(CUSDT_ADDRESS),
          abi: CUSDT_ABI,
          functionName: 'confidentialBalanceOf',
          args: [address],
        }) as Promise<string>,
        publicClient.readContract({
          address: asAddress(STAKING_ADDRESS),
          abi: STAKING_ABI,
          functionName: 'confidentialStakedCETHOf',
          args: [address],
        }) as Promise<string>,
        publicClient.readContract({
          address: asAddress(STAKING_ADDRESS),
          abi: STAKING_ABI,
          functionName: 'confidentialStakedCUSDTOf',
          args: [address],
        }) as Promise<string>,
      ]);

      setWalletHandles({ cETH: cEthBal, cUSDT: cUsdtBal });
      setStakedHandles({ cETH: stakedCeth, cUSDT: stakedCusdt });
    } catch (e) {
      console.error(e);
      setError('Failed to read encrypted balances from chain.');
    }
  }, [address, configured]);

  useEffect(() => {
    setWalletClear({});
    setStakedClear({});
    setWalletHandles({});
    setStakedHandles({});
    setError(null);

    void refreshEncrypted();
  }, [address, refreshEncrypted]);

  const decrypt = useCallback(
    async (kind: 'wallet' | 'staked', token: TokenKey) => {
      if (!instance || !address || !signerPromise) return;

      const contractAddress = kind === 'wallet' ? (token === 'cETH' ? CETH_ADDRESS : CUSDT_ADDRESS) : STAKING_ADDRESS;
      const handle = kind === 'wallet' ? walletHandles[token] : stakedHandles[token];

      if (!handle || handle === ZERO_HANDLE) {
        const targetSetter = kind === 'wallet' ? setWalletClear : setStakedClear;
        targetSetter((prev) => ({ ...prev, [token]: 0n }));
        return;
      }

      setError(null);
      setBusy(`Decrypting ${kind} ${token}...`);
      try {
        const signer = await signerPromise;
        const clear = await decryptEuint64({
          instance,
          signer,
          handle,
          contractAddress,
        });

        const targetSetter = kind === 'wallet' ? setWalletClear : setStakedClear;
        targetSetter((prev) => ({ ...prev, [token]: clear }));
      } catch (e) {
        console.error(e);
        setError('User decryption failed. Make sure the contract allowed your address to access this ciphertext.');
      } finally {
        setBusy(null);
      }
    },
    [address, instance, signerPromise, stakedHandles, walletHandles],
  );

  const claim = useCallback(
    async (token: TokenKey) => {
      if (!configured || !signerPromise) return;
      setError(null);
      setBusy(`Claiming ${token}...`);
      try {
        const signer = await signerPromise;
        const tokenAddress = token === 'cETH' ? CETH_ADDRESS : CUSDT_ADDRESS;
        const tokenAbi = token === 'cETH' ? CETH_ABI : CUSDT_ABI;
        const contract = new Contract(tokenAddress, tokenAbi, signer);

        const tx = await contract.claim();
        await tx.wait();
        await refreshEncrypted();
      } catch (e) {
        console.error(e);
        setError(`Claim ${token} failed.`);
      } finally {
        setBusy(null);
      }
    },
    [configured, refreshEncrypted, signerPromise],
  );

  const approveStaking = useCallback(
    async (token: TokenKey) => {
      if (!configured || !signerPromise) return;
      setError(null);
      setBusy(`Approving staking for ${token}...`);
      try {
        const signer = await signerPromise;
        const tokenAddress = token === 'cETH' ? CETH_ADDRESS : CUSDT_ADDRESS;
        const tokenAbi = token === 'cETH' ? CETH_ABI : CUSDT_ABI;
        const contract = new Contract(tokenAddress, tokenAbi, signer);

        const nowSeconds = Math.floor(Date.now() / 1000);
        const oneYear = 365 * 24 * 60 * 60;
        const until = nowSeconds + oneYear;

        const tx = await contract.setOperator(STAKING_ADDRESS, until);
        await tx.wait();
      } catch (e) {
        console.error(e);
        setError(`Approve ${token} failed.`);
      } finally {
        setBusy(null);
      }
    },
    [configured, signerPromise],
  );

  const stake = useCallback(
    async (token: TokenKey) => {
      if (!configured || !instance || !address || !signerPromise) return;

      const amountText = stakeInput[token].trim();
      if (!amountText) return;

      setError(null);
      setBusy(`Staking ${token}...`);
      try {
        const amount = parseUnits(amountText, DECIMALS);
        if (amount <= 0n) {
          setError('Amount must be greater than 0.');
          return;
        }

        const signer = await signerPromise;

        const input = instance.createEncryptedInput(STAKING_ADDRESS, address);
        input.add64(amount);
        const encrypted = await input.encrypt();

        const stakingContract = new Contract(STAKING_ADDRESS, STAKING_ABI, signer);
        const handle = ethers.hexlify(encrypted.handles[0]);

        const tx =
          token === 'cETH'
            ? await stakingContract.stakeCETH(handle, encrypted.inputProof)
            : await stakingContract.stakeCUSDT(handle, encrypted.inputProof);
        await tx.wait();

        setStakeInput((prev) => ({ ...prev, [token]: '' }));
        await refreshEncrypted();
      } catch (e) {
        console.error(e);
        setError(`Stake ${token} failed. Make sure you approved staking as an operator first.`);
      } finally {
        setBusy(null);
      }
    },
    [address, configured, instance, refreshEncrypted, signerPromise, stakeInput],
  );

  const unstake = useCallback(
    async (token: TokenKey) => {
      if (!configured || !instance || !address || !signerPromise) return;

      const amountText = unstakeInput[token].trim();
      if (!amountText) return;

      setError(null);
      setBusy(`Unstaking ${token}...`);
      try {
        const amount = parseUnits(amountText, DECIMALS);
        if (amount <= 0n) {
          setError('Amount must be greater than 0.');
          return;
        }

        const signer = await signerPromise;

        const input = instance.createEncryptedInput(STAKING_ADDRESS, address);
        input.add64(amount);
        const encrypted = await input.encrypt();
        const handle = ethers.hexlify(encrypted.handles[0]);

        const stakingContract = new Contract(STAKING_ADDRESS, STAKING_ABI, signer);
        const tx =
          token === 'cETH'
            ? await stakingContract.unstakeCETH(handle, encrypted.inputProof)
            : await stakingContract.unstakeCUSDT(handle, encrypted.inputProof);
        await tx.wait();

        setUnstakeInput((prev) => ({ ...prev, [token]: '' }));
        await refreshEncrypted();
      } catch (e) {
        console.error(e);
        setError(`Unstake ${token} failed.`);
      } finally {
        setBusy(null);
      }
    },
    [address, configured, instance, refreshEncrypted, signerPromise, unstakeInput],
  );

  return (
    <div className="encryptfi-app">
      <Header networkLabel={networkLabel} />

      <main className="encryptfi-main">
        {!configured && (
          <div className="panel warning">
            <div className="panel-title">Contracts not configured</div>
            <div className="panel-body">
              <p>
                Deploy contracts to Sepolia, then run <code>npx hardhat encryptfi:sync-ui</code> to generate{' '}
                <code>ui/src/config/deployments.ts</code>.
              </p>
            </div>
          </div>
        )}

        {zamaError && (
          <div className="panel error">
            <div className="panel-title">Encryption service error</div>
            <div className="panel-body">{zamaError}</div>
          </div>
        )}

        {error && (
          <div className="panel error">
            <div className="panel-title">Error</div>
            <div className="panel-body">{error}</div>
          </div>
        )}

        <div className="grid">
          <section className="panel">
            <div className="panel-title">Wallet</div>
            <div className="panel-body">
              <div className="row">
                <div className="label">cETH encrypted</div>
                <div className="mono">{walletHandles.cETH ?? '—'}</div>
              </div>
              <div className="row">
                <div className="label">cETH clear</div>
                <div>{walletClear.cETH !== undefined ? formatUnits(walletClear.cETH, DECIMALS) : '—'}</div>
              </div>
              <div className="actions">
                <button disabled={!isConnected || !configured || !!busy} onClick={() => void claim('cETH')}>
                  Claim cETH
                </button>
                <button
                  disabled={!isConnected || !configured || zamaLoading || !!busy}
                  onClick={() => void decrypt('wallet', 'cETH')}
                >
                  Decrypt
                </button>
              </div>

              <div className="divider" />

              <div className="row">
                <div className="label">cUSDT encrypted</div>
                <div className="mono">{walletHandles.cUSDT ?? '—'}</div>
              </div>
              <div className="row">
                <div className="label">cUSDT clear</div>
                <div>{walletClear.cUSDT !== undefined ? formatUnits(walletClear.cUSDT, DECIMALS) : '—'}</div>
              </div>
              <div className="actions">
                <button disabled={!isConnected || !configured || !!busy} onClick={() => void claim('cUSDT')}>
                  Claim cUSDT
                </button>
                <button
                  disabled={!isConnected || !configured || zamaLoading || !!busy}
                  onClick={() => void decrypt('wallet', 'cUSDT')}
                >
                  Decrypt
                </button>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-title">Staking</div>
            <div className="panel-body">
              <div className="row">
                <div className="label">Staked cETH encrypted</div>
                <div className="mono">{stakedHandles.cETH ?? '—'}</div>
              </div>
              <div className="row">
                <div className="label">Staked cETH clear</div>
                <div>{stakedClear.cETH !== undefined ? formatUnits(stakedClear.cETH, DECIMALS) : '—'}</div>
              </div>
              <div className="actions">
                <button disabled={!isConnected || !configured || !!busy} onClick={() => void approveStaking('cETH')}>
                  Approve cETH
                </button>
                <button
                  disabled={!isConnected || !configured || zamaLoading || !!busy}
                  onClick={() => void decrypt('staked', 'cETH')}
                >
                  Decrypt
                </button>
              </div>
              <div className="split">
                <input
                  value={stakeInput.cETH}
                  onChange={(e) => setStakeInput((prev) => ({ ...prev, cETH: e.target.value }))}
                  placeholder="Stake amount"
                />
                <button disabled={!isConnected || !configured || zamaLoading || !!busy} onClick={() => void stake('cETH')}>
                  Stake
                </button>
              </div>
              <div className="split">
                <input
                  value={unstakeInput.cETH}
                  onChange={(e) => setUnstakeInput((prev) => ({ ...prev, cETH: e.target.value }))}
                  placeholder="Unstake amount"
                />
                <button
                  disabled={!isConnected || !configured || zamaLoading || !!busy}
                  onClick={() => void unstake('cETH')}
                >
                  Unstake
                </button>
              </div>

              <div className="divider" />

              <div className="row">
                <div className="label">Staked cUSDT encrypted</div>
                <div className="mono">{stakedHandles.cUSDT ?? '—'}</div>
              </div>
              <div className="row">
                <div className="label">Staked cUSDT clear</div>
                <div>{stakedClear.cUSDT !== undefined ? formatUnits(stakedClear.cUSDT, DECIMALS) : '—'}</div>
              </div>
              <div className="actions">
                <button disabled={!isConnected || !configured || !!busy} onClick={() => void approveStaking('cUSDT')}>
                  Approve cUSDT
                </button>
                <button
                  disabled={!isConnected || !configured || zamaLoading || !!busy}
                  onClick={() => void decrypt('staked', 'cUSDT')}
                >
                  Decrypt
                </button>
              </div>
              <div className="split">
                <input
                  value={stakeInput.cUSDT}
                  onChange={(e) => setStakeInput((prev) => ({ ...prev, cUSDT: e.target.value }))}
                  placeholder="Stake amount"
                />
                <button
                  disabled={!isConnected || !configured || zamaLoading || !!busy}
                  onClick={() => void stake('cUSDT')}
                >
                  Stake
                </button>
              </div>
              <div className="split">
                <input
                  value={unstakeInput.cUSDT}
                  onChange={(e) => setUnstakeInput((prev) => ({ ...prev, cUSDT: e.target.value }))}
                  placeholder="Unstake amount"
                />
                <button
                  disabled={!isConnected || !configured || zamaLoading || !!busy}
                  onClick={() => void unstake('cUSDT')}
                >
                  Unstake
                </button>
              </div>
            </div>
          </section>
        </div>

        <div className="footer">
          <button className="link" disabled={!isConnected || !configured || !!busy} onClick={() => void refreshEncrypted()}>
            Refresh encrypted values
          </button>
          {busy && <span className="status">{busy}</span>}
        </div>
      </main>
    </div>
  );
}
