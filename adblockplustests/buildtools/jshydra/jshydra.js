var include = function(file)
{
  if (typeof include.dirStack == "undefined")
    include.dirStack = [];

  if (include.dirStack.length && !/^([a-zA-Z]:)?[\/\\]/.test(file))
    file = include.dirStack[include.dirStack.length - 1] + "/../" + file;
  while (/\/[^.\/][^\/]*\/\.\.(?=\/)/.test(file))
    file = file.replace(/\/[^.\/][^\/]*\/\.\.(?=\/)/, "");

  include.dirStack.push(file);
  try
  {
    load(file);
  }
  finally
  {
    include.dirStack.pop();
  }
}
var _print = print;

(function(scriptArgs)
{
  let scriptArg = "";
  for (var i = 0; i < scriptArgs.length; i++)
  {
    if (scriptArgs[i] == "--trueast")
      scriptArgs.splice(i--, 1);
    else if (scriptArgs[i] == "--arg" && i < scriptArgs.length - 1)
    {
      scriptArg = scriptArgs[i + 1];
      scriptArgs.splice(i--, 2);
    }
  }

  if (!scriptArgs.length)
    throw Error("No script to execute");
  include(scriptArgs[0]);

  for (var i = 1; i < scriptArgs.length; i++)
    process_js(Reflect.parse(read(scriptArgs[i])), scriptArgs[i], scriptArg);
})(arguments);
