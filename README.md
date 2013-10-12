
aciTree - A treeview control with jQuery

Features:

- unlimited number of `file` items (items that have no childrens) and `folder`
  items (items that can have one or more childrens) and unlimited number
  of tree levels;

- the tree can be initialized with data from a JavaScript variable or with the
  built-in AJAX loading capability, the entire tree can be initialized or the 
  tree branches can be loaded as requested (when a `folder` node is opened, 
  for example). Also, using server-side coding, the tree loading can be 
  optimized by returning data for more than one level deep, aciTree will 
  process it and init the branches as required;

- supports item selection, checkbox and radio-button items, keyboard navigation 
  (the arrow keys, pageup/pagedown, home/end, enter, escape and space can 
  be used), in-place item editing (using f2 key or the mouse and enter/escape 
  keys to save/cancel editing), item state (open/selected) persistance using 
  local storage, URL fragment support for item states (open/selected), 
  item search & filter, drag & drop for sorting items;

- supports displaying multiple columns without using tables, with RTL support;

- you can specify an ICON image for each tree item (background-position-x and 
  background-position-y can also be included so you can use a sprite image
  containing all icons), you ca also specify a CSS class name for each ICON;

- the tree can be styled with CSS, it is possible to style differently the 
  odd/even, first/last items, the column width (when using columns) can also be
  established with CSS rules, the tree items allow HTML formatting and can be 
  customized;                

- aciTree provides an easy to use API for handling the tree structure, the 
  items can by added/updated/removed on the fly, all operations trigger events 
  you can listen for and respond to;

- using callback functions you can change the default way aciTree behaves and 
  add your own logic;

- the code was split into a core section and more extensions, you can remove 
  what you dont need to ensure minimum script file size when including 
  aciTree in your pages.

Simple usage:

$(function(){

    $('#tree').aciTree({
        ajax: {
            url: 'path/script?nodeId='
        }
    });

});

aciTree jQuery Plugin v3.7.0
http://acoderinsights.ro

Copyright (c) 2013 Dragos Ursu
Dual licensed under the MIT or GPL Version 2 licenses.

Require jQuery Library >= v1.7.1 http://jquery.com
+ aciPlugin >= v1.5.1 https://github.com/dragosu/jquery-aciPlugin
