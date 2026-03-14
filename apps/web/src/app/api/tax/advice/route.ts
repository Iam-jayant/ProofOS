// HeyElsa AI tax-advice integration
// Bounty: HeyElsa ($2k track)
//
// POST /api/tax/advice
// Body: { breakdown: TaxBreakdown, user_type: string }
// Response: { advice: string }
//
// Calls the HeyElsa AI API with a structured prompt about the user's tax breakdown.
// ELSA_API_KEY env var required.

import { NextRequest, NextResponse } from "next/server";
import type { TaxBreakdown } from "@/lib/api";

const ELSA_API_URL = "https://api.heyelsa.ai/v1/chat/completions";

interface AdviceRequest {
  breakdown: TaxBreakdown;
  user_type: string;
}

export async function POST(req: NextRequest) {
  let body: AdviceRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const apiKey = process.env.ELSA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ELSA_API_KEY not configured" }, { status: 503 });
  }

  const { breakdown, user_type } = body;
  if (!breakdown || !user_type) {
    return NextResponse.json({ error: "breakdown and user_type are required" }, { status: 400 });
  }

  // Build a structured prompt with the tax breakdown
  const prompt = `You are an Indian tax advisor specializing in crypto and Web3 taxation.

A ${user_type} taxpayer has the following tax breakdown for their Web3 activities:
- Professional income (INR): ${breakdown.professional_income_inr}
- Taxable professional income after deductions: ${breakdown.taxable_professional_income_inr}
- VDA gross proceeds: ${breakdown.vda_gains_gross_inr}
- VDA net gains (after COA and fees): ${breakdown.net_vda_gains_inr}
- VDA losses: ${breakdown.vda_losses_inr}
- Slab tax on professional income: ${breakdown.professional_tax_inr}
- Surcharge: ${breakdown.surcharge_inr}
- Section 87A rebate applied: ${breakdown.section_87a_rebate_inr}
- Marginal relief applied: ${breakdown.marginal_relief_inr}
- VDA flat 30% tax: ${breakdown.vda_tax_inr}
- Health and Education Cess (4%): ${breakdown.cess_inr}
- Total tax liability (before TDS): ${breakdown.total_tax_inr}
- TDS credit (Sec 194S): ${breakdown.tds_194s_credit_inr}
- Tax payable after TDS: ${breakdown.tax_payable_after_tds_inr}

Please provide:
1. A brief summary of their tax position (2-3 sentences)
2. Up to 3 actionable, legal tax-saving tips relevant to their situation under the Indian Income Tax Act
3. Any compliance reminders specific to VDA/crypto gains

Keep the response concise and practical. Mention applicable sections of the IT Act where relevant.`;

  try {
    const response = await fetch(ELSA_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "elsa-1",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 600,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("HeyElsa API error:", response.status, errText);
      return NextResponse.json(
        { error: "HeyElsa API request failed" },
        { status: 502 }
      );
    }

    const data = await response.json();
    const advice: string = data?.choices?.[0]?.message?.content ?? "";

    return NextResponse.json({ advice });
  } catch (err) {
    console.error("HeyElsa fetch error:", err);
    return NextResponse.json({ error: "Failed to contact HeyElsa API" }, { status: 502 });
  }
}
