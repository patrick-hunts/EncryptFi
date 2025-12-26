import "@fhevm/hardhat-plugin";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-verify";
import "@typechain/hardhat";
import "hardhat-deploy";
import "hardhat-gas-reporter";
import type { HardhatUserConfig } from "hardhat/config";
import "solidity-coverage";

import "./tasks/accounts";
import "./tasks/FHECounter";
import "./tasks/EncryptFi";

import * as dotenv from "dotenv";

dotenv.config();

function normalizeEnvValue(value: string | undefined): string {
  return (value ?? "").trim().split(/\s+/)[0] ?? "";
}

function normalizePrivateKey(privateKey: string | undefined): string | undefined {
  const cleaned = normalizeEnvValue(privateKey);
  if (!cleaned) return undefined;
  return cleaned.startsWith("0x") ? cleaned : `0x${cleaned}`;
}

const INFURA_API_KEY: string = normalizeEnvValue(process.env.INFURA_API_KEY);
const PRIVATE_KEY: string | undefined = normalizePrivateKey(process.env.PRIVATE_KEY);
const ETHERSCAN_API_KEY: string = normalizeEnvValue(process.env.ETHERSCAN_API_KEY);

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  namedAccounts: {
    deployer: 0,
  },
  etherscan: {
    apiKey: {
      sepolia: ETHERSCAN_API_KEY,
    },
  },
  gasReporter: {
    currency: "USD",
    enabled: process.env.REPORT_GAS ? true : false,
    excludeContracts: [],
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      chainId: 31337,
      url: "http://127.0.0.1:8545",
    },
    sepolia: {
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 11155111,
      url: INFURA_API_KEY ? `https://sepolia.infura.io/v3/${INFURA_API_KEY}` : "https://rpc.sepolia.org",
    },
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
  },
  solidity: {
    version: "0.8.27",
    settings: {
      metadata: {
        // Not including the metadata hash
        // https://github.com/paulrberg/hardhat-template/issues/31
        bytecodeHash: "none",
      },
      // Disable the optimizer when debugging
      // https://hardhat.org/hardhat-network/#solidity-optimizer-support
      optimizer: {
        enabled: true,
        runs: 800,
      },
      evmVersion: "cancun",
    },
  },
  typechain: {
    outDir: "types",
    target: "ethers-v6",
  },
};

export default config;
