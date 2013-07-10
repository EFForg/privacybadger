// Arguments: autotest/test_comments.js
// Name: Comment association test

// This comment is associated with only code, so I don't see this.
include("../utils/cleanast.js");
include("../utils/comments.js");

// Processes an AST tree
function process_js(ast, file) {
  let objects = clean_ast(ast);
  associate_comments(file, objects);

  for each (let f in objects.functions) {
    if (f.comment)
      _print(f.name + ": " + f.comment);
  }
  for each (let o in objects.objects) {
    if (o.comment)
      _print(o.name + ": " + o.comment);
    for (let m in o.functions) {
      _print(m + ": " + o.functions[m].comment);
    }
  }
}

// Documenting an object!
var test_object = {
  /**
   * This method does absolutely nothing.
   */
  someMethod: function () {}
};
