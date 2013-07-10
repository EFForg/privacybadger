(function()
{
  let {application} = require("info");
  if (application != "firefox")
    return;

  let wnd = Utils.getChromeWindow(window);
  let toolbox = wnd.document.getElementById("navigator-toolbox");
  if (!toolbox)
    return;

  module("Icon position", {
    setup: function()
    {
      this.oldPosition = toolbox.getAttribute("abp-iconposition");
      if (UI.isToolbarIconVisible(wnd))
        UI.toggleToolbarIcon();
    },
    teardown: function()
    {
      toolbox.setAttribute("abp-iconposition", this.oldPosition);
      toolbox.ownerDocument.persist(toolbox.id, "abp-iconposition");
      UI.toggleToolbarIcon();
      UI.toggleToolbarIcon();
    }
  });

  test("Put icon before add-on bar close button", function()
  {
    toolbox.setAttribute("abp-iconposition", "hidden,addon-bar,addonbar-closebutton");

    UI.toggleToolbarIcon();
    let button = wnd.document.getElementById("abp-toolbarbutton");
    ok(button, "Button added");
    if (button)
    {
      ok(button.nextSibling, "Has next sibling");
      if (button.nextSibling)
        equal(button.nextSibling.id, "addonbar-closebutton", "Next sibling ID");
      equal(button.parentNode.id, "addon-bar", "Parent ID");
    }

    UI.toggleToolbarIcon();
    let button = wnd.document.getElementById("abp-toolbarbutton");
    ok(!button, "Button removed");

    UI.toggleToolbarIcon();
    let button = wnd.document.getElementById("abp-toolbarbutton");
    ok(button, "Button added");
    if (button)
    {
      ok(button.nextSibling, "Has next sibling");
      if (button.nextSibling)
        equal(button.nextSibling.id, "addonbar-closebutton", "Next sibling ID");
      equal(button.parentNode.id, "addon-bar", "Parent ID");
    }
  });

  test("Put icon at the end of the add-on bar", function()
  {
    toolbox.setAttribute("abp-iconposition", "hidden,addon-bar,");

    UI.toggleToolbarIcon();
    let button = wnd.document.getElementById("abp-toolbarbutton");
    ok(button, "Button added");
    if (button)
    {
      ok(!button.nextSibling, "No next sibling");
      equal(button.parentNode.id, "addon-bar", "Parent ID");
    }

    UI.toggleToolbarIcon();
    let button = wnd.document.getElementById("abp-toolbarbutton");
    ok(!button, "Button removed");

    UI.toggleToolbarIcon();
    let button = wnd.document.getElementById("abp-toolbarbutton");
    ok(button, "Button added");
    if (button)
    {
      ok(!button.nextSibling, "No next sibling");
      equal(button.parentNode.id, "addon-bar", "Parent ID");
    }
  });

  test("Put icon into navigation toolbar", function()
  {
    toolbox.setAttribute("abp-iconposition", "hidden,nav-bar,home-button");

    UI.toggleToolbarIcon();
    let button = wnd.document.getElementById("abp-toolbarbutton");
    ok(button, "Button added");
    if (button)
    {
      ok(button.nextSibling, "Has next sibling");
      if (button.nextSibling)
        equal(button.nextSibling.id, "home-button", "Next sibling ID");
      equal(button.parentNode.id, "nav-bar", "Parent ID");
    }

    UI.toggleToolbarIcon();
    let button = wnd.document.getElementById("abp-toolbarbutton");
    ok(!button, "Button removed");

    UI.toggleToolbarIcon();
    let button = wnd.document.getElementById("abp-toolbarbutton");
    ok(button, "Button added");
    if (button)
    {
      ok(button.nextSibling, "Has next sibling");
      if (button.nextSibling)
        equal(button.nextSibling.id, "home-button", "Next sibling ID");
      equal(button.parentNode.id, "nav-bar", "Parent ID");
    }
  });

  test("Put icon before an invalid element", function()
  {
    toolbox.setAttribute("abp-iconposition", "hidden,addon-bar,navigator-toolbox");

    UI.toggleToolbarIcon();
    let button = wnd.document.getElementById("abp-toolbarbutton");
    ok(button, "Button added");
    if (button)
    {
      ok(!button.nextSibling, "No next sibling");
      equal(button.parentNode.id, "addon-bar", "Parent ID");
    }
    equal(toolbox.getAttribute("abp-iconposition"), "visible,addon-bar,", "New saved position");
  });

  test("Put icon before an unknown element", function()
  {
    toolbox.setAttribute("abp-iconposition", "hidden,addon-bar,foobarelement");

    UI.toggleToolbarIcon();
    let button = wnd.document.getElementById("abp-toolbarbutton");
    ok(button, "Button added");
    if (button)
    {
      ok(!button.nextSibling, "No next sibling");
      equal(button.parentNode.id, "addon-bar", "Parent ID");
    }
    equal(toolbox.getAttribute("abp-iconposition"), "visible,addon-bar,", "New saved position");
  });

  test("Default icon position", function()
  {
    toolbox.removeAttribute("abp-iconposition");

    UI.toggleToolbarIcon();
    let button = wnd.document.getElementById("abp-toolbarbutton");
    ok(button, "Button added");
    if (button)
    {
      ok(button.nextSibling, "Has next sibling");
      if (button.nextSibling)
        equal(button.nextSibling.id, "addonbar-closebutton", "Next sibling ID");
      equal(button.parentNode.id, "addon-bar", "Parent ID");
    }
  });

  test("Recover legacy position", function()
  {
    toolbox.setAttribute("abp-iconposition", "hidden,addon-bar,");
    UI.toggleToolbarIcon();
    let icon = wnd.document.getElementById("abp-toolbarbutton");
    UI.toggleToolbarIcon();

    toolbox.removeAttribute("abp-iconposition");
    let addonBar =  wnd.document.getElementById("addon-bar");
    let currentset = addonBar.getAttribute("currentset");
    currentset = currentset.replace(/,abp-toolbarbutton/g, "");
    currentset = currentset.replace(/abp-toolbarbutton,/g, "");
    addonBar.setAttribute("currentset", currentset);

    let navBar = wnd.document.getElementById("nav-bar");
    currentset = navBar.getAttribute("currentset");
    currentset = currentset.replace(/,abp-toolbarbutton/g, "");
    currentset = currentset.replace(/abp-toolbarbutton,/g, "");
    currentset = currentset.replace(/,home-button/, ",abp-toolbarbutton,home-button");
    navBar.setAttribute("currentset", currentset);

    UI.restoreToolbarIcon(toolbox, icon);

    let button = wnd.document.getElementById("abp-toolbarbutton");
    ok(button, "Button added");
    if (button)
    {
      ok(button.nextSibling, "Has next sibling");
      if (button.nextSibling)
        equal(button.nextSibling.id, "home-button", "Next sibling ID");
      equal(button.parentNode.id, "nav-bar", "Parent ID");
    }
  });
})();
