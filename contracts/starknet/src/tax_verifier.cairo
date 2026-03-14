#[starknet::contract]
mod TaxVerifier {
    use core::array::ArrayTrait;
    use core::sha256::compute_sha256_byte_array;
    use core::traits::Into;
    use starknet::{
        ContractAddress,
        get_caller_address,
    };



    const SLAB_4L_PAISA: u128 = 40_000_000;
    const SLAB_8L_PAISA: u128 = 80_000_000;
    const SLAB_12L_PAISA: u128 = 120_000_000;
    const SLAB_16L_PAISA: u128 = 160_000_000;
    const SLAB_20L_PAISA: u128 = 200_000_000;
    const SLAB_24L_PAISA: u128 = 240_000_000;

    const SECTION_87A_INCOME_LIMIT_PAISA: u128 = 120_000_000;
    const SECTION_87A_REBATE_MAX_PAISA: u128 = 6_000_000;

    const MAX_44ADA_PAISA: u128 = 500_000_000;
    const STANDARD_DEDUCTION_PAISA: u128 = 7_500_000;

    const SURCHARGE_BAND_50L: u128 = 500_000_000;
    const SURCHARGE_BAND_1CR: u128 = 1_000_000_000;
    const SURCHARGE_BAND_2CR: u128 = 2_000_000_000;
    const SURCHARGE_BAND_5CR: u128 = 5_000_000_000;

    const CORP_1CR_PAISA: u128 = 1_000_000_000;
    const CORP_10CR_PAISA: u128 = 10_000_000_000;

    const CAT_INCOME: u8 = 0;
    const CAT_GAINS: u8 = 1;
    const CAT_LOSSES: u8 = 2;
    const CAT_FEES: u8 = 3;

    const DIR_IN: u8 = 0;
    const DIR_OUT: u8 = 1;

    const USER_INDIVIDUAL: u8 = 0;
    const USER_HUF: u8 = 1;

    const CORP_REGIME_115BAA: u8 = 0;

