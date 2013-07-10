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
 * Implementation of the various actions performed on the filters.
 * @class
 */
var FilterActions =
{
  /**
   * Initializes filter actions.
   */
  init: function()
  {
    let me = this;
    this.treeElement.parentNode.addEventListener("keypress", function(event)
    {
      me.keyPress(event);
    }, true);
    this.treeElement.view = FilterView;

    this.treeElement.inputField.addEventListener("keypress", function(event)
    {
      // Prevent the tree from capturing cursor keys pressed in the input field
      if (event.keyCode >= event.DOM_VK_PAGE_UP && event.keyCode <= event.DOM_VK_DOWN)
        event.stopPropagation();
    }, false);

    // Create a copy of the view menu
    function fixId(node, newId)
    {
      if (node.nodeType == node.ELEMENT_NODE)
      {
        if (node.hasAttribute("id"))
          node.setAttribute("id", node.getAttribute("id").replace(/\d+$/, newId));

        for (let i = 0, len = node.childNodes.length; i < len; i++)
          fixId(node.childNodes[i], newId);
      }
      return node;
    }
    E("viewMenu").appendChild(fixId(E("filters-view-menu1").cloneNode(true), "2"));
  },

  /**
   * <tree> element containing the filters.
   * @type XULElement
   */
  get treeElement() E("filtersTree"),

  /**
   * Tests whether the tree is currently visible.
   */
  get visible()
  {
    return !this.treeElement.parentNode.collapsed;
  },

  /**
   * Tests whether the tree is currently focused.
   * @type Boolean
   */
  get focused()
  {
    let focused = document.commandDispatcher.focusedElement;
    while (focused)
    {
      if ("treeBoxObject" in focused && focused.treeBoxObject == FilterView.boxObject)
        return true;
      focused = focused.parentNode;
    }
    return false;
  },

  /**
   * Updates visible filter commands whenever the selected subscription changes.
   */
  updateCommands: function()
  {
    E("filters-add-command").setAttribute("disabled", !FilterView.editable);
  },

  /**
   * Called whenever filter actions menu is opened, initializes menu items.
   */
  fillActionsPopup: function()
  {
    let editable = FilterView.editable;
    let items = FilterView.selectedItems.filter(function(i) !i.filter.dummy);
    items.sort(function(entry1, entry2) entry1.index - entry2.index);
    let activeItems = items.filter(function(i) i.filter instanceof ActiveFilter);

    E("filters-edit-command").setAttribute("disabled", !editable || !items.length);
    E("filters-delete-command").setAttribute("disabled", !editable || !items.length);
    E("filters-resetHitCounts-command").setAttribute("disabled", !activeItems.length);
    E("filters-moveUp-command").setAttribute("disabled", !editable || FilterView.isSorted() || !items.length || items[0].index == 0);
    E("filters-moveDown-command").setAttribute("disabled", !editable || FilterView.isSorted() || !items.length || items[items.length - 1].index == FilterView.rowCount - 1);
    E("filters-copy-command").setAttribute("disabled", !items.length);
    E("filters-cut-command").setAttribute("disabled", !editable || !items.length);
    E("filters-paste-command").setAttribute("disabled", !editable || !Utils.clipboard.hasDataMatchingFlavors(["text/unicode"], 1, Utils.clipboard.kGlobalClipboard));
  },

  /**
   * Changes sort current order for the tree. Sorts by filter column if the list is unsorted.
   * @param {String} order  either "ascending" or "descending"
   */
  setSortOrder: function(sortOrder)
  {
    let col = (FilterView.sortColumn ? FilterView.sortColumn.id : "col-filter");
    FilterView.sortBy(col, sortOrder);
  },

  /**
   * Toggles the visibility of a tree column.
   */
  toggleColumn: function(/**String*/ id)
  {
    let col = E(id);
    col.setAttribute("hidden", col.hidden ? "false" : "true");
  },

  /**
   * Enables or disables all filters in the current selection.
   */
  selectionToggleDisabled: function()
  {
    if (this.treeElement.editingColumn)
      return;

    let items = FilterView.selectedItems.filter(function(i) i.filter instanceof ActiveFilter);
    if (items.length)
    {
      FilterView.boxObject.beginUpdateBatch();
      let newValue = !items[0].filter.disabled;
      for (let i = 0; i < items.length; i++)
        items[i].filter.disabled = newValue;
      FilterView.boxObject.endUpdateBatch();
    }
  },

  /**
   * Selects all entries in the list.
   */
  selectAll: function()
  {
    if (this.treeElement.editingColumn)
      return;

    FilterView.selection.selectAll();
    this.treeElement.focus();
  },

  /**
   * Starts editing the current filter.
   */
  startEditing: function()
  {
    if (this.treeElement.editingColumn)
      return;

    this.treeElement.startEditing(FilterView.selection.currentIndex, FilterView.boxObject.columns.getNamedColumn("col-filter"));
  },

  /**
   * Starts editing a new filter at the current position.
   */
  insertFilter: function()
  {
    if (!FilterView.editable || this.treeElement.editingColumn)
      return;

    FilterView.insertEditDummy();
    this.startEditing();

    let tree = this.treeElement;
    let listener = function(event)
    {
      if (event.attrName == "editing" && tree.editingRow < 0)
      {
        tree.removeEventListener("DOMAttrModified", listener, false);
        FilterView.removeEditDummy();
      }
    }
    tree.addEventListener("DOMAttrModified", listener, false);
  },

  /**
   * Deletes items from the list.
   */
  deleteItems: function(/**Array*/ items)
  {
    let oldIndex = FilterView.selection.currentIndex;
    items.sort(function(entry1, entry2) entry2.index - entry1.index);

    for (let i = 0; i < items.length; i++)
      FilterStorage.removeFilter(items[i].filter, FilterView._subscription, items[i].index);

    FilterView.selectRow(oldIndex);
  },

  /**
   * Deletes selected filters.
   */
  deleteSelected: function()
  {
    if (!FilterView.editable || this.treeElement.editingColumn)
      return;

    let items = FilterView.selectedItems;
    if (items.length == 0 || (items.length >= 2 && !Utils.confirm(window, this.treeElement.getAttribute("_removewarning"))))
      return;

    this.deleteItems(items)
  },

  /**
   * Resets hit counts of the selected filters.
   */
  resetHitCounts: function()
  {
    if (this.treeElement.editingColumn)
      return;

    let items = FilterView.selectedItems.filter(function(i) i.filter instanceof ActiveFilter);
    if (items.length)
      FilterStorage.resetHitCounts(items.map(function(i) i.filter));
  },

  /**
   * Moves items to a different position in the list.
   * @param {Array} items
   * @param {Integer} offset  negative offsets move the items up, positive down
   */
  _moveItems: function(/**Array*/ items, /**Integer*/ offset)
  {
    if (!items.length)
      return;

    if (offset < 0)
    {
      items.sort(function(entry1, entry2) entry1.index - entry2.index);
      let position = items[0].index + offset;
      if (position < 0)
        return;

      for (let i = 0; i < items.length; i++)
        FilterStorage.moveFilter(items[i].filter, FilterView._subscription, items[i].index, position++);
      FilterView.selection.rangedSelect(position - items.length, position - 1, false);
    }
    else if (offset > 0)
    {
      items.sort(function(entry1, entry2) entry2.index - entry1.index);
      let position = items[0].index + offset;
      if (position >= FilterView.rowCount)
        return;

      for (let i = 0; i < items.length; i++)
        FilterStorage.moveFilter(items[i].filter, FilterView._subscription, items[i].index, position--);
      FilterView.selection.rangedSelect(position + 1, position + items.length, false);
    }
  },

  /**
   * Moves selected filters one line up.
   */
  moveUp: function()
  {
    if (!FilterView.editable || FilterView.isEmpty || FilterView.isSorted() || this.treeElement.editingColumn)
      return;

    this._moveItems(FilterView.selectedItems, -1);
  },

  /**
   * Moves selected filters one line down.
   */
  moveDown: function()
  {
    if (!FilterView.editable || FilterView.isEmpty || FilterView.isSorted() || this.treeElement.editingColumn)
      return;

    this._moveItems(FilterView.selectedItems, 1);
  },

  /**
   * Fills the context menu of the filters columns.
   */
  fillColumnPopup: function(/**Element*/ element)
  {
    let suffix = element.id.match(/\d+$/)[0] || "1";

    E("filters-view-filter" + suffix).setAttribute("checked", !E("col-filter").hidden);
    E("filters-view-slow" + suffix).setAttribute("checked", !E("col-slow").hidden);
    E("filters-view-enabled" + suffix).setAttribute("checked", !E("col-enabled").hidden);
    E("filters-view-hitcount" + suffix).setAttribute("checked", !E("col-hitcount").hidden);
    E("filters-view-lasthit" + suffix).setAttribute("checked", !E("col-lasthit").hidden);

    let sortColumn = FilterView.sortColumn;
    let sortColumnID = (sortColumn ? sortColumn.id : null);
    let sortDir = (sortColumn ? sortColumn.getAttribute("sortDirection") : "natural");
    E("filters-sort-none" + suffix).setAttribute("checked", sortColumn == null);
    E("filters-sort-filter" + suffix).setAttribute("checked", sortColumnID == "col-filter");
    E("filters-sort-enabled" + suffix).setAttribute("checked", sortColumnID == "col-enabled");
    E("filters-sort-hitcount" + suffix).setAttribute("checked", sortColumnID == "col-hitcount");
    E("filters-sort-lasthit" + suffix).setAttribute("checked", sortColumnID == "col-lasthit");
    E("filters-sort-asc" + suffix).setAttribute("checked", sortDir == "ascending");
    E("filters-sort-desc" + suffix).setAttribute("checked", sortDir == "descending");
  },

  /**
   * Fills tooltip with the item data.
   */
  fillTooltip: function(event)
  {
    let item = FilterView.getItemAt(event.clientX, event.clientY);
    if (!item || item.filter.dummy)
    {
      event.preventDefault();
      return;
    }

    function setMultilineContent(box, text)
    {
      while (box.firstChild)
        box.removeChild(box.firstChild);

      for (var i = 0; i < text.length; i += 80)
      {
        var description = document.createElement("description");
        description.setAttribute("value", text.substr(i, 80));
        box.appendChild(description);
      }
    }

    setMultilineContent(E("tooltip-filter"), item.filter.text);

    E("tooltip-hitcount-row").hidden = !(item.filter instanceof ActiveFilter);
    E("tooltip-lasthit-row").hidden = !(item.filter instanceof ActiveFilter) || !item.filter.lastHit;
    if (item.filter instanceof ActiveFilter)
    {
      E("tooltip-hitcount").setAttribute("value", item.filter.hitCount)
      E("tooltip-lasthit").setAttribute("value", Utils.formatTime(item.filter.lastHit))
    }

    E("tooltip-additional").hidden = false;
    if (item.filter instanceof InvalidFilter && item.filter.reason)
      E("tooltip-additional").textContent = item.filter.reason;
    else if (item.filter instanceof RegExpFilter && defaultMatcher.isSlowFilter(item.filter))
      E("tooltip-additional").textContent = Utils.getString("filter_regexp_tooltip");
    else
      E("tooltip-additional").hidden = true;
  },

  /**
   * Called whenever a key is pressed on the list.
   */
  keyPress: function(/**Event*/ event)
  {
    if (event.target != E("filtersTree"))
      return;

    let modifiers = 0;
    if (event.altKey)
      modifiers |= SubscriptionActions._altMask;
    if (event.ctrlKey)
      modifiers |= SubscriptionActions._ctrlMask;
    if (event.metaKey)
      modifiers |= SubscriptionActions._metaMask;

    if (event.charCode == " ".charCodeAt(0) && modifiers == 0 && !E("col-enabled").hidden)
      this.selectionToggleDisabled();
    else if (event.keyCode == Ci.nsIDOMKeyEvent.DOM_VK_UP && modifiers == SubscriptionActions._accelMask)
    {
      E("filters-moveUp-command").doCommand();
      event.preventDefault();
      event.stopPropagation();
    }
    else if (event.keyCode == Ci.nsIDOMKeyEvent.DOM_VK_DOWN && modifiers == SubscriptionActions._accelMask)
    {
      E("filters-moveDown-command").doCommand();
      event.preventDefault();
      event.stopPropagation();
    }
  },

  /**
   * Copies selected items to clipboard and optionally removes them from the
   * list after that.
   */
  copySelected: function(/**Boolean*/ keep)
  {
    let items = FilterView.selectedItems;
    if (!items.length)
      return;

    items.sort(function(entry1, entry2) entry1.index - entry2.index);
    let text = items.map(function(i) i.filter.text).join(IO.lineBreak);
    Utils.clipboardHelper.copyString(text);

    if (!keep && FilterView.editable && !this.treeElement.editingColumn)
      this.deleteItems(items);
  },

  /**
   * Pastes text from clipboard as filters at the current position.
   */
  paste: function()
  {
    if (!FilterView.editable || this.treeElement.editingColumn)
      return;

    let transferable = Cc["@mozilla.org/widget/transferable;1"].createInstance(Ci.nsITransferable);
    transferable.addDataFlavor("text/unicode");

    let data;
    try
    {
      data = {};
      Utils.clipboard.getData(transferable, Utils.clipboard.kGlobalClipboard);
      transferable.getTransferData("text/unicode", data, {});
      data = data.value.QueryInterface(Ci.nsISupportsString).data;
    }
    catch (e) {
      return;
    }

    let item = FilterView.currentItem;
    let position = (item ? item.index : FilterView.data.length);

    let lines = data.replace(/\r/g, "").split("\n");
    for (let i = 0; i < lines.length; i++)
    {
      let line = Filter.normalize(lines[i]);
      if (line)
      {
        let filter = Filter.fromText(line);
        FilterStorage.addFilter(filter, FilterView._subscription, position++);
      }
    }
  },

  dragItems: null,

  /**
   * Called whenever the user starts a drag operation.
   */
  startDrag: function(/**Event*/ event)
  {
    let items = FilterView.selectedItems;
    if (!items.length)
      return;

    items.sort(function(entry1, entry2) entry1.index - entry2.index);
    event.dataTransfer.setData("text/plain", items.map(function(i) i.filter.text).join(IO.lineBreak));
    this.dragItems = items;
    event.stopPropagation();
  },

  /**
   * Called to check whether moving the items to the given position is possible.
   */
  canDrop: function(/**Integer*/ newPosition, /**nsIDOMDataTransfer*/ dataTransfer)
  {
    if (!FilterView.editable || this.treeElement.editingColumn)
      return false;

    // If we aren't dragging items then maybe we got filters as plain text
    if (!this.dragItems)
      return dataTransfer && dataTransfer.getData("text/plain");

    if (FilterView.isEmpty || FilterView.isSorted())
      return false;

    if (newPosition < this.dragItems[0].index)
      return true;
    else if (newPosition > this.dragItems[this.dragItems.length - 1].index + 1)
      return true;
    else
      return false;
  },

  /**
   * Called when the user decides to drop the items.
   */
  drop: function(/**Integer*/ newPosition, /**nsIDOMDataTransfer*/ dataTransfer)
  {
    if (!FilterView.editable || this.treeElement.editingColumn)
      return;

    if (!this.dragItems)
    {
      // We got filters as plain text, insert them into the list
      let data = (dataTransfer ? dataTransfer.getData("text/plain") : null);
      if (data)
      {
        let lines = data.replace(/\r/g, "").split("\n");
        for (let i = 0; i < lines.length; i++)
        {
          let line = Filter.normalize(lines[i]);
          if (line)
          {
            let filter = Filter.fromText(line);
            FilterStorage.addFilter(filter, FilterView._subscription, newPosition++);
          }
        }
      }
      return;
    }

    if (FilterView.isEmpty || FilterView.isSorted())
      return;

    if (newPosition < this.dragItems[0].index)
      this._moveItems(this.dragItems, newPosition - this.dragItems[0].index);
    else if (newPosition > this.dragItems[this.dragItems.length - 1].index + 1)
      this._moveItems(this.dragItems, newPosition - this.dragItems[this.dragItems.length - 1].index - 1);
  },

  /**
   * Called whenever the a drag operation finishes.
   */
  endDrag: function(/**Event*/ event)
  {
    this.dragItems = null;
  },

  /**
   * Called if filters have been dragged into a subscription and need to be removed.
   */
  removeDraggedFilters: function()
  {
    if (!this.dragItems)
      return;

    this.deleteItems(this.dragItems);
  }
};

window.addEventListener("load", function()
{
  FilterActions.init();
}, false);
