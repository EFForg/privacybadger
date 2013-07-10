// Decompile a JS file. This will be painful.
include("../utils/dumpast.js");
include("../utils/astml.js");

let visitor = {
  _visitArray: function (arr, pre, post, comma) {
    if (pre === undefined) pre = '(';
    if (post === undefined) post = ')';
    if (comma === undefined) comma = ', ';
    output(pre);
    for each (let arg in arr) {
      arg.visit(this);
      output(comma);
    }
    if (arr.length > 0)
      unwrite(comma.length);
    output(post);
  },
  _visitMaybeBlock: function (body) {
    if (body.type == "BlockStatement") {
      output(" ");
      body.visit(this);
    } else {
      flush().indent();
      body.visit(this);
      unindent();
    }
  },
  _visitNeedBlock: function (stmt, noFlush) {
    if (stmt.type == "EmptyStatement") {
      output("{}")
      if (!noFlush)
        flush();
    }
    else if (stmt.type == "ReturnStatement") {
      output("{").flush().indent();
      stmt.visit(this);
      unindent().output("}");
      if (!noFlush)
        flush();
    }
    else
      stmt.visit(this);
  },
  visitProgram: function (program) {},
  visitFunctionDeclaration: function (func) {
    output("function ");
    if (func.name)
      output(func.name);
    this._visitArray(func.arguments, '(', ') ');
    this._visitNeedBlock(func.body, true);
    return true;
  },
  visitParameter: function (p) {
    output(p.name);
  },
  visitBlockStatement: function (stmt) {
    output("{").flush().indent();
  },
  postvisitBlockStatement: function (stmt) {
    output("}").unindent().flush();
  },
  visitVarStatement: function (stmt) {
    output(stmt.vartype).output(" ");
    this._visitArray(stmt.variables, '', '');
    if (!this._noFlush)
      output(';').flush();
    this._noFlush = false;
    return true;
  },
  visitVarDeclaration: function (decl) {
    output(decl.name);
    if ("initializer" in decl)
      output(" = ");
  },
  visitLetStatement: function (stmt) {
    output("let ");
    this._visitArray(stmt.variables, '(', ')');
    if (!this._noFlush)
      output(';').flush();
    this._noFlush = false;
    return true;
  },
  visitExpressionStatement: function (stmt) {},
  postvisitExpressionStatement: function (stmt) {
    output(";").flush();
  },
  visitEmptyStatement: function (stmt) { output(";").flush(); },
  visitIfStatement: function (stmt) {
    output("if (");
    stmt.cond.visit(this);
    output(")");
    this._visitMaybeBlock(stmt.body);
    if (stmt.elsebody) {
      output(" else");
      this._visitMaybeBlock(stmt.elsebody);
    }
    return true;
  },
  visitDoWhileStatement: function (stmt) {
    output("do");
    this._visitMaybeBlock(stmt.body);
    output("while (");
    stmt.cond.visit(this);
    output(");").flush();
    return true;
  },
  visitWhileStatement: function (stmt) {
    output("while (");
    stmt.cond.visit(this);
    output(")");
    this._visitMaybeBlock(stmt.body);
    return true;
  },
  visitForStatement: function (stmt) {
    output("for (");
    stmt.init.visit(this);
    stmt.cond.visit(this);
    if (stmt.cond.type != "EmptyStatement")
      output("; ");
    stmt.inc.visit(this);
    output(")");
    this._visitMaybeBlock(stmt.body);
    return true;
  },
  visitForInStatement: function (stmt) {
    output(stmt.itertype).output(" (");
    this._noFlush = true;
    stmt.itervar.visit(this);
    output(" in ");
    stmt.iterrange.visit(this);
    output(")");
    this._visitMaybeBlock(stmt.body);
    return true;
  },
  visitContinueStatement: function (stmt) {
    output("continue");
    if ("label" in stmt)
      output(" ").output(stmt.label);
    output(";").flush();
  },
  visitBreakStatement: function (stmt) {
    output("break");
    if ("label" in stmt)
      output(" ").output(stmt.label);
    output(";").flush();
  },
  visitReturnStatement: function (stmt) { output("return "); },
  postvisitReturnStatement: function (stmt) { output(";").flush(); },
  visitWithStatement: function (stmt) {
    output("with (");
    stmt.variable.visit(this);
    output(")");
    this._visitMaybeBlock(stmt.body);
    return true;
  },
  visitLabeledStatement: function (stmt) { output(stmt.label).output(": "); },
  visitSwitchStatement: function (stmt) {
    output("switch (");
    stmt.expr.visit(this);
    output(") {").flush().indent();
    this._visitArray(stmt.cases, '', '', '');
    output("}").unindent().flush();
    return true;
  },
  visitSwitchCase: function (stmt) {
    if ("expr" in stmt) {
      output("case ");
      stmt.expr.visit(this);
      output(": ");
    } else
      output("default: ");
    stmt.body.visit(this);
    return true;
  },
  visitThrowStatement: function (stmt) { output("throw "); },
  postvisitThrowStatement: function (stmt) { output(";").flush(); },
  visitTryStatement: function (stmt) {
    output("try ");
    this._visitNeedBlock(stmt.body);
    this._visitArray(stmt.catchers, '', '', '\n' + indentStr);
    if (stmt.fin) {
      output("finally ");
      this._visitNeedBlock(stmt.fin);
    }
    return true;
  },
  visitCatchStatement: function (stmt) {
    output("catch (");
    stmt.variable.visit(this);
    if ("cond" in stmt) {
      output(" if ");
      stmt.cond.visit(this);
    }
    output(")");
    this._visitNeedBlock(stmt.body);
    return true;
  },
  visitDebuggerStatement: function (stmt) { output("debugger;").flush(); },

  visitThisExpression: function (expr) { output("this"); },
  visitMemberExpression: function (expr) {
    let needparen = expr.precedence + 1 < expr.container.precedence;
    if (needparen)
      output("(");
    expr.container.visit(this);
    if (needparen)
      output(")");

    if ("constmember" in expr && /^[_a-zA-Z]\w*$/.test(expr.constmember))
      output(".").output(expr.constmember);
    else {
      output("[");
      expr.member.visit(this);
      output("]");
    }
    return true;
  },
  visitNewExpression: function (expr) {
    let needparen = expr.precedence < expr.constructor.precedence;
    output("new ");
    if (needparen)
      output("(");
    expr.constructor.visit(this);
    if (needparen)
      output(")");
    this._visitArray(expr.arguments);
    return true;
  },
  visitCallExpression: function (expr) {
    let needparen = expr.precedence < expr.func.precedence;
    if (needparen)
      output("(");
    expr.func.visit(this);
    if (needparen)
      output(")");
    this._visitArray(expr.arguments);
    return true;
  },
  visitLiteralExpression: function (expr) {
    switch (expr.objtype) {
    case "string":
      output('"').output(sanitize(expr.value, '"')).output('"');
      break;
    case "number":
    case "boolean":
    case "regex":
      output(expr.value.toString());
      break;
    case "null":
      output("null");
      break;
    default:
      throw "Unknown literal " + expr.objtype;
    };
  },
  visitObjectLiteral: function (obj) {
    output('{').flush().indent();
    this._visitArray(obj.setters, '', '', ',\n' + indentStr);
    flush().output('}').unindent();
    return true;
  },
  visitPropertyLiteral: function (prop) {
    if ("proptype" in prop) {
      if (prop.value.type == "LiteralExpression") {
        prop.property.visit(this);
        output(" ").output(prop.proptype).output(": ");
        prop.value.visit(this);
        return true;
      }
      if (prop.proptype == "getter")
        output("get ");
      else if (prop.proptype == "setter")
        output("set ");
      else
        throw "Unknown type: " + prop.proptype;
      prop.property.visit(this);
      if (prop.value.type != "FunctionDeclaration")
        throw "Expection function, found: " + prop.value.type;
      if (prop.value.name) {
        output(" ").output(prop.value.name);
      }
      this._visitArray(prop.value.arguments, '(', ') ');
      this._visitNeedBlock(prop.value.body, true);
      return true;
    }
    prop.property.visit(this);
    output(": ");
    prop.value.visit(this);
    return true;
  },
  visitArrayLiteral: function (arr) {
    this._visitArray(arr.members, '[', ']', ', ');
    return true;
  },
  visitArrayComprehensionExpression: function (arrcomp) {
    output('[');
    let enp = arrcomp.element.precedence > 16;
    if (enp)
      output("(");
    arrcomp.element.visit(this);
    if (enp)
      output(")");
    output(" ").output(arrcomp.itertype).output("(");
    arrcomp.itervar.visit(this);
    output(" in ");
    arrcomp.iterrange.visit(this);
    output(")");
    if ("iterif" in arrcomp) {
      output(" if (");
      arrcomp.iterif.visit(this);
      output(")");
    }
    output("]");
    return true;
  },
  visitIdentifierExpression: function (expr) {
    output(expr.name);
    if ("initializer" in expr) {
      output(" = ");
      expr.initializer.visit(this);
      return true;
    }
  },
  visitPostfixExpression: function (expr) {},
  postvisitPostfixExpression: function (expr) {
    output(expr.operator);
  },
  visitUnaryExpression: function (expr) {
    if (expr.operator != '()') {
      output(expr.operator);
      if (expr.operator.length > 1)
        output(" ");
    }
    let np = expr.precedence < expr.operand.precedence;
    if (expr.operator == '()' || np) {
      output("(");
      expr.operand.visit(this);
      output(")");
      return true;
    }
  },
  visitBinaryExpression: function (expr) {
    let lhp = expr.precedence < expr.lhs.precedence;
    let rhp = expr.precedence < expr.rhs.precedence;
    if (lhp)
      output("(");
    expr.lhs.visit(this);
    if (lhp)
      output(")");
    output(" ").output(expr.operator).output(" ");
    if (rhp)
      output("(");
    expr.rhs.visit(this);
    if (rhp)
      output(")");
    return true;
  },
  visitConditionalExpression: function (expr) {
    let lhp = expr.precedence < expr.cond.precedence;
    let mhp = expr.precedence < expr.iftrue.precedence;
    let rhp = expr.precedence < expr.iffalse.precedence;
    if (lhp)
      output("(");
    expr.cond.visit(this);
    if (lhp)
      output(")");
    output(" ? ");
    if (mhp)
      output("(");
    expr.iftrue.visit(this);
    if (mhp)
      output(")");
    output(" : ");
    if (rhp)
      output("(");
    expr.iffalse.visit(this);
    if (rhp)
      output(")");
    return true;
  },
  visitAssignmentExpression: function (expr) {
    let lhp = expr.precedence < expr.lhs.precedence;
    let rhp = expr.precedence < expr.rhs.precedence;
    if (lhp)
      output("(");
    expr.lhs.visit(this);
    if (lhp)
      output(")");
    output(" ").output(expr.operator).output("= ");
    if (rhp)
      output("(");
    expr.rhs.visit(this);
    if (rhp)
      output(")");
    return true;
  },
};

