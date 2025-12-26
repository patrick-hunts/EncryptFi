import { sepolia } from 'wagmi/chains';
import { createConfig, createStorage, http } from 'wagmi';
import { injected } from 'wagmi/connectors';

const memoryStore = new Map<string, string>();
const memoryStorage = {
  getItem: (key: string) => memoryStore.get(key) ?? null,
  setItem: (key: string, value: string) => {
    memoryStore.set(key, value);
  },
  removeItem: (key: string) => {
    memoryStore.delete(key);
  },
};

export const config = createConfig({
  chains: [sepolia],
  connectors: [injected()],
  storage: createStorage({ storage: memoryStorage }),
  transports: {
    [sepolia.id]: http('https://rpc.sepolia.org'),
  },
});
