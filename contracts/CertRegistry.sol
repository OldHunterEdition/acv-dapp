// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract CertRegistry is AccessControl {
    using ECDSA for bytes32;

    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    bytes32 private immutable DOMAIN_SEPARATOR;

    bytes32 private constant VERIFY_TYPEHASH =
        keccak256("Verify(address signer,string message)");

    enum Status {
        None,
        Active,
        Revoked
    }

    struct Cert {
        address issuer;
        string cid;
        bytes32 contentHash;
        uint64 issuedAt;
        uint64 revokedAt;
        Status status;
    }

    mapping(bytes32 => Cert) private certs;

    event Issued(
        bytes32 indexed certId,
        address indexed issuer,
        string cid,
        bytes32 contentHash
    );
    event Revoked(
        bytes32 indexed certId,
        address indexed issuer,
        string reason
    );

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ISSUER_ROLE, admin);
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256(bytes("CredentialChecker")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    // Single Issue

    function issue(
        bytes32 certId,
        string calldata cid,
        bytes32 contentHash
    ) external onlyRole(ISSUER_ROLE) {
        _issue(certId, cid, contentHash, msg.sender);
    }

    function revoke(bytes32 certId, string calldata reason) external {
        _revoke(certId, reason, msg.sender);
    }

    // Batch Issue

    function batchIssue(
        bytes32[] calldata certIds,
        string[] calldata cids,
        bytes32[] calldata contentHashes
    ) external onlyRole(ISSUER_ROLE) {
        require(certIds.length == cids.length, "length mismatch");
        require(cids.length == contentHashes.length, "length mismatch");

        for (uint256 i = 0; i < certIds.length; ) {
            _issue(certIds[i], cids[i], contentHashes[i], msg.sender);
            unchecked {
                ++i;
            }
        }
    }

    function batchRevoke(
        bytes32[] calldata certIds,
        string[] calldata reasons
    ) external {
        require(certIds.length == reasons.length, "length mismatch");

        for (uint256 i = 0; i < certIds.length; ) {
            _revoke(certIds[i], reasons[i], msg.sender);
            unchecked {
                ++i;
            }
        }
    }

    // Views

    function get(bytes32 certId) external view returns (Cert memory) {
        return certs[certId];
    }

    function statusOf(bytes32 certId) external view returns (Status) {
        return certs[certId].status;
    }

    function isActive(bytes32 certId) external view returns (bool) {
        return certs[certId].status == Status.Active;
    }

    function verify(
        address signer,
        string memory message,
        bytes memory signature
    ) public view returns (bool) {
        bytes32 structHash = keccak256(
            abi.encode(VERIFY_TYPEHASH, signer, keccak256(bytes(message)))
        );

        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash)
        );
        return digest.recover(signature) == signer;
    }

    // helpers

    function _issue(
        bytes32 certId,
        string calldata cid,
        bytes32 contentHash,
        address issuer
    ) internal {
        require(certs[certId].status == Status.None, "exists");
        certs[certId] = Cert(
            issuer,
            cid,
            contentHash,
            uint64(block.timestamp),
            0,
            Status.Active
        );
        emit Issued(certId, issuer, cid, contentHash);
    }

    function _revoke(
        bytes32 certId,
        string calldata reason,
        address caller
    ) internal {
        Cert storage c = certs[certId];
        require(c.status == Status.Active, "not active");
        require(
            hasRole(ISSUER_ROLE, caller) && caller == c.issuer,
            "only issuer"
        );
        c.status = Status.Revoked;
        c.revokedAt = uint64(block.timestamp);
        emit Revoked(certId, caller, reason);
    }
}
