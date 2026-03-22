// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IEntropyConsumer} from "@pythnetwork/entropy-sdk-solidity/IEntropyConsumer.sol";
import {IEntropyV2} from "@pythnetwork/entropy-sdk-solidity/IEntropyV2.sol";

contract Orra is IEntropyConsumer {
    IEntropyV2 public immutable entropy;
    address public immutable provider;

    mapping(uint64 => address) public readings;

    event ReadingRequested(uint64 indexed sequenceNumber, address indexed user);
    event CardDrawn(uint64 indexed sequenceNumber, address indexed user, uint8 cardIndex);

    constructor(address entropyAddress, address _provider) {
        entropy = IEntropyV2(entropyAddress);
        provider = _provider;
    }

    function requestReading() external payable {
        uint256 fee = entropy.getFeeV2();
        require(msg.value >= fee, "Insufficient fee");

        uint64 sequenceNumber = entropy.requestV2{value: fee}();
        readings[sequenceNumber] = msg.sender;

        emit ReadingRequested(sequenceNumber, msg.sender);

        if (msg.value > fee) {
            (bool ok,) = msg.sender.call{value: msg.value - fee}("");
            require(ok, "Refund failed");
        }
    }

    function entropyCallback(
        uint64 sequenceNumber,
        address,
        bytes32 randomNumber
    ) internal override {
        address user = readings[sequenceNumber];
        uint8 cardIndex = uint8(uint256(randomNumber) % 22);

        emit CardDrawn(sequenceNumber, user, cardIndex);

        delete readings[sequenceNumber];
    }

    function getEntropy() internal view override returns (address) {
        return address(entropy);
    }

    function getFee() external view returns (uint256) {
        return entropy.getFeeV2();
    }
}
