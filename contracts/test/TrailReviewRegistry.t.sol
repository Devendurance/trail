// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {TrailReviewRegistry} from "../src/TrailReviewRegistry.sol";

/// @notice Positive and adversarial tests for TrailReviewRegistry.
/// @dev Signatures are produced by replicating the documented EIP-712 schema,
///      exactly as the Slice 3 backend must. The positive tests prove the
///      replication matches the contract.
/// @dev Cheatcode ordering rule: compute signatures BEFORE vm.prank (vm.sign
///      consumes a prank), and place vm.expectRevert BEFORE vm.prank.
contract TrailReviewRegistryTest is Test {
    TrailReviewRegistry internal reg;
    TrailReviewRegistry internal regB;

    uint256 internal verifierKey = 0xB071;
    address internal verifier;
    uint256 internal attackerKey = 0xE711;
    address internal attacker;

    address internal reviewer = makeAddr("reviewer");
    address internal reviewer2 = makeAddr("reviewer2");

    uint256 internal constant PROJECT_ONE = 1;
    uint256 internal constant PROJECT_TWO = 2;

    bytes32 internal constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    function setUp() public {
        verifier = vm.addr(verifierKey);
        attacker = vm.addr(attackerKey);
        reg = new TrailReviewRegistry(verifier);
        regB = new TrailReviewRegistry(verifier);
        reg.setProjectActive(PROJECT_ONE, true);
        reg.setProjectActive(PROJECT_TWO, true);
    }

    // ---------- helpers ----------

    function _auth(
        address who,
        uint256 projectId,
        bytes32 proof,
        bytes32 content,
        uint8 rating,
        TrailReviewRegistry.Outcome outcome,
        uint256 nonce,
        uint64 deadline
    ) internal pure returns (TrailReviewRegistry.ReviewAuth memory) {
        return TrailReviewRegistry.ReviewAuth({
            reviewer: who,
            projectId: projectId,
            proofTxHash: proof,
            contentHash: content,
            rating: rating,
            outcome: outcome,
            nonce: nonce,
            deadline: deadline
        });
    }

    function _digest(TrailReviewRegistry target, TrailReviewRegistry.ReviewAuth memory auth)
        internal
        view
        returns (bytes32)
    {
        bytes32 structHash = keccak256(
            abi.encode(
                target.REVIEW_AUTH_TYPEHASH(),
                auth.reviewer,
                auth.projectId,
                auth.proofTxHash,
                auth.contentHash,
                auth.rating,
                auth.outcome,
                auth.nonce,
                auth.deadline
            )
        );
        bytes32 separator = keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes("TrailReviewRegistry")),
                keccak256(bytes("1")),
                block.chainid,
                address(target)
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", separator, structHash));
    }

    function _sign(TrailReviewRegistry target, uint256 key, TrailReviewRegistry.ReviewAuth memory auth)
        internal
        view
        returns (bytes memory)
    {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, _digest(target, auth));
        return abi.encodePacked(r, s, v);
    }

    function _sig(TrailReviewRegistry target, TrailReviewRegistry.ReviewAuth memory auth)
        internal
        view
        returns (bytes memory)
    {
        return _sign(target, verifierKey, auth);
    }

    function _deadline() internal view returns (uint64) {
        return uint64(block.timestamp + 600);
    }

    // ---------- positive ----------

    function test_ValidPublication() public {
        TrailReviewRegistry.ReviewAuth memory auth = _auth(
            reviewer, PROJECT_ONE, bytes32(uint256(0xA11CE)), bytes32(uint256(0xC0FFEE)),
            5, TrailReviewRegistry.Outcome.WorkedWell, 0, _deadline()
        );
        bytes memory sig = _sig(reg, auth);

        vm.expectEmit(true, true, true, true);
        emit TrailReviewRegistry.ReviewPublished(
            1, PROJECT_ONE, reviewer, auth.proofTxHash, auth.contentHash, 5,
            TrailReviewRegistry.Outcome.WorkedWell
        );
        vm.prank(reviewer);
        uint256 id = reg.publishReview(auth, sig);
        assertEq(id, 1);

        assertEq(reg.getReviewer(1), reviewer);
        assertTrue(reg.hasReviewed(PROJECT_ONE, reviewer));
        assertTrue(reg.proofUsed(auth.proofTxHash));
        assertEq(reg.nonces(reviewer), 1);
        assertEq(reg.reviewCount(), 1);

        TrailReviewRegistry.Review memory stored = reg.getReview(1);
        assertEq(stored.reviewer, reviewer);
        assertEq(stored.projectId, PROJECT_ONE);
        assertEq(stored.proofTxHash, auth.proofTxHash);
        assertEq(stored.contentHash, auth.contentHash);
        assertEq(stored.rating, 5);
        assertEq(uint8(stored.outcome), uint8(TrailReviewRegistry.Outcome.WorkedWell));
    }

    function testFuzz_ValidRatingsAndOutcomes(uint8 rawRating, uint8 rawOutcome) public {
        uint8 rating = uint8(bound(rawRating, 1, 5));
        TrailReviewRegistry.Outcome outcome =
            rawOutcome % 2 == 0 ? TrailReviewRegistry.Outcome.WorkedWell : TrailReviewRegistry.Outcome.WorkedWithFriction;
        TrailReviewRegistry.ReviewAuth memory auth = _auth(
            reviewer, PROJECT_ONE, bytes32(uint256(0xF07)), bytes32(uint256(0xBA5)),
            rating, outcome, 0, _deadline()
        );
        bytes memory sig = _sig(reg, auth);
        vm.prank(reviewer);
        uint256 id = reg.publishReview(auth, sig);
        assertEq(id, 1);
        assertEq(reg.getReview(1).rating, rating);
        assertEq(uint8(reg.getReview(1).outcome), uint8(outcome));
    }

    function test_RotatedVerifierAuthorizes() public {
        uint256 verifier2Key = 0xBE57;
        address verifier2 = vm.addr(verifier2Key);
        vm.expectEmit(true, true, false, false);
        emit TrailReviewRegistry.VerifierRotated(verifier, verifier2);
        reg.setVerifier(verifier2);

        TrailReviewRegistry.ReviewAuth memory auth = _auth(
            reviewer, PROJECT_ONE, bytes32(uint256(1)), bytes32(uint256(2)),
            4, TrailReviewRegistry.Outcome.WorkedWithFriction, 0, _deadline()
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(verifier2Key, _digest(reg, auth));
        vm.prank(reviewer);
        uint256 id = reg.publishReview(auth, abi.encodePacked(r, s, v));
        assertEq(id, 1);
        assertEq(reg.getReviewer(1), reviewer);
    }

    // ---------- negative ----------

    function test_RevertForgedSigner() public {
        TrailReviewRegistry.ReviewAuth memory auth = _auth(
            reviewer, PROJECT_ONE, bytes32(uint256(0xA11CE)), bytes32(uint256(0xC0FFEE)),
            5, TrailReviewRegistry.Outcome.WorkedWell, 0, _deadline()
        );
        bytes memory sig = _sign(reg, attackerKey, auth);
        vm.expectRevert(abi.encodeWithSelector(TrailReviewRegistry.BadSigner.selector, verifier, attacker));
        vm.prank(reviewer);
        reg.publishReview(auth, sig);
    }

    function test_RevertWrongCaller() public {
        TrailReviewRegistry.ReviewAuth memory auth = _auth(
            reviewer, PROJECT_ONE, bytes32(uint256(0xA11CE)), bytes32(uint256(0xC0FFEE)),
            5, TrailReviewRegistry.Outcome.WorkedWell, 0, _deadline()
        );
        bytes memory sig = _sig(reg, auth);
        vm.expectRevert(
            abi.encodeWithSelector(TrailReviewRegistry.WrongCaller.selector, reviewer, reviewer2)
        );
        vm.prank(reviewer2);
        reg.publishReview(auth, sig);
    }

    function test_RevertExpired() public {
        uint64 deadline = uint64(block.timestamp + 60);
        TrailReviewRegistry.ReviewAuth memory auth = _auth(
            reviewer, PROJECT_ONE, bytes32(uint256(0xA11CE)), bytes32(uint256(0xC0FFEE)),
            5, TrailReviewRegistry.Outcome.WorkedWell, 0, deadline
        );
        bytes memory sig = _sig(reg, auth);
        vm.warp(block.timestamp + 61);
        uint256 nowTs = block.timestamp;
        vm.expectRevert(
            abi.encodeWithSelector(TrailReviewRegistry.AuthExpired.selector, deadline, nowTs)
        );
        vm.prank(reviewer);
        reg.publishReview(auth, sig);
    }

    function test_RevertWrongChain() public {
        TrailReviewRegistry.ReviewAuth memory auth = _auth(
            reviewer, PROJECT_ONE, bytes32(uint256(0xA11CE)), bytes32(uint256(0xC0FFEE)),
            5, TrailReviewRegistry.Outcome.WorkedWell, 0, _deadline()
        );
        bytes memory sig = _sig(reg, auth);
        vm.chainId(677_001); // authorization was bound to the original chain
        vm.expectRevert(); // digest domain differs, recovery misses the verifier
        vm.prank(reviewer);
        reg.publishReview(auth, sig);
    }

    function test_RevertWrongContract() public {
        TrailReviewRegistry.ReviewAuth memory auth = _auth(
            reviewer, PROJECT_ONE, bytes32(uint256(0xA11CE)), bytes32(uint256(0xC0FFEE)),
            5, TrailReviewRegistry.Outcome.WorkedWell, 0, _deadline()
        );
        bytes memory sigForA = _sig(reg, auth);
        regB.setProjectActive(PROJECT_ONE, true);
        vm.expectRevert(); // domain binds regA, recovery on regB misses
        vm.prank(reviewer);
        regB.publishReview(auth, sigForA);
    }

    function test_RevertNonceReplay() public {
        TrailReviewRegistry.ReviewAuth memory auth = _auth(
            reviewer, PROJECT_ONE, bytes32(uint256(0xA11CE)), bytes32(uint256(0xC0FFEE)),
            5, TrailReviewRegistry.Outcome.WorkedWell, 0, _deadline()
        );
        bytes memory sig = _sig(reg, auth);
        vm.prank(reviewer);
        reg.publishReview(auth, sig);

        // same nonce signed again (fresh proof so only the nonce fails)
        TrailReviewRegistry.ReviewAuth memory replay = _auth(
            reviewer, PROJECT_ONE, bytes32(uint256(0xDEAD)), bytes32(uint256(0xBEEF)),
            4, TrailReviewRegistry.Outcome.WorkedWell, 0, _deadline()
        );
        bytes memory replaySig = _sig(reg, replay);
        vm.expectRevert(
            abi.encodeWithSelector(TrailReviewRegistry.BadNonce.selector, reviewer, 1, 0)
        );
        vm.prank(reviewer);
        reg.publishReview(replay, replaySig);
    }

    function test_RevertProofReuseAcrossProjects() public {
        bytes32 proof = bytes32(uint256(0xA11CE));
        TrailReviewRegistry.ReviewAuth memory first = _auth(
            reviewer, PROJECT_ONE, proof, bytes32(uint256(0xC0FFEE)),
            5, TrailReviewRegistry.Outcome.WorkedWell, 0, _deadline()
        );
        bytes memory firstSig = _sig(reg, first);
        vm.prank(reviewer);
        reg.publishReview(first, firstSig);

        TrailReviewRegistry.ReviewAuth memory second = _auth(
            reviewer, PROJECT_TWO, proof, bytes32(uint256(0xD1FF)),
            4, TrailReviewRegistry.Outcome.WorkedWell, 1, _deadline()
        );
        bytes memory secondSig = _sig(reg, second);
        vm.expectRevert(abi.encodeWithSelector(TrailReviewRegistry.ProofAlreadyUsed.selector, proof));
        vm.prank(reviewer);
        reg.publishReview(second, secondSig);
    }

    function test_RevertSecondReviewSameWalletProject() public {
        TrailReviewRegistry.ReviewAuth memory first = _auth(
            reviewer, PROJECT_ONE, bytes32(uint256(0xA11CE)), bytes32(uint256(0xC0FFEE)),
            5, TrailReviewRegistry.Outcome.WorkedWell, 0, _deadline()
        );
        bytes memory firstSig = _sig(reg, first);
        vm.prank(reviewer);
        reg.publishReview(first, firstSig);

        TrailReviewRegistry.ReviewAuth memory second = _auth(
            reviewer, PROJECT_ONE, bytes32(uint256(0xF9E5)), bytes32(uint256(0xD1FF)),
            4, TrailReviewRegistry.Outcome.WorkedWithFriction, 1, _deadline()
        );
        bytes memory secondSig = _sig(reg, second);
        vm.expectRevert(
            abi.encodeWithSelector(TrailReviewRegistry.AlreadyReviewed.selector, PROJECT_ONE, reviewer)
        );
        vm.prank(reviewer);
        reg.publishReview(second, secondSig);
    }

    function test_RevertRatingZero() public {
        TrailReviewRegistry.ReviewAuth memory auth = _auth(
            reviewer, PROJECT_ONE, bytes32(uint256(0xA11CE)), bytes32(uint256(0xC0FFEE)),
            0, TrailReviewRegistry.Outcome.WorkedWell, 0, _deadline()
        );
        bytes memory sig = _sig(reg, auth);
        vm.expectRevert(abi.encodeWithSelector(TrailReviewRegistry.InvalidRating.selector, 0));
        vm.prank(reviewer);
        reg.publishReview(auth, sig);
    }

    function test_RevertRatingSix() public {
        TrailReviewRegistry.ReviewAuth memory auth = _auth(
            reviewer, PROJECT_ONE, bytes32(uint256(0xA11CE)), bytes32(uint256(0xC0FFEE)),
            6, TrailReviewRegistry.Outcome.WorkedWell, 0, _deadline()
        );
        bytes memory sig = _sig(reg, auth);
        vm.expectRevert(abi.encodeWithSelector(TrailReviewRegistry.InvalidRating.selector, 6));
        vm.prank(reviewer);
        reg.publishReview(auth, sig);
    }

    function test_RevertInvalidProject() public {
        TrailReviewRegistry.ReviewAuth memory auth = _auth(
            reviewer, 999, bytes32(uint256(0xA11CE)), bytes32(uint256(0xC0FFEE)),
            5, TrailReviewRegistry.Outcome.WorkedWell, 0, _deadline()
        );
        bytes memory sig = _sig(reg, auth);
        vm.expectRevert(abi.encodeWithSelector(TrailReviewRegistry.InvalidProject.selector, 999));
        vm.prank(reviewer);
        reg.publishReview(auth, sig);
    }

    function test_RevertInactiveProject() public {
        reg.setProjectActive(PROJECT_ONE, false);
        TrailReviewRegistry.ReviewAuth memory auth = _auth(
            reviewer, PROJECT_ONE, bytes32(uint256(0xA11CE)), bytes32(uint256(0xC0FFEE)),
            5, TrailReviewRegistry.Outcome.WorkedWell, 0, _deadline()
        );
        bytes memory sig = _sig(reg, auth);
        vm.expectRevert(abi.encodeWithSelector(TrailReviewRegistry.InvalidProject.selector, PROJECT_ONE));
        vm.prank(reviewer);
        reg.publishReview(auth, sig);
    }

    function test_RevertZeroProofHash() public {
        TrailReviewRegistry.ReviewAuth memory auth = _auth(
            reviewer, PROJECT_ONE, bytes32(0), bytes32(uint256(0xC0FFEE)),
            5, TrailReviewRegistry.Outcome.WorkedWell, 0, _deadline()
        );
        bytes memory sig = _sig(reg, auth);
        vm.expectRevert(abi.encodeWithSelector(TrailReviewRegistry.EmptyHash.selector, "proofTxHash"));
        vm.prank(reviewer);
        reg.publishReview(auth, sig);
    }

    function test_RevertZeroContentHash() public {
        TrailReviewRegistry.ReviewAuth memory auth = _auth(
            reviewer, PROJECT_ONE, bytes32(uint256(0xA11CE)), bytes32(0),
            5, TrailReviewRegistry.Outcome.WorkedWell, 0, _deadline()
        );
        bytes memory sig = _sig(reg, auth);
        vm.expectRevert(abi.encodeWithSelector(TrailReviewRegistry.EmptyHash.selector, "contentHash"));
        vm.prank(reviewer);
        reg.publishReview(auth, sig);
    }

    function test_RevertTamperedRating() public {
        TrailReviewRegistry.ReviewAuth memory signedAuth = _auth(
            reviewer, PROJECT_ONE, bytes32(uint256(0xA11CE)), bytes32(uint256(0xC0FFEE)),
            5, TrailReviewRegistry.Outcome.WorkedWell, 0, _deadline()
        );
        bytes memory sig = _sig(reg, signedAuth);
        TrailReviewRegistry.ReviewAuth memory tampered = _auth(
            reviewer, PROJECT_ONE, signedAuth.proofTxHash, signedAuth.contentHash,
            1, TrailReviewRegistry.Outcome.WorkedWell, 0, signedAuth.deadline
        );
        vm.expectRevert(); // any rating/outcome/hash edit breaks the signature
        vm.prank(reviewer);
        reg.publishReview(tampered, sig);
    }

    function test_RevertWhenPaused() public {
        reg.pause();
        TrailReviewRegistry.ReviewAuth memory auth = _auth(
            reviewer, PROJECT_ONE, bytes32(uint256(0xA11CE)), bytes32(uint256(0xC0FFEE)),
            5, TrailReviewRegistry.Outcome.WorkedWell, 0, _deadline()
        );
        bytes memory sig = _sig(reg, auth);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(reviewer);
        reg.publishReview(auth, sig);

        // unpause restores publication with the same authorization
        reg.unpause();
        vm.prank(reviewer);
        uint256 id = reg.publishReview(auth, sig);
        assertEq(id, 1);
    }

    function test_RevertOldVerifierAfterRotation() public {
        TrailReviewRegistry.ReviewAuth memory auth = _auth(
            reviewer, PROJECT_ONE, bytes32(uint256(0xA11CE)), bytes32(uint256(0xC0FFEE)),
            5, TrailReviewRegistry.Outcome.WorkedWell, 0, _deadline()
        );
        bytes memory oldSig = _sig(reg, auth);
        address verifier2 = makeAddr("verifier2");
        reg.setVerifier(verifier2);
        vm.expectRevert(abi.encodeWithSelector(TrailReviewRegistry.BadSigner.selector, verifier2, verifier));
        vm.prank(reviewer);
        reg.publishReview(auth, oldSig);
    }

    function test_RevertUnknownReview() public {
        vm.expectRevert(abi.encodeWithSelector(TrailReviewRegistry.UnknownReview.selector, 1));
        reg.getReviewer(1);
    }

    function test_RevertNonOwnerAdmin() public {
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker)
        );
        vm.prank(attacker);
        reg.setVerifier(attacker);
    }

    function testFuzz_NonceAlwaysConsumed(uint8 rawRating) public {
        uint8 rating = uint8(bound(rawRating, 1, 5));
        for (uint256 i = 0; i < 2; i++) {
            address who = address(uint160(uint256(keccak256(abi.encode("reviewer", rawRating, i)))));
            bytes32 proof = keccak256(abi.encode("proof", rawRating, i));
            TrailReviewRegistry.ReviewAuth memory auth = _auth(
                who, PROJECT_ONE, proof, bytes32(uint256(0xC0FFEE)),
                rating, TrailReviewRegistry.Outcome.WorkedWell, 0, _deadline()
            );
            bytes memory sig = _sig(reg, auth);
            vm.prank(who);
            reg.publishReview(auth, sig);
            assertEq(reg.nonces(who), 1);
        }
        assertEq(reg.reviewCount(), 2);
    }
}
