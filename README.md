
aciTree - Tree view with jQuery

Features:

- supports an unlimited number of file items (items that have no childrens) and
  folder items (items that can have one or more childrens);

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
  (by default a text value is set - the item name; by using this callback you
  can add additional items - such as: a form element of type checkbox, etc).

Simple usage:

$('body').ready(function(){

    $('#tree').aciTree({
        json: 'php/aciTree.php?branch='
    });

});

aciTree jQuery Plugin v1.0
http://acoderinsights.ro

Copyright (c) 2013 Dragos Ursu
Dual licensed under the MIT or GPL Version 2 licenses.

Require jQuery Library http://jquery.com

Date: Mon Feb 04 21:15 2013 +0200
