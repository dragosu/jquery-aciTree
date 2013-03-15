
/*
 * aciTree jQuery Plugin v2.2.0
 * http://acoderinsights.ro
 *
 * Copyright (c) 2013 Dragos Ursu
 * Dual licensed under the MIT or GPL Version 2 licenses.
 *
 * Require jQuery Library >= v1.7.1 http://jquery.com
 * + aciPlugin >= v1.1.0 https://github.com/dragosu/jquery-aciPlugin
 *
 * Date: Thu Mar 14 20:10 2013 +0200
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

    // default options

    var options = {
        jsonUrl: null,                  // URL to the JSON provider, something like 'path/script?branch=' (will add the node ID value on load)
        rootData: null,                 // initial ROOT data for the Tree (if NULL then one initial AJAX request is made on init)
        threads: 4,                     // how many AJAX load requests will be run in the same time?
        queueDelay: 40,                 // a small delay for our queue implementation (less = uses more CPU, more = slower tree processing)
        loaderDelay: 500,               // how many msec to wait before showing the main loader? (on lengthy operations)
        expand: false,                  // if TRUE then all childrens of a node are expanded when the node is opened
        collapse: false,                // if TRUE then all childrens of a node are collapsed when the node is closed
        unique: false,                  // if TRUE then a single tree branch will stay open, the oters are closed when a node is opened
        empty: false,                   // if TRUE then all childrens of a node are removed when the node is closed
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
        callbacks: {
            // item : function(api, item, itemData, level)
            item: null                  // called when a new item is added, by default the item text is added to the DOM
        }
    };

    // aciTree plugin core

    var aciTree_core = {

        __extend: function(){
            // add extra data
            $.extend(this._instance, {
                locked: false,
                // the load queue
                _loadQueue: new this._queue(this._instance.options.threads, false, this._instance.options.queueDelay),
                // timeouts for the loader
                _loaderHide: null,
                _loaderInterval: null
            });
        },

        init: function(){
            var _this = this;
            if (_this.wasInit()){
                _this._trigger(null, 'wasinit');
                return false;
            }
            if (_this.isLocked()){
                _this._trigger(null, 'locked');
                return false;
            }
            _this._instance.locked = true;
            _this._instance.jQuery.on('click' + _this._instance.nameSpace, 'div.aciTreeButton', function(e){
                var item = $(e.target).parent();
                _this.toggle(item, {
                    collapse: _this._instance.options.collapse,
                    expand: _this._instance.options.expand,
                    unique: _this._instance.options.unique
                });
            });
            _this._init();
            // we keep the _super reference because this method can exit before 'success' or 'fail' will be run
            var _super = _this._super;
            var success = function(){
                // call the parent
                _super.apply(_this);
                _this._instance.locked = false;
                _this._trigger(null, 'init');
            };
            var fail = function(){
                // call the parent
                _super.apply(_this);
                _this._instance.locked = false;
                _this._trigger(null, 'initfail');
            };
            if (_this._instance.options.rootData){
                _this.initFrom(null, {
                    success: success,
                    fail: fail,
                    itemData: _this._instance.options.rootData
                });
            } else if (_this._instance.options.jsonUrl){
                _this.ajaxLoad(null, {
                    success: success,
                    fail: fail
                });
            } else {
                success();
            }
            return true;
        },

        _init: function(){
        // override this to do extra init when extending
        },

        // check locked state
        isLocked: function(){
            return this._instance.locked;
        },

        // a small queue implementation
        _queue: function(threads, realtime, delay){
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
                }, delay);
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
                var _self = this;
                setTimeout(function(){
                    if ((load >= workers) || locked){
                        return;
                    }
                    var item = fifo.shift();
                    if (!item){
                        if (fifo.length){
                            setTimeout(function(){
                                _self.run();
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
                                _self.run();
                            });
                        } else {
                            load++;
                            item.callback();
                            load--;
                            _self.run();
                        }
                    }
                }, realtime ? 10 : delay);
            };
        },

        // options object (need to be in this form for all API functions
        // that have a 'options' parameter, not all properties are required)
        _options: function(object, success, fail){
            var options = $.extend({
                success: null, // success callback
                fail: null, // fail callback
                expand: false, // propagate (on open)
                collapse: false, // propagate (on close)
                unique: false, // keep a single branch open (on open)
                unanimated: false, // unanimated (open/close/toggle)
                itemData: null // item data (init[Array], append[Array/object], after/before[Array/object])
            }, object);
            if (success){
                if (object && object.success) {
                    options.success = function(){
                        success();
                        object.success();
                    };
                } else {
                    options.success = success;
                }
            }
            if (fail){
                if (object && object.fail) {
                    options.fail = function(){
                        fail();
                        object.fail();
                    };
                } else {
                    options.fail = fail;
                }
            }
            return options;
        },

        // triger event
        _trigger: function(item, event, data){
            data = $.extend({
                event: event
            }, data);
            this._instance.jQuery.trigger('acitree', [this, item ? item.first() : null, data]);
        },

        // call on success
        _success: function(item, options, data){
            if (options && options.success){
                options.success(this, item ? item.first() : null, data);
            }
        },

        // call on fail
        _fail: function(item, options, data){
            if (options && options.fail){
                options.fail(this, item ? item.first() : null, data);
            }
        },

        // process item loading with AJAX
        ajaxLoad: function(item, options){
            var _this = this;
            options = _this._options(options, function(){
                _this._loading(item, false);
                _this._trigger(item, 'loaded');
            }, function(){
                _this._loading(item, false);
                _this._trigger(item, 'loadfail');
            });
            if (!item || _this.isFolder(item)){
                _this._instance._loadQueue.push(function(complete){
                    if (_this.wasLoad(item)){
                        _this._success(item, options);
                        complete();
                        return;
                    }
                    _this._loading(item, true);
                    $.get(_this._instance.options.jsonUrl + (item ? _this.getId(item) : ''), function(itemList){
                        if (itemList && (itemList instanceof Array) && itemList.length){
                            var process = function(){
                                if (_this.wasLoad(item)){
                                    _this.unload(item, {
                                        success: function(){
                                            _this._branch(item, itemList);
                                            _this._success(item, options);
                                            complete();
                                        },
                                        fail: function(){
                                            _this._fail(item, options);
                                            complete();
                                        },
                                        unanimated: options.unanimated
                                    });
                                } else {
                                    _this._branch(item, itemList);
                                    _this._success(item, options);
                                    complete();
                                }
                            };
                            _this.setFolder(item, {
                                success: process,
                                fail: process
                            });
                        } else {
                            var process = function(){
                                _this._fail(item, options);
                                complete();
                            };
                            _this.setFile(item, {
                                success: process,
                                fail: process
                            });
                        }
                    }, 'json').fail(function(){
                        _this._fail(item, options);
                        complete();
                    });
                }, true).run();
            } else {
                _this._fail(item, options);
            }
        },

        // process item init from options.itemData
        initFrom: function(item, options){
            var _this = this;
            options = _this._options(options, function(){
                _this._loading(item, false);
                _this._trigger(item, 'loaded');
            }, function(){
                _this._loading(item, false);
                _this._trigger(item, 'loadfail');
            });
            if (!item || _this.isFolder(item)){
                if (_this.wasLoad(item)){
                    _this._success(item, options);
                    return;
                }
                _this._loading(item, true);
                if (options.itemData && (options.itemData instanceof Array) && options.itemData.length){
                    var process = function(){
                        if (_this.wasLoad(item)){
                            _this.unload(item, {
                                success: function(){
                                    _this._branch(item, options.itemData);
                                    _this._success(item, options);
                                },
                                fail: options.fail,
                                unanimated: options.unanimated
                            });
                        } else {
                            _this._branch(item, options.itemData);
                            _this._success(item, options);
                        }
                    };
                    _this.setFolder(item, {
                        success: process,
                        fail: process
                    });
                } else {
                    _this.setFile(item, {
                        success: options.fail,
                        fail: options.fail
                    });
                }
            } else {
                _this._fail(item, options);
            }
        },

        // unload item
        unload: function(item, options){
            var _this = this;
            options = _this._options(options, function(){
                _this._trigger(item, 'unloaded');
            }, function(){
                _this._trigger(item, 'unloadfail');
            });
            if (!item || _this.isFolder(item)){
                _this._loading(item, true);
                _this.childrens(item, true).each(function(){
                    var item = $(this);
                    if (_this.isFolder(item)){
                        _this._trigger(item, 'closed');
                        _this._trigger(item, 'unloaded');
                    }
                    _this._trigger(item, 'removed');
                });
                if (item){
                    if (_this.isOpen(item)){
                        _this.close(item, {
                            success: function(){
                                _this._loading(item);
                                _this._ensure(item);
                                _this._success(item, options);
                            },
                            fail: function(){
                                _this._loading(item);
                                _this._fail(item, options);
                            },
                            unanimated: options.unanimated
                        });
                    } else {
                        _this._loading(item);
                        _this._ensure(item);
                        _this._success(item, options);
                    }
                } else {
                    _this._animate(item, false, !_this._instance.options.animateRoot || options.unanimated, function(){
                        _this._loading(item);
                        _this._ensure(item);
                        _this._success(item, options);
                    });
                }
            } else {
                _this._fail(item, options);
            }
        },

        // remove item
        remove: function(item, options){
            var _this = this;
            options = _this._options(options, function(){
                _this._trigger(item, 'removed');
            }, function(){
                _this._trigger(item, 'removefail');
            });
            if (_this.isItem(item)){
                if (_this.isFolder(item)){
                    if (_this.wasLoad(item)){
                        _this.unload(item, {
                            success: function(){
                                _this._success(item, options);
                                item.remove();
                            },
                            fail: options.fail,
                            unanimated: options.unanimated
                        });
                    } else {
                        _this._success(item, options);
                        item.remove();
                    }
                } else {
                    _this._success(item, options);
                    item.remove();
                }
            } else {
                _this._fail(item, options);
            }
        },

        // open item childrens
        _openChilds: function(item, options){
            var _this = this;
            if (options.expand){
                var queue = new _this._queue(_this._instance.options.threads, true, _this._instance.options.queueDelay);
                _this.childrens(item).each(function(){
                    var item = $(this);
                    if (_this.isFolder(item)){
                        if (_this.isOpen(item)){
                            _this._trigger(item, 'opened');
                        } else {
                            queue.push(function(complete){
                                _this.open(item, {
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
                    _this._success(item, options);
                }).run(true);
            } else {
                _this._success(item, options);
            }
        },

        // process item open
        _openItem: function(item, options){
            var _this = this;
            if (!options.unanimated && !_this.isVisible(item)){
                options.unanimated = true;
            }
            if (options.unique){
                _this.closeOthers(item);
                options.unique = false;
            }
            item.addClass('aciTreeOpen');
            _this._animate(item, true, options.unanimated, function(){
                _this._openChilds(item, options);
            });
        },

        // open a folder item and the childs if requested
        open: function(item, options){
            var _this = this;
            options = _this._options(options, function(){
                _this._trigger(item, 'opened');
            }, function(){
                _this._trigger(item, 'openfail');
            });
            if (_this.isFolder(item)){
                if (_this.isOpen(item)){
                    _this._openChilds(item, options);
                } else {
                    if (_this.wasLoad(item)){
                        _this._openItem(item, options);
                    } else {
                        _this.ajaxLoad(item, {
                            success: function(){
                                _this._openItem(item, options);
                            },
                            fail: options.fail
                        });
                    }
                }
            } else {
                _this._fail(item, options);
            }
        },

        // close item childrens
        _closeChilds: function(item, options){
            var _this = this;
            if (_this._instance.options.empty){
                options.unanimated = true;
                _this.unload(item, options);
            } else if (options.collapse){
                var queue = new _this._queue(_this._instance.options.threads, true, _this._instance.options.queueDelay);
                _this.childrens(item).each(function(){
                    var item = $(this);
                    if (_this.isFolder(item)){
                        if (_this.isOpen(item)){
                            queue.push(function(complete){
                                _this.close(item, {
                                    success: complete,
                                    fail: complete,
                                    collapse: true,
                                    unanimated: true
                                });
                            }, true);
                        } else {
                            _this._trigger(item, 'closed');
                        }
                    }
                });
                queue.complete(function(){
                    _this._success(item, options);
                }).run(true);
            } else {
                _this._success(item, options);
            }
        },

        // process item close
        _closeItem: function(item, options){
            var _this = this;
            if (!options.unanimated && !_this.isVisible(item)){
                options.unanimated = true;
            }
            item.removeClass('aciTreeOpen');
            _this._animate(item, false, options.unanimated, function(){
                _this._closeChilds(item, options);
            });
        },

        // close a folder item and the childs if requested
        close: function(item, options){
            var _this = this;
            options = _this._options(options, function(){
                _this._trigger(item, 'closed');
            }, function(){
                _this._trigger(item, 'closefail');
            });
            if (_this.isFolder(item)){
                if (_this.isOpen(item)){
                    _this._closeItem(item, options);
                } else if (_this.wasLoad(item)){
                    _this._closeChilds(item, options);
                } else {
                    _this._success(item, options);
                }
            } else {
                _this._fail(item, options);
            }
        },

        // keep just one branch open
        closeOthers: function(item, options){
            var _this = this;
            options = _this._options(options);
            if (_this.isItem(item)){
                var queue = new _this._queue(_this._instance.options.threads, true, _this._instance.options.queueDelay);
                var exclude = item.add(_this.getPath(item)).add(_this.childrens(item, true));
                _this.childrens(null, true).filter('.aciTreeOpen').not(exclude).each(function(){
                    var item = $(this);
                    queue.push(function(complete){
                        _this.close(item, {
                            success: complete,
                            fail: complete,
                            unanimated: options.unanimated
                        });
                    }, true);
                });
                queue.complete(function(){
                    _this._success(item, options);
                }).run(true);
            } else {
                _this._fail(item, options);
            }
        },

        // toggle item
        toggle: function(item, options){
            if (this.isOpen(item)){
                this.close(item, options);
            } else {
                this.open(item, options);
            }
        },

        // get item path (starting from top parent)
        // when 'reverse' is TRUE returns the path in reverse order
        // (top parent on last position)
        getPath: function(item, reverse){
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
        },

        // check if item is in view
        isVisible: function(item){
            var _this = this;
            var state = true;
            _this.getPath(item).each(function(){
                if (!_this.isOpen($(this))){
                    state = false;
                    return false;
                }
            });
            if (state && _this.isItem(item)){
                var rect = _this._instance.jQuery.get(0).getBoundingClientRect();
                var size = item.first().find('>div.aciTreeItem');
                var test = size.get(0).getBoundingClientRect();
                var height = size.outerHeight(true);
                if ((test.bottom - height < rect.top) || (test.top + height > rect.bottom) || (test.right < rect.left) || (test.left > rect.right)){
                    return false;
                }
                return true;
            }
            return false;
        },

        // open path to item
        openPath: function(item, options){
            var _this = this;
            options = _this._options(options);
            var path = _this.getPath(item);
            if (path.length){
                var queue = new _this._queue(null, true, _this._instance.options.queueDelay);
                path.each(function(){
                    var item = $(this);
                    if (_this.isOpen(item)){
                        _this._trigger(item, 'opened');
                    } else {
                        queue.push(function(complete){
                            _this.open(item, {
                                success: complete,
                                fail: complete,
                                unanimated: options.unanimated
                            });
                        }, true);
                    }
                });
                queue.complete(function(){
                    _this._success(item, options);
                }).run();
            } else {
                _this._fail(item, options);
            }
        },

        // get speed for required size vs totalSize for animations
        _speedFraction: function(speed, totalSize, required){
            if (required < totalSize){
                var numeric = parseInt(speed);
                if (isNaN(numeric)){
                    switch (speed){
                        case 'slow':
                            numeric = 600;
                            break;
                        case 'medium':
                            numeric = 400;
                            break;
                        case 'fast':
                            numeric = 200;
                            break;
                        default:
                            return speed;
                    }
                }
                return numeric * required / totalSize;
            }
            return speed;
        },

        // set item visible
        setVisible: function(item, options){
            var _this = this;
            options = _this._options(options);
            if (_this.isVisible(item)){
                _this._success(item, options);
            } else if (_this.isItem(item)){
                var show = function(){
                    var rect = _this._instance.jQuery.get(0).getBoundingClientRect();
                    var size = item.first().find('>div.aciTreeItem');
                    var test = size.get(0).getBoundingClientRect();
                    var height = size.outerHeight(true);
                    if (test.bottom - height < rect.top){
                        var diff = rect.top - test.bottom + height;
                        if (!options.unanimated && _this._instance.options.view){
                            _this._instance.jQuery.stop(true).animate({
                                scrollTop: _this._instance.jQuery.scrollTop() - diff
                            }, {
                                duration: _this._speedFraction(_this._instance.options.view.duration, rect.bottom - rect.top, diff),
                                easing: _this._instance.options.view.easing,
                                complete: function(){
                                    _this._success(item, options);
                                }
                            });
                        } else {
                            _this._instance.jQuery.stop(true).get(0).scrollTop = _this._instance.jQuery.scrollTop() - diff;
                            _this._success(item, options);
                        }
                    } else if (test.top + height > rect.bottom){
                        var diff = test.top - rect.bottom + height;
                        if (!options.unanimated && _this._instance.options.view){
                            _this._instance.jQuery.stop(true).animate({
                                scrollTop: _this._instance.jQuery.scrollTop() + diff
                            }, {
                                duration: _this._speedFraction(_this._instance.options.view.duration, rect.bottom - rect.top, diff),
                                easing: _this._instance.options.view.easing,
                                complete: function(){
                                    _this._success(item, options);
                                }
                            });
                        } else {
                            _this._instance.jQuery.stop(true).get(0).scrollTop = _this._instance.jQuery.scrollTop() + diff;
                            _this._success(item, options);
                        }
                    } else {
                        _this._success(item, options);
                    }
                };
                if (_this.haveParent(item)){
                    _this.openPath(item, {
                        success: show,
                        fail: options.fail
                    });
                } else {
                    show();
                }
            } else {
                _this._fail(item, options);
            }
        },

        // check if a item have parent
        haveParent: function(item){
            if (item){
                var li = item.first().parent().parent();
                return li.hasClass('aciTreeLi');
            }
            return false;
        },

        // get item parent
        getParent: function(item){
            return item ? item.first().parent().parent().filter('li.aciTreeLi') : $([]);
        },

        // get item top parent
        getTopParent: function(item){
            if (this.isItem(item)){
                var path = this.getPath(item);
                return path.length ? path.eq(0) : $([]);
            }
            return $([]);
        },

        // create tree branch
        _branch: function(item, itemList){
            if (item){
                item.removeClass('aciTreeFolderMaybe').addClass('aciTreeFolder');
            }
            var items = this.append(item, {
                itemData: itemList
            });
            var itemData;
            for(var i in itemList){
                itemData = itemList[i];
                if (itemData.items && (itemData.items instanceof Array) && itemData.items.length){
                    this._branch(items.eq(i), itemData.items);
                }
                if (itemData.props && itemData.props.open){
                    this.open(items.eq(i));
                }
            }
        },

        // process item for display
        _item: function(api, item, itemData, level){
            if (this._instance.options.callbacks && this._instance.options.callbacks.item){
                this._instance.options.callbacks.item(api, item, itemData, level);
                return;
            }
            this.setItem(item, itemData.item);
        },

        // create item from data
        _create: function(itemData, path, level){
            var li = $('<li class="aciTreeLi"></li>').data('id' + this._instance.nameSpace, itemData.id);
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
            this._item(this, li, itemData, level);
            return li;
        },

        // add one or more items
        _insert: function(ul, before, after, itemData, path, level){
            if (itemData){
                var items = [];
                if (itemData instanceof Array){
                    for(var i in itemData){
                        items[items.length] = this._create(itemData[i], path, level).get(0);
                    }
                } else {
                    items[items.length] = this._create(itemData, path, level).get(0);
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
        },

        // ensure childrens container
        _ensure: function(item, state){
            if (!item){
                item = this._instance.jQuery;
            }
            var ul = item.find('>ul.aciTreeUl');
            if (state)
            {
                if (!ul.length){
                    ul = $('<ul class="aciTreeUl" style="display:none"></ul>');
                    item.append(ul);
                }
                return ul;
            }
            ul.remove();
        },

        // append one or more items to item
        append: function(item, options){
            var _this = this;
            options = _this._options(options, function(){
                _this._trigger(item, 'appended');
            }, function(){
                _this._trigger(item, 'appendfail');
            });
            if (item){
                if (_this.isFolder(item)){
                    item = item.first();
                    var ul = _this._ensure(item, true);
                    var list = _this._insert(ul, null, null, options.itemData, _this.getPath(item).add(item), _this.getLevel(item) + 1);
                    if (list.length){
                        item.addClass('aciTreeFolder').removeClass('aciTreeFolderMaybe');
                        list.each(function(){
                            _this._trigger($(this), 'added');
                        });
                    } else if (!_this.childrens(item).length){
                        ul.remove();
                    }
                    _this._success(item, options);
                    return list;
                } else {
                    _this._fail(item, options);
                    return $([]);
                }
            } else {
                var ul = _this._ensure(_this._instance.jQuery, true);
                var list = _this._insert(ul, null, null, options.itemData, null, 0);
                if (list.length){
                    _this._animate(null, true, !_this._instance.options.animateRoot || options.unanimated);
                    list.each(function(){
                        _this._trigger($(this), 'added');
                    });
                } else if (!_this.childrens().length){
                    ul.remove();
                }
                _this._success(item, options);
                return list;
            }
        },

        // insert one or more items before item
        before: function(item, options){
            var _this = this;
            options = _this._options(options, function(){
                _this._trigger(item, 'before');
            }, function(){
                _this._trigger(item, 'beforefail');
            });
            if (_this.isItem(item)){
                item = item.first();
                var list = _this._insert(null, item, null, options.itemData, _this.getPath(item), _this.getLevel(item));
                list.each(function(){
                    _this._trigger($(this), 'added');
                });
                _this._success(item, options);
                return list;
            } else {
                _this._fail(item, options);
                return $([]);
            }
        },

        // insert one or more items after item
        after: function(item, options){
            var _this = this;
            options = _this._options(options, function(){
                _this._trigger(item, 'after');
            }, function(){
                _this._trigger(item, 'afterfail');
            });
            if (_this.isItem(item)){
                item = item.first();
                var list = _this._insert(null, null, item, options.itemData, _this.getPath(item), _this.getLevel(item));
                list.each(function(){
                    _this._trigger($(this), 'added');
                });
                _this._success(item, options);
                return list;
            } else {
                _this._fail(item, options);
                return $([]);
            }
        },

        // get item having the element
        itemFrom: function(element){
            if (element){
                var item = $(element).first();
                if (item.hasClass('aciTree')){
                    return $([]);
                } else if (item.hasClass('aciTreeLi')){
                    return item;
                } else {
                    return item.parents('li.aciTreeLi:first');
                }
            }
            return $([]);
        },

        // get item childrens
        // if 'branch' is TRUE then all childrens are returned
        childrens: function(item, branch){
            if (!item){
                item = this._instance.jQuery;
            }
            return item.first().find(branch ? '>ul.aciTreeUl li.aciTreeLi' : '>ul.aciTreeUl>li.aciTreeLi');
        },

        // filter only folders
        // if state is set then filter only open/closed ones
        folders: function(items, state){
            var list = items.filter('li.aciTreeFolder,li.aciTreeFolderMaybe');
            if (typeof state != 'undefined'){
                list = state ? list.filter('.aciTreeOpen') : list.not('.aciTreeOpen');
            }
            return list;
        },

        // filter only files
        files: function(items){
            return items.filter('li.aciTreeFile');
        },

        // check if item is a folder
        isFolder: function(item){
            return item && (item.first().hasClass('aciTreeFolder') || item.first().hasClass('aciTreeFolderMaybe'));
        },

        // check if item is a file
        isFile: function(item){
            return item && item.first().hasClass('aciTreeFile');
        },

        // check if item was loaded
        wasLoad: function(item){
            if (!item){
                return this._instance.jQuery.find('>ul.aciTreeUl').length > 0;
            }
            if (this.isFolder(item)){
                return item.first().find('>ul.aciTreeUl').length > 0;
            }
            return true;
        },

        // set item as folder
        setFolder: function(item, options){
            var _this = this;
            options = _this._options(options, function(){
                _this._trigger(item, 'folderset');
            });
            if (_this.isItem(item)){
                if (_this.isFile(item)){
                    item.first().removeClass('aciTreeFile').addClass('aciTreeFolder');
                }
                _this._success(item, options);
            } else {
                _this._fail(item, options);
            }
        },

        // set item as file
        setFile: function(item, options){
            var _this = this;
            options = _this._options(options, function(){
                _this._trigger(item, 'fileset');
            });
            if (_this.isItem(item)){
                if (_this.isFolder(item)){
                    if (_this.wasLoad(item)){
                        _this.unload(item, {
                            success: function(){
                                item.first().removeClass('aciTreeFolder aciTreeFolderMaybe aciTreeOpen').addClass('aciTreeFile');
                                _this._success(item, options);
                            },
                            fail: options.fail,
                            unanimated: options.unanimated
                        });
                    } else {
                        item.first().removeClass('aciTreeFolder aciTreeFolderMaybe aciTreeOpen').addClass('aciTreeFile');
                        _this._success(item, options);
                    }
                } else {
                    _this._success(item, options);
                }
            } else {
                _this._fail(item, options);
            }
        },

        // set the icon for item
        // icon - CSS class name or Array [class name, background x position, background y position]
        setIcon: function(item, icon){
            if (this.isItem(item)){
                item = item.first();
                var html = item.find('>div.aciTreeItem');
                var found = html.find('>div.aciTreeIcon');
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
        },

        // set item content
        setItem: function(item, content){
            if (this.isItem(item)){
                item = item.first();
                var old = this.getText(item);
                var html = item.find('>div.aciTreeItem');
                var icon = html.find('>div.aciTreeIcon').detach();
                html.html(content).prepend(icon);
                this._trigger(item, 'itemset', {
                    oldText: old
                });
                return true;
            }
            return false;
        },

        // check if item is open
        isOpen: function(item){
            return item && item.first().hasClass('aciTreeOpen');
        },

        // check if item is closed
        isClosed: function(item){
            return !this.isOpen(item);
        },

        // check if item have childrens
        haveChildrens: function(item){
            return this.childrens(item).length > 0;
        },

        // check if item have siblings
        haveSiblings: function(item){
            return item && (item.first().siblings('li.aciTreeLi:first').length > 0);
        },

        // check if item have another before
        havePrev: function(item){
            return this.getPrev(item).length > 0;
        },

        // check if item have another after
        haveNext: function(item){
            return this.getNext(item).length > 0;
        },

        // get item siblings
        siblings: function(item){
            return item ? item.first().siblings('li.aciTreeLi') : $([]);
        },

        // get previous item
        getPrev: function(item){
            return item ? item.first().prev('li.aciTreeLi') : $([]);
        },

        // get next item
        getNext: function(item){
            return item ? item.first().next('li.aciTreeLi') : $([]);
        },

        // get item level (starting from 0)
        // return -1 for invalid items
        getLevel: function(item){
            var level = -1;
            if (item){
                item = item.first();
                while (item.hasClass('aciTreeLi')){
                    item = item.parent().parent();
                    level++;
                }
            }
            return level;
        },

        // get item ID (NULL if not found)
        getId: function(item){
            return item ? item.first().data('id' + this._instance.nameSpace) : null;
        },

        // set item ID
        setId: function(item, id){
            if (id && this.isItem(item)){
                var old = this.getId(item);
                item.first().data('id' + this._instance.nameSpace, id);
                this._trigger(item, 'idset', {
                    oldId: old
                });
                return true;
            }
            return false;
        },

        // get item index starting from 0
        getIndex: function(item){
            if (this.isItem(item)){
                var parent = item.parent();
                return parent.find('>li.aciTreeLi').index(item.first());
            }
            return null;
        },

        // get item text value (NULL if not found)
        getText: function(item){
            return (item ? item.first().find('>div.aciTreeItem').text() : null);
        },

        // check if it's a valid item
        isItem: function(item){
            return item && item.first().hasClass('aciTreeLi');
        },

        // item animation
        _animate: function(item, state, unanimated, callback){
            if (!item){
                item = this._instance.jQuery;
            }
            if (!unanimated){
                var type = state ? this._instance.options.show : this._instance.options.hide;
                if (type) {
                    var ul = item.first().find('>ul.aciTreeUl');
                    if (ul.length){
                        ul.stop(true, true).animate(type.props, {
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
            item.first().find('>ul.aciTreeUl').stop(true, true).toggle(state);
            if (callback){
                callback();
            }
        },

        // get first child of item
        getFirst: function(item){
            if (!item){
                item = this._instance.jQuery;
            }
            return item.first().find('>ul.aciTreeUl>li.aciTreeLi:first');
        },

        // get last child of item
        getLast: function(item){
            if (!item){
                item = this._instance.jQuery;
            }
            return item.first().find('>ul.aciTreeUl>li.aciTreeLi:last');
        },

        // return TRUE if item is loading
        isBusy: function(item){
            if (item){
                return item.first().hasClass('aciTreeLoad');
            } else {
                return !this._instance._loadQueue.empty();
            }
        },

        // set loading state
        _loading: function(item, state){
            if (item){
                item.toggleClass('aciTreeLoad', state);
            } else if (state){
                this._loader(state);
            }
        },

        // show loader image
        _loader: function(show){
            var _this = this;
            if (show || _this.isBusy()){
                if (!_this._instance._loaderInterval){
                    _this._instance._loaderInterval = setInterval(function(){
                        _this._loader();
                    }, _this._instance.options.loaderDelay);
                }
                _this._instance.jQuery.toggleClass('aciTreeLoad', true);
                clearTimeout(_this._instance._loaderHide);
                _this._instance._loaderHide = setTimeout(function(){
                    _this._instance.jQuery.toggleClass('aciTreeLoad', false);
                }, _this._instance.options.loaderDelay * 2);
            }
        },

        // check if parent have children
        isChildren: function(parent, children){
            if (this.isItem(children)){
                return (this.childrens(parent, true).filter(children.first()).length == 1);
            }
            return false;
        },

        // check if parent have immediate children
        isImmediateChildren: function(parent, children){
            if (this.isItem(children)){
                var check = this.getParent(children);
                if (check.length){
                    return parent && (check.get(0) == parent.get(0));
                } else {
                    return !parent;
                }
            }
            return false;
        },

        // check if items share the same parent
        sameParent: function(item1, item2){
            if (this.isItem(item1) && this.isItem(item2)){
                var parent1 = this.getParent(item1);
                var parent2 = this.getParent(item2);
                return (!parent1.length && !parent2.length) || (parent1.get(0) == parent2.get(0));
            }
            return false;
        },

        // check if items share the same top parent
        sameTopParent: function(item1, item2){
            if (this.isItem(item1) && this.isItem(item2)){
                var parent1 = this.getTopParent(item1);
                var parent2 = this.getTopParent(item2);
                return (!parent1.length && !parent2.length) || (parent1.get(0) == parent2.get(0));
            }
            return false;
        },

        // destroy control
        destroy: function(){
            var _this = this;
            if (_this.wasInit()){
                if (_this.isLocked()){
                    _this._trigger(null, 'locked');
                    return false;
                }
                _this._instance.locked = true;
                _this._instance.jQuery.toggleClass('aciTreeLoad', true);
                _this._instance._branchQueue.destroy();
                _this._instance._loadQueue.destroy();
                // we keep the _super reference because this method can exit before 'success' or 'fail' will be run
                var _super = _this._super;
                _this.unload(null, {
                    success: function(){
                        clearTimeout(_this._instance._loaderHide);
                        clearInterval(_this._instance._loaderInterval);
                        _this._destroy();
                        _this._instance.jQuery.off(_this._instance.nameSpace, 'div.aciTreeButton');
                        _this._instance.jQuery.toggleClass('aciTreeLoad', false);
                        _this._instance.locked = false;
                        // call the parent
                        _super.apply(_this);
                        _this._trigger(null, 'destroyed');
                    },
                    fail: function(){
                        _this._instance.jQuery.toggleClass('aciTreeLoad', false);
                        _this._instance.locked = false;
                        _this._trigger(null, 'destroyfail');
                    }
                });
                return true;
            }
            _this._trigger(null, 'notinit');
            return false;
        },

        _destroy: function(){
        // override this to do extra destroy when extending
        }

    };

    // extend the base aciPluginUi class and store into aciPluginClass.plugins
    aciPluginClass.plugins.aciTree = aciPluginClass.aciPluginUi.extend(aciTree_core);

    // publish the plugin & the default options
    aciPluginClass.publish('aciTree', options);

})(jQuery);
