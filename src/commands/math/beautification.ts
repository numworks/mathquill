/*********************************************
 * Input beautification, as on NumWorks calculators
 ********************************************/

type AutoFunctionTemplate = {
  latex: string;
  defaults: string[];
  minArguments: number;
  numberOfArguments: number;
};
type AutoFunctionTemplates = {
  _maxLength?: number;
  [name: string]: AutoFunctionTemplate | number | undefined;
};

Options.prototype.lazyAutoCommands = { _maxLength: 0 };
baseOptionProcessors.lazyAutoCommands = baseOptionProcessors.autoCommands;

Options.prototype.autoFunctionTemplates = { _maxLength: 0 };
baseOptionProcessors.autoFunctionTemplates = function (templates) {
  const dict: AutoFunctionTemplates = {};
  let maxLength = 0;
  for (const name in templates) {
    if (!/^[a-z]+$/i.test(name)) {
      throw '"' + name + '" is not only letters';
    }
    const template = templates[name];
    const {
      latex,
      defaults = [],
      minArguments = 0
    } = typeof template === 'string' ? { latex: template } : template;
    let numberOfArguments = 0;
    latex.replace(/#(\d)/g, (_match, index) => {
      numberOfArguments = max(numberOfArguments, +index);
      return '';
    });
    dict[name] = { latex, defaults, minArguments, numberOfArguments };
    maxLength = max(maxLength, name.length);
  }
  dict._maxLength = maxLength;
  return dict;
};

// Marks where the cursor goes in a beautified template
const BEAUTIFICATION_CURSOR_MARKER = '\uE000';

/**
 * Substitutes the lazy auto commands spelled by the letters ending at `last`,
 * once the word is over (a non-letter is typed, or the cursor leaves it).
 * The word is split from left to right into the longest commands, so that
 * "pix" gives "\\pi x".
 */
function beautifyLazyAutoCommand(cursor: Cursor, last: NodeRef) {
  if (
    !(last instanceof Letter) ||
    last.shouldIgnoreSubstitutionInSimpleSubscript(cursor.options)
  ) {
    return;
  }
  const lazyCmds = cursor.options.lazyAutoCommands;
  const maxLength = lazyCmds._maxLength || 0;
  const word = letterSequenceEndingAtNode(last, Infinity);
  const letters: MQNode[] = [];
  for (let l: MQNode = last; letters.length < word.length; l = l[L] as MQNode) {
    letters.unshift(l);
  }

  const matches: { start: number; name: string }[] = [];
  for (let i = 0; i < word.length; ) {
    let len = min(maxLength, word.length - i);
    while (len > 0 && !lazyCmds.hasOwnProperty(word.slice(i, i + len))) {
      len -= 1;
    }
    if (len > 0) matches.push({ start: i, name: word.slice(i, i + len) });
    i += max(len, 1);
  }
  if (!matches.length) return;

  const previousPosition = { parent: cursor.parent, right: cursor[R] };
  // Right to left, so that the start indices of the next matches stay valid
  for (let i = matches.length - 1; i >= 0; i -= 1) {
    const { start, name } = matches[i];
    const first = letters[start];
    cursor.insRightOf(letters[start + name.length - 1]);
    new Fragment(first, cursor[L] as MQNode).remove();
    cursor[L] = first[L];
    const cmd = LatexCmds[name];
    const node = isMQNodeClass(cmd)
      ? new (cmd as typeof TempSingleCharNode)(name)
      : (cmd as (c: string) => MQNode)(name);
    node.createLeftOf(cursor);
  }

  if (previousPosition.right) cursor.insLeftOf(previousPosition.right);
  else cursor.insAtRightEnd(previousPosition.parent);
}

/** Ends the words left behind when the cursor leaves `previousParent`. */
function beautifyLeftBlock(cursor: Cursor, previousParent: MQNode) {
  if (cursor.parent === previousParent || cursor.selection) return;
  beautifyLazyAutoCommand(cursor, previousParent.getEnd(R));
}

/**
 * Turns `name(arg1,arg2…` into its function template, the cursor being inside
 * the parenthesis. Arguments fill the #1, #2… placeholders of the template.
 */
