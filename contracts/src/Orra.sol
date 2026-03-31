// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IEntropyConsumer} from "@pythnetwork/entropy-sdk-solidity/IEntropyConsumer.sol";
import {IEntropyV2} from "@pythnetwork/entropy-sdk-solidity/IEntropyV2.sol";

/**
 * @title Orra
 * @notice Tarot draw via Pyth Entropy v2, with an on-chain commitment to the Pyth feed
 *         snapshot the user attests at request time (feed id + keccak256 of packed oracle fields).
 */
contract Orra is IEntropyConsumer {
    IEntropyV2 public immutable entropy;
    address public immutable provider;

    struct PendingReading {
        address user;
        /// @notice Pyth Lazer / Pro numeric feed id the reading is bound to.
        uint32 feedId;
        /// @notice keccak256(abi.encodePacked(...)) of packed Pyth integers at request time; verifiable off-chain.
        bytes32 oracleSnapshotHash;
    }

    mapping(uint64 => PendingReading) public pendingReadings;

    event ReadingRequested(
        uint64 indexed sequenceNumber,
        address indexed user,
        uint32 feedId,
        bytes32 oracleSnapshotHash
    );
    event CardDrawn(
        uint64 indexed sequenceNumber,
        address indexed user,
        uint8 cardIndex,
        uint32 feedId,
        bytes32 oracleSnapshotHash,
        bytes32 randomNumber
    );

    constructor(address entropyAddress, address _provider) {
        entropy = IEntropyV2(entropyAddress);
        provider = _provider;
    }

    /**
     * @param feedId Pyth price feed id for this realm (must match off-chain hash inputs).
     * @param oracleSnapshotHash Commitment to raw Pyth fields; see frontend `computeOracleSnapshotHash`.
     */
    function requestReading(uint32 feedId, bytes32 oracleSnapshotHash) external payable {
        uint256 fee = entropy.getFeeV2();
        require(msg.value >= fee, "Insufficient fee");

        uint64 sequenceNumber = entropy.requestV2{value: fee}();
        pendingReadings[sequenceNumber] =
            PendingReading({user: msg.sender, feedId: feedId, oracleSnapshotHash: oracleSnapshotHash});

        emit ReadingRequested(sequenceNumber, msg.sender, feedId, oracleSnapshotHash);

        if (msg.value > fee) {
            (bool ok,) = msg.sender.call{value: msg.value - fee}("");
            require(ok, "Refund failed");
        }
    }

    function entropyCallback(uint64 sequenceNumber, address, bytes32 randomNumber) internal override {
        PendingReading memory p = pendingReadings[sequenceNumber];
        require(p.user != address(0), "Unknown sequence");

        uint8 cardIndex = uint8(uint256(randomNumber) % 22);

        emit CardDrawn(sequenceNumber, p.user, cardIndex, p.feedId, p.oracleSnapshotHash, randomNumber);

        delete pendingReadings[sequenceNumber];
    }

    function getEntropy() internal view override returns (address) {
        return address(entropy);
    }

    function getFee() external view returns (uint256) {
        return entropy.getFeeV2();
    }
}
