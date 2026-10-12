suite('mouse', function () {
  const $ = window.test_only_jquery;
  var mq;
  setup(function () {
    mq = MQ.MathField($('<span></span>').appendTo('#mock')[0]);
    mq.latex('12.5x+\\sin\\left(ab\\right)');
  });

  function mousedown(el, detail) {
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, detail }));
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, detail }));
  }

  function selectedLatex() {
    const { latex, startIndex, endIndex } = mq.selection();
    return latex.slice(startIndex, endIndex);
  }

  test('double click selects a number', function () {
    mousedown(mq.el().querySelectorAll('.mq-digit')[1], 2);
    assert.equal(selectedLatex(), '12.5');
  });

  test('double click selects letters', function () {
    mousedown(mq.el().querySelector('.mq-bracket-middle var'), 2);
    assert.equal(selectedLatex(), 'ab');
  });

  test('double click selects a single operator', function () {
    mousedown(mq.el().querySelector('.mq-binary-operator'), 2);
    assert.equal(selectedLatex(), '+');
  });

  test('triple click selects the whole field', function () {
    mousedown(mq.el().querySelector('.mq-digit'), 3);
    assert.equal(selectedLatex(), mq.latex());
  });
});
