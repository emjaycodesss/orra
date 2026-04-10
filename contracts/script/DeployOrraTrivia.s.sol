// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {OrraTrivia} from "../src/OrraTrivia.sol";

/**
 * @notice Deploy `OrraTrivia` with Pyth Entropy v2 on the target chain.
 * @dev Constructor args are supplied via env vars so the same script works
 *      on Base Sepolia and Base mainnet.
 */
contract DeployOrraTrivia is Script {
    function run() external returns (OrraTrivia deployed) {
        address entropyAddress = vm.envAddress("ENTROPY_ADDRESS");
        address providerAddress = vm.envAddress("ENTROPY_PROVIDER_ADDRESS");
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerKey);
        deployed = new OrraTrivia(entropyAddress, providerAddress);
        vm.stopBroadcast();
    }
}
