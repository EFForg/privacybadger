/**
 * This processes comments.
 */
function associate_comments(filename, scopeObject) {
  // Read the script and give us line stuff
  let file = read_file(filename).split(/\r\n|[\r\n]/);
  // make file 1-based to avoid off-by-one errors...
  file.unshift("");

  // Now, get us a sorted list of all important AST locations
  let locations = [{loc: {line: 0, column: -1}}];

  function add_func(func) {
    locations.push({loc: func.loc, obj: func, commentWanted: true});
    // The following will get us to the last line of the function
    if (func.body.kids.length == 0)
      return;
    let last = func.body.kids[func.body.kids.length - 1];
    while (last.kids[last.kids.length - 1] &&
        last.kids[last.kids.length - 1].line > last.line)
      last = last.kids[last.kids.length - 1];
    locations.push({loc: {line: last.line, column: last.column}});
  }
  for each (let v in scopeObject.variables)
    locations.push({loc: v.loc, obj: v, commentWanted: true});
  for each (let v in scopeObject.constants)
    locations.push({loc: v.loc, obj: v, commentWanted: true});
  for each (let v in scopeObject.functions)
    add_func(v);
  for each (let v in scopeObject.code)
    locations.push({loc: {line: v.line, column: v.column}, obj: v});
  for each (let o in scopeObject.objects) {
    locations.push({loc: o.loc, obj: o, commentWanted: true});
    for each (let x in o.variables)
      locations.push({loc: x.loc, obj: x, commentWanted: true});
    for each (let x in o.functions)
      add_func(x);
    for each (let x in o.getters)
      add_func(x);
    for each (let x in o.setters)
      add_func(x);
  }
  for each (let o in scopeObject.classes) {
    locations.push({loc: o.loc, obj: o, commentWanted: true});
    for each (let x in o.variables)
      locations.push({loc: x.loc, obj: x, commentWanted: true});
    for each (let x in o.functions)
      add_func(x);
    for each (let x in o.getters)
      add_func(x);
    for each (let x in o.setters)
      add_func(x);
  }
  locations.sort(function (a, b) {
    if (a.loc.line == b.loc.line)
      return a.loc.column - b.loc.column;
    return a.loc.line - b.loc.line;
  });

  // With that list done, let's find comments in the range.
  for (let i = 1; i < locations.length; i++) {
    if (!locations[i].commentWanted)
      continue;
    let comment = find_comments(locations[i - 1].loc, locations[i].loc, file);
    if (comment)
      locations[i].obj.comment = comment;
  }
}

let comment_regex = /\/\*[\s\S]*?\*\/|\/\/.*?\n/mg;
function find_comments(start, end, file) {
  let lines = [];
  lines[0] = file[start.line].substring(start.column + 1).trim();
  for (let l = start.line + 1; l < end.line; l++) {
    lines.push(file[l].trim());
  }
  lines.push(file[end.line].substring(0, end.column).trim());

  let goop = lines.join("\n");
  let match;
  lines = [];
  while ((match = comment_regex.exec(goop)) != null) {
    lines.push(match);
  }
  return lines.join("\n");
}
