### Contributing

Before you submit a pull request:

0. In general, you should develop off of 'master' unless you are making a hotfix ('stable' is the current production-ready state).
1. Make sure your code conforms to the [Style Guide](doc/style.md).
2. Reference any issues that you are fixing in the commit message (ideally with
   the [magic auto-closing syntax](https://help.github.com/articles/closing-issues-via-commit-messages)).
3. Make sure the [tests pass](https://developer.mozilla.org/en-US/Add-ons/SDK/Tools/cfx#cfx_test).
   Please add tests for any new functionality.
4. BONUS: make sure your changes are compatible with the current [Firefox ESR](https://www.mozilla.org/en-US/firefox/organizations/all/), [Beta](https://www.mozilla.org/en-US/firefox/beta/), and [Aurora](https://www.mozilla.org/en-US/firefox/aurora/) releases as well as the [current stable release](https://www.mozilla.org/en-US/firefox/new/)!

You can use `cfx -b` to choose different Firefox binaries. So for instance

        cfx -b /path/to/firefox-aurora run

can be used to test your changes on Aurora if you have its binary available
at `/path/to/firefox-aurora`.
