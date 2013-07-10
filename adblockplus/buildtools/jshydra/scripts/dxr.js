// This is a simple test to test global magic

include("../utils/cleanast.js");
include("../utils/dumpast.js");
include("../utils/jstypes.js");

function process_js(ast, f) {
  function loc(l) {
    return f + ":" + l.line + ":" + l.column;
  }
  let toplevel = clean_ast(ast);
  _print("Global variables:");
  for each (let v in toplevel.variables) {
    _print("\t" + v.name + " at " + f + ":" + v.loc.line + ":" + v.loc.column);
  }
  _print("Global constants:");
  for each (let v in toplevel.constants) {
    _print("\t" + v.name + " at " + f + ":" + v.loc.line + ":" + v.loc.column);
  }
  _print("Global objects:");
  for each (let v in toplevel.objects) {
    divine_inheritance(v, toplevel.constants);
    _print("\t" + v.name + " at " + f + ":" + v.loc.line + ":" + v.loc.column);
    if (v.inherits) {
      _print("\tInherits from " + v.inherits.join(", "));
    }
    _print("\tFunctions:");
    for (let name in v.functions) {
      _print("\t\t" + name + " at " + loc(v.functions[name].loc));
    }
    _print("\tVariables:");
    for (let name in v.variables) {
      _print("\t\t" + name + " at " + loc(v.variables[name].loc));
    }
    _print("\tGetters:");
    for (let name in v.getters) {
      _print("\t\t" + name + " at " + loc(v.getters[name].loc));
    }
    _print("\tSetters:");
    for (let name in v.setters) {
      _print("\t\t" + name + " at " + loc(v.setters[name].loc));
    }
  }
  _print("Global classes:");
  for each (let v in toplevel.classes) {
    divine_inheritance(v, toplevel.constants);
    _print("\t" + v.name + " at " + f + ":" + v.loc.line + ":" + v.loc.column);
    if (v.inherits) {
      _print("\tInherits from " + v.inherits.join(", "));
    }
    _print("\tFunctions:");
    for (let name in v.functions) {
      _print("\t\t" + name + " at " + loc(v.functions[name].loc));
    }
    _print("\tVariables:");
    for (let name in v.variables) {
      _print("\t\t" + name + " at " + loc(v.variables[name].loc));
    }
    _print("\tGetters:");
    for (let name in v.getters) {
      _print("\t\t" + name + " at " + loc(v.getters[name].loc));
    }
    _print("\tSetters:");
    for (let name in v.setters) {
      _print("\t\t" + name + " at " + loc(v.setters[name].loc));
    }
  }
  _print("Global functions:");
  for each (let v in toplevel.functions) {
    _print("\t" + v.name + " at " + f + ":" + v.loc.line + ":" + v.loc.column);
  }
}
