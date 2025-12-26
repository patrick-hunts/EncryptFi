// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {FHE, euint64} from "@fhevm/solidity/lib/FHE.sol";

contract ERC7984ETH is ERC7984, ZamaEthereumConfig {
    uint64 public constant FAUCET_AMOUNT = 1_000_000_000; // 1000 tokens with 6 decimals
    uint32 public constant FAUCET_COOLDOWN_SECONDS = 24 hours;

    mapping(address user => uint48 lastClaimedAt) public lastClaimedAt;

    constructor() ERC7984("cETH", "cETH", "") {}

    function claim() external returns (euint64 minted) {
        uint48 last = lastClaimedAt[msg.sender];
        require(last == 0 || block.timestamp - uint256(last) >= FAUCET_COOLDOWN_SECONDS, "Faucet cooldown");

        lastClaimedAt[msg.sender] = uint48(block.timestamp);

        minted = _mint(msg.sender, FHE.asEuint64(FAUCET_AMOUNT));
    }
}
