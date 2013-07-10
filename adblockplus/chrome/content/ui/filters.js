/*
 * This file is part of Adblock Plus <http://adblockplus.org/>,
 * Copyright (C) 2006-2013 Eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * Initialization function, called when the window is loaded.
 */
function init()
{
  if (window.arguments && window.arguments.length)
  {
    let filter = window.arguments[0].wrappedJSObject;
    if (filter instanceof Filter)
      Utils.runAsync(SubscriptionActions.selectFilter, SubscriptionActions, filter);
  }
}

/**
 * Called whenever the currently selected tab changes.
 */
function onTabChange(/**Element*/ tabbox)
{
  updateSelectedSubscription();

  Utils.runAsync(function()
  {
    let panel = tabbox.selectedPanel;
    if (panel)
      panel.getElementsByClassName("initialFocus")[0].focus();
    SubscriptionActions.updateCommands();
  });
}

/**
 * Called whenever the selected subscription changes.
 */
function onSelectionChange(/**Element*/ list)
{
  SubscriptionActions.updateCommands();
  updateSelectedSubscription();
  list.focus();

  // Take elements of the previously selected item out of the tab order
  if ("previousSelection" in list && list.previousSelection)
  {
    let elements = list.previousSelection.getElementsByClassName("tabable");
    for (let i = 0; i < elements.length; i++)
      elements[i].setAttribute("tabindex", "-1");
  }
  // Put elements of the selected item into tab order
  if (list.selectedItem)
  {
    let elements = list.selectedItem.getElementsByClassName("tabable");
    for (let i = 0; i < elements.length; i++)
      elements[i].removeAttribute("tabindex");
  }
  list.previousSelection = list.selectedItem;
}

/**
 * Called when splitter state changes to make sure it is persisted properly.
 */
function onSplitterStateChange(/**Element*/ splitter)
{
  let state = splitter.getAttribute("state");
  if (!state)
  {
    splitter.setAttribute("state", "open");
    document.persist(splitter.id, "state");
  }
}

/**
 * Updates filter list when selected subscription changes.
 */
function updateSelectedSubscription()
{
  let panel = E("tabs").selectedPanel;
  if (!panel)
    return;

  let list = panel.getElementsByTagName("richlistbox")[0];
  if (!list)
    return;

  let data = Templater.getDataForNode(list.selectedItem);
  FilterView.subscription = (data ? data.subscription : null);
  FilterActions.updateCommands();
}

/**
 * Template processing functions.
 * @class
 */
var Templater =
{
  /**
   * Processes a template node using given data object.
   */
  process: function(/**Node*/ template, /**Object*/ data) /**Node*/
  {
    // Use a sandbox to resolve attributes (for convenience, not security)
    let sandbox = Cu.Sandbox(window);
    for (let key in data)
      sandbox[key] = data[key];
    sandbox.formatTime = Utils.formatTime;

    // Clone template but remove id/hidden attributes from it
    let result = template.cloneNode(true);
    result.removeAttribute("id");
    result.removeAttribute("hidden");
    result._data = data;

    // Resolve any attributes of the for attr="{obj.foo}"
    let conditionals = [];
    let nodeIterator = document.createNodeIterator(result, NodeFilter.SHOW_ELEMENT, null, false);
    for (let node = nodeIterator.nextNode(); node; node = nodeIterator.nextNode())
    {
      if (node.localName == "if")
        conditionals.push(node);
      for (let i = 0; i < node.attributes.length; i++)
      {
        let attribute = node.attributes[i];
        let len = attribute.value.length;
        if (len >= 2 && attribute.value[0] == "{" && attribute.value[len - 1] == "}")
          attribute.value = Cu.evalInSandbox(attribute.value.substr(1, len - 2), sandbox);
      }
    }

    // Process <if> tags - remove if condition is false, replace by their children
    // if it is true
    for each (let node in conditionals)
    {
      let fragment = document.createDocumentFragment();
      let condition = node.getAttribute("condition");
      if (condition == "false")
        condition = false;
      for (let i = 0; i < node.childNodes.length; i++)
      {
        let child = node.childNodes[i];
        if (child.localName == "elif" || child.localName == "else")
        {
          if (condition)
            break;
          condition = (child.localName == "elif" ? child.getAttribute("condition") : true);
          if (condition == "false")
            condition = false;
        }
        else if (condition)
          fragment.appendChild(node.childNodes[i--]);
      }
      node.parentNode.replaceChild(fragment, node);
    }

    return result;
  },

  /**
   * Updates first child of a processed template if the underlying data changed.
   */
  update: function(/**Node*/ template, /**Node*/ node)
  {
    if (!("_data" in node))
      return;
    let newChild = Templater.process(template.firstChild, node._data);
    delete newChild._data;
    node.replaceChild(newChild, node.firstChild);
  },

  /**
   * Walks up the parent chain for a node until the node corresponding with a
   * template is found.
   */
  getDataNode: function(/**Node*/ node) /**Node*/
  {
    while (node)
    {
      if ("_data" in node)
        return node;
      node = node.parentNode;
    }
    return null;
  },

  /**
   * Returns the data used to generate the node from a template.
   */
  getDataForNode: function(/**Node*/ node) /**Object*/
  {
    node = Templater.getDataNode(node);
    if (node)
      return node._data;
    else
      return null;
  },

  /**
   * Returns a node that has been generated from a template using a particular
   * data object.
   */
  getNodeForData: function(/**Node*/ parent, /**String*/ property, /**Object*/ data) /**Node*/
  {
    for (let child = parent.firstChild; child; child = child.nextSibling)
      if ("_data" in child && property in child._data && child._data[property] == data)
        return child;
    return null;
  }
};
