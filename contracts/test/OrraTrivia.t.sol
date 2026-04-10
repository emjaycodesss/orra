// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/OrraTrivia.sol";
import {EntropyStructsV2} from "@pythnetwork/entropy-sdk-solidity/EntropyStructsV2.sol";

contract MockEntropyTrivia is IEntropyV2 {
    uint64 public nextSeq = 1;
    uint128 public fee = 0.001 ether;
    address public _defaultProvider;

    constructor(address provider_) {
        _defaultProvider = provider_;
    }

    function requestV2() external payable returns (uint64) {
        require(msg.value >= fee, "Fee too low");
        return nextSeq++;
    }

    function requestV2(uint32) external payable returns (uint64) {
        require(msg.value >= fee, "Fee too low");
        return nextSeq++;
    }

    function requestV2(address, uint32) external payable returns (uint64) {
        require(msg.value >= fee, "Fee too low");
        return nextSeq++;
    }

    function requestV2(address, bytes32, uint32) external payable returns (uint64) {
        require(msg.value >= fee, "Fee too low");
        return nextSeq++;
    }

    function getFeeV2() external view returns (uint128) {
        return fee;
    }

    function getFeeV2(uint32) external view returns (uint128) {
        return fee;
    }

    function getFeeV2(address, uint32) external view returns (uint128) {
        return fee;
    }

    function getDefaultProvider() external view returns (address) {
        return _defaultProvider;
    }

    function getProviderInfoV2(address) external pure returns (EntropyStructsV2.ProviderInfo memory info) {
        return info;
    }

    function getRequestV2(address, uint64) external pure returns (EntropyStructsV2.Request memory req) {
        return req;
    }

    function simulateCallback(address consumer, uint64 seq, bytes32 random) external {
        IEntropyConsumer(consumer)._entropyCallback(seq, _defaultProvider, random);
    }
}

contract OrraTriviaTest is Test {
    OrraTrivia public trivia;
    MockEntropyTrivia public mockEntropy;
    address public provider = address(0xBEEF);
    address public user = address(0xCAFE);

    function setUp() public {
        mockEntropy = new MockEntropyTrivia(provider);
        trivia = new OrraTrivia(address(mockEntropy), provider);
        vm.deal(user, 10 ether);
    }

    function testRequestBoosters() public {
        bytes32 salt = keccak256("session");
        vm.prank(user);
        trivia.requestSessionBoosters{value: 0.001 ether}(salt);
        (address u, bytes32 s) = trivia.pendingBoosters(1);
        assertEq(u, user);
        assertEq(s, salt);
    }

    function testBoostersDrawnIndicesInRange() public {
        bytes32 salt = bytes32(uint256(1));
        vm.prank(user);
        trivia.requestSessionBoosters{value: 0.001 ether}(salt);

        bytes32 randomNumber = keccak256("entropy");

        uint32 drawn = 0;
        uint8[3] memory expected;
        uint8 count = 0;

        for (uint8 i = 0; i < 22 && count < 3; i++) {
            uint8 candidate = uint8(uint256(keccak256(abi.encodePacked(randomNumber, i)))) % 22;
            uint32 mask = uint32(1) << candidate;
            if ((drawn & mask) == 0) {
                drawn |= mask;
                expected[count] = candidate;
                count++;
            }
        }

        require(count == 3, "Failed to draw 3 unique cards");
        require(expected[0] != expected[1] && expected[1] != expected[2] && expected[0] != expected[2], "Cards must be unique");

        vm.expectEmit(true, true, false, true);
        emit OrraTrivia.BoostersDrawn(1, user, expected[0], expected[1], expected[2], randomNumber, salt);

        mockEntropy.simulateCallback(address(trivia), 1, randomNumber);
    }

    function testBoostersAreAlwaysUnique() public {
        bytes32 salt = bytes32(uint256(1));
        vm.prank(user);
        trivia.requestSessionBoosters{value: 0.001 ether}(salt);

        bytes32[5] memory randomNumbers = [
            keccak256("entropy1"),
            keccak256("entropy2"),
            bytes32(uint256(12345)),
            bytes32(uint256(999999)),
            keccak256(abi.encodePacked(block.timestamp, block.number))
        ];

        for (uint i = 0; i < randomNumbers.length; i++) {
            bytes32 randomNumber = randomNumbers[i];

            uint32 drawn = 0;
            uint8[3] memory cards;
            uint8 count = 0;

            for (uint8 j = 0; j < 22 && count < 3; j++) {
                uint8 candidate = uint8(uint256(keccak256(abi.encodePacked(randomNumber, j)))) % 22;
                uint32 mask = uint32(1) << candidate;
                if ((drawn & mask) == 0) {
                    drawn |= mask;
                    cards[count] = candidate;
                    count++;
                }
            }

            require(count == 3, "Should always draw exactly 3 cards");
            require(cards[0] != cards[1], "c0 must != c1");
            require(cards[1] != cards[2], "c1 must != c2");
            require(cards[0] != cards[2], "c0 must != c2");
            require(cards[0] < 22 && cards[1] < 22 && cards[2] < 22, "All indices must be < 22");
        }
    }

    function testInsufficientFee() public {
        vm.prank(user);
        vm.expectRevert("Insufficient fee");
        trivia.requestSessionBoosters{value: 0.0001 ether}(bytes32(0));
    }
}