    #[storage]
    struct Storage {}

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        TaxCommitted: TaxCommitted,
    }

    #[derive(Drop, starknet::Event)]
    struct TaxCommitted {
        #[key]
        ledger_commitment: felt252,
        #[key]
        tax_after_tds_paisa: u256,
        user_type: u8,
        used_44ada: bool,
        tds_194s_paisa: u128,
        vda_losses_paisa: u128,
        business_loss_cfy_paisa: u128,
        surcharge_paisa: u128,
        caller: ContractAddress,
    }

    #[derive(Drop, Serde, Copy)]
    struct LedgerRow {
        category: u8,
        amount_paisa: u128,
        asset_type: u8,
        cost_basis_paisa: u128,
        direction: u8,
    }

    fn u128_to_be_bytes(val: u128) -> Array<u8> {
        let mut be: Array<u8> = ArrayTrait::new();
        let mut remaining = val;
        let mut i: usize = 0;

        let mut le_bytes: Array<u8> = ArrayTrait::new();
        loop {
            if i >= 16 {
                break;
            }
            let byte: u8 = (remaining & 0xff_u128).try_into().unwrap();
            le_bytes.append(byte);
            remaining /= 256_u128;
            i += 1;
        };

        let mut k: usize = 16;
        loop {
            if k == 0 {
                break;
            }
            be.append(*le_bytes.at(k - 1));
            k -= 1;
        };
        be
    }

    fn serialize_ledger(rows: @Array<LedgerRow>) -> ByteArray {
        let mut result: ByteArray = Default::default();
        let mut i: usize = 0;

        loop {
            if i >= rows.len() {
                break;
            }

            let row = rows.at(i);
            result.append_byte(*row.category);

            let amount_be = u128_to_be_bytes(*row.amount_paisa);
            let mut j: usize = 0;
            loop {
                if j >= 16 {
                    break;
                }
                result.append_byte(*amount_be.at(j));
                j += 1;
            };

            result.append_byte(*row.asset_type);

            let coa_be = u128_to_be_bytes(*row.cost_basis_paisa);
            let mut z: usize = 0;
            loop {
                if z >= 16 {
                    break;
                }
                result.append_byte(*coa_be.at(z));
                z += 1;
            };

            i += 1;
        };

        result
    }

    fn calculate_slab_tax(taxable_income_paisa: u128) -> u128 {
        let mut tax: u128 = 0;

        if taxable_income_paisa > SLAB_4L_PAISA {
            let upper = SLAB_8L_PAISA;
            let in_slab = if taxable_income_paisa >= upper {
                upper - SLAB_4L_PAISA
            } else {
                taxable_income_paisa - SLAB_4L_PAISA
            };
            tax += in_slab * 5_u128 / 100_u128;
        }

        if taxable_income_paisa > SLAB_8L_PAISA {
            let upper = SLAB_12L_PAISA;
            let in_slab = if taxable_income_paisa >= upper {
                upper - SLAB_8L_PAISA
            } else {
                taxable_income_paisa - SLAB_8L_PAISA
            };
            tax += in_slab * 10_u128 / 100_u128;
        }

        if taxable_income_paisa > SLAB_12L_PAISA {
            let upper = SLAB_16L_PAISA;
            let in_slab = if taxable_income_paisa >= upper {
                upper - SLAB_12L_PAISA
            } else {
                taxable_income_paisa - SLAB_12L_PAISA
            };
            tax += in_slab * 15_u128 / 100_u128;
        }

        if taxable_income_paisa > SLAB_16L_PAISA {
            let upper = SLAB_20L_PAISA;
            let in_slab = if taxable_income_paisa >= upper {
                upper - SLAB_16L_PAISA
            } else {
                taxable_income_paisa - SLAB_16L_PAISA
            };
            tax += in_slab * 20_u128 / 100_u128;
        }

        if taxable_income_paisa > SLAB_20L_PAISA {
            let upper = SLAB_24L_PAISA;
            let in_slab = if taxable_income_paisa >= upper {
                upper - SLAB_20L_PAISA
            } else {
                taxable_income_paisa - SLAB_20L_PAISA
            };
            tax += in_slab * 25_u128 / 100_u128;
        }

        if taxable_income_paisa > SLAB_24L_PAISA {
            tax += (taxable_income_paisa - SLAB_24L_PAISA) * 30_u128 / 100_u128;
        }

        tax
    }

    fn calculate_surcharge(slab_tax: u128, total_income: u128) -> u128 {
        if total_income > SURCHARGE_BAND_5CR {
            slab_tax * 25_u128 / 100_u128
        } else if total_income > SURCHARGE_BAND_2CR {
            slab_tax * 25_u128 / 100_u128
        } else if total_income > SURCHARGE_BAND_1CR {
            slab_tax * 15_u128 / 100_u128
        } else if total_income > SURCHARGE_BAND_50L {
            slab_tax * 10_u128 / 100_u128
        } else {
            0_u128
        }
    }

    fn calculate_corporate_surcharge(
        base_tax: u128,
        taxable_income_paisa: u128,
        corporate_regime: u8,
    ) -> u128 {
        if corporate_regime == CORP_REGIME_115BAA {
            base_tax * 10_u128 / 100_u128
        } else if taxable_income_paisa > CORP_10CR_PAISA {
            base_tax * 12_u128 / 100_u128
        } else if taxable_income_paisa > CORP_1CR_PAISA {
            base_tax * 7_u128 / 100_u128
        } else {
            0_u128
        }
    }

    #[external(v0)]
    fn verify_and_commit(
        ref self: ContractState,
        ledger_rows: Array<LedgerRow>,
        user_type: u8,
        use_44ada: bool,
        is_salaried: bool,
        corporate_regime: u8,
        prior_loss_paisa: u128,
        tds_194s_paisa: u128,
    ) {
        let serialized = serialize_ledger(@ledger_rows);
        let hash_result = compute_sha256_byte_array(@serialized);

        let w0: felt252 = (*hash_result.span().at(0)).into();
        let w1: felt252 = (*hash_result.span().at(1)).into();
        let w2: felt252 = (*hash_result.span().at(2)).into();
        let w3: felt252 = (*hash_result.span().at(3)).into();
        let w4: felt252 = (*hash_result.span().at(4)).into();
        let w5: felt252 = (*hash_result.span().at(5)).into();
        let w6: felt252 = (*hash_result.span().at(6)).into();
        let w7_u32: u32 = *hash_result.span().at(7) & 0x07ffffff_u32;
        let w7: felt252 = w7_u32.into();

        let ledger_commitment: felt252 = {
            let mut c: felt252 = w0;
            c = c * 0x100000000_felt252 + w1;
            c = c * 0x100000000_felt252 + w2;
            c = c * 0x100000000_felt252 + w3;
            c = c * 0x100000000_felt252 + w4;
            c = c * 0x100000000_felt252 + w5;
            c = c * 0x100000000_felt252 + w6;
            c * 0x8000000_felt252 + w7
        };

        let mut income_paisa: u128 = 0;
        let mut gains_paisa: u128 = 0;
        let mut losses_paisa: u128 = 0;
        let mut fees_paisa: u128 = 0;
        let mut business_loss_current_paisa: u128 = 0;

        let mut i: usize = 0;
        loop {
            if i >= ledger_rows.len() {
                break;
            }

            let row = ledger_rows.at(i);

            if *row.category == CAT_INCOME {
                if *row.direction == DIR_IN {
                    income_paisa += *row.amount_paisa;
                } else if *row.direction == DIR_OUT {
                    business_loss_current_paisa += *row.amount_paisa;
                }
            } else if *row.category == CAT_GAINS {
                if *row.direction == DIR_IN {
                    let net_gain = if *row.amount_paisa > *row.cost_basis_paisa {
                        *row.amount_paisa - *row.cost_basis_paisa
                    } else {
                        0_u128
                    };
                    gains_paisa += net_gain;
                }
            } else if *row.category == CAT_LOSSES {
                if *row.direction == DIR_OUT {
                    losses_paisa += *row.amount_paisa;
                }
            } else if *row.category == CAT_FEES {
                if *row.direction == DIR_OUT {
                    fees_paisa += *row.amount_paisa;
                }
            }

            i += 1;
        };

        let net_income_paisa = if income_paisa > business_loss_current_paisa {
            income_paisa - business_loss_current_paisa
        } else {
            0_u128
        };

        let income_after_carryforward = if net_income_paisa > prior_loss_paisa {
            net_income_paisa - prior_loss_paisa
        } else {
            0_u128
        };

        let business_loss_cfy_paisa = if prior_loss_paisa > net_income_paisa {
            prior_loss_paisa - net_income_paisa
        } else {
            0_u128
        };

        let effective_44ada = use_44ada
            && user_type == USER_INDIVIDUAL
            && income_after_carryforward <= MAX_44ADA_PAISA;

        let taxable_income_paisa: u128 = if effective_44ada {
            income_after_carryforward / 2_u128
        } else {
            income_after_carryforward
        };

        let income_after_std_deduction: u128 = if is_salaried && user_type == USER_INDIVIDUAL {
            if taxable_income_paisa > STANDARD_DEDUCTION_PAISA {
                taxable_income_paisa - STANDARD_DEDUCTION_PAISA
            } else {
                0_u128
            }
        } else {
            taxable_income_paisa
        };

        let adjusted_gains_paisa: u128 = if gains_paisa > fees_paisa {
            gains_paisa - fees_paisa
        } else {
            0_u128
        };

        // ── Individual / HUF path ──────────────────────────────────────────
        let (surcharge, professional_tax_after_adjustments) =
            if user_type == USER_INDIVIDUAL || user_type == USER_HUF {
                let slab = calculate_slab_tax(income_after_std_deduction);

                let rebate = if income_after_std_deduction <= SECTION_87A_INCOME_LIMIT_PAISA {
                    if slab < SECTION_87A_REBATE_MAX_PAISA { slab } else { SECTION_87A_REBATE_MAX_PAISA }
                } else {
                    0_u128
                };

                let relief = if income_after_std_deduction > SECTION_87A_INCOME_LIMIT_PAISA {
                    let excess = income_after_std_deduction - SECTION_87A_INCOME_LIMIT_PAISA;
                    if slab > excess { slab - excess } else { 0_u128 }
                } else {
                    0_u128
                };

                let total_for_surcharge = income_after_std_deduction + adjusted_gains_paisa;
                let sc = calculate_surcharge(slab, total_for_surcharge);
                let prof_tax = slab - rebate - relief + sc;
                (sc, prof_tax)
            } else {
                // ── Corporate path ─────────────────────────────────────────
                let base_tax = if corporate_regime == CORP_REGIME_115BAA {
                    income_after_std_deduction * 22_u128 / 100_u128
                } else {
                    income_after_std_deduction * 30_u128 / 100_u128
                };
                let sc = calculate_corporate_surcharge(
                    base_tax, income_after_std_deduction, corporate_regime,
                );
                (sc, base_tax + sc)
            };

        let vda_tax = adjusted_gains_paisa * 30_u128 / 100_u128;
        let total_before_cess = professional_tax_after_adjustments + vda_tax;
        let cess = total_before_cess * 4_u128 / 100_u128;
        let final_tax_paisa = total_before_cess + cess;

        let tax_after_tds: u128 = if tds_194s_paisa < final_tax_paisa {
            final_tax_paisa - tds_194s_paisa
        } else {
            0_u128
        };

        let tax_after_tds_u256: u256 = u256 { low: tax_after_tds, high: 0_u128 };




        let caller = get_caller_address();
        self.emit(
            TaxCommitted {
                ledger_commitment,
                tax_after_tds_paisa: tax_after_tds_u256,
                user_type,
                used_44ada: effective_44ada,
                tds_194s_paisa,
                vda_losses_paisa: losses_paisa,
                business_loss_cfy_paisa,
                surcharge_paisa: surcharge,
                caller,
            }
        );
    }
}
