import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy, get } = hre.deployments;

  const cEth = await get("ERC7984ETH");
  const cUsdt = await get("ERC7984USDT");

  const deployedStaking = await deploy("EncryptFiStaking", {
    from: deployer,
    args: [cEth.address, cUsdt.address],
    log: true,
  });

  console.log(`EncryptFiStaking contract: ${deployedStaking.address}`);
};

export default func;
func.id = "deploy_encryptfi_staking";
func.tags = ["EncryptFi", "EncryptFiStaking"];
func.dependencies = ["deploy_encryptfi_tokens"];

