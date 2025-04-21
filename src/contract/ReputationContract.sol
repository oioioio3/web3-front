// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ReputationContract {
    struct Reputation {
        uint256 successfulTrades; // 正常完成
        uint256 negotiatedTrades; // 协商完成
        uint256 timedOutTrades; // 超时
    }

    mapping(address => Reputation) public reputations;

    event ReputationUpdated(address indexed account, uint256 successful, uint256 negotiated, uint256 timedOut);

    function updateReputation(address account, uint8 status) internal {
        Reputation storage rep = reputations[account];
        if (status == 2) {
            rep.successfulTrades++;
        } else if (status == 3) {
            rep.negotiatedTrades++;
        } else if (status == 4) {
            rep.timedOutTrades++;
        }
        emit ReputationUpdated(account, rep.successfulTrades, rep.negotiatedTrades, rep.timedOutTrades);
    }

    function getReputation(address account) public view returns (
        uint256 successfulTrades,
        uint256 negotiatedTrades,
        uint256 timedOutTrades
    ) {
        Reputation storage rep = reputations[account];
        return (rep.successfulTrades, rep.negotiatedTrades, rep.timedOutTrades);
    }
}