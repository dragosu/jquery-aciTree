
/*
 * aciTree jQuery Plugin v1.0
 * http://acoderinsights.ro
 *
 * Copyright (c) 2013 Dragos Ursu
 * Dual licensed under the MIT or GPL Version 2 licenses.
 *
 * Require jQuery Library http://jquery.com
 *
 * Date: Mon Feb 04 21:15 2013 +0200
 */

/*
 * A few words about how a Tree item data looks like:
 *
 * for a Tree File (a Tree item that does not have any childrens):
 *
 * {
 *   id: 'some_file_ID',                // unique Tree item ID
 *   item: 'This is a File Item',       // the Tree item (text value)
 *   props: {                           // a list of item properties
 *     isFolder: false,                 // FALSE means this is a File item
 *     open: false,                     // used only on Folders (if TRUE then the node will be opened)
 *     icon: 'fileIcon',                // CSS class name for the icon (if any), can also be a Array ['CSS class name', background-position-x, background-position-y]
 *     random_prop: 'random 1'          // just a random property (you can have any number defined)
 *   },
 *   items: []                          // used only on Folders (a list of children item data, if any)
 * }
 *
 * for a Tree folder (a Tree item that have at least a children under it):
 *
 * {
 *   id: 'some_folder_ID',              // unique Tree item ID
 *   item: 'This is a Folder Item',     // the Tree item (text value)
 *   props: {                           // a list of item properties
 *     isFolder: true,                  // can also be NULL meaning not sure if there are any childrens (on load will be transformed in a Tree file if there aren't any items)
 *     open: false,                     // if TRUE then the node will be opened
 *     icon: 'folderIcon',              // CSS class name for the icon (if any), can also be a Array ['CSS class name', background-position-x, background-position-y]
 *     random_prop: 'random 2'          // just a random property (you can have any number defined)
 *   },
 *   items: [{ ... item data ... }, { ... item data ... }, ...]
 * }
 *
 * The 'items' Array can be empty, in this case the childrens will be loaded when the node will be opened for the first time.
 *
 * A list of Tree items data it's just an Array of item data: [{ ... item data ... }, { ... item data ... }, ...]
 *
 * Please note that the item data should be valid data (in the expected format). No checking is done and JS errors can appear on invalid data.
 *
 * One note about a Tree item: the Tree item is always the LI element with the class 'aciTreeLi' set.
 * The childrens of a node are all added under a UL element with the class 'aciTreeUl' set.
 *
 * All API functions - that take a Tree item as a parameter - expects a single item, a single LI element.
 * Ensure you call these functions only on a single valid LI Tree item element and check for return type,
 * for some functions can be NULL or a jQuery empty set.
 */