function beautifyAutoFunction(cursor: Cursor) {
  const block = cursor.parent;
  const bracket = block.parent;
  if (
    !(bracket instanceof Bracket) ||
    bracket.sides[L].ch !== '(' ||
    bracket.side === R
  ) {
    return;
  }

  const templates = cursor.options.autoFunctionTemplates;
  let first: NodeRef = bracket[L];
  let word = '';
  let name = '';
  let nameFirst: MQNode | undefined;
  // Operator names letters count, since templates names may be operators
  for (
    let i = 0;
    first instanceof Letter && i < (templates._maxLength || 0);
    i += 1, first = first[L]
  ) {
    word = first.letter + word;
    if (templates.hasOwnProperty(word)) {
      name = word;
      nameFirst = first;
    }
  }
  if (!nameFirst) return;
  const template = templates[name] as AutoFunctionTemplate;

  const args: MQNode[][] = [[]];
  let cursorArgument = -1;
  let cursorOffset = 0;
  block.eachChild((child) => {
    if (child === cursor[R]) {
      cursorArgument = args.length - 1;
      cursorOffset = args[cursorArgument].length;
    }
    if (child.ctrlSeq === ',') args.push([]);
    else args[args.length - 1].push(child);
    return undefined;
  });
  if (cursorArgument < 0) {
    cursorArgument = args.length - 1;
    cursorOffset = args[cursorArgument].length;
  }
  if (
    args.length < template.minArguments ||
    args.length > template.numberOfArguments
  ) {
    return;
  }

  const latexOf = (nodes: MQNode[]) =>
    nodes.map((node) => node.latex()).join('');
  const values: string[] = [];
  for (let i = 0; i < template.numberOfArguments; i += 1) {
    values.push(latexOf(args[i] || []) || template.defaults[i] || '');
  }

  // If defaulted, the cursor argument gives way to the next empty one
  let cursorTarget = cursorArgument;
  if (!args[cursorArgument].length && template.defaults[cursorArgument]) {
    for (let i = cursorArgument + 1; i < values.length; i += 1) {
      if (!values[i]) {
        cursorTarget = i;
        break;
      }
    }
  }
  if (cursorTarget === cursorArgument && args[cursorArgument].length) {
    const nodes = args[cursorArgument];
    values[cursorTarget] =
      latexOf(nodes.slice(0, cursorOffset)) +
      BEAUTIFICATION_CURSOR_MARKER +
      latexOf(nodes.slice(cursorOffset));
  } else {
    values[cursorTarget] = BEAUTIFICATION_CURSOR_MARKER + values[cursorTarget];
  }

  let markerWritten = false;
  const latex = template.latex.replace(/#(\d)/g, (_match, index) => {
    const value = values[+index - 1];
    if (value.indexOf(BEAUTIFICATION_CURSOR_MARKER) < 0) return value;
    if (markerWritten) return value.replace(BEAUTIFICATION_CURSOR_MARKER, '');
    markerWritten = true;
    return value;
  });
  const parsed = latexMathParser
    .skip(Parser.eof)
    .or(Parser.all.result<false>(false))
    .parse(latex);
  if (!parsed) return;
  const marker = findBeautificationCursorMarker(parsed) as MQNode;
  const markerParent = marker.parent;
  const markerRight = marker[R];
  marker.disown();

  const parent = bracket.parent as MathBlock;
  const right = bracket[R];
  new Fragment(nameFirst, bracket).remove();
  if (right) cursor.insLeftOf(right);
  else cursor.insAtRightEnd(parent);
  parent.writeBlock(cursor, parsed);

  if (markerRight) cursor.insLeftOf(markerRight);
  else if (markerParent !== parsed) cursor.insAtRightEnd(markerParent);
}

function findBeautificationCursorMarker(node: MQNode): MQNode | undefined {
  let marker: MQNode | undefined;
  node.eachChild((child) => {
    marker =
      child.ctrlSeq === BEAUTIFICATION_CURSOR_MARKER
        ? child
        : findBeautificationCursorMarker(child);
    return !marker;
  });
  return marker;
}
