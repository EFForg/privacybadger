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
 * Fills a list of filter groups and keeps it updated.
 * @param {Element} list  richlistbox element to be filled
 * @param {Node} template  template to use for the groups
 * @param {Function} filter  filter to decide which lists should be included
 * @param {Function} listener  function to be called on changes
 * @constructor
 */
function ListManager(list, template, filter, listener)
{
  this._list = list;
  this._template = template;
  this._filter = filter;
  this._listener = listener || function(){};

  this._deck = this._list.parentNode;

  this._list.listManager = this;
  this.reload();

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
}
ListManager.prototype =
{
  /**
   * List element being managed.
   * @type Element
   */
  _list: null,
  /**
   * Template used for the groups.
   * @type Node
   */
  _template: null,
  /**
   * Filter function to decide which subscriptions should be included.
   * @type Function
   */
  _filter: null,
  /**
   * Function to be called whenever list contents change.
   * @type Function
   */
  _listener: null,
  /**
   * Deck switching between list display and "no entries" message.
   * @type Element
   */
  _deck: null,

  /**
   * Completely rebuilds the list.
   */
  reload: function()
  {
    // Remove existing entries if any
    while (this._list.firstChild)
      this._list.removeChild(this._list.firstChild);

    // Now add all subscriptions
    let subscriptions = FilterStorage.subscriptions.filter(this._filter, this);
    if (subscriptions.length)
    {
      for each (let subscription in subscriptions)
        this.addSubscription(subscription, null);

      // Make sure first list item is selected after list initialization
      Utils.runAsync(function()
      {
        this._list.selectItem(this._list.getItemAtIndex(this._list.getIndexOfFirstVisibleRow()));
      }, this);
    }

    this._deck.selectedIndex = (subscriptions.length ? 1 : 0);
    this._listener();
  },

  /**
   * Adds a filter subscription to the list.
   */
  addSubscription: function(/**Subscription*/ subscription, /**Node*/ insertBefore) /**Node*/
  {
    let disabledFilters = 0;
    for (let i = 0, l = subscription.filters.length; i < l; i++)
      if (subscription.filters[i] instanceof ActiveFilter && subscription.filters[i].disabled)
        disabledFilters++;

    let node = Templater.process(this._template, {
      __proto__: null,
      subscription: subscription,
      isExternal: subscription instanceof ExternalSubscription,
      downloading: Synchronizer.isExecuting(subscription.url),
      disabledFilters: disabledFilters
    });
    if (insertBefore)
      this._list.insertBefore(node, insertBefore);
    else
      this._list.appendChild(node);
    return node;
  },

  /**
   * Map indicating subscriptions that need their "disabledFilters" property to
   * be updated by next updateDisabled() call.
   * @type Object
   */
  _scheduledUpdateDisabled: null,

  /**
   * Updates subscriptions that had some of their filters enabled/disabled.
   */
  updateDisabled: function()
  {
    let list = this._scheduledUpdateDisabled;
    this._scheduledUpdateDisabled = null;
    for (let url in list)
    {
      let subscription = Subscription.fromURL(url);
      let subscriptionNode = Templater.getNodeForData(this._list, "subscription", subscription);
      if (subscriptionNode)
      {
        let data = Templater.getDataForNode(subscriptionNode);
        let disabledFilters = 0;
        for (let i = 0, l = subscription.filters.length; i < l; i++)
          if (subscription.filters[i] instanceof ActiveFilter && subscription.filters[i].disabled)
            disabledFilters++;

        if (disabledFilters != data.disabledFilters)
        {
          data.disabledFilters = disabledFilters;
          Templater.update(this._template, subscriptionNode);

          if (!document.commandDispatcher.focusedElement)
            this._list.focus();
        }
      }
    }
  },

  /**
   * Subscriptions change processing.
   * @see FilterNotifier.addListener()
   */
  _onChange: function(action, item, param1, param2)
  {
    if ((action == "subscription.added" || action == "subscription.removed") && item.url == Prefs.subscriptions_exceptionsurl)
      E("acceptableAds").checked = FilterStorage.subscriptions.some(function(s) s.url == Prefs.subscriptions_exceptionsurl);

    if (action == "filter.disabled")
    {
      if (this._scheduledUpdateDisabled == null)
      {
        this._scheduledUpdateDisabled = {__proto__: null};
        Utils.runAsync(this.updateDisabled, this);
      }
      for (let i = 0; i < item.subscriptions.length; i++)
        this._scheduledUpdateDisabled[item.subscriptions[i].url] = true;
      return;
    }

    if (action != "load" && !this._filter(item))
      return;

    switch (action)
    {
      case "load":
      {
        this.reload();
        break;
      }
      case "subscription.added":
      {
        let index = FilterStorage.subscriptions.indexOf(item);
        if (index >= 0)
        {
          let insertBefore = null;
          for (index++; index < FilterStorage.subscriptions.length && !insertBefore; index++)
            insertBefore = Templater.getNodeForData(this._list, "subscription", FilterStorage.subscriptions[index]);
          this.addSubscription(item, insertBefore);
          this._deck.selectedIndex = 1;
          this._listener();
        }
        break;
      }
      case "subscription.removed":
      {
        let node = Templater.getNodeForData(this._list, "subscription", item);
        if (node)
        {
          let newSelection = node.nextSibling || node.previousSibling;
          node.parentNode.removeChild(node);
          if (!this._list.firstChild)
          {
            this._deck.selectedIndex = 0;
            this._list.selectedIndex = -1;
          }
          else if (newSelection)
          {
            this._list.ensureElementIsVisible(newSelection);
            this._list.selectedItem = newSelection;
          }
          this._listener();
        }
        break
      }
      case "subscription.moved":
      {
        let node = Templater.getNodeForData(this._list, "subscription", item);
        if (node)
        {
          node.parentNode.removeChild(node);
          let insertBefore = null;
          let index = FilterStorage.subscriptions.indexOf(item);
          if (index >= 0)
            for (index++; index < FilterStorage.subscriptions.length && !insertBefore; index++)
              insertBefore = Templater.getNodeForData(this._list, "subscription", FilterStorage.subscriptions[index]);
          this._list.insertBefore(node, insertBefore);
          this._list.ensureElementIsVisible(node);
          this._listener();
        }
        break;
      }
      case "subscription.title":
      case "subscription.disabled":
      case "subscription.homepage":
      case "subscription.lastDownload":
      case "subscription.downloadStatus":
      {
        let subscriptionNode = Templater.getNodeForData(this._list, "subscription", item);
        if (subscriptionNode)
        {
          Templater.getDataForNode(subscriptionNode).downloading = Synchronizer.isExecuting(item.url);
          Templater.update(this._template, subscriptionNode);

          if (!document.commandDispatcher.focusedElement)
            this._list.focus();
          this._listener();
        }
        break;
      }
      case "subscription.fixedTitle":
      {
        SubscriptionActions.updateCommands();
        break;
      }
      case "subscription.updated":
      {
        if (this._scheduledUpdateDisabled == null)
        {
          this._scheduledUpdateDisabled = {__proto__: null};
          Utils.runAsync(this.updateDisabled, this);
        }
        this._scheduledUpdateDisabled[item.url] = true;
        break;
      }
    }
  }
};

