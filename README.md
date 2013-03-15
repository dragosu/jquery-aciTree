
aciTree - A treeview control with jQuery

Features:

- supports an unlimited number of 'file' items (items that have no childrens)
  and 'folder' items (items that can have one or more childrens);

- unlimited number of levels, those can be easily loaded with AJAX (the archive
  contains a small PHP implementation as an example);

- is possible to change the form in which the tree is displayed (the included
  example uses only 3 image files to indicate various states in which you can
  find a node and for drawing the tree branches);

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

Check out the demos, now with item selection support and keyboard navigation!

aciTree jQuery Plugin v2.2.0
http://acoderinsights.ro

Copyright (c) 2013 Dragos Ursu
Dual licensed under the MIT or GPL Version 2 licenses.

Require jQuery Library >= v1.7.1 http://jquery.com
+ aciPlugin >= v1.1.0 https://github.com/dragosu/jquery-aciPlugin

Date: Thu Mar 14 20:10 2013 +0200
