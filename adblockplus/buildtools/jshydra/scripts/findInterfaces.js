// This is a simple script to find all interfaces that a JS code uses, at least
// via Components.interfaces.

include("../utils/cleanast.js");
include("../utils/dumpast.js");

function visit(root_ast, func) {
	function v_r(ast, func) {
		if (ast == null)
			return;
		func(ast);
		for each (let child in ast.kids)
			v_r(child, func);
	}

	function sanitize(ast) {
		if (ast == null)
			return null;
		if (ast.op == JSOP_NAME && ast.atom in aliases) {
			ast = sanitize(aliases[ast.atom]);
			ast.expanded = true;
		}
		let sanitized_ast = { kids: [] };
		for (let key in ast) {
			if (key == 'kids') {
				for each (let kid in ast.kids) {
					sanitized_ast.kids.push(sanitize(kid));
				}
			} else {
				sanitized_ast[key] = ast[key];
			}
		}
		return sanitized_ast;
	}

	v_r(sanitize(root_ast), func);
}

let filename;

function process_js(ast, f) {
	filename = f;
	let global = clean_ast(ast);
	for each (let c in global.constants) {
		mark_globals(c);
	}
	//_print(uneval(aliases));
	for each (let v in global.variables) {
		visit(v.init, find_interfaces);
	}
	for each (let statement in global.code)
		visit(statement, find_interfaces);
	//_print(uneval(global));
}

let aliases = {};

function mark_globals(constant) {
	aliases[constant.name] = constant.init;
}

function find_interfaces(ast) {
	if (ast.op == JSOP_GETPROP && ast.kids[0]) {
		let check = ast.kids[0];
		if (check.atom == "interfaces" && check.kids[0] &&
				check.kids[0].atom == "Components") {
			_print("Interface " + ast.atom + " used at " + loc2str(ast));
		} else if (ast.atom && ast.atom == "nsIMimeStreamConverter") {
			_print(uneval(ast));
		}
	}
}

function loc2str(ast) {
	return filename + ":" + ast.line + ":" + ast.column;
}
