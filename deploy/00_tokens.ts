import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedCETH = await deploy("ERC7984ETH", {
    from: deployer,
    log: true,
  });

  const deployedCUSDT = await deploy("ERC7984USDT", {
    from: deployer,
    log: true,
  });

  console.log(`ERC7984ETH contract: ${deployedCETH.address}`);
  console.log(`ERC7984USDT contract: ${deployedCUSDT.address}`);
};

export default func;
func.id = "deploy_encryptfi_tokens";
func.tags = ["EncryptFi", "EncryptFiTokens"];

