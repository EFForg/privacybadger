// Arguments: autotest/test_trueast.js
// Name: Simple asts

include("../utils/astml.js");

function process_js(pn, file) {
  let ast = makeAST(pn);
  dump_trueast(ast);
}
