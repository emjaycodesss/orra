// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/OrraDuel.sol";
import {EntropyStructsV2} from "@pythnetwork/entropy-sdk-solidity/EntropyStructsV2.sol";

contract MockEntropyDuel is IEntropyV2 {
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

contract OrraDuelTest is Test {
    OrraDuel public duel;
    MockEntropyDuel public mockEntropy;
    address public provider = address(0xBEEF);
    address public user = address(0xCAFE);

    function setUp() public {
        mockEntropy = new MockEntropyDuel(provider);
        duel = new OrraDuel(address(mockEntropy), provider);
        vm.deal(user, 10 ether);
    }

    function testRequestBoosters() public {
        bytes32 salt = keccak256("session");
        vm.prank(user);
        duel.requestSessionBoosters{value: 0.001 ether}(salt);
        (address u, bytes32 s) = duel.pendingBoosters(1);
        assertEq(u, user);
        assertEq(s, salt);
    }

    function testBoostersDrawnIndicesInRange() public {
        bytes32 salt = bytes32(uint256(1));
        vm.prank(user);
        duel.requestSessionBoosters{value: 0.001 ether}(salt);

        bytes32 randomNumber = keccak256("entropy");
        uint8 e0 = uint8(uint256(keccak256(abi.encodePacked(randomNumber, uint8(0))))) % 22;
        uint8 e1 = uint8(uint256(keccak256(abi.encodePacked(randomNumber, uint8(1))))) % 22;
        uint8 e2 = uint8(uint256(keccak256(abi.encodePacked(randomNumber, uint8(2))))) % 22;

        vm.expectEmit(true, true, false, true);
        emit OrraDuel.BoostersDrawn(1, user, e0, e1, e2, randomNumber, salt);

        mockEntropy.simulateCallback(address(duel), 1, randomNumber);
    }

    function testInsufficientFee() public {
        vm.prank(user);
        vm.expectRevert("Insufficient fee");
        duel.requestSessionBoosters{value: 0.0001 ether}(bytes32(0));
    }
}
