// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/Orra.sol";
import {EntropyStructsV2} from "@pythnetwork/entropy-sdk-solidity/EntropyStructsV2.sol";

contract MockEntropy is IEntropyV2 {
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

contract OrraTest is Test {
    Orra public orra;
    MockEntropy public mockEntropy;
    address public provider = address(0xBEEF);
    address public user = address(0xCAFE);

    function setUp() public {
        mockEntropy = new MockEntropy(provider);
        orra = new Orra(address(mockEntropy), provider);
        vm.deal(user, 10 ether);
    }

    function testRequestReading() public {
        vm.prank(user);
        orra.requestReading{value: 0.001 ether}();
        assertEq(orra.readings(1), user);
    }

    function testGetFee() public view {
        assertEq(orra.getFee(), 0.001 ether);
    }

    function testCardDrawn() public {
        vm.prank(user);
        orra.requestReading{value: 0.001 ether}();

        bytes32 randomNumber = keccak256("test");
        uint8 expectedCard = uint8(uint256(randomNumber) % 22);

        vm.expectEmit(true, true, false, true);
        emit Orra.CardDrawn(1, user, expectedCard);

        mockEntropy.simulateCallback(address(orra), 1, randomNumber);
    }

    function testRefundExcess() public {
        uint256 balanceBefore = user.balance;
        vm.prank(user);
        orra.requestReading{value: 0.01 ether}();
        uint256 balanceAfter = user.balance;
        assertEq(balanceBefore - balanceAfter, 0.001 ether);
    }

    function testInsufficientFee() public {
        vm.prank(user);
        vm.expectRevert("Insufficient fee");
        orra.requestReading{value: 0.0001 ether}();
    }

    function testCardIndexRange() public pure {
        for (uint256 i = 0; i < 50; i++) {
            bytes32 rand = keccak256(abi.encodePacked(i));
            uint8 cardIndex = uint8(uint256(rand) % 22);
            assertTrue(cardIndex < 22);
        }
    }
}
