// Refund calculator: a rough federal + Illinois estimate for W-2 income
// with the standard deduction. All rates come from config/tax-rates.js.
(function (root) {
  'use strict';

  function bracketTax(income, brackets) {
    var tax = 0;
    var lower = 0;
    for (var i = 0; i < brackets.length; i++) {
      var upper = brackets[i][0];
      var rate = brackets[i][1];
      if (income <= lower) break;
      tax += (Math.min(income, upper) - lower) * rate;
      lower = upper;
    }
    return tax;
  }

  function eitcAmount(income, kids, status, table) {
    var row = table[Math.min(kids, 3)];
    var key = status === 'joint' ? 'joint' : 'other';
    var start = row.phaseoutStart[key];
    var end = row.phaseoutEnd[key];
    var phaseIn = Math.min(row.maxCredit, income * (row.maxCredit / row.earnedAmount));
    if (income <= start) return phaseIn;
    if (income >= end) return 0;
    var phaseoutRate = row.maxCredit / (end - start);
    return Math.max(0, Math.min(phaseIn, row.maxCredit - (income - start) * phaseoutRate));
  }

  // input: { status: 'single'|'joint'|'head', income, kids, kidsUnder12, fedWithheld, ilWithheld }
  // Withheld amounts are null when the visitor left them empty.
  function estimate(input, rates) {
    var fed = rates.federal;
    var il = rates.illinois;
    var status = input.status;
    var income = Math.max(0, input.income || 0);
    var kids = Math.max(0, Math.floor(input.kids || 0));

    // ---- Federal
    var deduction = fed.standardDeduction[status];
    var taxable = Math.max(0, income - deduction);
    var tax = bracketTax(taxable, fed.brackets[status]);

    var ctc = fed.childTaxCredit;
    var ctcFull = kids * ctc.perChild;
    var over = Math.max(0, income - ctc.phaseoutStart[status]);
    var ctcAllowed = Math.max(0, ctcFull - Math.ceil(over / 1000) * ctc.phaseoutPer1000);
    var ctcNonrefundable = Math.min(ctcAllowed, tax);
    var ctcRefundable = Math.min(
      ctcAllowed - ctcNonrefundable,
      kids * ctc.refundablePerChild,
      Math.max(0, (income - ctc.refundableEarnedFloor) * ctc.refundableRate)
    );
    var eitc = eitcAmount(income, kids, status, fed.eitc);

    var fedTaxAfterCredits = tax - ctcNonrefundable;
    var fedRefundableCredits = ctcRefundable + eitc;
    var fedNet = fedTaxAfterCredits - fedRefundableCredits; // > 0 owed, < 0 comes back

    // ---- Illinois
    var people = (status === 'joint' ? 2 : 1) + kids;
    var exemptions = income > il.exemptionIncomeLimit[status] ? 0 : people * il.exemption;
    var ilTaxable = Math.max(0, income - exemptions);
    var ilTax = ilTaxable * il.rate;
    var ilEitc = eitc * il.eitcShareOfFederal;
    var kidsUnder12 = Math.min(kids, Math.max(0, Math.floor(input.kidsUnder12 || 0)));
    var ilChildCredit = kidsUnder12 > 0 ? ilEitc * il.childTaxCredit.shareOfIlEitc : 0;
    var ilNet = ilTax - ilEitc - ilChildCredit;

    var hasWithheld = input.fedWithheld != null || input.ilWithheld != null;
    var fedResult = (input.fedWithheld || 0) - fedNet; // > 0 refund, < 0 owed
    var ilResult = (input.ilWithheld || 0) - ilNet;

    return {
      year: rates.year,
      federal: {
        income: income, deduction: deduction, taxable: taxable, tax: tax,
        childCredit: ctcNonrefundable + ctcRefundable, eitc: eitc,
        net: fedNet, withheld: input.fedWithheld, result: fedResult,
      },
      illinois: {
        exemptions: exemptions, taxable: ilTaxable, tax: ilTax, eitc: ilEitc, childCredit: ilChildCredit,
        net: ilNet, withheld: input.ilWithheld, result: ilResult,
      },
      hasWithheld: hasWithheld,
      total: hasWithheld ? fedResult + ilResult : -(fedNet + ilNet),
    };
  }

  root.TaxCalculator = { estimate: estimate };
  if (typeof module !== 'undefined') module.exports = { estimate: estimate };
})(typeof window !== 'undefined' ? window : globalThis);
