// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {IEntropyConsumer} from "@pythnetwork/entropy-sdk-solidity/IEntropyConsumer.sol";
import {IEntropyV2} from "@pythnetwork/entropy-sdk-solidity/IEntropyV2.sol";

/**
 * @title OrraDuel
 * @notice Draws three Major Arcana indices (0-21) per Entropy v2 request for quiz power-ups.
 */
contract OrraDuel is IEntropyConsumer {
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

        uint8 c0 = uint8(uint256(keccak256(abi.encodePacked(randomNumber, uint8(0))))) % 22;
        uint8 c1 = uint8(uint256(keccak256(abi.encodePacked(randomNumber, uint8(1))))) % 22;
        uint8 c2 = uint8(uint256(keccak256(abi.encodePacked(randomNumber, uint8(2))))) % 22;

        emit BoostersDrawn(sequenceNumber, p.user, c0, c1, c2, randomNumber, p.sessionSalt);

        delete pendingBoosters[sequenceNumber];
    }

    function getEntropy() internal view override returns (address) {
        return address(entropy);
    }

    function getFee() external view returns (uint256) {
        return entropy.getFeeV2();
    }
}
