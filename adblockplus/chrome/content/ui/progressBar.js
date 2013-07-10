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

(function()
{
  let progressBar, canvas, headers, isRTL;

  function onLoad()
  {
    window.removeEventListener("load", onLoad, false);

    // Init global variables
    progressBar = document.getElementById("progressBar");
    canvas = document.getElementById("progressBarCanvas");

    headers = Array.prototype.slice.call(progressBar.getElementsByTagName("label"));
    for (let i = 0; i < headers.length; i++)
      canvas.parentNode.appendChild(headers[i]);

    // Expose properties
    progressBar.__defineGetter__("activeItem", getActiveItem);
    progressBar.__defineSetter__("activeItem", setActiveItem);
    progressBar.__defineGetter__("activeItemComplete", getActiveItemComplete);
    progressBar.__defineSetter__("activeItemComplete", setActiveItemComplete);

    isRTL = (window.getComputedStyle(document.documentElement).direction == "rtl");

    // Run actual drawing delayed, once the sizes are fixed
    window.setTimeout(init, 0);
  };
  window.addEventListener("load", onLoad, false);

  function init()
  {
    const gapWidth = 5;
    const arrowheadWidth = 5;

    let width = canvas.width = canvas.offsetWidth;
    let height = canvas.height = canvas.offsetHeight;

    let context = canvas.getContext("2d");
    context.fillStyle = window.getComputedStyle(progressBar, "").color;
    context.strokeStyle = window.getComputedStyle(progressBar, "").color;
    context.lineWidth = 1;
    if (isRTL)
    {
      context.translate(width, 0);
      context.scale(-1, 1);
    }

    let panelCount = headers.length;
    let panelWidth = (width - gapWidth * (panelCount - 1) - 1) / panelCount;
    for (let i = 0; i < panelCount; i++)
    {
      context.save();
      context.translate(Math.round(i * (panelWidth + gapWidth)) + 0.5, 0.5);
      context.beginPath();
      if (i)
        context.moveTo(-arrowheadWidth, 0);
      else
        context.moveTo(0, 0);
      context.lineTo(panelWidth - arrowheadWidth, 0);
      context.lineTo(panelWidth, (height - 1) / 2);
      context.lineTo(panelWidth - arrowheadWidth, height - 1);
      if (i)
      {
        context.lineTo(-arrowheadWidth, height - 1);
        context.lineTo(0, (height - 1) / 2);
        context.lineTo(-arrowheadWidth, 0);
      }
      else
      {
        context.lineTo(0, height - 1);
        context.lineTo(0, 0);
      }

      context.stroke();
      context.restore();

      let childLeft = Math.round(i * (panelWidth + gapWidth) + 1);
      let childWidth = panelWidth - arrowheadWidth - 2;
      let child = headers[i];
      child.style.MozMarginStart = childLeft + "px";
      child.style.MozMarginEnd = (width - childLeft - childWidth) + "px";
      child.style.width = childWidth + "px";
    }

    // Resize after initialization should be ignored
    canvas.parentNode.removeAttribute("flex");
  }

  function getActiveItem()
  {
    for (let i = 0; i < headers.length; i++)
    {
      let header = headers[i];
      if (header.classList.contains("active"))
        return header;
    }
    return null;
  }

  function setActiveItem(val)
  {
    let complete = true;
    for (let i = 0; i < headers.length; i++)
    {
      let header = headers[i];
      if (header == val)
        complete = false;

      if (!complete && header.value[0] == "✔")
        header.value = header.value.replace(/^✔\s*/, "");
      else if (complete && header.value[0] != "✔")
        header.value = "✔ " + header.value;

      if (header == val)
        header.classList.add("active");
      else
        header.classList.remove("active");
    }
  }

  function getActiveItemComplete()
  {
    let activeItem = this.activeItem;
    if (!activeItem)
      return false;
    else
      return activeItem.value[0] == "✔";
  }

  function setActiveItemComplete(val)
  {
    let activeItem = this.activeItem;
    if (!activeItem)
      return;

    if (!val && activeItem.value[0] == "✔")
      activeItem.value = activeItem.value.replace(/^✔\s*/, "");
    else if (val && activeItem.value[0] != "✔")
      activeItem.value = "✔ " + activeItem.value;
  }
})();
