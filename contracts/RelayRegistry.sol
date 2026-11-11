// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title AI Remix Relay Registry
/// @notice Minimal application registry for parent/child remix lineage on X Layer.
///         AI generation and TapeOut evaluation remain off-chain boundaries; this
///         contract stores their commitments and the final publish evidence.
contract RelayRegistry {
    struct NodeRecord {
        bytes32 relayId;
        bytes32 parentNodeId;
        bytes32 contentHash;
        bytes32 ruleHash;
        bytes32 circuitInputCommitment;
        bytes32 recipeCode;
        address creator;
        uint64 createdAt;
        uint16 splitBps;
        uint8 contentType; // 1=image, 2=text
        bool exists;
    }

    mapping(bytes32 => NodeRecord) public nodes;

    event NodePublished(
        bytes32 indexed nodeId,
        bytes32 indexed relayId,
        bytes32 indexed parentNodeId,
        bytes32 contentHash,
        bytes32 ruleHash,
        bytes32 circuitInputCommitment,
        bytes32 recipeCode,
        address creator,
        uint8 contentType,
        uint16 splitBps
    );

    error ParentNotFound();
    error NodeAlreadyExists();
    error InvalidSplit();
    error InvalidContentType();

    function publishNode(
        bytes32 relayId,
        bytes32 parentNodeId,
        bytes32 contentHash,
        bytes32 ruleHash,
        bytes32 circuitInputCommitment,
        bytes32 recipeCode,
        uint8 contentType,
        uint16 splitBps
    ) external returns (bytes32 nodeId) {
        if (parentNodeId != bytes32(0) && !nodes[parentNodeId].exists) revert ParentNotFound();
        if (splitBps > 3000) revert InvalidSplit();
        if (contentType != 1 && contentType != 2) revert InvalidContentType();

        nodeId = keccak256(abi.encode(relayId, parentNodeId, contentHash, msg.sender, block.number));
        if (nodes[nodeId].exists) revert NodeAlreadyExists();

        nodes[nodeId] = NodeRecord({
            relayId: relayId,
            parentNodeId: parentNodeId,
            contentHash: contentHash,
            ruleHash: ruleHash,
            circuitInputCommitment: circuitInputCommitment,
            recipeCode: recipeCode,
            creator: msg.sender,
            createdAt: uint64(block.timestamp),
            splitBps: splitBps,
            contentType: contentType,
            exists: true
        });

        emit NodePublished(nodeId, relayId, parentNodeId, contentHash, ruleHash, circuitInputCommitment, recipeCode, msg.sender, contentType, splitBps);
    }
}
