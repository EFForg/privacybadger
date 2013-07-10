// This is a complex script used for producing doxygen-readable input

/* The following is a sample doxygen input file:
FILE doxygen.js
// Documentation for thing
0:0 VARIABLE variable1
// More documentation
1:0 FUNCTION function ARGS a b c
// Yet more documentation
25:0 CLASS clazz INHERITS base1 base2
40:2 CLASS VARIABLE clazzvar
41:2 CLASS METHOD clazzfunc ARGS
52:2 CLASS GETTER vara ARGS
// Some Constant
101:0 CONSTANT const1 VALUE 10
*/

include("../utils/dumpast.js");
include("../utils/cleanast.js");
include("../utils/comments.js");
include("../utils/jstypes.js");

function process_js(ast, f) {
  _print("FILE " + f);
  function loc(l) {
    return l.line + ":" + l.column;
  }
  let toplevel = clean_ast(ast);
  associate_comments(f, toplevel);
  for each (let v in toplevel.variables) {
    if (v.comment)
      _print(v.comment);
    _print(loc(v.loc) + " VARIABLE " + v.name);
  }
  for each (let v in toplevel.constants) {
    if (v.comment)
      _print(v.comment);
    _print(loc(v.loc) + " CONST " + v.name);
  }
  for each (let v in toplevel.objects) {
    divine_inheritance(v, toplevel.constants);
    if (v.comment)
      _print(v.comment);
    let inherits = v.inherits ? (" INHERITS " + v.inherits.join(", ")) : "";
    _print(loc(v.loc) + " CLASS " + v.name + inherits);
    let attrs = { METHOD: v.functions, VARIABLE: v.variables, GETTER: v.getters,
      SETTER: v.setters };
    for (let attr in attrs) {
      for (let name in attrs[attr]) {
        if (attrs[attr][name].comment)
          _print(attrs[attr][name].comment);
        _print(loc(attrs[attr][name].loc) + " CLASS " + attr + " " + name);
      }
    }
    _print("CLASS END");
  }
  for each (let v in toplevel.classes) {
    divine_inheritance(v, toplevel.constants);
    if (v.constructor && v.constructor.comment)
      _print(v.constructor.comment);
    if (v.comment)
      _print(v.comment);
    let inherits = v.inherits ? (" INHERITS " + v.inherits.join(", ")) : "";
    _print(loc(v.loc) + " CLASS " + v.name + inherits);
    let attrs = { METHOD: v.functions, VARIABLE: v.variables, GETTER: v.getters,
      SETTER: v.setters };
    for (let attr in attrs) {
      for (let name in attrs[attr]) {
        if (attrs[attr][name].comment)
          _print(attrs[attr][name].comment);
        _print(loc(attrs[attr][name].loc) + " CLASS " + attr + " " + name);
      }
    }
    _print("CLASS END");
  }
  for each (let v in toplevel.functions) {
    if (v.comment)
      _print(v.comment);
    _print(loc(v.loc) + " FUNCTION " + v.name);
  }
}
