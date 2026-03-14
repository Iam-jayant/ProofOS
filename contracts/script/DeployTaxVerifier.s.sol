// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {TaxVerifier} from "../src/TaxVerifier.sol";

/// @notice Standalone script to (re)deploy only TaxVerifier.
///         Reads DEPLOYER_PRIVATE_KEY and CAIRO_TAX_VERIFIER_ADDRESS from env.
contract DeployTaxVerifierScript is Script {
    // Starknet Core on Ethereum Sepolia
    address constant STARKNET_CORE_SEPOLIA = 0xE2Bb56ee936fd6433DC0F6e7e3b8365C906AA057;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        uint256 cairoAddress = vm.envOr("CAIRO_TAX_VERIFIER_ADDRESS", uint256(0));

        vm.startBroadcast(deployerPrivateKey);

        TaxVerifier taxVerifier = new TaxVerifier(STARKNET_CORE_SEPOLIA, cairoAddress);
        console.log("TaxVerifier deployed at:", address(taxVerifier));
        console.log("StarknetCore:          ", STARKNET_CORE_SEPOLIA);

        vm.stopBroadcast();
    }
}
