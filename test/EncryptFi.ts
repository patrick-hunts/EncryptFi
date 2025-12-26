import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { EncryptFiStaking, ERC7984ETH, ERC7984USDT } from "../types";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
};

async function deployFixture() {
  const cEthFactory = await ethers.getContractFactory("ERC7984ETH");
  const cUsdtFactory = await ethers.getContractFactory("ERC7984USDT");
  const stakingFactory = await ethers.getContractFactory("EncryptFiStaking");

  const cEth = (await cEthFactory.deploy()) as ERC7984ETH;
  const cUsdt = (await cUsdtFactory.deploy()) as ERC7984USDT;
  const staking = (await stakingFactory.deploy(await cEth.getAddress(), await cUsdt.getAddress())) as EncryptFiStaking;

  return { cEth, cUsdt, staking };
}

describe("EncryptFi", function () {
  let signers: Signers;
  let cEth: ERC7984ETH;
  let cUsdt: ERC7984USDT;
  let staking: EncryptFiStaking;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ cEth, cUsdt, staking } = await deployFixture());
  });

  it("claim, stake, and unstake flow works", async function () {
    const cEthAddress = await cEth.getAddress();
    const cUsdtAddress = await cUsdt.getAddress();
    const stakingAddress = await staking.getAddress();

    await cEth.connect(signers.alice).claim();
    await cUsdt.connect(signers.alice).claim();

    const faucetAmount = await cEth.FAUCET_AMOUNT();

    const encryptedCethBal1 = await cEth.confidentialBalanceOf(signers.alice.address);
    const clearCethBal1 = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedCethBal1,
      cEthAddress,
      signers.alice,
    );
    expect(clearCethBal1).to.eq(faucetAmount);

    const until = 0xffff_ffff_ffffn;
    await cEth.connect(signers.alice).setOperator(stakingAddress, until);
    await cUsdt.connect(signers.alice).setOperator(stakingAddress, until);

    const stakeAmount = faucetAmount / 2n;

    const encryptedStakeCeth = await fhevm
      .createEncryptedInput(stakingAddress, signers.alice.address)
      .add64(stakeAmount)
      .encrypt();
    await staking.connect(signers.alice).stakeCETH(encryptedStakeCeth.handles[0], encryptedStakeCeth.inputProof);

    const encryptedStakeCusdt = await fhevm
      .createEncryptedInput(stakingAddress, signers.alice.address)
      .add64(stakeAmount)
      .encrypt();
    await staking.connect(signers.alice).stakeCUSDT(encryptedStakeCusdt.handles[0], encryptedStakeCusdt.inputProof);

    const encryptedStakedCeth1 = await staking.confidentialStakedCETHOf(signers.alice.address);
    const clearStakedCeth1 = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedStakedCeth1,
      stakingAddress,
      signers.alice,
    );
    expect(clearStakedCeth1).to.eq(stakeAmount);

    const encryptedStakedCusdt1 = await staking.confidentialStakedCUSDTOf(signers.alice.address);
    const clearStakedCusdt1 = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedStakedCusdt1,
      stakingAddress,
      signers.alice,
    );
    expect(clearStakedCusdt1).to.eq(stakeAmount);

    const encryptedCethBal2 = await cEth.confidentialBalanceOf(signers.alice.address);
    const clearCethBal2 = await fhevm.userDecryptEuint(FhevmType.euint64, encryptedCethBal2, cEthAddress, signers.alice);
    expect(clearCethBal2).to.eq(faucetAmount - stakeAmount);

    const encryptedCusdtBal2 = await cUsdt.confidentialBalanceOf(signers.alice.address);
    const clearCusdtBal2 = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedCusdtBal2,
      cUsdtAddress,
      signers.alice,
    );
    expect(clearCusdtBal2).to.eq(faucetAmount - stakeAmount);

    const unstakeAmount = stakeAmount / 2n;

    const encryptedUnstakeCeth = await fhevm
      .createEncryptedInput(stakingAddress, signers.alice.address)
      .add64(unstakeAmount)
      .encrypt();
    await staking.connect(signers.alice).unstakeCETH(encryptedUnstakeCeth.handles[0], encryptedUnstakeCeth.inputProof);

    const encryptedUnstakeCusdt = await fhevm
      .createEncryptedInput(stakingAddress, signers.alice.address)
      .add64(unstakeAmount)
      .encrypt();
    await staking.connect(signers.alice).unstakeCUSDT(encryptedUnstakeCusdt.handles[0], encryptedUnstakeCusdt.inputProof);

    const encryptedStakedCeth2 = await staking.confidentialStakedCETHOf(signers.alice.address);
    const clearStakedCeth2 = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedStakedCeth2,
      stakingAddress,
      signers.alice,
    );
    expect(clearStakedCeth2).to.eq(stakeAmount - unstakeAmount);

    const encryptedStakedCusdt2 = await staking.confidentialStakedCUSDTOf(signers.alice.address);
    const clearStakedCusdt2 = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedStakedCusdt2,
      stakingAddress,
      signers.alice,
    );
    expect(clearStakedCusdt2).to.eq(stakeAmount - unstakeAmount);

    const encryptedCethBal3 = await cEth.confidentialBalanceOf(signers.alice.address);
    const clearCethBal3 = await fhevm.userDecryptEuint(FhevmType.euint64, encryptedCethBal3, cEthAddress, signers.alice);
    expect(clearCethBal3).to.eq(faucetAmount - stakeAmount + unstakeAmount);

    const encryptedCusdtBal3 = await cUsdt.confidentialBalanceOf(signers.alice.address);
    const clearCusdtBal3 = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedCusdtBal3,
      cUsdtAddress,
      signers.alice,
    );
    expect(clearCusdtBal3).to.eq(faucetAmount - stakeAmount + unstakeAmount);
  });
});
