include("../utils/astml.js");

function process_js(pn, file) {
  dump_ast(pn);
  let ast = makeAST(pn);
  dump_trueast(ast);
}
