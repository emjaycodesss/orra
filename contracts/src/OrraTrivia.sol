// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {IEntropyConsumer} from "@pythnetwork/entropy-sdk-solidity/IEntropyConsumer.sol";
import {IEntropyV2} from "@pythnetwork/entropy-sdk-solidity/IEntropyV2.sol";

/**
 * @title OrraTrivia
 * @notice Draws three Major Arcana indices (0-21) per Entropy v2 request for quiz power-ups.
 */
contract OrraTrivia is IEntropyConsumer {
    IEntropyV2 public immutable entropy;
    address public immutable provider;

    struct PendingBoosters {
        address user;
        bytes32 sessionSalt;
    }

    mapping(uint64 => PendingBoosters) public pendingBoosters;

    event BoostersRequested(uint64 indexed sequenceNumber, address indexed user, bytes32 sessionSalt);
    event BoostersDrawn(
        uint64 indexed sequenceNumber,
        address indexed user,
        uint8 c0,
        uint8 c1,
        uint8 c2,
        bytes32 randomNumber,
        bytes32 sessionSalt
    );

    constructor(address entropyAddress, address _provider) {
        entropy = IEntropyV2(entropyAddress);
        provider = _provider;
    }

    function requestSessionBoosters(bytes32 sessionSalt) external payable {
        uint256 fee = entropy.getFeeV2();
        require(msg.value >= fee, "Insufficient fee");

        uint64 sequenceNumber = entropy.requestV2{value: fee}();
        pendingBoosters[sequenceNumber] = PendingBoosters({user: msg.sender, sessionSalt: sessionSalt});

        emit BoostersRequested(sequenceNumber, msg.sender, sessionSalt);

        if (msg.value > fee) {
            (bool ok,) = msg.sender.call{value: msg.value - fee}("");
            require(ok, "Refund failed");
        }
    }

    function entropyCallback(uint64 sequenceNumber, address, bytes32 randomNumber) internal override {
        PendingBoosters memory p = pendingBoosters[sequenceNumber];
        require(p.user != address(0), "Unknown sequence");

        uint32 drawn = 0;
        uint8[3] memory cards;
        uint8 cardCount = 0;

        for (uint8 i = 0; i < 22 && cardCount < 3; i++) {
            uint8 candidate = uint8(uint256(keccak256(abi.encodePacked(randomNumber, i)))) % 22;

            uint32 mask = uint32(1) << candidate;
            if ((drawn & mask) == 0) {
                drawn |= mask;
                cards[cardCount] = candidate;
                cardCount++;
            }
        }

        emit BoostersDrawn(sequenceNumber, p.user, cards[0], cards[1], cards[2], randomNumber, p.sessionSalt);

        delete pendingBoosters[sequenceNumber];
    }

    function getEntropy() internal view override returns (address) {
        return address(entropy);
    }

    function getFee() external view returns (uint256) {
        return entropy.getFeeV2();
    }
}