/* Reminder */
for (let f in structure) {
  if (!("visit" + f in visitor))
    throw "Please visit " + f;
}

function process_js(ast) {
  if (!ast)
    return;
  ast = makeAST(ast);
  walkAST(ast, visitor);
}

/* Output functions */
let buffer = "", indentStr = "";
function output(str) {
  buffer += str;
  return global;
}
function unwrite(numChars) {
  buffer = buffer.substring(0, buffer.length - numChars);
  return global;
}
function flush() {
  _print(buffer);
  buffer = indentStr;
  return global;
}
function indent() {
  indentStr += "  ";
  buffer = "  " + buffer;
  return global;
}
function unindent() {
  indentStr = indentStr.substring(2);
  buffer = buffer.substring(2);
  return global;
}

function sanitize(str, q) {
  function replace(x) {
    if (x == q) return '\\' + q;
    if (x == '\\') return '\\\\';
    if (x == '\b') return '\\b';
    if (x == '\f') return '\\f';
    if (x == '\n') return '\\n';
    if (x == '\r') return '\\r';
    if (x == '\t') return '\\t';
    if (x == '\v') return '\\v';
    let val = x.charCodeAt(0)
    if (x < ' ') return '\\x' + (val - val % 16) / 16 + (val % 16);
    return x;
  }
  return [replace(x) for each (x in str)].join('');
}
