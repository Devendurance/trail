// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {TrailReviewRegistry} from "../src/TrailReviewRegistry.sol";

/// @notice Deploys TrailReviewRegistry. No mainnet deployment in Slice 2.
/// @dev Required env: VERIFIER (authorized EIP-712 signer address).
///      Optional env: OWNER (defaults to deployer; used with --account flows).
contract Deploy is Script {
    function run() external returns (TrailReviewRegistry) {
        address verifier = vm.envAddress("VERIFIER");
        require(verifier != address(0), "VERIFIER env is zero");
        vm.startBroadcast();
        TrailReviewRegistry reg = new TrailReviewRegistry(verifier);
        vm.stopBroadcast();
        return reg;
    }
}