/**
 * Attaches list managers to the lists.
 */
ListManager.init = function()
{
  new ListManager(E("subscriptions"),
                  E("subscriptionTemplate"),
                  function(s) s instanceof RegularSubscription && !(ListManager.acceptableAdsCheckbox && s.url == Prefs.subscriptions_exceptionsurl),
                  SubscriptionActions.updateCommands);
  new ListManager(E("groups"),
                  E("groupTemplate"),
                  function(s) s instanceof SpecialSubscription,
                  SubscriptionActions.updateCommands);
  E("acceptableAds").checked = FilterStorage.subscriptions.some(function(s) s.url == Prefs.subscriptions_exceptionsurl);
  E("acceptableAds").parentNode.hidden = !ListManager.acceptableAdsCheckbox;
};

/**
 * Defines whether the "acceptable ads" subscription needs special treatment.
 * @type Boolean
 */
ListManager.acceptableAdsCheckbox = Prefs.subscriptions_exceptionscheckbox;

/**
 * Adds or removes filter subscription allowing acceptable ads.
 */
ListManager.allowAcceptableAds = function(/**Boolean*/ allow)
{
  let subscription = Subscription.fromURL(Prefs.subscriptions_exceptionsurl);
  if (!subscription)
    return;

  subscription.disabled = false;
  subscription.title = "Allow non-intrusive advertising";
  if (allow)
  {
    FilterStorage.addSubscription(subscription);
    if (subscription instanceof DownloadableSubscription && !subscription.lastDownload)
      Synchronizer.execute(subscription);
  }
  else
    FilterStorage.removeSubscription(subscription);
};

window.addEventListener("load", ListManager.init, false);
