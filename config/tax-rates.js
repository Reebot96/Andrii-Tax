// Tax rates and limits used by the refund calculator.
// Update once a year when the IRS and Illinois publish new numbers
// (IRS: the annual "inflation adjustments" Revenue Procedure, usually in October;
//  Illinois: the IDOR "What's New" bulletin and Schedule IL-E/EITC).
//
// Sources for tax year 2026:
//   IRS Rev. Proc. 2025-32 — https://www.irs.gov/irb/2025-45_IRB
//   Illinois Bulletin FY 2026-15 — https://tax.illinois.gov/research/publications/bulletins/fy-2026-15.html

window.TAX_RATES = {
  year: 2026,

  federal: {
    // Standard deduction by filing status
    standardDeduction: { single: 16100, joint: 32200, head: 24150 },

    // Brackets: [upper limit of the bracket, rate]. The last one has no limit.
    brackets: {
      single: [[12400, 0.10], [50400, 0.12], [105700, 0.22], [201775, 0.24], [256225, 0.32], [640600, 0.35], [Infinity, 0.37]],
      joint:  [[24800, 0.10], [100800, 0.12], [211400, 0.22], [403550, 0.24], [512450, 0.32], [768700, 0.35], [Infinity, 0.37]],
      head:   [[17700, 0.10], [67450, 0.12], [105700, 0.22], [201750, 0.24], [256200, 0.32], [640600, 0.35], [Infinity, 0.37]],
    },

    // Child Tax Credit (children under 17)
    childTaxCredit: {
      perChild: 2200,
      refundablePerChild: 1700,   // the part that can come back even with no tax owed
      refundableEarnedFloor: 2500, // refundable part = 15% of earnings above this
      refundableRate: 0.15,
      phaseoutStart: { single: 200000, joint: 400000, head: 200000 },
      phaseoutPer1000: 50,         // credit drops $50 for each $1,000 above the start
    },

    // Earned Income Tax Credit, by number of qualifying children (0, 1, 2, 3+)
    eitc: [
      { earnedAmount: 8680,  maxCredit: 664,  phaseoutStart: { other: 10860, joint: 18140 }, phaseoutEnd: { other: 19540, joint: 26820 } },
      { earnedAmount: 13020, maxCredit: 4427, phaseoutStart: { other: 23890, joint: 31160 }, phaseoutEnd: { other: 51593, joint: 58863 } },
      { earnedAmount: 18290, maxCredit: 7316, phaseoutStart: { other: 23890, joint: 31160 }, phaseoutEnd: { other: 58629, joint: 65899 } },
      { earnedAmount: 18290, maxCredit: 8231, phaseoutStart: { other: 23890, joint: 31160 }, phaseoutEnd: { other: 62974, joint: 70244 } },
    ],
  },

  illinois: {
    rate: 0.0495,                // flat income tax rate
    exemption: 2925,             // per person: you, spouse (joint) and each dependent
    exemptionIncomeLimit: { single: 250000, joint: 500000, head: 250000 }, // no exemptions above this
    eitcShareOfFederal: 0.20,    // Illinois EITC = 20% of the federal EITC (refundable)

    // Illinois Child Tax Credit: 40% of the Illinois EITC when at least one
    // dependent is under 12 at the end of the year (35 ILCS 5/244, tax years from 2025).
    // Note: the IDOR page still says the credit "was created for tax years 2024 and 2025",
    // while the statute has no end date — check IDOR's "What's New" each year
    // and set shareOfIlEitc to 0 if the credit is not available.
    childTaxCredit: { shareOfIlEitc: 0.40, maxChildAge: 11 },
  },
};
