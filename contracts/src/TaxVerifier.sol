// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Minimal interface for Starknet Core on Ethereum — used to consume
///         messages bridged from Cairo via send_message_to_l1_syscall.
interface IStarknetMessaging {
    function consumeMessageFromL2(
        uint256 fromAddress,
        uint256[] calldata payload
    ) external returns (bytes32);
}

/// @title TaxVerifier
/// @notice Receives STARK-proven tax records from the Starknet TaxVerifier Cairo
///         contract and stores them on Ethereum Sepolia.
///
///         Message payload layout (must match tax_verifier.cairo verify_and_commit):
///           payload[0] = ledger_commitment  (felt252 truncated to bytes32)
///           payload[1] = tax_after_tds_paisa.low  (u128 low half)
///           payload[2] = tax_after_tds_paisa.high (u128 high half — always 0 in practice)
///           payload[3] = user_type  (0=Individual, 1=HUF, 2=Corporate)
///           payload[4] = used_44ada (0 or 1)
///           payload[5] = tds_194s_paisa
///           payload[6] = vda_losses_paisa
///           payload[7] = business_loss_cfy_paisa
///           payload[8] = surcharge_paisa
///
/// @dev Starknet Core on Ethereum Sepolia: 0xE2Bb56ee936fd6433DC0F6e7e3b8365C906AA057
contract TaxVerifier {
    /// @notice The Starknet Core messaging contract on Ethereum
    IStarknetMessaging public immutable starknetCore;

    /// @notice The Cairo TaxVerifier contract address on Starknet (felt252 value)
    uint256 public immutable cairoTaxVerifier;

    // ─── Events ────────────────────────────────────────────────────────────────
    /// @notice Emitted when a tax proof is verified (keeps same signature as before)
    event TaxProofVerified(
        bytes32 indexed ledgerCommitment,
        uint256 taxAfterTdsPaisa,
        uint256 tds194sPaisa,
        uint8 userType,
        bool used44ada,
        address indexed verifiedBy
    );

    // ─── Storage ───────────────────────────────────────────────────────────────
    /// @notice Struct to store verified tax records (unchanged from SP1 version)
    struct TaxRecord {
        uint256 totalTaxPaisa;
        uint256 taxAfterTdsPaisa;
        uint256 tds194sPaisa;
        uint256 vdaLossesPaisa;
        uint256 businessLossCfyPaisa;
        uint256 surchargePaisa;
        uint8 userType;
        bool used44ada;
        uint256 verifiedAt;
        address verifiedBy;
    }

    /// @notice Mapping from ledger commitment to tax record
    mapping(bytes32 => TaxRecord) public taxRecords;

    // ─── Constructor ───────────────────────────────────────────────────────────
    /// @param _starknetCore  Address of Starknet Core contract on Ethereum Sepolia
    /// @param _cairoAddress  Cairo contract address as uint256 (felt252 value)
    constructor(address _starknetCore, uint256 _cairoAddress) {
        starknetCore = IStarknetMessaging(_starknetCore);
        cairoTaxVerifier = _cairoAddress;
    }

    // ─── Message consumption ───────────────────────────────────────────────────
    /// @notice Consume a bridged Starknet message and record the verified tax proof.
    ///
    ///         Anyone can call this once the message has been enqueued in Starknet Core.
    ///         The message is consumed (deleted) from the core contract atomically,
    ///         so replay is impossible.
    ///
    /// @param payload  The 9-element uint256 array matching Cairo payload layout.
    function consumeStarknetMessage(uint256[] calldata payload) external {
        require(payload.length == 9, "TaxVerifier: invalid payload length");

        // Consume message from Starknet Core (reverts if message does not exist)
        starknetCore.consumeMessageFromL2(cairoTaxVerifier, payload);

        // Decode payload fields
        bytes32 ledgerCommitment = bytes32(payload[0]);
        // Reconstruct u256 from low + high halves (matches Cairo u256 layout)
        uint256 taxLow  = payload[1];
        uint256 taxHigh = payload[2];
        uint256 taxAfterTdsPaisa = taxHigh * (2 ** 128) + taxLow;
        uint8   userType  = uint8(payload[3]);
        bool    used44ada = payload[4] != 0;
        uint256 tds194sPaisa = payload[5];
        uint256 vdaLossesPaisa = payload[6];
        uint256 businessLossCfyPaisa = payload[7];
        uint256 surchargePaisa = payload[8];

        // Gross tax reconstructed for convenience.
        uint256 totalTaxPaisa = taxAfterTdsPaisa + tds194sPaisa;

        // Store verified record
        taxRecords[ledgerCommitment] = TaxRecord({
            totalTaxPaisa: totalTaxPaisa,
            taxAfterTdsPaisa: taxAfterTdsPaisa,
            tds194sPaisa: tds194sPaisa,
            vdaLossesPaisa: vdaLossesPaisa,
            businessLossCfyPaisa: businessLossCfyPaisa,
            surchargePaisa: surchargePaisa,
            userType:      userType,
            used44ada:     used44ada,
            verifiedAt:    block.timestamp,
            verifiedBy:    msg.sender
        });

        emit TaxProofVerified(
            ledgerCommitment,
            taxAfterTdsPaisa,
            tds194sPaisa,
            userType,
            used44ada,
            msg.sender
        );
    }

    // ─── Read-only helpers (unchanged signatures) ──────────────────────────────
    /// @notice Check if a ledger commitment has been verified
    function isVerified(bytes32 ledgerCommitment) external view returns (bool) {
        return taxRecords[ledgerCommitment].verifiedAt > 0;
    }

    /// @notice Get the tax record for a ledger commitment
    function getTaxRecord(bytes32 ledgerCommitment) external view returns (TaxRecord memory) {
        return taxRecords[ledgerCommitment];
    }
}
