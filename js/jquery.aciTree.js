
/*
 * aciTree jQuery Plugin v1.2
 * http://acoderinsights.ro
 *
 * Copyright (c) 2013 Dragos Ursu
 * Dual licensed under the MIT or GPL Version 2 licenses.
 *
 * Require jQuery Library http://jquery.com
 *
 * Date: Fri Feb 08 18:20 2013 +0200
 */

/*
 * A few words about how a item data looks like:
 *
 * for a File item (a item that does not have any childrens):
 *
 * {
 *   id: 'some_file_ID',                // unique item ID
 *   item: 'This is a File Item',       // the item (text value)
 *   props: {                           // a list of item properties
 *     isFolder: false,                 // FALSE means it's a File item
 *     open: false,                     // used only on Folders (if TRUE then the node will be opened)
 *     icon: 'fileIcon',                // CSS class name for the icon (if any), can also be a Array ['CSS class name', background-position-x, background-position-y]
 *     random_prop: 'random 1'          // just a random property (you can have any number defined)
 *   },
 *   items: []                          // used only on Folders (a list of children item data, if any)
 * }
 *
 * for a Folder item (a item that have at least a children under it):
 *
 * {
 *   id: 'some_folder_ID',              // unique item ID
 *   item: 'This is a Folder Item',     // the item (text value)
 *   props: {                           // a list of item properties
 *     isFolder: true,                  // can also be NULL meaning not sure if there are any childrens (on load will be transformed in a File if there aren't any childrens)
 *     open: false,                     // if TRUE then the node will be opened
 *     icon: 'folderIcon',              // CSS class name for the icon (if any), can also be a Array ['CSS class name', background-position-x, background-position-y]
 *     random_prop: 'random 2'          // just a random property (you can have any number defined)
 *   },
 *   items: [{ ... item data ... }, { ... item data ... }, ...]
 * }
 *
 * The 'items' Array can be empty, in this case the childrens will be loaded when the node will be opened for the first time.
 *
 * Please note that the item data should be valid data (in the expected format). No checking is done and errors can appear on invalid data.
 *
 * One note about a item: a item is always the LI element with the class 'aciTreeLi'.
 * The childrens of a node are all added under a UL element with the class 'aciTreeUl'.
 *
 * Some of the API functions will work with only the first item in the set. In this case you'll need to loop between all of them yourself.
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
        json: null,                     // URL to the JSON provider, something like 'path/script?branch=' (will add the node ID value on load)
        root: null,                     // initial ROOT data for the Tree (if NULL then one initial AJAX request is made on init)
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
            // beforeInit : function(the tree jQuery object)
            beforeInit: null,           // just before init
            // beforeInit : function(the tree jQuery object)
            afterInit: null,            // just after init (does not ensure the tree finished loading),
            // item : function(the tree jQuery object, the item, the item data, the level - starting from 0)
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

        // process item for display
        var _item = function(item, itemData, level){
            if (data.options.callbacks && data.options.callbacks.item){
                data.options.callbacks.item($this, item, itemData, level);
                return;
            }
            item.find('.aciTreeItem').html(itemData.item);
        }

        // get item path helper
        var _getPath = function(item){
            var list = [];
            var li = item.parent().parent();
            if (li.hasClass('aciTreeLi')){
                list = list.concat(_getPath(li), li.get(0));
            }
            return list;
        }

        // get item path
        var getPath = function(item){
            if (item){
                return $(_getPath(item.first()));
            }
            return $([]);
        }

        // check if a item have parent
        var haveParent = function(item){
            if (item){
                var li = item.first().parent().parent();
                return li.hasClass('aciTreeLi');
            }
            return false;
        }

        // get item parent
        var getParent = function(item){
            return item ? item.first().parent().parent().filter('.aciTreeLi') : $([]);
        }

        // init a branch from itemList
        var _branchInit = function(parent, itemList, level, openNode){
            var ul = $('<ul class="aciTreeUl" style="display:none"></ul>');
            if ((level == 0) && (itemList.length == 1)){
                // if only one item in ROOT
                ul.addClass('aciTreeSingle');
            }
            parent.append(ul);
            var itemData, li, html;
            var path = getPath(parent).add(parent);
            for (var i in itemList){
                itemData = itemList[i];
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
                    if (itemData.items && itemData.items.length){
                        _branchInit(li, itemData.items, level + 1, itemData.props.open);
                    }
                    if (itemData.props.open){
                        doOpen(li);
                    }
                } else {
                    li.addClass('aciTreeFile');
                }
                _item(li, itemData, level);
            }
            if (openNode){
                _animateNode(ul, true);
            }
        }

        // node animation
        var _animateNode = function(container, show, callback){
            var type = show ? data.options.show : data.options.hide;
            container.stop(true).animate(type.props, {
                duration: type.duration,
                easing: type.easing,
                complete: callback
            });
        }

        // add one new item
        var _addItem = function(ul, before, after, itemData, path, level){
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
        var _addItems = function(ul, before, after, itemData, path, level){
            if (itemData instanceof Array){
                var list = [];
                if (!ul && !before && after){
                    itemData.reverse();
                }
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

        // append one or more items from itemData as childrens of a Folder
        // item can be NULL for ROOT
        var addChildren = function(item, itemData){
            if (item){
                item = item.first();
                if (isFolder(item)){
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
                return $([]);
            } else {
                var ul = $this.find('>.aciTreeUl');
                if (!ul.length){
                    ul = $('<ul class="aciTreeUl"></ul>');
                    $this.append(ul);
                }
                var list = _addItems(ul, null, null, itemData, null, 0);
                $this.find('>.aciTreeUl').toggleClass('aciTreeSingle', childrens().length == 1);
                return list;
            }
        }

        // check for more items in ROOT
        var _multiple = function(item){
            if ((getLevel(item) == 0) && (childrens().length > 1)) {
                $this.find('>.aciTreeUl').removeClass('aciTreeSingle');
            }
        }

        // add one or more items from itemData before a item
        var addBefore = function(item, itemData){
            if (item){
                item = item.first();
                if (isItem(item)){
                    var list = _addItems(null, item, null, itemData, getPath(item), getLevel(item));
                    _multiple(item);
                    return list;
                }
            }
            return $([]);
        }

        // add one or more items from itemData after a item
        var addAfter = function(item, itemData){
            if (item){
                item = item.first();
                if (isItem(item)){
                    var list = _addItems(null, null, item, itemData, getPath(item), getLevel(item));
                    _multiple(item);
                    return list;
                }
            }
            return $([]);
        }

        // get item having the element
        var itemFrom = function(element){
            if (element){
                var item = $(element).first();
                if (item.hasClass('aciTree')){
                    return $([]);
                } else if (item.hasClass('aciTreeLi')){
                    return item;
                } else {
                    return item.parents('.aciTreeLi:first');
                }
            }
            return $([]);
        }

        // get item childrens
        // item can be NULL for ROOT
        var childrens = function(item){
            if (!item){
                item = $this;
            }
            return item.first().find('>.aciTreeUl>.aciTreeLi');
        }

        // toggle one or more Folder items
        var toggle = function(items){
            items.each(function(){
                var item = $(this);
                if (isFolder(item)){
                    if (item.hasClass('aciTreeOpen')){
                        item.removeClass('aciTreeOpen');
                        _animateNode(item.find('>.aciTreeUl'), false, function(){
                            if (data.options.empty){
                                $(this).remove();
                            }
                        });
                        _collapse(item, data.options.collapse);
                    } else {
                        item.addClass('aciTreeOpen');
                        if (wasLoad(item)){
                            _animateNode(item.find('>.aciTreeUl'), true);
                            _expand(item, data.options.expand);
                        } else {
                            doLoad(item, function(){
                                _animateNode(item.find('>.aciTreeUl'), true);
                                _expand(item, data.options.expand);
                            });
                        }
                    }
                }
            });
        }

        // check if item is a Folder
        var isFolder = function(item){
            return item && (item.first().hasClass('aciTreeFolder') || item.first().hasClass('aciTreeFolderMaybe'));
        }

        // check if item is a File
        var isFile = function(item){
            return item && item.first().hasClass('aciTreeFile');
        }

        // check if item was loaded
        // item can be NULL for ROOT
        var wasLoad = function(item){
            if (!item){
                return $this.find('>.aciTreeUl').length > 0;
            }
            if (isFolder(item)){
                return item.first().find('>.aciTreeUl').length > 0;
            }
            return true;
        }

        // remove all childrens from one or more items
        // items can be NULL for ROOT
        var empty = function(items) {
            if (items){
                items.each(function(){
                    var item = $(this);
                    if (isItem(item)){
                        item.find('>.aciTreeUl').remove();
                        doClose(item);
                    }
                });
            } else {
                $this.html('');
            }
        }

        // redraw item branches
        var _redraw = function(item){
            if (isFolder(item)){
                var level = getLevel(item);
                var next = haveNext(item);
                item.find('.aciTreeLi').each(function(){
                    $(this).find('>.aciTreeSpace').eq(level).toggleClass('aciTreeBranch', next);
                });
            }
        }

        // remove one or more items
        // items can be NULL for ROOT
        var remove = function(items){
            if (items){
                items.each(function(){
                    var item = $(this);
                    if (isItem(item)){
                        var parent = getParent(item);
                        var prev = getPrev(item);
                        var level = getLevel(item);
                        item.remove();
                        if (!childrens(parent).length){
                            empty(parent);
                        }
                        _redraw(prev);
                        if ((level == 0) && (childrens().length == 1)) {
                            // if only one item in ROOT
                            $this.find('>.aciTreeUl').addClass('aciTreeSingle');
                        }
                    }
                });
            } else {
                $this.html('');
            }
        }

        // set one or more items as Folders
        var setFolder = function(items){
            items.each(function(){
                var item = $(this);
                if (isFile(item)){
                    item.removeClass('aciTreeFile').addClass('aciTreeFolderMaybe');
                }
            });
        }

        // set one or more items as Files
        var setFile = function(items){
            items.each(function(){
                var item = $(this);
                if (isFolder(item)){
                    empty(item);
                    item.removeClass('aciTreeFolder aciTreeFolderMaybe aciTreeOpen').addClass('aciTreeFile');
                }
            });
        }

        // set the icon for one or more items
        // icon - CSS class name or Array [class, background x position, background y position]
        var setIcon = function(items, icon){
            items.each(function(){
                var item = $(this);
                if (isItem(item)){
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
            });
        }

        // open child nodes
        var _expand = function(item, propagate){
            if (propagate){
                var childs = childrens(item);
                childs.each(function(){
                    doOpen($(this), true);
                });
            }
        }

        // close child nodes
        var _collapse = function(item, propagate){
            if (propagate){
                var childs = childrens(item);
                childs.each(function(){
                    doClose($(this), true);
                });
            }
        }

        // open one or more Folder items
        // propagate - if TRUE will open all childrens (loading them if required)
        var doOpen = function(items, propagate){
            items.each(function(){
                var item = $(this);
                if (isFolder(item)){
                    if (!item.hasClass('aciTreeOpen')){
                        item.addClass('aciTreeOpen');
                        if (wasLoad(item)){
                            _animateNode(item.find('>.aciTreeUl'), true);
                            _expand(item, propagate);
                        } else {
                            doLoad(item, function(){
                                _animateNode(item.find('>.aciTreeUl'), true);
                                _expand(item, propagate);
                            });
                        }
                    }
                }
            });
        }

        // close one or more Folder items
        // propagate - if TRUE will close all childrens
        var doClose = function(items, propagate){
            items.each(function(){
                var item = $(this);
                if (isFolder(item)){
                    if (item.hasClass('aciTreeOpen')){
                        item.removeClass('aciTreeOpen');
                        _animateNode(item.find('>.aciTreeUl'), false, function(){
                            if (data.options.empty){
                                $(this).remove();
                            }
                        });
                        _collapse(item, propagate);
                    }
                }
            });
        }

        // check if item is open
        var isOpen = function(item){
            return item && item.first().hasClass('aciTreeOpen');
        }

        // check if item is closed
        var isClosed = function(item){
            return !isOpen(item);
        }

        // check if item have childrens
        // item can be NULL for ROOT
        var haveChildrens = function(item){
            if (!item){
                item = $this;
            }
            return item.first().find('>.aciTreeUl').length > 0;
        }

        // check if item have siblings
        var haveSiblings = function(item){
            return item && (item.first().parent().find('>.aciTreeLi').length > 1);
        }

        // check if item have another before
        var havePrev = function(item){
            return item && (item.first().prev('.aciTreeLi').length > 0);
        }

        // check if item have another after
        var haveNext = function(item){
            return item && (item.first().next('.aciTreeLi').length > 0);
        }

        // get item siblings
        var siblings = function(item){
            return item ? item.first().parent().find('>.aciTreeLi').not(item) : $([]);
        }

        // get previous item
        var getPrev = function(item){
            return item ? item.first().prev('.aciTreeLi') : $([]);
        }

        // get next item
        var getNext = function(item){
            return item ? item.first().next('.aciTreeLi') : $([]);
        }

        // get item level (starting from 0)
        // return -1 for invalid items
        var getLevel = function(item){
            var level = -1;
            if (item){
                item = item.first();
                while (item.hasClass('aciTreeLi')){
                    item = item.parent().parent();
                    level++;
                }
            }
            return level;
        }

        // get item ID (NULL if not found)
        var getId = function(item){
            return item ? item.first().data('id' + $.aciTree.nameSpace) : null;
        }

        // get item text value (NULL if not found)
        var getText = function(item){
            return (item ? item.first().find('>.aciTreeItem').text() : null);
        }

        // search a item by ID
        var byId = function(id){
            if (id){
                var data = 'id' + $.aciTree.nameSpace;
                $this.find('.aciTreeLi').each(function(){
                    if ($(this).data(data) == id){
                        return $(this);
                    }
                });
            }
            return $([]);
        }

        // check if it's a single valid item
        var isItem = function(item){
            return item && (item.length == 1) && item.hasClass('aciTreeLi');
        }

        // process item init from dataList
        // item can be NULL for ROOT
        var doInit = function(item, dataList){
            if (item){
                // this should be a Folder
                item = item.first();
                if (isItem(item) && !wasLoad(item)){
                    var level = getLevel(item);
                    if (dataList.length){
                        item.removeClass('aciTreeFolderMaybe').addClass('aciTreeFolder');
                        _branchInit(item, dataList, level + 1, false);
                    } else {
                        setFile(item);
                    }
                    item.find('>.aciTreeButton').removeClass('aciTreeLoad');
                }
            } else {
                // this is the ROOT
                if (!wasLoad()){
                    $this.html('');
                    if (dataList.length){
                        _branchInit($this, dataList, 0, data.options.animateRoot);
                        if (!data.options.animateRoot){
                            $this.find('>.aciTreeUl').show();
                        }
                    }
                    $this.removeClass('aciTreeLoad');
                }
            }
        }

        // process items loading with AJAX
        // items can be NULL for ROOT
        var doLoad = function(items, callback){
            if (items){
                items.each(function(){
                    // this should be a Folder
                    var item = $(this);
                    if (isItem(item) && !wasLoad(item)){
                        item.find('>.aciTreeButton').addClass('aciTreeLoad');
                        var level = getLevel(item);
                        $.get(data.options.json + getId(item), null, function(items){
                            if (items && items.length){
                                item.removeClass('aciTreeFolderMaybe').addClass('aciTreeFolder');
                                _branchInit(item, items, level + 1, false);
                                if (callback){
                                    callback();
                                }
                            } else {
                                setFile(item);
                            }
                            item.find('>.aciTreeButton').removeClass('aciTreeLoad');
                        }, 'json');
                    }
                });
            } else {
                if (!wasLoad()){
                    $this.addClass('aciTreeLoad');
                    $.get(data.options.json, null, function(items){
                        $this.html('');
                        if (items && items.length){
                            _branchInit($this, items, 0, data.options.animateRoot);
                            if (!data.options.animateRoot){
                                $this.find('>.aciTreeUl').show();
                            }
                        }
                        $this.removeClass('aciTreeLoad');
                    }, 'json');
                }
            }
        }

        // get first item child
        var getFirst = function(item){
            if (!item){
                item = $this;
            }
            return item.first().find('>.aciTreeUl>.aciTreeLi:first');
        }

        // get last item child
        var getLast = function(item){
            if (!item){
                item = $this;
            }
            return item.first().find('>.aciTreeUl>.aciTreeLi:last');
        }

        // callback call for each child from item
        var branch = function(item, callback, reverse){
            var child = getFirst(item);
            while (child.length){
                if (isFolder(child)){
                    if (!reverse){
                        callback($this, child);
                    }
                    branch(child, callback, reverse);
                    if (reverse){
                        callback($this, child);
                    }
                } else {
                    callback($this, child);
                }
                child = getNext(child);
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

                                isItem: isItem,
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
                                isOpen: isOpen,
                                isClosed: isClosed,

                                haveSiblings: haveSiblings,
                                havePrev: havePrev,
                                haveNext: haveNext,
                                haveChildrens: haveChildrens,

                                siblings: siblings,
                                getFirst: getFirst,
                                getLast: getLast,
                                getPrev: getPrev,
                                getNext: getNext,
                                childrens: childrens,

                                doInit: doInit,
                                doLoad: doLoad,
                                branch: branch
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
