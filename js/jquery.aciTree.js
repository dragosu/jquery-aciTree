
/*
 * aciTree jQuery Plugin v2.1.0
 * http://acoderinsights.ro
 *
 * Copyright (c) 2013 Dragos Ursu
 * Dual licensed under the MIT or GPL Version 2 licenses.
 *
 * Require jQuery Library >= v1.7.1 http://jquery.com
 *
 * Date: Sun Mar 02 14:20 2013 +0200
 */

/*
 * A few words about how a item data looks like:
 *
 * for a 'file' item (a item that does not have any childrens):
 *
 * {
 *   id: 'some_file_ID',                // unique item ID
 *   item: 'This is a File Item',       // the item (text value)
 *   props: {                           // a list of item properties
 *     isFolder: false,                 // FALSE means it's a 'file' item
 *     icon: 'fileIcon',                // CSS class name for the icon (if any), can also be a Array ['CSS class name', background-position-x, background-position-y]
 *     random_prop: 'random 1'          // just a random property (you can have any number defined)
 *   }
 * }
 *
 * for a 'folder' item (a item that have at least a children under it):
 *
 * {
 *   id: 'some_folder_ID',              // unique item ID
 *   item: 'This is a Folder Item',     // the item (text value)
 *   props: {                           // a list of item properties
 *     isFolder: true,                  // can also be NULL meaning not sure if there are any childrens (on load will be transformed in a 'file' if there aren't any childrens)
 *     open: false,                     // if TRUE then the node will be opened when the tree is loaded
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
 * All API functions will work with only the first item in the set. If you need to process more at once then you'll need to loop between all of them yourself.
 *
 * The 'options' parameter for all API functions (when there is one) it's a object with the properties (not all are required or used):
 *
 * {
 *   success: function (api, item, data) -> callback to be called on success
 *   fail: function (api, item, data) -> callback to be called on fail
 *   expand: true/false -> propagate on open/toggle
 *   collapse: true/false -> propagate on close/toggle
 *   unique: true/false -> close other branches (on open/toggle)?
 *   unanimated: true/false -> if it's TRUE then no animations are to be run (used on open/close/toggle)
 *   itemData: NULL/object[item data]/Array[item data] -> used when adding items
 * }
 *
 * For the callbacks: 'item' can be a single element or NULL (for the ROOT), 'data' can be some useful data returned (depending on the function called).
 *
 * Note: when using the API with the functions that support the 'options' parameter, you will need to use the success/fail callbacks if you need to do
 * any processing after the API call. This because there can be async operations that will complete at a later time and the API function will
 * exit before the job is actually completed. This will happen when items are loaded with AJAX, on animations and other delayed operations (see _queue).
 *
 */

