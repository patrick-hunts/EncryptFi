// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {FHE, ebool, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";

contract EncryptFiStaking is ZamaEthereumConfig {
    IERC7984 public immutable cETH;
    IERC7984 public immutable cUSDT;

    mapping(address user => euint64) private _stakedCETH;
    mapping(address user => euint64) private _stakedCUSDT;

    event Staked(address indexed user, address indexed token, euint64 indexed amount);
    event Unstaked(address indexed user, address indexed token, euint64 indexed amount);

    error ZeroAddress();

    constructor(address cETH_, address cUSDT_) {
        if (cETH_ == address(0) || cUSDT_ == address(0)) revert ZeroAddress();
        cETH = IERC7984(cETH_);
        cUSDT = IERC7984(cUSDT_);
    }

    function confidentialStakedCETHOf(address account) external view returns (euint64) {
        return _stakedCETH[account];
    }

    function confidentialStakedCUSDTOf(address account) external view returns (euint64) {
        return _stakedCUSDT[account];
    }

    function stakeCETH(externalEuint64 encryptedAmount, bytes calldata inputProof) external returns (euint64 staked) {
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        FHE.allowThis(amount);
        FHE.allow(amount, address(cETH));

        staked = cETH.confidentialTransferFrom(msg.sender, address(this), amount);
        _increaseStake(_stakedCETH, msg.sender, staked);
        emit Staked(msg.sender, address(cETH), staked);
    }

    function stakeCUSDT(externalEuint64 encryptedAmount, bytes calldata inputProof) external returns (euint64 staked) {
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        FHE.allowThis(amount);
        FHE.allow(amount, address(cUSDT));

        staked = cUSDT.confidentialTransferFrom(msg.sender, address(this), amount);
        _increaseStake(_stakedCUSDT, msg.sender, staked);
        emit Staked(msg.sender, address(cUSDT), staked);
    }

    function unstakeCETH(externalEuint64 encryptedAmount, bytes calldata inputProof) external returns (euint64 unstaked) {
        unstaked = _decreaseStake(_stakedCETH, msg.sender, encryptedAmount, inputProof);
        FHE.allow(unstaked, address(cETH));
        cETH.confidentialTransfer(msg.sender, unstaked);
        emit Unstaked(msg.sender, address(cETH), unstaked);
    }

    function unstakeCUSDT(
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external returns (euint64 unstaked) {
        unstaked = _decreaseStake(_stakedCUSDT, msg.sender, encryptedAmount, inputProof);
        FHE.allow(unstaked, address(cUSDT));
        cUSDT.confidentialTransfer(msg.sender, unstaked);
        emit Unstaked(msg.sender, address(cUSDT), unstaked);
    }

    function _increaseStake(mapping(address => euint64) storage staked, address user, euint64 amount) internal {
        euint64 current = staked[user];
        if (!FHE.isInitialized(current)) {
            current = FHE.asEuint64(0);
        }

        euint64 next = FHE.add(current, amount);
        FHE.allowThis(next);
        FHE.allow(next, user);
        staked[user] = next;
    }

    function _decreaseStake(
        mapping(address => euint64) storage staked,
        address user,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) internal returns (euint64 withdrawn) {
        euint64 current = staked[user];
        if (!FHE.isInitialized(current)) {
            current = FHE.asEuint64(0);
        }

        euint64 requested = FHE.fromExternal(encryptedAmount, inputProof);
        FHE.allowThis(requested);

        ebool canWithdraw = FHE.le(requested, current);
        withdrawn = FHE.select(canWithdraw, requested, current);
        FHE.allowThis(withdrawn);

        euint64 next = FHE.sub(current, withdrawn);
        FHE.allowThis(next);
        FHE.allow(next, user);
        staked[user] = next;
    }
}
