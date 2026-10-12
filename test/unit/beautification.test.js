suite('beautification', function () {
  const $ = window.test_only_jquery;
  var mq;

  setup(function () {
    mq = MQ.MathField($('<span></span>').appendTo('#mock')[0], {
      autoOperatorNames: 'sin abs',
      lazyAutoCommands: 'pi theta',
      typingExclamationEqualsWritesNotEqual: true,
      autoFunctionTemplates: {
        abs: '\\left|#1\\right|',
        sqrt: '\\sqrt{#1}',
        root: '\\sqrt[#2]{#1}',
        int: { latex: '\\int_{#3}^{#4}#1d#2', defaults: ['', 'x'] },
        sum: {
          latex: '\\sum_{#2=#3}^{#4}\\left(#1\\right)',
          defaults: ['', 'k'],
          minArguments: 2
        }
      }
    });
  });

  function assertTyped(input, expected) {
    mq.typedText(input);
    assert.equal(mq.latex(), expected, input);
  }

  suite('lazyAutoCommands', function () {
    test('waits for the word to end', function () {
      assertTyped('pi', 'pi');
      assertTyped('+', '\\pi+');
    });

    test('only substitutes word endings', function () {
      assertTyped('xpi+', 'x\\pi+');
      assertTyped('pix+', 'x\\pi+pix+');
    });

    test('substitutes before sup and subscripts', function () {
      assertTyped('theta^2', '\\theta^{2}');
    });

    test('substitutes when moving out of a block', function () {
      mq.typedText('x^pi');
      assert.equal(mq.latex(), 'x^{pi}');
      mq.keystroke('Right');
      assert.equal(mq.latex(), 'x^{\\pi}');
    });

    test('keeps the word while moving inside its block', function () {
      mq.typedText('pi');
      mq.keystroke('Left');
      assert.equal(mq.latex(), 'pi');
    });

    test('substitutes on blur', function () {
      mq.focus();
      mq.typedText('pi');
      mq.blur();
      assert.equal(mq.latex(), '\\pi');
    });

    test('substitutes before written latex', function () {
      mq.typedText('pi');
      mq.write('\\frac{1}{2}');
      assert.equal(mq.latex(), '\\pi\\frac{1}{2}');
    });
  });

  suite('autoFunctionTemplates', function () {
    test('beautifies on opening parenthesis', function () {
      assertTyped('sqrt(2', '\\sqrt{2}');
    });

    test('beautifies the end of a word', function () {
      assertTyped('asqrt(2', 'a\\sqrt{2}');
    });

    test('ends lazy commands of the word', function () {
      assertTyped('pisqrt(2', '\\pi\\sqrt{2}');
    });

    test('beautifies operator names', function () {
      assertTyped('abs(x', '\\left|x\\right|');
    });

    test('fills defaults and places the cursor in the first argument', function () {
      assertTyped('int(t', '\\int_{ }^{ }tdx');
    });

    test('fills placeholders with arguments', function () {
      mq.typedText('2,3');
      mq.keystroke('Home');
      assertTyped('root(x', '\\sqrt[3]{x2}');
    });

    test('cancels when there are too many arguments', function () {
      mq.typedText('2,3,4');
      mq.keystroke('Home');
      assertTyped('sqrt(', 'sqrt\\left(2,3,4\\right)');
    });

    test('waits for the minimum number of arguments', function () {
      assertTyped('sum(2n', 'sum\\left(2n\\right)');
      assertTyped(',1', '\\sum_{k=1}^{ }\\left(2n\\right)');
    });
  });

  test('typingExclamationEqualsWritesNotEqual', function () {
    assertTyped('x!=1', 'x\\ne1');
  });
});
