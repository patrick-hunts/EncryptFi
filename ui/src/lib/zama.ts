import type { JsonRpcSigner } from 'ethers';

type ZamaInstance = {
  generateKeypair: () => { publicKey: string; privateKey: string };
  createEIP712: (
    publicKey: string,
    contractAddresses: string[],
    startTimestamp: string,
    durationDays: string,
  ) => {
    domain: Record<string, unknown>;
    types: Record<string, unknown>;
    message: Record<string, unknown>;
  };
  userDecrypt: (
    handleContractPairs: { handle: string; contractAddress: string }[],
    privateKey: string,
    publicKey: string,
    signature: string,
    contractAddresses: string[],
    userAddress: string,
    startTimestamp: string,
    durationDays: string,
  ) => Promise<Record<string, unknown>>;
};

export async function decryptEuint64({
  instance,
  signer,
  handle,
  contractAddress,
}: {
  instance: ZamaInstance;
  signer: JsonRpcSigner;
  handle: string;
  contractAddress: string;
}): Promise<bigint> {
  const keypair = instance.generateKeypair();
  const startTimeStamp = Math.floor(Date.now() / 1000).toString();
  const durationDays = '10';
  const contractAddresses = [contractAddress];

  const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimeStamp, durationDays);
  const signature = await signer.signTypedData(
    eip712.domain as any,
    {
      UserDecryptRequestVerification: (eip712.types as any).UserDecryptRequestVerification,
    },
    eip712.message as any,
  );

  const result = await instance.userDecrypt(
    [{ handle, contractAddress }],
    keypair.privateKey,
    keypair.publicKey,
    signature.replace('0x', ''),
    contractAddresses,
    await signer.getAddress(),
    startTimeStamp,
    durationDays,
  );

  const value = result[handle];
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(value);
  if (typeof value === 'string') return BigInt(value);
  throw new Error('Unexpected decrypt result type');
}

