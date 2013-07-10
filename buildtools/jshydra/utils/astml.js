// Output an JsonML codec for the AST

// Explanation of a node:
// {
//   type: The type of the node
//   location: "line:col-line:col"
// }
/**
 * Node formats:
 * Program
 *   sourceElements: Array of elements (functions, statements)
 * FunctionDeclaration
 *   name: Name of the function
 *   arguments: Array of arguments
 *   body: Array of elements in function body
 * VarStatement
 *   variables: Variables being initialized
 * VarDeclaration
 *   name: Name of variable
 *   initializer: Initial value of variable
 * CallExpression
 *   func: Name of the function being called
 *   arguments: Array of arguments
 * IdentifierExpression
 *   name: Name of identifier
 * LiteralExpression
 *   objtype: "null", "boolean", "numeric", "string", "regex"
 *   value: Value of the literal
 * BinaryExpression
 *   operator: operator (e.g., '|', '+')
 +   lhs, rhs: left-hand, right-hand expressions for the operator
 */
include("../utils/dumpast.js");

function makeAST(pn) {
  let ast = shellNode(pn, "Program");
  ast.sourceElements = parseToAst(pn).statements;
  return ast;
}

// Broken things:
// * Generators (i for (i in foo), not array comp)
// * let {a: x, b: y} = baz();
// * let (x = 5, y = 12) {} (really!)
// * function ( {a: 1, b: 2} )
// * E4x

let structure = {
  // Program : SourceElement*
  "Program": [ "sourceElements" ],
  // SourceElement : FunctionDeclaration | Statement
  // FunctionDeclaration : function [name] ( Parameter * ) { SourceElement * }
  "FunctionDeclaration": [ "arguments", "body" ],
  "Parameter": [ ], // name: Parameter name

  // Statements
  "BlockStatement": [ "statements" ],
  "VarStatement": [ "variables" ],
    "VarDeclaration": [ "initializer" ], // name: name of variable
  "LetStatement": [ "variables", "body" ],
  "EmptyStatement": [],
  "ExpressionStatement": [ "expr" ],
  "IfStatement": [ "cond", "body", "elsebody" ],
  "DoWhileStatement": [ "cond", "body" ],
  "WhileStatement": [ "cond", "body" ],
  "ForStatement": [ "init", "cond", "inc", "body" ],
  "ForInStatement": [ "itervar", "iterrange", "body" ], // itertype: for (each)
  "ContinueStatement": [ ], // label: label to break to
  "BreakStatement": [ ], // label: label to break to
  "ReturnStatement": [ "expr" ],
  "WithStatement": [ "variable", "body" ],
  "LabeledStatement": [ "body" ], // label: label of statement
  "SwitchStatement": [ "expr", "cases" ],
    "SwitchCase": [ "expr", "body"], // default: no expr
  "ThrowStatement": [ "expr" ],
  "TryStatement": [ "body", "catchers", "fin" ],
    "CatchStatement": [ "variable", "cond", "body" ],
  "DebuggerStatement": [ ],

  // Expressions (all have a precedence attribute, 0 (primary) -17)
  "ThisExpression": [],
  "LiteralExpression": [], // objtype: typeof literal, value: value
  "ObjectLiteral": [ "setters" ],
    "PropertyLiteral": [ "property", "value" ], // proptype: getter, setter, not
  "ArrayLiteral": [ "members" ],
  "ArrayComprehensionExpression": [ "element", "itervar", "iterrange",
                                    "iterif" ], // itertype
  "IdentifierExpression": [], // name: name of node
  "MemberExpression": [ "container", "member"], //constmember if constant
  "NewExpression": [ "constructor", "arguments" ],
  "CallExpression": [ "func", "arguments" ],
  "PostfixExpression": [ "operand" ], // operator
  // XXX: jorendorff says yield is weird precedence
  // For now, it's an unary with precedence = 16
  "UnaryExpression": [ "operand" ], // operator
  "BinaryExpression": [ "lhs", "rhs" ], // operator
  "ConditionalExpression": [ "cond", "iftrue", "iffalse" ],
  "AssignmentExpression": [ "lhs", "rhs" ], // operator
};
function walkAST(ast, visitor) {
  function astVisitor(node) {
    let info = structure[node.type];
    if (!info)
      throw "Need to define " + node.type;
    let cback = "visit" + node.type;
    let deep = false;
    if (cback in visitor)
      deep = visitor[cback](node);
    if (!deep) {
      for each (let part in info) {
        let piece = node[part];
        if (piece instanceof Array) {
          [astVisitor(x) for each (x in piece)];
        } else if (piece) {
          astVisitor(piece);
        }
      }
    }
    cback = "post" + cback;
    if (cback in visitor)
      visitor[cback](node);
  }
  astVisitor(ast);
}

