// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {Orra} from "../src/Orra.sol";

/**
 * @notice Deploy `Orra` with Pyth Entropy v2 on the target chain.
 * @dev We keep constructor args as env vars so we can reuse this script across
 *      Base (mainnet) and Base Sepolia (testnet) without code changes.
 *
 *      Base Sepolia (84532) — from https://docs.pyth.network/entropy/chainlist :
 *      - ENTROPY_ADDRESS=0x41c9e39574F40Ad34c79f1C99B66A45eFB830d4c
 *      - ENTROPY_PROVIDER_ADDRESS=0x6CC14824Ea2918f5De5C2f75A9Da968ad4BD6344
 *      Base mainnet (8453) uses different addresses (same chainlist page).
 *      Wrong ENTROPY_ADDRESS makes Orra.getFee() / entropy.getFeeV2() revert with empty data.
 */
contract DeployOrra is Script {
    function run() external returns (Orra deployed) {
        // These must be set in your shell / CI environment.
        address entropyAddress = vm.envAddress("ENTROPY_ADDRESS");
        address providerAddress = vm.envAddress("ENTROPY_PROVIDER_ADDRESS");

        // PRIVATE_KEY should be the deployer EOA (hex string, 0x...).
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerKey);
        deployed = new Orra(entropyAddress, providerAddress);
        vm.stopBroadcast();
    }
}

