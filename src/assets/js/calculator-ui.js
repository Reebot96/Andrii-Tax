// Wires the calculator form to TaxCalculator and renders the result live.
(function () {
  'use strict';

  var form = document.querySelector('[data-calc]');
  if (!form || !window.TAX_RATES || !window.TaxCalculator) return;

  var text = JSON.parse(document.getElementById('calc-i18n').textContent);
  var money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  var out = function (name) { return document.querySelector('[data-out="' + name + '"]'); };
  var headline = out('headline');
  var shown = 0;

  document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = window.TAX_RATES.year; });

  // Money inputs: digits only, shown with thousands separators.
  function readMoney(input) {
    var digits = input.value.replace(/[^\d]/g, '');
    return digits ? Number(digits) : null;
  }
  form.querySelectorAll('[data-money]').forEach(function (input) {
    input.addEventListener('input', function () {
      var n = readMoney(input);
      input.value = n == null ? '' : n.toLocaleString('en-US');
    });
  });

  // Children stepper
  var kidsInput = form.querySelector('[name="kids"]');
  form.querySelectorAll('[data-step]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var next = Math.max(0, Math.min(10, Number(kidsInput.value || 0) + Number(btn.dataset.step)));
      kidsInput.value = next;
      update();
    });
  });

  // Count the big number up/down to its new value.
  function animateTo(value) {
    var from = shown;
    var start = performance.now();
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function frame(now) {
      var t = reduce ? 1 : Math.min(1, (now - start) / 600);
      var eased = 1 - Math.pow(1 - t, 3);
      shown = from + (value - from) * eased;
      headline.textContent = money.format(Math.abs(Math.round(shown)));
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function minus(n) {
    return (Math.round(n) > 0 ? '−' : '') + money.format(Math.round(n));
  }

  function signed(n) {
    return (n < 0 ? '−' : '') + money.format(Math.abs(Math.round(n)));
  }

  function update() {
    var status = form.querySelector('[name="status"]:checked').value;
    var r = window.TaxCalculator.estimate({
      status: status,
      income: readMoney(form.querySelector('[name="income"]')) || 0,
      kids: Number(kidsInput.value || 0),
      fedWithheld: readMoney(form.querySelector('[name="fedWithheld"]')),
      ilWithheld: readMoney(form.querySelector('[name="ilWithheld"]')),
    }, window.TAX_RATES);

    var label;
    var tone;
    if (r.hasWithheld) {
      label = r.total >= 0 ? text.refund : text.owe;
      tone = r.total >= 0 ? 'good' : 'owe';
    } else {
      label = r.total >= 0 ? text.creditsBack : text.yearTax;
      tone = r.total >= 0 ? 'good' : 'neutral';
    }
    out('label').textContent = label;
    out('card').dataset.tone = tone;
    out('hint').hidden = r.hasWithheld;
    animateTo(r.total);

    out('fedIncome').textContent = money.format(r.federal.income);
    out('fedDeduction').textContent = minus(r.federal.deduction);
    out('fedTaxable').textContent = money.format(r.federal.taxable);
    out('fedTax').textContent = money.format(r.federal.tax);
    out('fedChild').textContent = minus(r.federal.childCredit);
    out('fedEitc').textContent = minus(r.federal.eitc);
    out('fedNet').textContent = signed(r.federal.net);

    out('ilExemptions').textContent = minus(r.illinois.exemptions);
    out('ilTaxable').textContent = money.format(r.illinois.taxable);
    out('ilTax').textContent = money.format(r.illinois.tax);
    out('ilEitc').textContent = minus(r.illinois.eitc);
    out('ilNet').textContent = signed(r.illinois.net);

    var headWarn = status === 'head' && Number(kidsInput.value || 0) === 0;
    out('headWarn').hidden = !headWarn;
  }

  form.addEventListener('input', update);
  form.addEventListener('change', update);
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  update();
})();
