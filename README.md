
aciTree - A treeview control with jQuery

Features:

- supports an unlimited number of 'file' items (items that have no childrens)
  and 'folder' items (items that can have one or more childrens);

- unlimited number of levels, those can be easily loaded with AJAX (the archive
  contains a small PHP implementation as an example);

- supports selecting an item, checkbox and radio-button elements, keyboard
  navigation (the arrow keys, pageup/pagedown, home/end, enter, escape and
  space can be used), in-place item editing (using f2 key or the mouse
  and enter/escape keys to save/cancel editing);

- supports displaying multiple columns without using tables, with RTL support;

- is possible to change the form in which the tree is displayed, the items
  allows HTML formatting, the odd/even rows can be styled differently;

- you can specify an ICON image for each item (background-position-x and
  background-position-y can be included so that you can use a single image
  containing all the icons);

- aciTree provides an easy to use API for handling the tree structure:
  initialization data read by AJAX or from a JavaScript variable, adding,
  removing items, changing ICON images etc;

- the use of a callback function so you can customize the content of each item
  (by default a text value is set - the item name; by using the callback you
  can add additional elements - such as: a form element of type checkbox, etc).

Simple usage:

$(function(){

    $('#tree').aciTree({
        jsonUrl: 'path/script?branch='
    });

});

Check out the demos, now with in-place edit support!

aciTree jQuery Plugin v3.0.0-rc.5
http://acoderinsights.ro

Copyright (c) 2013 Dragos Ursu
Dual licensed under the MIT or GPL Version 2 licenses.

Require jQuery Library >= v1.7.1 http://jquery.com
+ aciPlugin >= v1.1.1 https://github.com/dragosu/jquery-aciPlugin

Date: Apr Mon 15 20:10 2013 +0200