(function($){

    $.aciTree = {
        nameSpace: '.aciTree'
    };

    $.fn.aciTree = function(options, option, value){
        var result = null;
        for (var i = 0; i < this.length; i++){
            result = $(this[i])._aciTree(options, option, value);
            if (!(result instanceof jQuery)){
                return result;
            }
        }
        return this;
    };

    // default options
    $.fn.aciTree.defaults = {
        json: null,                     // URL to the JSON provider, something like 'path/script.php?branch=' (will add the node ID value on load)
        root: null,                     // initial ROOT data for the Tree (if NULL then one initial AJAX request will be made on init)
        expand: false,                  // should all childrens be expanded when a tree node is opened?
        collapse: false,                // should all childrens be collapsed when a tree node is closed?
        empty: false,                   // should all childrens be removed when a tree node is closed?
        show: {                         // show node/ROOT animation (default is slideDown)
            props: {
                'height': 'show',
                'marginTop': 'show',
                'marginBottom': 'show',
                'paddingTop': 'show',
                'paddingBottom': 'show'
            },
            duration: 'medium',
            easing: 'linear'
        },
        hide: {                         // hide node animation (default is slideUp)
            props: {
                'height': 'hide',
                'marginTop': 'hide',
                'marginBottom': 'hide',
                'paddingTop': 'hide',
                'paddingBottom': 'hide'
            },
            duration: 'medium',
            easing: 'linear'
        },
        animateRoot: true,              // if the ROOT should be animated on init
        autoInit: true,                 // if autoInit is disabled need to manually init the tree
        callbacks: {                    // all callback functions receive at least a parameter: the current jQuery object
            beforeInit: null,           // just before init
            afterInit: null,            // just after init (does not ensure the Tree finished loading),
            // item : function (the current jQuery object, the Tree item LI element, the item data, the Tree level - starting from 0)
            item: null                  // used to process a item when it is added, by default the item text is added to the DOM
        }
    };

    $.fn._aciTree = function(options, option, value){

        var $this = this;

        var data = $this.data($.aciTree.nameSpace);
        if (!data && ((typeof options == 'undefined') || (typeof options == 'object'))){
            data = {
                options: $.extend({}, $.fn.aciTree.defaults, options),
                wasInit: false          // init state
            };
            $this.data($.aciTree.nameSpace, data);
        }

        var _init = function(){
            if (!data || data.wasInit){
                return;
            }
            data.wasInit = true;
            if (data.options.callbacks && data.options.callbacks.beforeInit){
                data.options.callbacks.beforeInit($this);
            }
            $this.on('click' + $.aciTree.nameSpace, '.aciTreeButton', function(e){
                var item = $(e.target).parent();
                toggle(item);
            });
            if (data.options.root){
                doInit(null, data.options.root);
            } else {
                doLoad();
            }
            if (data.options.callbacks && data.options.callbacks.afterInit){
                data.options.callbacks.afterInit($this);
            }
        };

        // process a Item for display
        var _item = function(item, itemData, level){
            if (data.options.callbacks && data.options.callbacks.item){
                data.options.callbacks.item($this, item, itemData, level);
                return;
            }
            item.find('.aciTreeItem').html(itemData.item);
        }

        // get Tree item path
        var _getPath = function(item){
            var list = [];
            if (item){
                var li = item.parent().parent();
                if (li.hasClass('aciTreeLi')){
                    list = list.concat(_getPath(li), li.get(0));
                }
            }
            return list;
        }

        // get Tree item path as a jQuery list
        var getPath = function (item){
            return $(_getPath(item));
        }

        // check if Tree item have a parent
        var haveParent = function (item){
            if (item){
                var li = item.parent().parent();
                return li.hasClass('aciTreeLi');
            }
            return false;
        }

        // get Tree item parent
        // can return NULL
        var getParent = function (item){
            return item ? item.parent().parent().filter('.aciTreeLi') : null;
        }

        // init Tree branch from 'items'
        var _branch = function (parent, items, level, open){
            if (items && items.length){
                var ul = $('<ul class="aciTreeUl" style="display:none"></ul>');
                if ((items.length == 1) && (level == 0)){
                    ul.addClass('aciSingle');
                }
                parent.append(ul);
                var itemData, li, html;
                var path = getPath(parent).add(parent);
                for (var i in items){
                    itemData = items[i];
                    li = $('<li class="aciTreeLi"></li>').data('id' + $.aciTree.nameSpace, itemData.id);
                    html = '';
                    for (var j = 0; j < level; j++){
                        html += '<span class="aciTreeSpace ' + (haveNext(path.eq(j)) ? ' aciTreeBranch' : '') + '"></span>';
                    }
                    html += '<span class="aciTreeButton"><span></span></span>';
                    if (itemData.props && itemData.props.icon){
                        if (itemData.props.icon instanceof Array){
                            html += '<span class="aciTreeIcon ' + itemData.props.icon[0] + '" style="background-position:' +
                            itemData.props.icon[1] + 'px ' + itemData.props.icon[2] + 'px' + '"></span>';
                        } else {
                            html += '<span class="aciTreeIcon ' + itemData.props.icon + '"></span>';
                        }
                    }
                    html += '<span class="aciTreeItem"></span>';
                    li.append(html);
                    ul.append(li);
                    if (itemData.props && (itemData.props.isFolder || (itemData.props.isFolder === null))){
                        li.addClass((itemData.props.isFolder || (itemData.items && itemData.items.length)) ? 'aciTreeFolder' : 'aciTreeFolderMaybe');
                        _branch(li, itemData.items, level + 1, itemData.props.open);
                        if (itemData.props.open){
                            doOpen(li);
                        }
                    } else {
                        li.addClass('aciTreeFile');
                    }
                    _item(li, itemData, level);
                }
                if (open){
                    _animate(ul, true);
                }
            }
        }

        // node animation
        var _animate = function (element, show, callback){
            var type = show ? data.options.show : data.options.hide;
            element.animate(type.props, {
                duration: type.duration,
                easing: type.easing,
                complete: callback
            });
        }

        // add one new item
        var _addItem = function (ul, before, after, itemData, path, level){
            var li = $('<li class="aciTreeLi"></li>').data('id' + $.aciTree.nameSpace, itemData.id);
            var html = '';
            for (var j = 0; j < level; j++){
                html += '<span class="aciTreeSpace ' + (haveNext(path.eq(j)) ? ' aciTreeBranch' : '') + '"></span>';
            }
            html += '<span class="aciTreeButton"><span></span></span>';
            if (itemData.props && itemData.props.icon){
                if (itemData.props.icon instanceof Array){
                    html += '<span class="aciTreeIcon ' + itemData.props.icon[0] + '" style="background-position:' +
                    itemData.props.icon[1] + 'px ' + itemData.props.icon[2] + 'px' + '"></span>';
                } else {
                    html += '<span class="aciTreeIcon ' + itemData.props.icon + '"></span>';
                }
            }
            html += '<span class="aciTreeItem"></span>';
            li.append(html);
            if (ul){
                ul.append(li);
            } else if (before){
                before.before(li);
            } else if (after){
                after.after(li);
            }
            if (itemData.props && (itemData.props.isFolder || (itemData.props.isFolder === null))){
                li.addClass((itemData.props.isFolder || (itemData.items && itemData.items.length)) ? 'aciTreeFolder' : 'aciTreeFolderMaybe');
            } else {
                li.addClass('aciTreeFile');
            }
            _item(li, itemData, level);
            return li;
        }

        // add one or more new items
        var _addItems = function (ul, before, after, itemData, path, level){
            if (itemData instanceof Array){
                var list = [];
                for(var i in itemData){
                    list[list.length] = _addItem(ul, before, after, itemData[i], path, level).get(0);
                }
                if (ul){
                    if (list.length){
                        _redraw(getPrev($(list[0])));
                    }
                } else if (before){
                // nothing to do
                } else if (after){
                    _redraw(after);
                }
                return $(list);
            }
            var li = _addItem(ul, before, after, itemData, path, level);
            if (ul){
                _redraw(getPrev(li));
            } else if (before){
            // nothing to do
            } else if (after){
                _redraw(after);
            }
            return li;
        }

        // append new children(s) to a Tree folder
        // item - Tree item
        // itemData - item data object or Array of them
        var addChildren = function (item, itemData){
            if (!item){
                var ul = $this.find('>.aciTreeUl');
                if (!ul.length){
                    ul = $('<ul class="aciTreeUl"></ul>');
                    $this.append(ul);
                }
                return _addItems(ul, null, null, itemData, null, 0);
            } else if (isFolder(item)){
                var ul = item.find('>.aciTreeUl');
                if (!ul.length){
                    ul = $('<ul class="aciTreeUl" style="display:none"></ul>');
                    item.append(ul);
                }
                var list = _addItems(ul, null, null, itemData, getPath(item).add(item), getLevel(item) + 1);
                if (list.length){
                    item.removeClass('aciTreeFolderMaybe').addClass('aciTreeFolder');
                }
                return list;
            }
        }

        // add new item(s) before a Tree item
        // item - Tree item
        // itemData - item data object or Array of them
        var addBefore = function (item, itemData){
            return _addItems(null, item, null, itemData, getPath(item), getLevel(item));
        }

        // Add new item(s) after a Tree item
        // item - Tree item
        // itemData - item data object or Array of them
        var addAfter = function (item, itemData){
            return _addItems(null, null, item, itemData, getPath(item), getLevel(item));
        }

        // get Tree item having the element
        // can return NULL
        var itemFrom = function (element){
            var item = $(element).eq(0);
            if (item.hasClass('aciTree')){
                return null;
            } else if (item.hasClass('aciTreeLi')){
                return item;
            } else {
                return item.parents('.aciTreeLi:first');
            }
        }

        // get Tree item childrens
        // item - Tree item (if NULL then it's the ROOT)
        var childrens = function (item){
            if (!item){
                item = $this;
            }
            return item.find('>.aciTreeUl>.aciTreeLi');
        }

        // toggle Tree item
        var toggle = function (item){
            if (isFolder(item)){
                if (item.hasClass('aciTreeOpen')){
                    item.removeClass('aciTreeOpen');
                    _animate(item.find('>.aciTreeUl').stop(true), false, function(){
                        if (data.options.empty){
                            $(this).remove();
                        }
                    });
                    _collapse(item, data.options.collapse);
                } else {
                    item.addClass('aciTreeOpen');
                    if (wasLoad(item)){
                        _animate(item.find('>.aciTreeUl').stop(true), true);
                        _expand(item, data.options.expand);
                    } else {
                        doLoad(item, function(){
                            _animate(item.find('>.aciTreeUl').stop(true), true);
                            _expand(item, data.options.expand);
                        });
                    }
                }
            }
        }

        // check if it's a Tree folder
        var isFolder = function (item){
            return item && (item.hasClass('aciTreeFolder') || item.hasClass('aciTreeFolderMaybe'));
        }

        // check if it's a Tree file
        var isFile = function (item){
            return item && item.hasClass('aciTreeFile');
        }

        // check if Tree item was loaded
        var wasLoad = function (item){
            if (!item){
                return $this.find('>.aciTreeUl').length > 0;
            }
            if (isFolder(item)){
                return item.find('>.aciTreeUl').length > 0;
            }
            return true;
        }

        // remove all Tree item childrens
        // item - Tree item (if NULL then all are removed)
        var empty = function (item) {
            if (item){
                item.find('>.aciTreeUl').remove();
                doClose(item);
            } else {
                $this.html('');
            }
        }

        // redraw branches
        var _redraw = function(item){
            if (isFolder(item)){
                var level = getLevel(item);
                var next = haveNext(item);
                item.find('.aciTreeLi').each(function(){
                    var space = $(this).find('>.aciTreeSpace').eq(level);
                    if (next){
                        if (!space.hasClass('aciTreeBranch')){
                            space.addClass('aciTreeBranch');
                        }
                    } else {
                        space.removeClass('aciTreeBranch');
                    }
                });
            }
        }

        // remove Tree item
        // item - Tree item (if NULL then all are removed)
        var remove = function (item){
            if (item){
                var parent = getParent(item);
                var prev = getPrev(item);
                item.remove();
                if (parent && !childrens(parent).length){
                    empty(parent);
                }
                _redraw(prev);
            } else {
                $this.html('');
            }
        }

        // set a Tree item as folder
        // item - Tree item (need to be a file)
        var setFolder = function (item){
            if (isFile(item)){
                item.removeClass('aciTreeFile').addClass('aciTreeFolderMaybe');
            }
        }

        // set a Tree item as file
        // item - Tree item (need to be a folder, all childrens are removed)
        var setFile = function (item){
            if (isFolder(item)){
                empty(item);
                item.removeClass('aciTreeFolder aciTreeFolderMaybe aciTreeOpen').addClass('aciTreeFile');
            }
        }

        // set Tree item icon
        // item - Tree item
        // icon - CSS class name or Array [class, background x position, background y position]
        var setIcon = function (item, icon){
            var found = item.find('>.aciTreeIcon');
            if (found.length){
                if (icon){
                    if (icon instanceof Array){
                        found.attr('class', 'aciTreeIcon').addClass(icon[0]).css('background-position', icon[1] + 'px ' + icon[2] + 'px');
                    } else {
                        found.attr('class', 'aciTreeIcon').addClass(icon);
                    }
                } else {
                    found.remove();
                }
            } else {
                if (icon){
                    if (icon instanceof Array){
                        item.find('>.aciTreeButton').after('<span class="aciTreeIcon ' + icon[0] + '" style="background-position:' +
                            icon[1] + 'px ' + icon[2] + 'px' + '"></span>');
                    } else {
                        item.find('>.aciTreeButton').after('<span class="aciTreeIcon ' + icon + '"></span>');
                    }
                }
            }
        }

        // expand node
        var _expand = function (item, propagate){
            if (propagate){
                var childs = childrens(item);
                childs.each(function(){
                    doOpen($(this), true);
                });
            }
        }

        // collapse node
        var _collapse = function (item, propagate){
            if (propagate){
                var childs = childrens(item);
                childs.each(function(){
                    doClose($(this), true);
                });
            }
        }

        // open a Tree item (folder)
        // item - Tree item
        // propagate - will try to open all childrens (if 'expand' is active)
        var doOpen = function (item, propagate){
            if (isFolder(item)){
                if (!item.hasClass('aciTreeOpen')){
                    item.addClass('aciTreeOpen');
                    if (wasLoad(item)){
                        _animate(item.find('>.aciTreeUl').stop(true), true);
                        _expand(item, propagate);
                    } else {
                        doLoad(item, function(){
                            _animate(item.find('>.aciTreeUl').stop(true), true);
                            _expand(item, propagate);
                        });
                    }
                }
            }
        }

        // close a Tree item (folder)
        // item - Tree item
        // propagate - will try to collapse all childrens (if 'collapse' is active)
        var doClose = function (item, propagate){
            if (isFolder(item)){
                if (item.hasClass('aciTreeOpen')){
                    item.removeClass('aciTreeOpen');
                    _animate(item.find('>.aciTreeUl').stop(true), false, function(){
                        if (data.options.empty){
                            $(this).remove();
                        }
                    });
                    _collapse(item, propagate);
                }
            }
        }

        // check if Tree item have childrens
        var haveChildrens = function (item){
            if (!item){
                item = $this;
            }
            return item.find('>.aciTreeUl').length > 0;
        }

        // check if Tree item have siblings
        var haveSiblings = function (item){
            return item && (item.parent().find('>.aciTreeLi').length > 1);
        }

        // check if Tree item have another before him
        var havePrev = function (item){
            return item && (item.prev('.aciTreeLi').length > 0);
        }

        // check if Tree item have another after him
        var haveNext = function (item){
            return item && (item.next('.aciTreeLi').length > 0);
        }

        // get Tree item siblings
        var siblings = function (item){
            return item ? item.parent().find('>.aciTreeLi').not(item) : $([]);
        }

        // get previous Tree item
        var getPrev = function (item){
            return item ? item.prev('.aciTreeLi') : $([]);
        }

        // get next Tree item
        var getNext = function (item){
            return item ? item.next('.aciTreeLi') : $([]);
        }

        // get item level
        var _getLevel = function (item){
            if (item && item.hasClass('aciTreeLi')){
                var li = item.parent().parent();
                return 1 + _getLevel(li);
            }
            return null;
        }

        // get Tree item level (starting from 0)
        // item - Tree item
        var getLevel = function (item){
            var level = _getLevel(item);
            if (level !== null){
                return level - 1;
            }
            return null;
        }

        // get Tree item ID
        // item - Tree item
        var getId = function (item){
            return item ? item.data('id' + $.aciTree.nameSpace) : null;
        }

        // get Tree item text value
        // item - Tree item
        var getText = function (item){
            return (item ? item.find('>.aciTreeItem').text() : null);
        }

        // this will search a Tree item by ID (and return the LI if found)
        var byId = function (id){
            if (id){
                var data = 'id' + $.aciTree.nameSpace;
                $this.find('.aciTreeLi').each(function(){
                    if ($(this).data(data) == id){
                        return $(this);
                    }
                });
            }
            return null;
        }

        // process Tree load (from Tree item data)
        // item - Tree item (if NULL then it's the ROOT)
        var doInit = function (item, itemData){
            if (item){
                if (!wasLoad(item)){
                    var level = getLevel(item);
                    if (itemData.length){
                        item.removeClass('aciTreeFolderMaybe').addClass('aciTreeFolder');
                        _branch(item, itemData, level + 1, false);
                    } else {
                        setFile(item);
                    }
                    item.find('>.aciTreeButton').removeClass('aciTreeLoad');
                }
            } else {
                if (!wasLoad()){
                    $this.html('');
                    _branch($this, itemData, 0, data.options.animateRoot);
                    if (!data.options.animateRoot){
                        $this.find('>.aciTreeUl').show();
                    }
                    $this.removeClass('aciTreeLoad');
                }
            }
        }

        // process AJAX Tree load
        // item - Tree item (if NULL then it's the ROOT)
        // callback - function called after load (only after loading a Folder)
        var doLoad = function (item, callback){
            if (item){
                if (!wasLoad(item)){
                    item.find('>.aciTreeButton').addClass('aciTreeLoad');
                    var level = getLevel(item);
                    $.get(data.options.json + getId(item), null, function(items){
                        if (items.length){
                            item.removeClass('aciTreeFolderMaybe').addClass('aciTreeFolder');
                            _branch(item, items, level + 1, false);
                            if (callback){
                                callback();
                            }
                        } else {
                            setFile(item);
                        }
                        item.find('>.aciTreeButton').removeClass('aciTreeLoad');
                    }, 'json');
                }
            } else {
                if (!wasLoad()){
                    $this.addClass('aciTreeLoad');
                    $.get(data.options.json, null, function(items){
                        $this.html('');
                        _branch($this, items, 0, data.options.animateRoot);
                        if (!data.options.animateRoot){
                            $this.find('>.aciTreeUl').show();
                        }
                        $this.removeClass('aciTreeLoad');
                    }, 'json');
                }
            }
        }

        // init control based on options
        var _initUi = function(){
            if ((typeof options == 'undefined') || (typeof options == 'object')){
                if (data.options.autoInit){
                    // auto init
                    _init();
                }
            } else {
                // process custom request
                if (typeof options == 'string'){
                    switch (options){
                        case 'init':
                            // init the control
                            _init();
                            break;
                        case 'api':
                            // expose some functions :)
                            return {
                                itemFrom: itemFrom,
                                getId: getId,
                                getText: getText,
                                getLevel: getLevel,
                                byId: byId,

                                isFile: isFile,
                                isFolder: isFolder,
                                wasLoad: wasLoad,
                                empty: empty,
                                remove: remove,

                                setFolder: setFolder,
                                setFile: setFile,
                                setIcon: setIcon,

                                haveParent: haveParent,
                                getParent: getParent,
                                getPath: getPath,

                                addAfter: addAfter,
                                addBefore: addBefore,
                                addChildren: addChildren,

                                toggle: toggle,
                                doOpen: doOpen,
                                doClose: doClose,

                                haveSiblings: haveSiblings,
                                havePrev: havePrev,
                                haveNext: haveNext,
                                haveChildrens: haveChildrens,

                                siblings: siblings,
                                getPrev: getPrev,
                                getNext: getNext,
                                childrens: childrens,

                                doInit: doInit,
                                doLoad: doLoad
                            };
                        case 'option':
                            if (data){
                                // set a option
                                data.options[option] = value;
                                $this.data($.aciTree.nameSpace, data);
                            }
                            break;
                        case 'options':
                            // get options
                            return data ? data.options : null;
                        case 'destroy':
                            if (data){
                                // destroy the control
                                empty();
                                $this.off($.aciTree.nameSpace, '.aciTreeButton');
                                $this.data($.aciTree.nameSpace, null);
                            }
                            break;
                    }
                }
            }
            // return this object
            return $this;
        };

        // init the control
        return _initUi();

    };

})(jQuery);
