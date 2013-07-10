/**
 * This file presents various methods to create a JS typing system.
 */

function divine_inheritance(clazz, constants) {
  let aliases = {};
  for each (let c in constants) {
    aliases[c.name] = c.init;
  }

  // First, do we have a QueryInterface variable?
  if ("QueryInterface" in clazz.variables) {
    // Yes, it's a function, but the variable means that we found a XPCOMUtils
    // utility. This'll be easy!
    let xpcom = clazz.variables.QueryInterface.init;
    assert(xpcom.op == JSOP_CALL && xpcom.kids[0].atom == "generateQI");

    if (!clazz.inherits)
      clazz.inherits = [];
    for each (let iface in xpcom.kids[1].kids)
      clazz.inherits.push(iface.atom);
    return;
  }
  
  if ("QueryInterface" in clazz.functions) {
    if (!clazz.inherits)
      clazz.inherits = [];
    function findInterfaces(ast) {
	    if (ast.op == JSOP_GETPROP && ast.kids[0]) {
		    let check = ast.kids[0];
		    if (check.atom == "interfaces" && check.kids[0] &&
	  	  		check.kids[0].atom == "Components") {
          clazz.inherits.push(ast.atom);
        }
      }
    }
    visit(clazz.functions.QueryInterface.body, findInterfaces, aliases);
    return;
  }
}
