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

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

/**
 * nsITreeView implementation to display filters of a particular filter
 * subscription.
 * @class
 */
var FilterView =
{
  /**
   * Initialization function.
   */
  init: function()
  {
    if (this.sortProcs)
      return;

    function compareText(/**Filter*/ filter1, /**Filter*/ filter2)
    {
      if (filter1.text < filter2.text)
        return -1;
      else if (filter1.text > filter2.text)
        return 1;
      else
        return 0;
    }
    function compareSlow(/**Filter*/ filter1, /**Filter*/ filter2)
    {
      let isSlow1 = filter1 instanceof RegExpFilter && defaultMatcher.isSlowFilter(filter1);
      let isSlow2 = filter2 instanceof RegExpFilter && defaultMatcher.isSlowFilter(filter2);
      return isSlow1 - isSlow2;
    }
    function compareEnabled(/**Filter*/ filter1, /**Filter*/ filter2)
    {
      let hasEnabled1 = (filter1 instanceof ActiveFilter ? 1 : 0);
      let hasEnabled2 = (filter2 instanceof ActiveFilter ? 1 : 0);
      if (hasEnabled1 != hasEnabled2)
        return hasEnabled1 - hasEnabled2;
      else if (hasEnabled1)
        return (filter2.disabled - filter1.disabled);
      else
        return 0;
    }
    function compareHitCount(/**Filter*/ filter1, /**Filter*/ filter2)
    {
      let hasHitCount1 = (filter1 instanceof ActiveFilter ? 1 : 0);
      let hasHitCount2 = (filter2 instanceof ActiveFilter ? 1 : 0);
      if (hasHitCount1 != hasHitCount2)
        return hasHitCount1 - hasHitCount2;
      else if (hasHitCount1)
        return filter1.hitCount - filter2.hitCount;
      else
        return 0;
    }
    function compareLastHit(/**Filter*/ filter1, /**Filter*/ filter2)
    {
      let hasLastHit1 = (filter1 instanceof ActiveFilter ? 1 : 0);
      let hasLastHit2 = (filter2 instanceof ActiveFilter ? 1 : 0);
      if (hasLastHit1 != hasLastHit2)
        return hasLastHit1 - hasLastHit2;
      else if (hasLastHit1)
        return filter1.lastHit - filter2.lastHit;
      else
        return 0;
    }

    /**
     * Creates a sort function from a primary and a secondary comparison function.
     * @param {Function} cmpFunc  comparison function to be called first
     * @param {Function} fallbackFunc  (optional) comparison function to be called if primary function returns 0
     * @param {Boolean} desc  if true, the result of the primary function (not the secondary function) will be reversed - sorting in descending order
     * @result {Function} comparison function to be used
     */
    function createSortFunction(cmpFunc, fallbackFunc, desc)
    {
      let factor = (desc ? -1 : 1);

      return function(entry1, entry2)
      {
        // Comment replacements not bound to a filter always go last
        let isLast1 = ("origFilter" in entry1 && entry1.filter == null);
        let isLast2 = ("origFilter" in entry2 && entry2.filter == null);
        if (isLast1)
          return (isLast2 ? 0 : 1)
        else if (isLast2)
          return -1;

        let ret = cmpFunc(entry1.filter, entry2.filter);
        if (ret == 0 && fallbackFunc)
          return fallbackFunc(entry1.filter, entry2.filter);
        else
          return factor * ret;
      }
    }

    this.sortProcs = {
      filter: createSortFunction(compareText, null, false),
      filterDesc: createSortFunction(compareText, null, true),
      slow: createSortFunction(compareSlow, compareText, true),
      slowDesc: createSortFunction(compareSlow, compareText, false),
      enabled: createSortFunction(compareEnabled, compareText, false),
      enabledDesc: createSortFunction(compareEnabled, compareText, true),
      hitcount: createSortFunction(compareHitCount, compareText, false),
      hitcountDesc: createSortFunction(compareHitCount, compareText, true),
      lasthit: createSortFunction(compareLastHit, compareText, false),
      lasthitDesc: createSortFunction(compareLastHit, compareText, true)
    };

    let me = this;
    let proxy = function()
    {
      return me._onChange.apply(me, arguments);
    };
    FilterNotifier.addListener(proxy);
    window.addEventListener("unload", function()
    {
      FilterNotifier.removeListener(proxy);
    }, false);
  },

  /**
   * Filter change processing.
   * @see FilterNotifier.addListener()
   */
  _onChange: function(action, item, param1, param2, param3)
  {
    switch (action)
    {
      case "subscription.updated":
      {
        if (item == this._subscription)
          this.refresh(true);
        break;
      }
      case "filter.disabled":
      case "filter.hitCount":
      case "filter.lastHit":
      {
        this.updateFilter(item);
        break;
      }
      case "filter.added":
      {
        let subscription = param1;
        let position = param2;
        if (subscription == this._subscription)
          this.addFilterAt(position, item);
        break;
      }
      case "filter.removed":
      {
        let subscription = param1;
        let position = param2;
        if (subscription == this._subscription)
          this.removeFilterAt(position);
        break;
      }
      case "filter.moved":
      {
        let subscription = param1;
        let oldPosition = param2;
        let newPosition = param3;
        if (subscription == this._subscription)
          this.moveFilterAt(oldPosition, newPosition);
        break;
      }
    }
  },

  /**
   * Box object of the tree that this view is attached to.
   * @type nsITreeBoxObject
   */
  boxObject: null,

  /**
   * Map of used cell properties to the corresponding nsIAtom representations.
   */
  atoms: null,

  /**
   * "Filter" to be displayed if no filter group is selected.
   */
  noGroupDummy: null,

  /**
   * "Filter" to be displayed if the selected group is empty.
   */
  noFiltersDummy: null,

  /**
   * "Filter" to be displayed for a new filter being edited.
   */
  editDummy: null,

  /**
   * Displayed list of filters, might be sorted.
   * @type Filter[]
   */
  data: [],

  /**
   * <tree> element that the view is attached to.
   * @type XULElement
   */
  get treeElement() this.boxObject ? this.boxObject.treeBody.parentNode : null,

  /**
   * Checks whether the list is currently empty (regardless of dummy entries).
   * @type Boolean
   */
  get isEmpty()
  {
    return !this._subscription || !this._subscription.filters.length;
  },

  /**
   * Checks whether the filters in the view can be changed.
   * @type Boolean
   */
  get editable()
  {
    return (FilterView._subscription instanceof SpecialSubscription);
  },

  /**
   * Returns current item of the list.
   * @type Object
   */
  get currentItem()
  {
    let index = this.selection.currentIndex;
    if (index >= 0 && index < this.data.length)
      return this.data[index];
    return null;
  },

  /**
   * Returns items that are currently selected in the list.
   * @type Object[]
   */
  get selectedItems()
  {
    let items = []
    for (let i = 0; i < this.selection.getRangeCount(); i++)
    {
      let min = {};
      let max = {};
      this.selection.getRangeAt(i, min, max);
      for (let j = min.value; j <= max.value; j++)
        if (j >= 0 && j < this.data.length)
          items.push(this.data[j]);
    }
    return items;
  },

  getItemAt: function(x, y)
  {
    let row = this.boxObject.getRowAt(x, y);
    if (row >= 0 && row < this.data.length)
      return this.data[row];
    else
      return null;
  },

  _subscription: 0,

  /**
   * Filter subscription being displayed.
   * @type Subscription
   */
  get subscription() this._subscription,
  set subscription(value)
  {
    if (value == this._subscription)
      return;

    // Make sure the editor is done before we update the list.
    if (this.treeElement)
      this.treeElement.stopEditing(true);

    this._subscription = value;
    this.refresh(true);
  },

  /**
   * Will be true if updates are outstanding because the list was hidden.
   */
  _dirty: false,

  /**
   * Updates internal view data after a change.
   * @param {Boolean} force  if false, a refresh will only happen if previous
   *                         changes were suppressed because the list was hidden
   */
  refresh: function(force)
  {
    if (FilterActions.visible)
    {
      if (!force && !this._dirty)
        return;
      this._dirty = false;
      this.updateData();
      this.selectRow(0);
    }
    else
      this._dirty = true;
  },

  /**
   * Map of comparison functions by column ID  or column ID + "Desc" for
   * descending sort order.
   * @const
   */
  sortProcs: null,

  /**
   * Column that the list is currently sorted on.
   * @type Element
   */
  sortColumn: null,

  /**
   * Sorting function currently in use.
   * @type Function
   */
  sortProc: null,

  /**
   * Resorts the list.
   * @param {String} col ID of the column to sort on. If null, the natural order is restored.
   * @param {String} direction "ascending" or "descending", if null the sort order is toggled.
   */
  sortBy: function(col, direction)
  {
    let newSortColumn = null;
    if (col)
    {
      newSortColumn = this.boxObject.columns.getNamedColumn(col).element;
      if (!direction)
      {
        if (this.sortColumn == newSortColumn)
          direction = (newSortColumn.getAttribute("sortDirection") == "ascending" ? "descending" : "ascending");
        else
          direction = "ascending";
      }
    }

    if (this.sortColumn && this.sortColumn != newSortColumn)
      this.sortColumn.removeAttribute("sortDirection");

    this.sortColumn = newSortColumn;
    if (this.sortColumn)
    {
      this.sortColumn.setAttribute("sortDirection", direction);
      this.sortProc = this.sortProcs[col.replace(/^col-/, "") + (direction == "descending" ? "Desc" : "")];
    }
    else
      this.sortProc = null;

    if (this.data.length > 1)
    {
      this.updateData();
      this.boxObject.invalidate();
    }
  },

  /**
   * Inserts dummy entry into the list if necessary.
   */
  addDummyRow: function()
  {
    if (this.boxObject && this.data.length == 0)
    {
      if (this._subscription)
        this.data.splice(0, 0, this.noFiltersDummy);
      else
        this.data.splice(0, 0, this.noGroupDummy);
      this.boxObject.rowCountChanged(0, 1);
    }
  },

  /**
   * Removes dummy entry from the list if present.
   */
  removeDummyRow: function()
  {
    if (this.boxObject && this.isEmpty && this.data.length)
    {
      this.data.splice(0, 1);
      this.boxObject.rowCountChanged(0, -1);
    }
  },

  /**
   * Inserts dummy row when a new filter is being edited.
   */
  insertEditDummy: function()
  {
    FilterView.removeDummyRow();
    let position = this.selection.currentIndex;
    if (position >= this.data.length)
      position = this.data.length - 1;
    if (position < 0)
      position = 0;

    this.editDummy.index = (position < this.data.length ? this.data[position].index : this.data.length);
    this.editDummy.position = position;
    this.data.splice(position, 0, this.editDummy);
    this.boxObject.rowCountChanged(position, 1);
    this.selectRow(position);
  },

  /**
   * Removes dummy row once the edit is finished.
   */
  removeEditDummy: function()
  {
    let position = this.editDummy.position;
    if (typeof position != "undefined" && position < this.data.length && this.data[position] == this.editDummy)
    {
      this.data.splice(position, 1);
      this.boxObject.rowCountChanged(position, -1);
      FilterView.addDummyRow();

      this.selectRow(position);
    }
  },

  /**
   * Selects a row in the tree and makes sure it is visible.
   */
  selectRow: function(row)
  {
    if (this.selection)
    {
      row = Math.min(Math.max(row, 0), this.data.length - 1);
      this.selection.select(row);
      this.boxObject.ensureRowIsVisible(row);
    }
  },

  /**
   * Finds a particular filter in the list and selects it.
   */
  selectFilter: function(/**Filter*/ filter)
  {
    let index = -1;
    for (let i = 0; i < this.data.length; i++)
    {
      if (this.data[i].filter == filter)
      {
        index = i;
        break;
      }
    }
    if (index >= 0)
    {
      this.selectRow(index);
      this.treeElement.focus();
    }
  },

  /**
   * Updates value of data property on sorting or filter subscription changes.
   */
  updateData: function()
  {
    let oldCount = this.rowCount;
    if (this._subscription && this._subscription.filters.length)
    {
      this.data = this._subscription.filters.map(function(f, i) ({index: i, filter: f}));
      if (this.sortProc)
      {
        // Hide comments in the list, they should be sorted like the filter following them
        let followingFilter = null;
        for (let i = this.data.length - 1; i >= 0; i--)
        {
          if (this.data[i].filter instanceof CommentFilter)
          {
            this.data[i].origFilter = this.data[i].filter;
            this.data[i].filter = followingFilter;
          }
          else
            followingFilter = this.data[i].filter;
        }

        this.data.sort(this.sortProc);

        // Restore comments
        for (let i = 0; i < this.data.length; i++)
        {
          if ("origFilter" in this.data[i])
          {
            this.data[i].filter = this.data[i].origFilter;
            delete this.data[i].origFilter;
          }
        }
      }
    }
    else
      this.data = [];

    if (this.boxObject)
    {
      this.boxObject.rowCountChanged(0, -oldCount);
      this.boxObject.rowCountChanged(0, this.rowCount);
    }

    this.addDummyRow();
  },

  /**
   * Called to update the view when a filter property is changed.
   */
  updateFilter: function(/**Filter*/ filter)
  {
    for (let i = 0; i < this.data.length; i++)
      if (this.data[i].filter == filter)
        this.boxObject.invalidateRow(i);
  },

  /**
   * Called if a filter has been inserted at the specified position.
   */
  addFilterAt: function(/**Integer*/ position, /**Filter*/ filter)
  {
    if (this.data.length == 1 && this.data[0].filter.dummy)
    {
      this.data.splice(0, 1);
      this.boxObject.rowCountChanged(0, -1);
    }

    if (this.sortProc)
    {
      this.updateData();
      for (let i = 0; i < this.data.length; i++)
      {
        if (this.data[i].index == position)
        {
          position = i;
          break;
        }
      }
    }
    else
    {
      for (let i = 0; i < this.data.length; i++)
        if (this.data[i].index >= position)
          this.data[i].index++;
      this.data.splice(position, 0, {index: position, filter: filter});
    }
    this.boxObject.rowCountChanged(position, 1);
    this.selectRow(position);
  },

  /**
   * Called if a filter has been removed at the specified position.
   */
  removeFilterAt: function(/**Integer*/ position)
  {
    for (let i = 0; i < this.data.length; i++)
    {
      if (this.data[i].index == position)
      {
        this.data.splice(i, 1);
        this.boxObject.rowCountChanged(i, -1);
        i--;
      }
      else if (this.data[i].index > position)
        this.data[i].index--;
    }
    this.addDummyRow();
  },

  /**
   * Called if a filter has been moved within the list.
   */
  moveFilterAt: function(/**Integer*/ oldPosition, /**Integer*/ newPosition)
  {
    let dir = (oldPosition < newPosition ? 1 : -1);
    for (let i = 0; i < this.data.length; i++)
    {
      if (this.data[i].index == oldPosition)
        this.data[i].index = newPosition;
      else if (dir * this.data[i].index > dir * oldPosition && dir * this.data[i].index <= dir * newPosition)
        this.data[i].index -= dir;
    }

    if (!this.sortProc)
    {
      let item = this.data[oldPosition];
      this.data.splice(oldPosition, 1);
      this.data.splice(newPosition, 0, item);
      this.boxObject.invalidateRange(Math.min(oldPosition, newPosition), Math.max(oldPosition, newPosition));
    }
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsITreeView]),

  setTree: function(boxObject)
  {
    this.init();
    this.boxObject = boxObject;

    if (this.boxObject)
    {
      this.noGroupDummy = {index: 0, filter: {text: this.boxObject.treeBody.getAttribute("noGroupText"), dummy: true}};
      this.noFiltersDummy = {index: 0, filter: {text: this.boxObject.treeBody.getAttribute("noFiltersText"), dummy: true}};
      this.editDummy = {filter: {text: ""}};

      let atomService = Cc["@mozilla.org/atom-service;1"].getService(Ci.nsIAtomService);
      let stringAtoms = ["col-filter", "col-enabled", "col-hitcount", "col-lasthit", "type-comment", "type-filterlist", "type-whitelist", "type-elemhide", "type-elemhideexception", "type-invalid"];
      let boolAtoms = ["selected", "dummy", "slow", "disabled"];

      this.atoms = {};
      for each (let atom in stringAtoms)
        this.atoms[atom] = atomService.getAtom(atom);
      for each (let atom in boolAtoms)
      {
        this.atoms[atom + "-true"] = atomService.getAtom(atom + "-true");
        this.atoms[atom + "-false"] = atomService.getAtom(atom + "-false");
      }

      let columns = this.boxObject.columns;
      for (let i = 0; i < columns.length; i++)
        if (columns[i].element.hasAttribute("sortDirection"))
          this.sortBy(columns[i].id, columns[i].element.getAttribute("sortDirection"));

      this.refresh(true);
    }
  },

  selection: null,

  get rowCount() this.data.length,

  getCellText: function(row, col)
  {
    if (row < 0 || row >= this.data.length)
      return null;

    col = col.id;
    if (col != "col-filter" && col != "col-slow" && col != "col-hitcount" && col != "col-lasthit")
      return null;

    let filter = this.data[row].filter;
    if (col == "col-filter")
      return filter.text;
    else if (col == "col-slow")
      return (filter instanceof RegExpFilter && defaultMatcher.isSlowFilter(filter) ? "!" : null);
    else if (filter instanceof ActiveFilter)
    {
      if (col == "col-hitcount")
        return filter.hitCount;
      else if (col == "col-lasthit")
        return (filter.lastHit ? Utils.formatTime(filter.lastHit) : null);
    }

    return null;
  },

  generateProperties: function(list, properties)
  {
    if (properties)
    {
      // Gecko 21 and below: we have an nsISupportsArray parameter, add atoms
      // to that.
      for (let i = 0; i < list.length; i++)
        if (list[i] in this.atoms)
          properties.AppendElement(this.atoms[list[i]]);
      return null;
    }
    else
    {
      // Gecko 22+: no parameter, just return a string
      return list.join(" ");
    }
  },

  getColumnProperties: function(col, properties)
  {
    return this.generateProperties(["col-" + col.id], properties);
  },

  getRowProperties: function(row, properties)
  {
    if (row < 0 || row >= this.data.length)
      return "";

    let list = [];
    let filter = this.data[row].filter;
    list.push("selected-" + this.selection.isSelected(row));
    list.push("slow-" + (filter instanceof RegExpFilter && defaultMatcher.isSlowFilter(filter)));
    if (filter instanceof ActiveFilter)
      list.push("disabled-" + filter.disabled);
    list.push("dummy-" + ("dummy" in filter));

    if (filter instanceof CommentFilter)
      list.push("type-comment");
    else if (filter instanceof BlockingFilter)
      list.push("type-filterlist");
    else if (filter instanceof WhitelistFilter)
      list.push("type-whitelist");
    else if (filter instanceof ElemHideFilter)
      list.push("type-elemhide");
    else if (filter instanceof ElemHideException)
      list.push("type-elemhideexception");
    else if (filter instanceof InvalidFilter)
      list.push("type-invalid");

    return this.generateProperties(list, properties);
  },

  getCellProperties: function(row, col, properties)
  {
    return this.getRowProperties(row, properties) + " " + this.getColumnProperties(col, properties);
  },

  cycleHeader: function(col)
  {
    let oldDirection = col.element.getAttribute("sortDirection");
    if (oldDirection == "ascending")
      this.sortBy(col.id, "descending");
    else if (oldDirection == "descending")
      this.sortBy(null, null);
    else
      this.sortBy(col.id, "ascending");
  },

  isSorted: function()
  {
    return (this.sortProc != null);
  },

  canDrop: function(row, orientation, dataTransfer)
  {
    if (orientation == Ci.nsITreeView.DROP_ON || row < 0 || row >= this.data.length || !this.editable)
      return false;

    let item = this.data[row];
    let position = (orientation == Ci.nsITreeView.DROP_BEFORE ? item.index : item.index + 1);
    return FilterActions.canDrop(position, dataTransfer);
  },

  drop: function(row, orientation, dataTransfer)
  {
    if (orientation == Ci.nsITreeView.DROP_ON || row < 0 || row >= this.data.length || !this.editable)
      return;

    let item = this.data[row];
    let position = (orientation == Ci.nsITreeView.DROP_BEFORE ? item.index : item.index + 1);
    FilterActions.drop(position, dataTransfer);
  },

  isEditable: function(row, col)
  {
    if (row < 0 || row >= this.data.length || !this.editable)
      return false;

    let filter = this.data[row].filter;
    if (col.id == "col-filter")
      return !("dummy" in filter);
    else
      return false;
  },

  setCellText: function(row, col, value)
  {
    if (row < 0 || row >= this.data.length || col.id != "col-filter")
      return;

    let oldFilter = this.data[row].filter;
    let position = this.data[row].index;
    value = Filter.normalize(value);
    if (!value || value == oldFilter.text)
      return;

    // Make sure we don't get called recursively (see https://adblockplus.org/forum/viewtopic.php?t=9003)
    this.treeElement.stopEditing();

    let newFilter = Filter.fromText(value);
    if (this.data[row] == this.editDummy)
      this.removeEditDummy();
    else
      FilterStorage.removeFilter(oldFilter, this._subscription, position);
    FilterStorage.addFilter(newFilter, this._subscription, position);
  },

  cycleCell: function(row, col)
  {
    if (row < 0 || row >= this.data.length || col.id != "col-enabled")
      return;

    let filter = this.data[row].filter;
    if (filter instanceof ActiveFilter)
      filter.disabled = !filter.disabled;
  },

  isContainer: function(row) false,
  isContainerOpen: function(row) false,
  isContainerEmpty: function(row) true,
  getLevel: function(row) 0,
  getParentIndex: function(row) -1,
  hasNextSibling: function(row, afterRow) false,
  toggleOpenState: function(row) {},
  getProgressMode: function() null,
  getImageSrc: function() null,
  isSeparator: function() false,
  performAction: function() {},
  performActionOnRow: function() {},
  performActionOnCell: function() {},
  getCellValue: function() null,
  setCellValue: function() {},
  selectionChanged: function() {},
};
