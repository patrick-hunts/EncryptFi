# EncryptFi

EncryptFi is a privacy-preserving DeFi demo built on Zama FHEVM. It lets users claim encrypted cETH and cUSDT, stake them,
withdraw staked assets, and selectively decrypt balances on demand. The project focuses on end-to-end encrypted balances
and a clear, auditable flow from encrypted on-chain state to user-controlled decryption in the UI.

## Project Goals

- Keep user balances and staking positions encrypted on-chain by default.
- Allow users to decrypt only when they choose, with explicit user action.
- Provide a full working flow (claim, stake, withdraw, decrypt) without mock data.
- Separate read and write paths: reads use viem, writes use ethers.
- Keep the frontend free of local storage, environment variables, and localhost networks.

## Problems Solved

- **Public balance exposure**: Traditional DeFi makes balances and positions visible to everyone.
- **Privacy vs usability tradeoff**: Many privacy solutions hide data but are hard to interact with.
- **Selective disclosure**: Users need a way to prove or view their own balances without exposing them to the public.

EncryptFi solves these by using FHEVM encrypted types for balances and staking positions. Users can view encrypted values
on-chain and decrypt them only when they choose through the Zama relayer flow.

## Key Features

- Claim encrypted cETH and cUSDT.
- View encrypted wallet balances and decrypt on demand.
- Stake encrypted cETH and cUSDT.
- Withdraw staked assets.
- View encrypted staking balances and decrypt on demand.
- Sepolia-ready deployment and frontend integration.

## Advantages

- **Privacy-first by default**: Encrypted balances stay encrypted on-chain.
- **User-controlled disclosure**: Decryption is explicit and user-initiated.
- **Separation of concerns**: Reads via viem, writes via ethers for predictable UX.
- **Minimal trust surface**: Decryption uses the Zama relayer workflow instead of exposing plaintext on-chain.
- **Clear project boundaries**: Contracts, tasks, tests, and UI are separated for maintainability.

## Tech Stack

- **Smart contracts**: Solidity + Hardhat
- **FHE layer**: Zama FHEVM
- **Frontend**: React + Vite
- **Wallet UI**: RainbowKit + wagmi
- **On-chain reads**: viem
- **Transactions**: ethers
- **Relayer**: @zama-fhe/relayer-sdk
- **Package manager**: npm

## Repository Layout

```
contracts/        Smart contracts
contracts/*.sol   FHE-enabled contracts
deploy/           Deployment scripts
tasks/            Hardhat tasks
test/             Test suite
docs/             Project and Zama references
ui/               Frontend (React + Vite)
```

## Smart Contract Overview

The contracts use encrypted types for balances and staking positions. The encrypted values remain on-chain and cannot be
read directly without the FHE decryption flow.

Core behaviors:

- **Claim**: Users receive encrypted cETH and cUSDT.
- **Stake**: Users lock encrypted tokens into staking balances.
- **Withdraw**: Users unlock staked tokens.
- **Encrypted views**: Contract read functions return encrypted balances.

Important design constraints:

- View methods should not rely on `msg.sender` for address selection; user addresses should be explicit inputs.
- Only generated ABIs should be used in the UI, and they must come from `deployments/sepolia`.

## Frontend Overview

The frontend integrates the encrypted contract flows with a privacy-focused UI.

- Reads use viem, writes use ethers.
- No local storage usage.
- No frontend environment variables.
- No localhost networks in the UI.
- ABIs are sourced from the contract build output, not handcrafted.
- The UI does not import files from the repository root.

## User Flows

1. **Connect wallet** via RainbowKit.
2. **Claim tokens** (cETH and cUSDT) to receive encrypted balances.
3. **View encrypted balances** in the UI.
4. **Decrypt balances** on demand through the relayer flow.
5. **Stake tokens** to move encrypted balances into encrypted staking positions.
6. **Withdraw stake** to return encrypted balances to the wallet.
7. **Decrypt staking balances** on demand.

## Setup and Usage

### Prerequisites

- Node.js 20+
- npm

### Install Dependencies

From the repository root:

```bash
npm install
```

From the UI directory:

```bash
cd ui
npm install
```

### Compile and Test

```bash
npm run compile
npm run test
```

### Deploy

Contracts are deployed with a private key. Do not use a mnemonic.

Create a `.env` in the repository root with the following values:

```
INFURA_API_KEY=your_infura_key
PRIVATE_KEY=your_private_key
```

Deploy to Sepolia:

```bash
npm run compile
npx hardhat deploy --network sepolia
```

### Update UI Contract Data

- Copy the generated ABI files from `deployments/sepolia` into the UI contract config.
- Update deployed contract addresses in the UI to match the Sepolia deployment.

### Run the UI

```bash
cd ui
npm run dev
```

Use a wallet connected to Sepolia and interact with the deployed contracts.

## Testing

- Unit tests run with `npm run test`.
- Tasks in `tasks/` can be used for targeted checks and scripted interactions.

## Security and Privacy Notes

- Encrypted values are never exposed on-chain.
- Decryption only occurs through explicit user action.
- Relayer usage provides the privacy-preserving decrypt flow required by FHEVM.
- This is a demonstration project and should be audited before production use.

## Future Plans

- Add more encrypted assets beyond cETH and cUSDT.
- Introduce staking rewards with encrypted accounting.
- Add partial withdrawals and time-based staking tiers.
- Improve relayer UX and error handling for decryption requests.
- Expand tests for edge cases and failure modes.
- Formal security review and audit preparation.

## License

This project is licensed under the BSD-3-Clause-Clear License. See `LICENSE`.
