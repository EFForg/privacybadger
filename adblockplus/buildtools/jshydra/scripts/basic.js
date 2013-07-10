// Run ../jshydra basic.js basic.js: it should work.
// This is a simple test just to make sure that something isn't borking with
// jshydra.
_print("HI!");
function process_js(ast) {
	for (let f in ast) {
		_print(f + ": "+ ast[f]);
	}
	_print(uneval(ast));
}