function getLocation(pn) {
  return pn.line + ":" + pn.column;
}
function shellNode(pn, type) {
  function visit(visitor) {
    return walkAST(this, visitor);
  }
  return {type: type, location: getLocation(pn), visit: visit };
}
function binaryNode(pn, operator, precedence) {
  let ast = shellNode(pn, "BinaryExpression");
  ast.precedence = precedence;
  ast.operator = operator;
  ast.lhs = parseToAst(pn.kids[0]);
  ast.rhs = parseToAst(pn.kids[1]);
  for (let i = 2; i < pn.kids.length; i++) {
    let sup = shellNode(pn.kids[i], "BinaryExpression");
    sup.precedence = precedence;
    sup.operator = operator;
    sup.lhs = ast;
    sup.rhs = parseToAst(pn.kids[i]);
    ast = sup;
  }
  return ast;
}

function parseToAst(pn) {
  if (!pn)
    return pn;
  try {
    return global["convert" + decode_type(pn.type)](pn);
  } catch (e if e instanceof TypeError) {
    dump_ast(pn);
    throw e;
    //throw "Unexpected token " + decode_type(pn.type);
  }
}

// Nodes that I don't see in output
// TOK_ERROR, TOK_EOL, TOK_ELSE, TOK_FINALLY, TOK_SEQ
// TOK_XMLSTAGO - TOK_XMLLIST are XML and thus ignored

function convertTOK_SEMI(pn) {
  let ast = shellNode(pn, "ExpressionStatement");
  if (pn.kids[0])
    ast.expr = parseToAst(pn.kids[0]);
  else {
    ast.type = "EmptyStatement";
  }
  return ast;
}

function convertTOK_COMMA(pn) {
  if (pn.kids.length == 0) {
    let ast = shellNode(pn, "EmptyExpression");
    ast.precedence = 17;
    return ast;
  } else {
    return binaryNode(pn, ",", 17);
  }
}

function convertTOK_ASSIGN(pn) {
  let ast = shellNode(pn, "AssignmentExpression");
  ast.precedence = 16;
  ast.lhs = parseToAst(pn.kids[0]);
  ast.rhs = parseToAst(pn.kids[1]);
  switch (pn.op) {
  case JSOP_NOP: ast.operator = ''; break;
  case JSOP_BITOR: ast.operator = '|'; break;
  case JSOP_BITXOR: ast.operator = '^'; break;
  case JSOP_BITAND: ast.operator = '&'; break;
  case JSOP_LSH: ast.operator = '<<'; break;
  case JSOP_RSH: ast.operator = '>>'; break;
  case JSOP_URSH: ast.operator = '>>>'; break;
  case JSOP_ADD: ast.operator = '+'; break;
  case JSOP_SUB: ast.operator = '-'; break;
  case JSOP_MUL: ast.operator = '*'; break;
  case JSOP_DIV: ast.operator = '/'; break;
  case JSOP_MOD: ast.operator = '%'; break;
  default: throw "Unexpected operator " + decode_op(pn.op);
  };
  return ast;
}

function convertTOK_HOOK(pn) {
  let ast = shellNode(pn, "ConditionalExpression");
  ast.precedence = 15;
  ast.cond = parseToAst(pn.kids[0]);
  ast.iftrue = parseToAst(pn.kids[1]);
  ast.iffalse = parseToAst(pn.kids[2]);
  return ast;
}