(function($){

    $.aciTree = {
        nameSpace: '.aciTree'
    };

    $.fn.aciTree = function(options, option, value){
        var result = null;
        for(var i = 0, size = this.length; i < size; i++){
            result = $(this[i])._aciTree(options, option, value);
            if (!(result instanceof jQuery)){
                return result;
            }
        }
        return this;
    };

    // default options
    $.fn.aciTree.defaults = {
        jsonUrl: null,                  // URL to the JSON provider, something like 'path/script?branch=' (will add the node ID value on load)
        rootData: null,                 // initial ROOT data for the Tree (if NULL then one initial AJAX request is made on init)
        threads: 4,                     // how many AJAX load requests will be run in the same time?
        queueDelay: 40,                 // a small delay for our queue implementation (less = uses more CPU, more = slower tree processing)
        loaderDelay: 500,               // how many msec to wait before showing the main loader? (on lengthy operations)
        expand: false,                  // if TRUE then all childrens of a node are expanded when the node is opened
        collapse: false,                // if TRUE then all childrens of a node are collapsed when the node is closed
        unique: false,                  // if TRUE then a single tree branch will stay open, the oters are closed when a node is opened
        empty: false,                   // if TRUE then all childrens of a node are removed when the node is closed
        selectable: true,               // ToDo: if TRUE then one item can be selected (and the tree navigation with the keyboard will be enabled)
        show: {                         // show node/ROOT animation (default is slideDown, should be NULL for heavy treeviews)
            props: {
                'height': 'show'
            },
            duration: 'medium',
            easing: 'linear'
        },
        animateRoot: true,              // if the ROOT should be animated on init
        hide: {                         // hide node animation (default is slideUp, should be NULL for heavy treeviews)
            props: {
                'height': 'hide'
            },
            duration: 'medium',
            easing: 'linear'
        },
        view: {                         // scroll item into view animation
            duration: 'medium',
            easing: 'linear'
        },
        autoInit: true,                 // if FALSE then need to manually init the tree
        callbacks: {
            // item : function(api, item, itemData, level)
            item: null,                 // called when a new item is added, by default the item text is added to the DOM
            // selected : function(api, item, state)
            selected: null              // ToDo: called to draw the item selection
        }
    };

    $.fn._aciTree = function(options, option, value){

        var $this = this;

        var data = $this.data($.aciTree.nameSpace);
        if (!data && ((typeof options == 'undefined') || (typeof options == 'object'))){
            data = {
                options: $.extend({}, $.fn.aciTree.defaults, options),
                wasInit: false,          // init state
                locked: false            // locked state
            };
            $this.data($.aciTree.nameSpace, data);
        }

        // init control
        var _init = function(){
            if (!data){
                _trigger(null, 'initerr');
                return;
            }
            if (wasInit()){
                _trigger(null, 'wasinit');
                return;
            }
            if (isLocked()){
                _trigger(null, 'locked');
                return;
            }
            data.locked = true;
            $this.on('click' + $.aciTree.nameSpace, '.aciTreeButton', function(e){
                var item = $(e.target).parent();
                toggle(item, {
                    collapse: data.options.collapse,
                    expand: data.options.expand,
                    unique: data.options.unique
                });
            });
            var success = function(){
                data.wasInit = true;
                data.locked = false;
                _trigger(null, 'init');
            };
            var fail = function(){
                data.wasInit = true;
                data.locked = false;
                _trigger(null, 'initfail');
            };
            if (data.options.rootData){
                initFrom(null, {
                    success: success,
                    fail: fail,
                    itemData: data.options.rootData
                });
            } else if (data.options.jsonUrl){
                ajaxLoad(null, {
                    success: success,
                    fail: fail
                });
            } else {
                success();
            }
        };

        // chek if was init
        var wasInit = function(){
            return data && data.wasInit;
        };

        // check locked state
        var isLocked = function(){
            return data && data.locked;
        }

        // a small queue implementation
        var _queue = function(threads, realtime){
            var fifo = [];
            var finalize = [];
            var workers = threads ? Math.max(threads, 1) : 1;
            var load = 0;
            var locked = false;
            // push a 'callback' for later call
            this.push = function(callback, async){
                if (!locked){
                    fifo.push({
                        callback: callback,
                        async: async
                    });
                }
                return this;
            };
            // push a 'callback' for later call (on completion)
            this.complete = function (callback, async){
                if (!locked){
                    finalize.push({
                        callback: callback,
                        async: async
                    });
                }
                return this;
            };
            // destroy queue
            this.destroy = function(){
                locked = true;
                setTimeout(function(){
                    finalize = [];
                    fifo = [];
                    load = 0;
                    locked = false;
                }, data.options.queueDelay);
            };
            // return TRUE if all threads are busy
            this.busy = function(){
                return load >= workers;
            };
            // return TRUE if it's empty
            this.empty = function(){
                return (load == 0) && (fifo.length == 0) && (finalize.length == 0);
            };
            // do the magic: run our queue
            this.run = function(spawn){
                if ((load >= workers) || locked){
                    return;
                }
                if (spawn){
                    for(var i = 1, size = workers - load; i < size; i++){
                        this.run();
                    }
                }
                var $this = this;
                setTimeout(function(){
                    if ((load >= workers) || locked){
                        return;
                    }
                    var item = fifo.shift();
                    if (!item){
                        if (fifo.length){
                            setTimeout(function(){
                                $this.run();
                            }, 10);
                        } else {
                            item = finalize.shift();
                        }
                    }
                    if (item){
                        if (item.async){
                            load++;
                            item.callback(function(){
                                load--;
                                $this.run();
                            });
                        } else {
                            load++;
                            item.callback();
                            load--;
                            $this.run();
                        }
                    }
                }, realtime ? 10 : data.options.queueDelay);
            };
        };

        // options object (need to be in this form for all API functions
        // that have a 'options' parameter, not all properties are required)
        var _options = function(data, success, fail){
            var options = $.extend({
                success: null, // success callback
                fail: null, // fail callback
                expand: false, // propagate (on open)
                collapse: false, // propagate (on close)
                unique: false, // keep a single branch open (on open)
                unanimated: false, // unanimated (open/close/toggle)
                itemData: null // item data (init[Array], append[Array/object], after/before[Array/object])
            }, data);
            if (success){
                if (data && data.success) {
                    options.success = function(){
                        success();
                        data.success();
                    };
                } else {
                    options.success = success;
                }
            }
            if (fail){
                if (data && data.fail) {
                    options.fail = function(){
                        fail();
                        data.fail();
                    };
                } else {
                    options.fail = fail;
                }
            }
            return options;
        }

        // triger event
        var _trigger = function(item, event, data){
            data = $.extend({
                event: event
            }, data);
            $this.trigger('acitree', [_api, item, data]);
        }

        // call on success
        var _success = function(item, options, data){
            if (options && options.success){
                options.success(_api, item ? item.first() : null, data);
            }
        };

        // call on fail
        var _fail = function(item, options, data){
            if (options && options.fail){
                options.fail(_api, item ? item.first() : null, data);
            }
        };

        // process item loading with AJAX
        var ajaxLoad = function(item, options){
            options = _options(options, function(){
                _loading(item, false);
                _trigger(item, 'loaded');
            }, function(){
                _loading(item, false);
                _trigger(item, 'loadfail');
            });
            if (!item || isFolder(item)){
                _loadQueue.push(function(complete){
                    if (wasLoad(item)){
                        _success(item, options);
                        complete();
                        return;
                    }
                    _loading(item, true);
                    $.get(data.options.jsonUrl + (item ? getId(item) : ''), function(itemList){
                        if (itemList && (itemList instanceof Array) && itemList.length){
                            var process = function(){
                                if (wasLoad(item)){
                                    unload(item, {
                                        success: function(){
                                            _branch(item, itemList);
                                            _success(item, options);
                                            complete();
                                        },
                                        fail: function(){
                                            _fail(item, options);
                                            complete();
                                        },
                                        unanimated: options.unanimated
                                    });
                                } else {
                                    _branch(item, itemList);
                                    _success(item, options);
                                    complete();
                                }
                            };
                            setFolder(item, {
                                success: process,
                                fail: process
                            });
                        } else {
                            var process = function(){
                                _fail(item, options);
                                complete();
                            };
                            setFile(item, {
                                success: process,
                                fail: process
                            });
                        }
                    }, 'json').fail(function(){
                        _fail(item, options);
                        complete();
                    });
                }, true).run();
            } else {
                _fail(item, options);
            }
        };

        // process item init from options.itemData
        var initFrom = function(item, options){
            options = _options(options, function(){
                _loading(item, false);
                _trigger(item, 'loaded');
            }, function(){
                _loading(item, false);
                _trigger(item, 'loadfail');
            });
            if (!item || isFolder(item)){
                if (wasLoad(item)){
                    _success(item, options);
                    return;
                }
                _loading(item, true);
                if (options.itemData && (options.itemData instanceof Array) && options.itemData.length){
                    var process = function(){
                        if (wasLoad(item)){
                            unload(item, {
                                success: function(){
                                    _branch(item, options.itemData);
                                    _success(item, options);
                                },
                                fail: options.fail,
                                unanimated: options.unanimated
                            });
                        } else {
                            _branch(item, options.itemData);
                            _success(item, options);
                        }
                    };
                    setFolder(item, {
                        success: process,
                        fail: process
                    });
                } else {
                    setFile(item, {
                        success: options.fail,
                        fail: options.fail
                    });
                }
            } else {
                _fail(item, options);
            }
        };

        // unload item
        var unload = function(item, options){
            options = _options(options, function(){
                _trigger(item, 'unloaded');
            }, function(){
                _trigger(item, 'unloadfail');
            });
            if (!item || isFolder(item)){
                _loading(item, true);
                childrens(item, true).each(function(){
                    var item = $(this);
                    if (isFolder(item)){
                        _trigger(item, 'closed');
                        _trigger(item, 'unloaded');
                    }
                    _trigger(item, 'removed');
                });
                if (item){
                    if (isOpen(item)){
                        close(item, {
                            success: function(){
                                _loading(item);
                                _ensure(item);
                                _success(item, options);
                            },
                            fail: function(){
                                _loading(item);
                                _fail(item, options);
                            },
                            unanimated: options.unanimated
                        });
                    } else {
                        _loading(item);
                        _ensure(item);
                        _success(item, options);
                    }
                } else {
                    _animate(item, false, !data.options.animateRoot || options.unanimated, function(){
                        _loading(item);
                        _ensure(item);
                        _success(item, options);
                    });
                }
            } else {
                _fail(item, options);
            }
        };

        // remove item
        var remove = function(item, options){
            options = _options(options, function(){
                _trigger(item, 'removed');
            }, function(){
                _trigger(item, 'removefail');
            });
            if (isItem(item)){
                if (isFolder(item)){
                    if (wasLoad(item)){
                        unload(item, {
                            success: function(){
                                _success(item, options);
                                item.remove();
                            },
                            fail: options.fail,
                            unanimated: options.unanimated
                        });
                    } else {
                        _success(item, options);
                        item.remove();
                    }
                } else {
                    _success(item, options);
                    item.remove();
                }
            } else {
                _fail(item, options);
            }
        };

        // open item childrens
        var _openChilds = function(item, options){
            if (options.expand){
                var queue = new _queue(data.options.threads, true);
                childrens(item).each(function(){
                    var item = $(this);
                    if (isFolder(item)){
                        if (isOpen(item)){
                            _trigger(item, 'opened');
                        } else {
                            queue.push(function(complete){
                                open(item, {
                                    success: complete,
                                    fail: complete,
                                    expand: true,
                                    unanimated: options.unanimated
                                });
                            }, true);
                        }
                    }
                });
                queue.complete(function(){
                    _success(item, options);
                }).run(true);
            } else {
                _success(item, options);
            }
        };

        // process item open
        var _openItem = function(item, options){
            if (!options.unanimated && !isVisible(item)){
                options.unanimated = true;
            }
            if (options.unique){
                closeOthers(item);
                options.unique = false;
            }
            _animate(item, true, options.unanimated, function(){
                item.addClass('aciTreeOpen');
                _openChilds(item, options);
            });
        }

        // open a folder item and the childs if requested
        var open = function(item, options){
            options = _options(options, function(){
                _trigger(item, 'opened');
            }, function(){
                _trigger(item, 'openfail');
            });
            if (isFolder(item)){
                if (isOpen(item)){
                    _openChilds(item, options);
                } else {
                    if (wasLoad(item)){
                        _openItem(item, options);
                    } else {
                        ajaxLoad(item, {
                            success: function(){
                                _openItem(item, options);
                            },
                            fail: options.fail
                        });
                    }
                }
            } else {
                _fail(item, options);
            }
        };

        // close item childrens
        var _closeChilds = function(item, options){
            if (data.options.empty){
                options.unanimated = true;
                unload(item, options);
            } else if (options.collapse){
                var queue = new _queue(data.options.threads, true);
                childrens(item).each(function(){
                    var item = $(this);
                    if (isFolder(item)){
                        if (isOpen(item)){
                            queue.push(function(complete){
                                close(item, {
                                    success: complete,
                                    fail: complete,
                                    collapse: true,
                                    unanimated: true
                                });
                            }, true);
                        } else {
                            _trigger(item, 'closed');
                        }
                    }
                });
                queue.complete(function(){
                    _success(item, options);
                }).run(true);
            } else {
                _success(item, options);
            }
        };

        // process item close
        var _closeItem = function(item, options){
            if (!options.unanimated && !isVisible(item)){
                options.unanimated = true;
            }
            _animate(item, false, options.unanimated, function(){
                item.removeClass('aciTreeOpen');
                _closeChilds(item, options);
            });
        }

        // close a folder item and the childs if requested
        var close = function(item, options){
            options = _options(options, function(){
                _trigger(item, 'closed');
            }, function(){
                _trigger(item, 'closefail');
            });
            if (isFolder(item)){
                if (isOpen(item)){
                    _closeItem(item, options);
                } else if (wasLoad(item)){
                    _closeChilds(item, options);
                } else {
                    _success(item, options);
                }
            } else {
                _fail(item, options);
            }
        };

        // keep just one branch open
        var closeOthers = function(item, options){
            options = _options(options);
            if (isItem(item)){
                var queue = new _queue(data.options.threads, true);
                var exclude = item.add(getPath(item)).add(childrens(item, true));
                childrens(null, true).filter('.aciTreeOpen').not(exclude).each(function(){
                    var item = $(this);
                    queue.push(function(complete){
                        close(item, {
                            success: complete,
                            fail: complete,
                            unanimated: options.unanimated
                        });
                    }, true);
                });
                queue.complete(function(){
                    _success(item, options);
                }).run(true);
            } else {
                _fail(item, options);
            }
        };

        // toggle item
        var toggle = function(item, options){
            if (isOpen(item)){
                close(item, options);
            } else {
                open(item, options);
            }
        };

        // get item path (starting from top parent)
        // when 'reverse' is TRUE returns the path in reverse order
        // (top parent on last position)
        var getPath = function(item, reverse){
            if (item){
                var path = function(item){
                    var list = [];
                    var li = item.parent().parent();
                    if (li.hasClass('aciTreeLi')){
                        list = reverse ? list.concat(li.get(0), path(li)) : list.concat(path(li), li.get(0));
                    }
                    return list;
                };
                return $(path(item.first()));
            }
            return $([]);
        };

        // open path to item
        var openPath = function(item, options){
            options = _options(options);
            var path = getPath(item);
            if (path.length){
                var queue = new _queue(null, true);
                path.each(function(){
                    var item = $(this);
                    if (isOpen(item)){
                        _trigger(item, 'opened');
                    } else {
                        queue.push(function(complete){
                            open(item, {
                                success: complete,
                                fail: complete,
                                unanimated: options.unanimated
                            });
                        }, true);
                    }
                });
                queue.complete(function(){
                    _success(item, options);
                }).run();
            } else {
                _fail(item, options);
            }
        };

        // check if item is in view
        var isVisible = function(item){
            var state = true;
            getPath(item).each(function(){
                if (!$(this).is(':visible')){
                    state = false;
                    return false;
                }
            });
            if (state){
                var rect = $this.get(0).getBoundingClientRect();
                var size = item.first().find('.aciTreeItem');
                var test = size.get(0).getBoundingClientRect();
                var height = size.height();
                if ((test.bottom - height < rect.top) || (test.top + height > rect.bottom) || (test.right < rect.left) || (test.left > rect.right)){
                    return false;
                }
                return true;
            }
            return false;
        };

        // set item visible
        var setVisible = function(item, options){
            options = _options(options);
            if (isVisible(item)){
                _success(item, options);
            } else {
                openPath(item, {
                    success: function(){
                        var rect = $this.get(0).getBoundingClientRect();
                        var size = item.first().find('.aciTreeItem');
                        var test = size.get(0).getBoundingClientRect();
                        var height = size.height();
                        if (test.bottom - height < rect.top){
                            if (!options.unanimated && data.options.view){
                                $this.animate({
                                    scrollTop: $this.scrollTop() - rect.top + test.bottom - height
                                }, {
                                    duration: data.options.view.duration,
                                    easing: data.options.view.easing,
                                    complete: function(){
                                        _success(item, options);
                                    }
                                });
                            } else {
                                $this.scrollTop($this.scrollTop() - rect.top + test.bottom - height);
                                _success(item, options);
                            }
                        } else if (test.top + height > rect.bottom){
                            if (!options.unanimated && data.options.view){
                                $this.animate({
                                    scrollTop: $this.scrollTop() + test.top - rect.bottom + height
                                }, {
                                    duration: data.options.view.duration,
                                    easing: data.options.view.easing,
                                    complete: function(){
                                        _success(item, options);
                                    }
                                });
                            } else {
                                $this.scrollTop($this.scrollTop() + test.top - rect.bottom + height);
                                _success(item, options);
                            }
                        } else {
                            _success(item, options);
                        }
                    },
                    fail: options.fail
                });
            }
        };

        // check if a item have parent
        var haveParent = function(item){
            if (item){
                var li = item.first().parent().parent();
                return li.hasClass('aciTreeLi');
            }
            return false;
        };

        // get item parent
        var getParent = function(item){
            return item ? item.first().parent().parent().filter('.aciTreeLi') : $([]);
        };

        // get item top parent
        var getTopParent = function(item){
            if (isItem(item)){
                var path = getPath(item);
                return path.length ? path.eq(0) : $([]);
            }
            return $([]);
        };

        // create tree branch
        var _branch = function(item, itemList){
            if (item){
                item.removeClass('aciTreeFolderMaybe').addClass('aciTreeFolder');
            }
            var items = append(item, {
                itemData: itemList
            });
            var itemData;
            for(var i in itemList){
                itemData = itemList[i];
                if (itemData.items && (itemData.items instanceof Array) && itemData.items.length){
                    _branch(items.eq(i), itemData.items);
                }
                if (itemData.props && itemData.props.open){
                    open(items.eq(i));
                }
            }
        };

        // update item (create tree branch if requested)
        // if options.itemData have the 'items' property set then
        // will be like when calling 'initFrom' for the item
        var update = function(item, options){
            options = _options(options);
            if (isItem(item)){
                if (options.itemData.props && (options.itemData.props.isFolder || (options.itemData.props.isFolder === null))){
                    var process = function(){
                        setId(item, options.itemData.id);
                        setItem(item, options.itemData.item);
                        if (options.itemData.props){
                            setIcon(item, options.itemData.props.icon);
                        }
                        item = item.first();
                        item.removeClass('aciTreeFolder aciTreeFolderMaybe').addClass((options.itemData.props.isFolder ||
                            (options.itemData.items && options.itemData.items.length)) ? 'aciTreeFolder' : 'aciTreeFolderMaybe');
                        if (options.itemData.items){
                            if (wasLoad(item)){
                                unload(item, {
                                    success: function(){
                                        initFrom(item, {
                                            success: options.success,
                                            fail: options.fail,
                                            itemData: options.itemData.items
                                        });
                                    },
                                    fail: options.fail,
                                    unanimated: options.unanimated
                                });
                            } else {
                                initFrom(item, {
                                    success: options.success,
                                    fail: options.fail,
                                    itemData: options.itemData.items
                                });
                            }
                        } else {
                            _success(item, options);
                        }
                    };
                    setFolder(item, {
                        success: process,
                        fail: options.fail
                    });
                } else {
                    var process = function(){
                        setId(item, options.itemData.id);
                        setItem(item, options.itemData.item);
                        if (options.itemData.props){
                            setIcon(item, options.itemData.props.icon);
                        }
                    };
                    setFile(item, {
                        success: process,
                        fail: options.fail
                    });
                }
            } else {
                _fail(item, options);
            }
        }

        // process item for display
        var _item = function(api, item, itemData, level){
            if (data.options.callbacks && data.options.callbacks.item){
                data.options.callbacks.item(api, item, itemData, level);
                return;
            }
            setItem(item, itemData.item);
        };

        // create item from data
        var _create = function(itemData, path, level){
            var li = $('<li class="aciTreeLi"></li>').data('id' + $.aciTree.nameSpace, itemData.id);
            var html = '<div class="aciTreeButton"><div></div></div><div class="aciTreeItem">';
            if (itemData.props && itemData.props.icon){
                if (itemData.props.icon instanceof Array){
                    html += '<div class="aciTreeIcon ' + itemData.props.icon[0] + '" style="background-position:' +
                    itemData.props.icon[1] + 'px ' + itemData.props.icon[2] + 'px' + '"></div>';
                } else {
                    html += '<div class="aciTreeIcon ' + itemData.props.icon + '"></div>';
                }
            }
            li.append(html + '</div>');
            if (itemData.props && (itemData.props.isFolder || (itemData.props.isFolder === null))){
                li.addClass((itemData.props.isFolder || (itemData.items && itemData.items.length)) ? 'aciTreeFolder' : 'aciTreeFolderMaybe');
            } else {
                li.addClass('aciTreeFile');
            }
            _item(_api, li, itemData, level);
            return li;
        };

        // add one or more items
        var _insert = function(ul, before, after, itemData, path, level){
            if (itemData){
                var items = [];
                if (itemData instanceof Array){
                    for(var i in itemData){
                        items[items.length] = _create(itemData[i], path, level).get(0);
                    }
                } else {
                    items[items.length] = _create(itemData, path, level).get(0);
                }
                items = $(items);
                if (ul){
                    ul.append(items);
                } else if (before){
                    before.before(items);
                } else if (after){
                    after.after(items);
                }
                return items;
            }
            return $([]);
        };

        // ensure childrens container
        var _ensure = function(item, state){
            if (!item){
                item = $this;
            }
            var ul = item.find('>.aciTreeUl');
            if (state)
            {
                if (!ul.length){
                    ul = $('<ul class="aciTreeUl" style="display:none"></ul>');
                    item.append(ul);
                }
                return ul;
            }
            ul.remove();
        };

        // append one or more items to item
        var append = function(item, options){
            options = _options(options, function(){
                _trigger(item, 'appended');
            }, function(){
                _trigger(item, 'appendfail');
            });
            if (item){
                if (isFolder(item)){
                    item = item.first();
                    var ul = _ensure(item, true);
                    var list = _insert(ul, null, null, options.itemData, getPath(item).add(item), getLevel(item) + 1);
                    if (list.length){
                        item.addClass('aciTreeFolder').removeClass('aciTreeFolderMaybe');
                        list.each(function(){
                            _trigger($(this), 'added');
                        });
                    } else if (!childrens(item).length){
                        ul.remove();
                    }
                    _success(item, options);
                    return list;
                } else {
                    _fail(item, options);
                    return $([]);
                }
            } else {
                var ul = _ensure($this, true);
                var list = _insert(ul, null, null, options.itemData, null, 0);
                if (list.length){
                    _animate(null, true, !data.options.animateRoot || options.unanimated);
                    list.each(function(){
                        _trigger($(this), 'added');
                    });
                } else if (!childrens().length){
                    ul.remove();
                }
                _success(item, options);
                return list;
            }
        };

        // insert one or more items before item
        var before = function(item, options){
            options = _options(options, function(){
                _trigger(item, 'before');
            }, function(){
                _trigger(item, 'beforefail');
            });
            if (isItem(item)){
                item = item.first();
                var list = _insert(null, item, null, options.itemData, getPath(item), getLevel(item));
                list.each(function(){
                    _trigger($(this), 'added');
                });
                _success(item, options);
                return list;
            } else {
                _fail(item, options);
                return $([]);
            }
        };

        // insert one or more items after item
        var after = function(item, options){
            options = _options(options, function(){
                _trigger(item, 'after');
            }, function(){
                _trigger(item, 'afterfail');
            });
            if (isItem(item)){
                item = item.first();
                var list = _insert(null, null, item, options.itemData, getPath(item), getLevel(item));
                list.each(function(){
                    _trigger($(this), 'added');
                });
                _success(item, options);
                return list;
            } else {
                _fail(item, options);
                return $([]);
            }
        };

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
        };

        // get item childrens
        // if 'branch' is TRUE then all childrens are returned
        var childrens = function(item, branch){
            if (!item){
                item = $this;
            }
            return item.first().find(branch ? '>.aciTreeUl .aciTreeLi' : '>.aciTreeUl>.aciTreeLi');
        };

        // check if item is a folder
        var isFolder = function(item){
            return item && (item.first().hasClass('aciTreeFolder') || item.first().hasClass('aciTreeFolderMaybe'));
        };

        // check if item is a file
        var isFile = function(item){
            return item && item.first().hasClass('aciTreeFile');
        };

        // check if item was loaded
        var wasLoad = function(item){
            if (!item){
                return $this.find('>.aciTreeUl').length > 0;
            }
            if (isFolder(item)){
                return item.first().find('>.aciTreeUl').length > 0;
            }
            return true;
        };

        // set item as folder
        var setFolder = function(item, options){
            options = _options(options, function(){
                _trigger(item, 'folderset');
            });
            if (isItem(item)){
                if (isFile(item)){
                    item.first().removeClass('aciTreeFile').addClass('aciTreeFolder');
                }
                _success(item, options);
            } else {
                _fail(item, options);
            }
        };

        // set item as file
        var setFile = function(item, options){
            options = _options(options, function(){
                _trigger(item, 'fileset');
            });
            if (isItem(item)){
                if (isFolder(item)){
                    if (wasLoad(item)){
                        unload(item, {
                            success: function(){
                                item.first().removeClass('aciTreeFolder aciTreeFolderMaybe aciTreeOpen').addClass('aciTreeFile');
                                _success(item, options);
                            },
                            fail: options.fail,
                            unanimated: options.unanimated
                        });
                    } else {
                        item.first().removeClass('aciTreeFolder aciTreeFolderMaybe aciTreeOpen').addClass('aciTreeFile');
                        _success(item, options);
                    }
                } else {
                    _success(item, options);
                }
            } else {
                _fail(item, options);
            }
        };

        // set the icon for item
        // icon - CSS class name or Array [class name, background x position, background y position]
        var setIcon = function(item, icon){
            if (isItem(item)){
                item = item.first();
                var html = item.find('>.aciTreeItem');
                var found = html.find('>.aciTreeIcon:first-child');
                if (found.length){
                    if (icon){
                        if (icon instanceof Array){
                            found.attr('class', 'aciTreeIcon ' + icon[0]).css('background-position', icon[1] + 'px ' + icon[2] + 'px');
                        } else {
                            found.attr('class', 'aciTreeIcon ' + icon);
                        }
                    } else {
                        found.remove();
                    }
                } else if (icon){
                    if (icon instanceof Array){
                        html.prepend('<div class="aciTreeIcon ' + icon[0] + '" style="background-position:' +
                            icon[1] + 'px ' + icon[2] + 'px' + '"></div>');
                    } else {
                        html.prepend('<div class="aciTreeIcon ' + icon + '"></div>');
                    }
                }
                return true;
            }
            return false;
        };

        // set item content
        var setItem = function(item, content){
            if (isItem(item)){
                item = item.first();
                var old = getText(item);
                var html = item.find('>.aciTreeItem');
                var icon = html.find('>.aciTreeIcon:first-child').detach();
                html.html(content).prepend(icon);
                _trigger(item, 'itemset', {
                    oldText: old
                });
                return true;
            }
            return false;
        };

        // check if item is open
        var isOpen = function(item){
            return item && item.first().hasClass('aciTreeOpen');
        };

        // check if item is closed
        var isClosed = function(item){
            return !isOpen(item);
        };

        // check if item have childrens
        // if 'branch' is TRUE then all childrens are counted
        var haveChildrens = function(item, branch){
            return childrens(item, branch).length > 0;
        };

        // check if item have siblings
        var haveSiblings = function(item){
            return item && (item.first().siblings('.aciTreeLi:first').length > 0);
        };

        // check if item have another before
        var havePrev = function(item){
            return getPrev(item).length > 0;
        };

        // check if item have another after
        var haveNext = function(item){
            return getNext(item).length > 0;
        };

        // get item siblings
        var siblings = function(item){
            return item ? item.first().siblings('.aciTreeLi') : $([]);
        };

        // get previous item
        var getPrev = function(item){
            return item ? item.first().prev('.aciTreeLi') : $([]);
        };

        // get next item
        var getNext = function(item){
            return item ? item.first().next('.aciTreeLi') : $([]);
        };

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
        };

        // get item ID (NULL if not found)
        var getId = function(item){
            return item ? item.first().data('id' + $.aciTree.nameSpace) : null;
        };

        // set item ID
        var setId = function(item, id){
            if (id && isItem(item)){
                var old = getId(item);
                item.first().data('id' + $.aciTree.nameSpace, id);
                _trigger(item, 'idset', {
                    oldId: old
                });
                return true;
            }
            return false;
        };

        // get item index starting from 0
        var getIndex = function(item){
            if (isItem(item)){
                var parent = item.parent();
                return parent.find('>.aciTreeLi').index(item.first());
            }
            return null;
        };

        // get item text value (NULL if not found)
        var getText = function(item){
            return (item ? item.first().find('>.aciTreeItem').text() : null);
        };

        // swap two items
        var swap = function(item1, item2){
            if (isItem(item1) && isItem(item2) && !isChildren(item1, item2) && !isChildren(item2, item1) && (item1.get(0) != item2.get(0))){
                item1 = item1.first();
                item2 = item2.first();
                var prev = getPrev(item1);
                if (prev.length){
                    if (item2.get(0) == prev.get(0)){
                        item2.before(item1);
                    } else {
                        item1.insertAfter(item2);
                        item2.insertAfter(prev);
                    }
                } else {
                    var next = getNext(item1);
                    if (next.length){
                        if (item2.get(0) == next.get(0)){
                            item2.after(item1);
                        } else {
                            item1.insertAfter(item2);
                            item2.insertBefore(next);
                        }
                    } else {
                        var parent = item1.parent();
                        item1.insertAfter(item2);
                        parent.append(item2);
                    }
                }
                _trigger(null, 'swapped', {
                    item1: item1,
                    item2: item2
                });
                return true;
            }
            return false;
        };

        // move item up
        var moveUp = function(item){
            if (isItem(item)){
                var prev = getPrev(item);
                var old = getIndex(item);
                if (prev.length){
                    prev.before(item.first());
                }
                _trigger(item, 'movedup', {
                    oldIndex: old
                });
                return true;
            }
            return false;
        };

        // move item down
        var moveDown = function(item){
            if (isItem(item)){
                var next = getNext(item);
                var old = getIndex(item);
                if (next.length){
                    next.after(item.first());
                }
                _trigger(item, 'moveddown', {
                    oldIndex: old
                });
                return true;
            }
            return false;
        };

        // move item in first position
        var moveFirst = function(item){
            if (isItem(item)){
                var parent = getParent(item);
                if (!parent.length){
                    parent = $this;
                }
                var old = getIndex(item);
                parent.find('>.aciTreeUl').prepend(item.first());
                _trigger(item, 'movedfirst', {
                    oldIndex: old
                });
                return true;
            }
            return false;
        };

        // move item in last position
        var moveLast = function(item){
            if (isItem(item)){
                var parent = getParent(item);
                if (!parent.length){
                    parent = $this;
                }
                var old = getIndex(item);
                parent.find('>.aciTreeUl').append(item.first());
                _trigger(item, 'movedlast', {
                    oldIndex: old
                });
                return true;
            }
            return false;
        };

        // check if parent have children
        var isChildren = function(parent, children){
            if (isItem(children)){
                return (childrens(parent, true).filter(children.first()).length == 1);
            }
            return false;
        };

        // check if parent have immediate children
        var isImmediateChildren = function(parent, children){
            if (isItem(children)){
                var check = getParent(children);
                if (check.length){
                    return parent && (check.get(0) == parent.get(0));
                } else {
                    return !parent;
                }
            }
            return false;
        };

        // check if items share the same parent
        var sameParent = function(item1, item2){
            if (isItem(item1) && isItem(item2)){
                var parent1 = getParent(item1);
                var parent2 = getParent(item2);
                return (!parent1.length && !parent2.length) || (parent1.get(0) == parent2.get(0));
            }
            return false;
        };

        // check if items share the same top parent
        var sameTopParent = function(item1, item2){
            if (isItem(item1) && isItem(item2)){
                var parent1 = getTopParent(item1);
                var parent2 = getTopParent(item2);
                return (!parent1.length && !parent2.length) || (parent1.get(0) == parent2.get(0));
            }
            return false;
        }

        // search a 'path' ID from a parent
        var _search = function(parent, pathId){
            var items = childrens(parent);
            var item, id, length, found, exact = false;
            for(var i = 0, size = items.length; i < size; i++){
                item = items.eq(i);
                id = item.data('id' + $.aciTree.nameSpace);
                if (id){
                    length = id.length;
                    if (length){
                        if (id == pathId.substr(0, length)){
                            found = item;
                            exact = pathId.length == length;
                            break;
                        }
                    }
                }
            }
            if (found){
                if (!exact){
                    // try to search childrens
                    var child = _search(found, pathId);
                    if (child){
                        return child;
                    }
                }
                return {
                    item: found,
                    exact: exact
                };
            } else {
                return null;
            }
        };

        // search items by ID
        // if 'path' is TRUE then the search will be more optimized
        // and reduced to the first branch that matches the ID
        // but the ID must be set like a path otherwise will not work
        // if 'load' is TRUE will also try to load nodes (works only when 'path' is TRUE)
        var searchId = function(id, path, load, options){
            options = _options(options);
            if (id){
                if (path){
                    if (load){
                        var process = function(item){
                            var found = _search(item, id);
                            if (found){
                                if (found.exact){
                                    _success(found.item, options);
                                } else {
                                    if (wasLoad(found.item)){
                                        _fail(item, options);
                                    } else {
                                        ajaxLoad(found.item, {
                                            success: function(){
                                                process(found.item);
                                            },
                                            fail: options.fail
                                        });
                                    }
                                }
                            } else {
                                _fail(item, options);
                            }
                        };
                        process();
                        return $([]);
                    } else {
                        var found = _search(null, id);
                        if (found && found.exact){
                            _success(found, options);
                            return found.item;
                        }
                    }
                } else {
                    var list = [];
                    var data = 'id' + $.aciTree.nameSpace;
                    $this.find('.aciTreeLi').each(function(){
                        if ($(this).data(data) == id){
                            list[list.length] = this;
                        }
                    });
                    if (list.length){
                        var found = $(list);
                        _success(found, options, found);
                        return found
                    }
                }
            }
            _fail(null, options);
            return $([]);
        };

        // check if it's a valid item
        var isItem = function(item){
            return item && item.first().hasClass('aciTreeLi');
        };

        // item animation
        var _animate = function(item, state, unanimated, callback){
            if (!item){
                item = $this;
            }
            if (!unanimated){
                var type = state ? data.options.show : data.options.hide;
                if (type) {
                    var ul = item.first().find('>.aciTreeUl');
                    if (ul.length){
                        ul.stop(true).animate(type.props, {
                            duration: type.duration,
                            easing: type.easing,
                            complete: callback
                        });
                    } else if (callback){
                        callback();
                    }
                    return;
                }
            }
            item.first().find('>.aciTreeUl').stop(true).toggle(state);
            if (callback){
                callback();
            }
        };

        // the load queue
        var _loadQueue = new _queue(data ? data.options.threads : null);

        // get first child of item
        var getFirst = function(item){
            if (!item){
                item = $this;
            }
            return item.first().find('>.aciTreeUl>.aciTreeLi:first');
        };

        // get last child of item
        var getLast = function(item){
            if (!item){
                item = $this;
            }
            return item.first().find('>.aciTreeUl>.aciTreeLi:last');
        };

        // return TRUE if item is loading
        var isBusy = function(item){
            if (item){
                return item.first().hasClass('aciTreeLoad');
            } else {
                return !_loadQueue.empty() || !_branchQueue.empty();
            }
        };

        // set loading state
        var _loading = function(item, state){
            if (item){
                item.toggleClass('aciTreeLoad', state);
            } else if (state){
                _loader(state);
            }
        };

        var _loaderHide = null;
        var _loaderInterval = null;

        // show loader image
        var _loader = function(show){
            if (show || isBusy()){
                if (!_loaderInterval){
                    _loaderInterval = setInterval(_loader, data.options.loaderDelay);
                }
                $this.toggleClass('aciTreeLoad', true);
                clearTimeout(_loaderHide);
                _loaderHide = setTimeout(function(){
                    $this.toggleClass('aciTreeLoad', false);
                }, data.options.loaderDelay * 2);
            }
        };

        // the branch queue
        var _branchQueue = new _queue(null, true);

        // callback call for each item childrens
        // when 'load' is TRUE will also try to load nodes
        var branch = function(item, callback, load){
            var process = function(item, callback, next){
                var child = next ? getNext(item) : getFirst(item);
                if (child.length){
                    if (isFolder(child)){
                        if (wasLoad(child)){
                            _branchQueue.push(function(){
                                callback(_api, child);
                                process(child, callback);
                                process(child, callback, true);
                            }).run();
                        } else if (load) {
                            _branchQueue.push(function(complete){
                                ajaxLoad(child, {
                                    success: function(){
                                        callback(_api, child);
                                        process(child, callback);
                                        process(child, callback, true);
                                        complete();
                                    },
                                    fail: function(){
                                        process(child, callback, true);
                                        complete();
                                    }
                                });
                            }, true).run();
                        } else {
                            _branchQueue.push(function(){
                                callback(_api, child);
                                process(child, callback, true);
                            }).run();
                        }
                    } else {
                        _branchQueue.push(function(){
                            callback(_api, child);
                            process(child, callback, true);
                        }).run();
                    }
                }
            }
            process(item, callback);
        };

        // destroy control
        var _destroy = function(){
            if (wasInit()){
                if (isLocked()){
                    _trigger(null, 'locked');
                }
                data.locked = true;
                $this.toggleClass('aciTreeLoad', true);
                _branchQueue.destroy();
                _loadQueue.destroy();
                unload(null, {
                    success: function(){
                        clearTimeout(_loaderHide);
                        clearInterval(_loaderInterval);
                        $this.off($.aciTree.nameSpace, '.aciTreeButton');
                        $this.data($.aciTree.nameSpace, null);
                        data.wasInit = false;
                        $this.toggleClass('aciTreeLoad', false);
                        data.locked = false;
                        _trigger(null, 'destroyed');
                    },
                    fail: function(){
                        $this.toggleClass('aciTreeLoad', false);
                        data.locked = false;
                        _trigger(null, 'destroyfail');
                    }
                });
            } else {
                _trigger(null, 'notinit');
            }
        };

        // treeview api
        var _api = {
            itemFrom: itemFrom,
            getId: getId,
            getText: getText,
            getLevel: getLevel,
            getIndex: getIndex,
            searchId: searchId,

            isItem: isItem,
            isFile: isFile,
            isFolder: isFolder,
            wasLoad: wasLoad,

            setId: setId,
            setFolder: setFolder,
            setFile: setFile,
            setIcon: setIcon,
            setItem: setItem,
            update: update,

            haveParent: haveParent,
            getParent: getParent,
            getTopParent: getTopParent,
            getPath: getPath,
            sameParent: sameParent,
            sameTopParent: sameTopParent,

            after: after,
            before: before,
            append: append,
            unload: unload,
            remove: remove,
            swap: swap,
            moveUp: moveUp,
            moveDown: moveDown,
            moveFirst: moveFirst,
            moveLast: moveLast,

            toggle: toggle,
            open: open,
            openPath: openPath,
            close: close,
            closeOthers: closeOthers,
            isOpen: isOpen,
            isClosed: isClosed,
            isVisible: isVisible,
            setVisible: setVisible,

            haveSiblings: haveSiblings,
            havePrev: havePrev,
            haveNext: haveNext,
            haveChildrens: haveChildrens,
            isChildren: isChildren,
            isImmediateChildren: isImmediateChildren,

            siblings: siblings,
            getFirst: getFirst,
            getLast: getLast,
            getPrev: getPrev,
            getNext: getNext,
            childrens: childrens,

            initFrom: initFrom,
            ajaxLoad: ajaxLoad,
            isBusy: isBusy,
            branch: branch,

            init: _init,
            wasInit: wasInit,
            isLocked: isLocked,
            option: function(option, value){
                if (data){
                    // set a option
                    data.options[option] = value;
                    $this.data($.aciTree.nameSpace, data);
                }
            },
            options: function(){
                // get options
                return data ? data.options : null;
            },
            destroy: _destroy
        };

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
                        _init();
                        break;
                    case 'api':
                        // expose api
                        return _api;
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
                        _destroy();
                        break;
                }
            }
        }

        return $this;

        // ToDo: implement the 'selectable' option & keyboard navigation

    };

})(jQuery);
