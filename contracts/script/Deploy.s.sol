// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {TrailReviewRegistry} from "../src/TrailReviewRegistry.sol";

/// @notice Deploys TrailReviewRegistry and activates one project.
/// @dev The broadcaster (--account / --private-key / --ledger) becomes the
///      contract owner (OZ Ownable uses msg.sender). There is no OWNER env.
///      Required env: VERIFIER (backend signer address, NOT the deployer key).
///      Optional env: PROJECT_ID (default 1), ALLOW_ANY_CHAIN=true for local/test chains.
///      Refuses to run unless block.chainid == 677 (BOT Chain mainnet).
contract Deploy is Script {
    uint256 internal constant BOT_MAINNET = 677;

    function run() external returns (TrailReviewRegistry) {
        address verifier = vm.envAddress("VERIFIER");
        require(verifier != address(0), "VERIFIER env is zero");
        require(
            block.chainid == BOT_MAINNET || vm.envOr("ALLOW_ANY_CHAIN", false),
            "wrong chain: expected BOT Chain 677"
        );
        uint256 projectId = vm.envOr("PROJECT_ID", uint256(1));
        vm.startBroadcast();
        TrailReviewRegistry reg = new TrailReviewRegistry(verifier);
        reg.setProjectActive(projectId, true);
        vm.stopBroadcast();
        return reg;
    }
}