function convertTOK_COLON(pn) {
  if (pn.kids.length == 1) {
    let ast = shellNode(pn, "LabeledStatement");
    ast.label = pn.atom;
    ast.body = parseToAst(pn.kids[0]);
    return ast;
  }
  let ast = shellNode(pn, "PropertyLiteral");
  ast.property = parseToAst(pn.kids[0]);
  ast.value = parseToAst(pn.kids[1]);
  if (pn.op == JSOP_GETTER)
    ast.proptype = "getter";
  else if (pn.op == JSOP_SETTER)
    ast.proptype = "setter";
  return ast;
}

function convertTOK_OR(pn)     { return binaryNode(pn, "||", 14); }
function convertTOK_AND(pn)    { return binaryNode(pn, "&&", 13); }
function convertTOK_BITOR(pn)  { return binaryNode(pn, "|", 12); }
function convertTOK_BITXOR(pn) { return binaryNode(pn, "^", 11); }
function convertTOK_BITAND(pn) { return binaryNode(pn, "&", 10); }
function convertTOK_EQOP(pn) {
  switch (pn.op) {
  case JSOP_EQ:                  return binaryNode(pn, "==", 9);
  case JSOP_NE:                  return binaryNode(pn, "!=", 9);
  case JSOP_STRICTEQ:            return binaryNode(pn, "===", 9);
  case JSOP_STRICTNE:            return binaryNode(pn, "!==", 9);
  }
  throw "Unknown operator: " + decode_op(pn.op);
}
function convertTOK_RELOP(pn) {
  switch (pn.op) {
  case JSOP_LT:                  return binaryNode(pn, "<", 8);
  case JSOP_LE:                  return binaryNode(pn, "<=", 8);
  case JSOP_GT:                  return binaryNode(pn, ">", 8);
  case JSOP_GE:                  return binaryNode(pn, ">=", 8);
  }
  throw "Unknown operator: " + decode_op(pn.op);
}
function convertTOK_SHOP(pn) {
  switch (pn.op) {
  case JSOP_LSH:                 return binaryNode(pn, "<<", 7);
  case JSOP_RSH:                 return binaryNode(pn, ">>", 7);
  case JSOP_URSH:                return binaryNode(pn, ">>>", 7);
  }
  throw "Unknown operator: " + decode_op(pn.op);
}
function convertTOK_PLUS(pn)   { return binaryNode(pn, "+", 6); }
function convertTOK_MINUS(pn)  { return binaryNode(pn, "-", 6); }
function convertTOK_STAR(pn)   { return binaryNode(pn, "*", 5); }
function convertTOK_DIVOP(pn) {
  switch (pn.op) {
  case JSOP_MUL:                 return binaryNode(pn, "*", 5);
  case JSOP_DIV:                 return binaryNode(pn, "/", 5);
  case JSOP_MOD:                 return binaryNode(pn, "%", 5);
  }
  throw "Unknown operator: " + decode_op(pn.op);
}
function convertTOK_UNARYOP(pn) {
  let ast = shellNode(pn, "UnaryExpression");
  ast.precedence = 4;
  ast.operand = parseToAst(pn.kids[0]);
  switch (pn.op) {
  case JSOP_NEG:                 ast.operator = "-"; break;
  case JSOP_POS:                 ast.operator = "+"; break;
  case JSOP_NOT:                 ast.operator = "!"; break;
  case JSOP_BITNOT:              ast.operator = "~"; break;
  case JSOP_TYPEOF:              ast.operator = "typeof"; break;
  case JSOP_VOID:                ast.operator = "void"; break;
  case JSOP_TYPEOFEXPR:          ast.operator = "typeof"; break;
  default:
    throw "Unknown operator: " + decode_op(pn.op);
  }
  return ast;
}
function convertTOK_INC(pn) { return convertPrePost(pn, '++'); }
function convertTOK_DEC(pn) { return convertPrePost(pn, '--'); }
function convertPrePost(pn, op) {
  let ast = shellNode(pn, "UnaryExpression");
  ast.precedence = 3;
  ast.operator = op;
  ast.operand = parseToAst(pn.kids[0]);
  switch (pn.op) {
  case JSOP_INCNAME:
  case JSOP_INCPROP:
  case JSOP_INCELEM:
  case JSOP_DECNAME:
  case JSOP_DECPROP:
  case JSOP_DECELEM:
    /*ast.type = "PrefixExpression";*/ break;
  case JSOP_NAMEINC:
  case JSOP_PROPINC:
  case JSOP_ELEMINC:
  case JSOP_NAMEDEC:
  case JSOP_PROPDEC:
  case JSOP_ELEMDEC:
    ast.type = "PostfixExpression"; break;
  default:
    throw "Unknown operator: " + decode_op(pn.op);
  }
  return ast;
}

