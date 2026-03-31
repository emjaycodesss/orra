// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {IEntropyConsumer} from "@pythnetwork/entropy-sdk-solidity/IEntropyConsumer.sol";
import {IEntropyV2} from "@pythnetwork/entropy-sdk-solidity/IEntropyV2.sol";

/**
 * @title MinimalEntropyConsumerExample
 * @notice Smallest useful Pyth Entropy v2 flow: pay getFeeV2(), call requestV2(), handle entropyCallback.
 * Educational / gist — not audited. See Pyth Entropy docs and chainlist on docs.pyth.network (entropy).
 * Build in this repo: cd contracts && forge build (remapping in foundry.toml).
 */
contract MinimalEntropyConsumerExample is IEntropyConsumer {
    IEntropyV2 public immutable entropy;

    mapping(uint64 => address) private _requester;

    event RandomnessRequested(uint64 indexed sequence, address indexed user);
    event RandomnessReceived(uint64 indexed sequence, address indexed user, address provider, bytes32 randomNumber);

    constructor(address entropyContract) {
        entropy = IEntropyV2(entropyContract);
    }

    /// @notice Request one callback; forwards exactly the current fee as msg.value (refunds overpayment).
    function requestRandomness() external payable {
        uint256 fee = uint256(entropy.getFeeV2());
        require(msg.value >= fee, "fee");

        uint64 sequence = entropy.requestV2{value: fee}();
        _requester[sequence] = msg.sender;
        emit RandomnessRequested(sequence, msg.sender);

        if (msg.value > fee) {
            (bool ok,) = msg.sender.call{value: msg.value - fee}("");
            require(ok, "refund");
        }
    }

    function entropyCallback(uint64 sequence, address provider, bytes32 randomNumber) internal override {
        address user = _requester[sequence];
        require(user != address(0), "unknown seq");
        emit RandomnessReceived(sequence, user, provider, randomNumber);
        delete _requester[sequence];
    }

    function getEntropy() internal view override returns (address) {
        return address(entropy);
    }

    function currentFee() external view returns (uint256) {
        return uint256(entropy.getFeeV2());
    }
}
