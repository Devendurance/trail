// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title TrailReviewRegistry
/// @notice Wallet-signed, evidence-backed product reviews for the Trail ecosystem.
/// @dev A review can only be published by the reviewer wallet itself, carrying an
///      EIP-712 authorization signed by the configured off-chain verifier. The
///      verifier is expected (off-chain, Slice 3) to sign only after validating a
///      real eligible underlying on-chain action. This contract does NOT verify
///      any historical external transaction itself.
contract TrailReviewRegistry is EIP712, Ownable, Pausable {
    /// @notice Self-reported experience outcome. Never a quality grade.
    enum Outcome {
        WorkedWell, // 0
        WorkedWithFriction // 1

    }

    /// @notice EIP-712 review authorization signed by the verifier.
    struct ReviewAuth {
        address reviewer;
        uint256 projectId;
        bytes32 proofTxHash;
        bytes32 contentHash;
        uint8 rating; // 1..5, user-reported
        Outcome outcome; // user-reported
        uint256 nonce; // must equal nonces[reviewer]
        uint64 deadline; // unix seconds, inclusive
    }

    /// @notice Stored review. Immutable once published.
    struct Review {
        address reviewer;
        uint256 projectId;
        bytes32 proofTxHash;
        bytes32 contentHash;
        uint8 rating;
        Outcome outcome;
    }

    /// @dev Must match the Slice 3 backend payload exactly.
    ///      ReviewAuth(address reviewer,uint256 projectId,bytes32 proofTxHash,
    ///        bytes32 contentHash,uint8 rating,uint8 outcome,uint256 nonce,uint64 deadline)
    bytes32 public constant REVIEW_AUTH_TYPEHASH = keccak256(
        "ReviewAuth(address reviewer,uint256 projectId,bytes32 proofTxHash,bytes32 contentHash,uint8 rating,uint8 outcome,uint256 nonce,uint64 deadline)"
    );

    /// @notice EIP-712 domain name bound in every authorization signature.
    string public constant DOMAIN_NAME = "TrailReviewRegistry";
    /// @notice EIP-712 domain version. Bump only with a new registry deployment.
    string public constant DOMAIN_VERSION = "1";
    /// @notice Minimum accepted user rating.
    uint8 public constant MIN_RATING = 1;
    /// @notice Maximum accepted user rating.
    uint8 public constant MAX_RATING = 5;

    /// @notice Off-chain verifier authorized to sign review authorizations.
    address public verifier;
    /// @notice Next usable nonce per reviewer wallet. Starts at 0.
    mapping(address reviewer => uint256 nonce) public nonces;
    /// @notice Active (reviewable) project IDs. Inactive or never-added IDs reject.
    mapping(uint256 projectId => bool active) public projectActive;
    /// @notice True once a wallet has published for a project. One review per wallet/app.
    mapping(uint256 projectId => mapping(address reviewer => bool reviewed)) public hasReviewed;
    /// @notice True once a proof hash is consumed. Bound to this chain ID.
    /// @dev Key is keccak256(abi.encode(block.chainid, proofTxHash)).
    mapping(bytes32 proofKey => bool used) internal _proofConsumed;
    /// @notice Total published reviews. Also the latest reviewId (IDs start at 1).
    uint256 public reviewCount;
    /// @notice Published reviews by ID. No setter exists; entries are append-only.
    mapping(uint256 reviewId => Review review) internal _reviews;

    event ReviewPublished(
        uint256 indexed reviewId,
        uint256 indexed projectId,
        address indexed reviewer,
        bytes32 proofTxHash,
        bytes32 contentHash,
        uint8 rating,
        Outcome outcome
    );
    event VerifierRotated(address indexed oldVerifier, address indexed newVerifier);
    event ProjectStatusChanged(uint256 indexed projectId, bool active);

    error WrongCaller(address expected, address actual);
    error BadSigner(address expected, address recovered);
    error AuthExpired(uint64 deadline, uint256 nowTs);
    error BadNonce(address reviewer, uint256 expected, uint256 provided);
    error InvalidProject(uint256 projectId);
    error InvalidRating(uint8 rating);
    error EmptyHash(string field);
    error AlreadyReviewed(uint256 projectId, address reviewer);
    error ProofAlreadyUsed(bytes32 proofTxHash);
    error ZeroVerifier();
    error UnknownReview(uint256 reviewId);

    constructor(address initialVerifier) EIP712(DOMAIN_NAME, DOMAIN_VERSION) Ownable(msg.sender) {
        if (initialVerifier == address(0)) revert ZeroVerifier();
        verifier = initialVerifier;
    }

    /// @notice Publish a review carrying a verifier-signed authorization.
    /// @dev Caller must be the reviewer. Consumes the reviewer nonce and the
    ///      proof hash. Reverts while paused.
    function publishReview(ReviewAuth calldata auth, bytes calldata sig)
        external
        whenNotPaused
        returns (uint256 reviewId)
    {
        if (auth.reviewer != msg.sender) revert WrongCaller(auth.reviewer, msg.sender);
        if (auth.reviewer == address(0)) revert WrongCaller(address(0), msg.sender);
        if (block.timestamp > auth.deadline) revert AuthExpired(auth.deadline, block.timestamp);
        if (!projectActive[auth.projectId]) revert InvalidProject(auth.projectId);
        if (auth.rating < MIN_RATING || auth.rating > MAX_RATING) revert InvalidRating(auth.rating);
        if (auth.proofTxHash == bytes32(0)) revert EmptyHash("proofTxHash");
        if (auth.contentHash == bytes32(0)) revert EmptyHash("contentHash");

        uint256 expectedNonce = nonces[auth.reviewer];
        if (auth.nonce != expectedNonce) revert BadNonce(auth.reviewer, expectedNonce, auth.nonce);
        nonces[auth.reviewer] = expectedNonce + 1;

        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    REVIEW_AUTH_TYPEHASH,
                    auth.reviewer,
                    auth.projectId,
                    auth.proofTxHash,
                    auth.contentHash,
                    auth.rating,
                    auth.outcome,
                    auth.nonce,
                    auth.deadline
                )
            )
        );
        address recovered = ECDSA.recover(digest, sig);
        if (recovered != verifier) revert BadSigner(verifier, recovered);

        bytes32 proofKey = _proofKey(auth.proofTxHash);
        if (_proofConsumed[proofKey]) revert ProofAlreadyUsed(auth.proofTxHash);
        if (hasReviewed[auth.projectId][auth.reviewer]) revert AlreadyReviewed(auth.projectId, auth.reviewer);
        _proofConsumed[proofKey] = true;
        hasReviewed[auth.projectId][auth.reviewer] = true;

        reviewId = ++reviewCount;
        _reviews[reviewId] = Review({
            reviewer: auth.reviewer,
            projectId: auth.projectId,
            proofTxHash: auth.proofTxHash,
            contentHash: auth.contentHash,
            rating: auth.rating,
            outcome: auth.outcome
        });

        emit ReviewPublished(
            reviewId, auth.projectId, auth.reviewer, auth.proofTxHash, auth.contentHash, auth.rating, auth.outcome
        );
    }

    /// @notice True if a proof hash is already consumed on this chain.
    function proofUsed(bytes32 proofTxHash) external view returns (bool) {
        return _proofConsumed[_proofKey(proofTxHash)];
    }

    /// @notice Reviewer wallet of a published review. Reverts for unknown IDs.
    function getReviewer(uint256 reviewId) external view returns (address) {
        if (reviewId == 0 || reviewId > reviewCount) revert UnknownReview(reviewId);
        return _reviews[reviewId].reviewer;
    }

    /// @notice Full stored review by ID. Reverts for unknown IDs.
    function getReview(uint256 reviewId) external view returns (Review memory) {
        if (reviewId == 0 || reviewId > reviewCount) revert UnknownReview(reviewId);
        return _reviews[reviewId];
    }

    /// @notice Rotate the authorized verifier. Old authorizations stop working.
    function setVerifier(address newVerifier) external onlyOwner {
        if (newVerifier == address(0)) revert ZeroVerifier();
        address old = verifier;
        verifier = newVerifier;
        emit VerifierRotated(old, newVerifier);
    }

    /// @notice Activate or deactivate a project for new reviews.
    function setProjectActive(uint256 projectId, bool active) external onlyOwner {
        projectActive[projectId] = active;
        emit ProjectStatusChanged(projectId, active);
    }

    /// @notice Pause new publications. Existing reviews stay readable.
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Resume new publications.
    function unpause() external onlyOwner {
        _unpause();
    }

    function _proofKey(bytes32 proofTxHash) internal view returns (bytes32) {
        return keccak256(abi.encode(block.chainid, proofTxHash));
    }
}