function convertTOK_DOT(pn) {
  let ast = shellNode(pn, "MemberExpression");
  ast.precedence = 1;
  ast.container = parseToAst(pn.kids[0]);
  ast.member = shellNode(pn, "LiteralExpression");
  ast.member.objtype = "string";
  ast.member.value = pn.atom;
  ast.constmember = pn.atom;
  return ast;
}

function convertTOK_LB(pn) {
  let ast = shellNode(pn, "MemberExpression");
  ast.precedence = 1;
  ast.container = parseToAst(pn.kids[0]);
  ast.member = parseToAst(pn.kids[1]);
  return ast;
}

function convertTOK_RB(pn) {
  let ast = shellNode(pn, "ArrayLiteral");
  ast.precedence = 0;
  ast.members = [parseToAst(x) for each (x in pn.kids)];
  return ast;
}

/* Returns a list */
function convertTOK_LC(pn) {
  let ast = shellNode(pn, "BlockStatement");
  ast.statements = [parseToAst(x) for each (x in pn.kids)];
  if (ast.statements.length == 0) {
    return shellNode(pn, "EmptyStatement");
  }
  return ast;
}

function convertTOK_RC(pn) {
  let ast = shellNode(pn, "ObjectLiteral");
  ast.setters = [parseToAst(x) for each (x in pn.kids)];
  return ast;
}

function convertTOK_LP(pn) {
  if (pn.op != JSOP_CALL && pn.op != JSOP_APPLY) {
    let ast = shellNode(pn, "LetStatement");
    ast.variables = [parseToAst(x) for each (x in pn.kids)];
    return ast;
  }
  let ast = shellNode(pn, "CallExpression");
  ast.precedence = 2;
  ast.func = parseToAst(pn.kids[0]);
  ast.arguments = [];
  for (let i = 1; i < pn.kids.length; i++)
    ast.arguments[i - 1] = parseToAst(pn.kids[i]);
  return ast;
}

function convertTOK_RP(pn) {
  let ast = shellNode(pn, "UnaryExpression");
  ast.precedence = 2;
  ast.operand = parseToAst(pn.kids[0]);
  ast.operator = "()";
  return ast;
}

function convertTOK_NAME(pn) {
  let ast = shellNode(pn, "IdentifierExpression");
  ast.precedence = 0;
  ast.name = pn.atom;
  if (pn.kids.length > 0 && pn.kids[0]) {
    ast.initializer = parseToAst(pn.kids[0]);
  }
  return ast;
}


function convertTOK_NUMBER(pn) {
  let ast = shellNode(pn, "LiteralExpression");
  ast.precedence = 0;
  ast.objtype = "number";
  ast.value = pn.value;
  return ast;
}

function convertTOK_STRING(pn) {
  let ast = shellNode(pn, "LiteralExpression");
  ast.precedence = 0;
  ast.objtype = "string";
  ast.value = pn.atom;
  return ast;
}

function convertTOK_REGEXP(pn) {
  let ast = shellNode(pn, "LiteralExpression");
  ast.precedence = 0;
  ast.objtype = "regex";
  ast.value = pn.value;
  return ast;
}

function convertTOK_PRIMARY(pn) {
  let ast = shellNode(pn, "LiteralExpression");
  ast.precedence = 0;
  switch (pn.op) {
  case JSOP_ZERO: ast.objtype = "number"; ast.value = 0; break;
  case JSOP_ONE: ast.objtype = "number"; ast.value = 1; break;
  case JSOP_NULL: ast.objtype = "null"; ast.value = null; break;
  case JSOP_FALSE: ast.objtype = "boolean"; ast.value = false; break;
  case JSOP_TRUE: ast.objtype = "boolean"; ast.value = true; break;
  case JSOP_THIS:
    return shellNode(pn, "ThisExpression");
  default:
    throw "Unknown operand: " + decode_op(pn.op);
  }
  return ast;
}

function convertTOK_FUNCTION(pn) {
  let ast = shellNode(pn, "FunctionDeclaration");
  // Precedence needs to be highest -> always wrapped
  ast.precedence = 1.0 / 0.0;
  ast.name = pn.name;
  if (pn.kids[0].type == TOK_UPVARS)
    pn = pn.kids[0];
  let args = [];
  if (pn.kids[0].type == TOK_ARGSBODY) {
    pn = pn.kids[0];
    while (pn.kids.length > 1) {
      let argNode = parseToAst(pn.kids.shift());
      argNode.type = "Parameter";
      args.push(argNode);
    }
  }
  ast.arguments = args;
  ast.body = parseToAst(pn.kids[0]);
  return ast;
}

function convertTOK_IF(pn) {
  let ast = shellNode(pn, "IfStatement");
  ast.cond = parseToAst(pn.kids[0]);
  ast.body = parseToAst(pn.kids[1]);
  if (pn.kids[1])
    ast.elsebody = parseToAst(pn.kids[2]);
  return ast;
}


function convertTOK_SWITCH(pn) {
  let ast = shellNode(pn, "SwitchStatement");
  ast.expr = parseToAst(pn.kids[0]);
  let rhs = parseToAst(pn.kids[1]);
  if (rhs instanceof Array)
    ast.cases = rhs;
  else
    ast.cases = rhs.statements;
  return ast;
}

function convertTOK_CASE(pn) {
  let ast = shellNode(pn, "SwitchCase");
  ast.expr = parseToAst(pn.kids[0]);
  ast.body = parseToAst(pn.kids[1]);
  return ast;
}
function convertTOK_DEFAULT(pn) {
  let ast = shellNode(pn, "SwitchCase");
  ast.body = parseToAst(pn.kids[1]);
  return ast;
}

function convertTOK_WHILE(pn) {
  let ast = shellNode(pn, "WhileStatement");
  ast.cond = parseToAst(pn.kids[0]);
  ast.body = parseToAst(pn.kids[1]);
  return ast;
}
function convertTOK_DO(pn) {
  let ast = shellNode(pn, "DoWhileStatement");
  ast.body = parseToAst(pn.kids[0]);
  ast.cond = parseToAst(pn.kids[1]);
  return ast;
}

function convertTOK_FOR(pn) {
  let ast = shellNode(pn, "ForStatement");
  let expr = parseToAst(pn.kids[0]);
  if (expr.type == "Forehead") {
    ast.init = expr.init;
    ast.cond = expr.condition;
    ast.inc = expr.increment;
  } else {
    ast.type = "ForInStatement";
    ast.itervar = expr.lhs;
    ast.iterrange = expr.rhs;
    ast.itertype = (pn.iflags & 0x2 ? "for each" : "for");
  }
  ast.body = parseToAst(pn.kids[1]);
  return ast;
}

function convertTOK_BREAK(pn) {
  let ast = shellNode(pn, "BreakStatement");
  if (pn.atom)
    ast.label = pn.atom;
  return ast;
}
function convertTOK_CONTINUE(pn) {
  let ast = shellNode(pn, "ContinueStatement");
  if (pn.atom)
    ast.label = pn.atom;
  return ast;
}

function convertTOK_IN(pn) { return binaryNode(pn, "in", 8); }

function convertTOK_VAR(pn) {
  let ast = shellNode(pn, "VarStatement");
  if (pn.op == JSOP_DEFCONST)
    ast.vartype = "const";
  else
    ast.vartype = "var";
  ast.variables = [parseToAst(x) for each (x in pn.kids)];
  for each (let x in ast.variables) {
    if (x.type == "LetStatement")
      return x;
    if (x.type == "IdentifierExpression")
      x.type = "VarDeclaration";
  }
  return ast;
}

function convertTOK_WITH(pn) {
  let ast = shellNode(pn, "WithStatement");
  ast.variable = parseToAst(pn.kids[0]);
  ast.body = parseToAst(pn.kids[1]);
  return ast;
}

function convertTOK_RETURN(pn) {
  let ast = shellNode(pn, "ReturnStatement");
  ast.expr = parseToAst(pn.kids[0]);
  return ast;
}

function convertTOK_NEW(pn) {
  let ast = shellNode(pn, "NewExpression");
  ast.precedence = 1;
  ast.constructor = parseToAst(pn.kids[0]);
  ast.arguments = [];
  for (let i = 1; i < pn.kids.length; i++)
    ast.arguments.push(parseToAst(pn.kids[i]));
  return ast;
}

function convertTOK_DELETE(pn) {
  let ast = shellNode(pn, "UnaryExpression");
  ast.precedence = 4;
  ast.operator = "delete";
  ast.operand = parseToAst(pn.kids[0]);
  return ast;
}

function convertTOK_DEFSHARP(pn) {
  let ast = shellNode(pn, "SharpDefinitionExpression");
  ast.expr = parseToAst(pn.kids[0]);
  ast.sharpnum = pn.number;
  return ast;
}
function convertTOK_USESHARP(pn) {
  let ast = shellNode(pn, "SharpExpression");
  ast.sharpnum = pn.number;
  return ast;
}

function convertTOK_TRY(pn) {
  let ast = shellNode(pn, "TryStatement");
  ast.body = parseToAst(pn.kids[0]);
  if (pn.kids[1])
    ast.catchers = parseToAst(pn.kids[1]);
  else
    ast.catchers = [];
  if (pn.kids[2])
    ast.fin = parseToAst(pn.kids[2]);
  return ast;
}

function convertTOK_CATCH(pn) {
  let ast = shellNode(pn, "CatchStatement");
  ast.variable = parseToAst(pn.kids[0]);
  if (pn.kids[1])
    ast.cond = parseToAst(pn.kids[1]);
  ast.body = parseToAst(pn.kids[2]);
  return ast;
}

function convertTOK_THROW(pn) {
  let ast = shellNode(pn, "ThrowStatement");
  ast.expr = parseToAst(pn.kids[0]);
  return ast;
}

function convertTOK_INSTANCEOF(pn) { return binaryNode(pn, "instanceof", 8); }

function convertTOK_DEBUGGER(pn) { return shellNode(pn, "DebuggerStatement"); }
// XML OPS

function convertTOK_YIELD(pn) {
  let ast = shellNode(pn, "UnaryExpression");
  ast.operand = parseToAst(pn.kids[0]);
  ast.precedence = 16;
  ast.operator = "yield";
  return ast;
}

function convertTOK_ARRAYCOMP(pn) {
  let ast = parseToAst(pn.kids[0]);
  ast.precedence = 0;
  ast.type = "ArrayComprehensionExpression";
  if ("expr" in ast.body)
    ast.element = ast.body.expr;
  else {
    ast.element = ast.body.body.expr;
    ast.iterif = ast.body.cond;
  }
  delete ast.body;
  return ast;
}

function convertTOK_ARRAYPUSH(pn) {
  let ast = shellNode(pn, "ArrayPush");
  ast.expr = parseToAst(pn.kids[0]);
  return ast;
}

function convertTOK_LEXICALSCOPE(pn) {
  return parseToAst(pn.kids[0]);
}

function convertTOK_LET(pn) {
  let ast = convertTOK_VAR(pn);
  if (ast.type == "VarStatement")
    ast.vartype = "let";
  return ast;
}

function convertTOK_FORHEAD(pn) {
  let ast = shellNode(pn, "Forehead");
  ast.init = pn.kids[0] ? parseToAst(pn.kids[0]) :
    shellNode(pn, "EmptyStatement");
  ast.condition = pn.kids[1] ? parseToAst(pn.kids[1]) :
    shellNode(pn, "EmptyStatement");
  ast.increment = pn.kids[2] ? parseToAst(pn.kids[2]) :
    shellNode(pn, "EmptyStatement");
  return ast;
}

function convertTOK_RESERVED(pn) {
  return [parseToAst(x) for each (x in pn.kids)];
}
