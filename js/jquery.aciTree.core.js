
/*
 * aciTree jQuery Plugin v3.0.0-rc.1
 * http://acoderinsights.ro
 *
 * Copyright (c) 2013 Dragos Ursu
 * Dual licensed under the MIT or GPL Version 2 licenses.
 *
 * Require jQuery Library >= v1.7.1 http://jquery.com
 * + aciPlugin >= v1.1.1 https://github.com/dragosu/jquery-aciPlugin
 *
 * Date: Fri Mar 22 19:10 2013 +0200
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
 * All API functions expect only one item. If you need to process more at once then you'll need to loop between all of them yourself.
 *
 * The 'options' parameter for all API functions (when there is one) it's a object with the properties (not all are required or used):
 *
 * {
 *   success: function (item, data) -> callback to be called on success (you can access plugin API with 'this' keyword inside the callback)
 *   fail: function (item, data) -> callback to be called on fail (you can access plugin API with 'this' keyword inside the callback)
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
            // item : function(item, itemData, level)
            // you can access plugin API with 'this' keyword inside the callback
            item: null                  // called when a new item is added, by default the item text is added to the DOM
        }
    };

    // aciTree plugin core

    var aciTree_core = {

        __extend: function(){
            // add extra data
            $.extend(this._instance, {
                locked: false
            });
            $.extend(this._private, {
                loadQueue: new this._queue(this._instance.options.threads, false, this._instance.options.queueDelay),
                // timeouts for the loader
                loaderHide: null,
                loaderInterval: null,
                // busy delay count
                delayBusy: 0
            });
        },

        init: function(){
            var _this = this;
            if (this.wasInit()){
                this._trigger(null, 'wasinit');
                return false;
            }
            if (this.isLocked()){
                this._trigger(null, 'locked');
                return false;
            }
            this._instance.locked = true;
            this._instance.jQuery.bind('mousedown' + this._instance.nameSpace, function(e){
                var element = $(e.target);
                if (element.is('.aciTreeButton,.aciTreeLoad,.aciTreeLi,.aciTreeIcon')){
                    _this._instance.jQuery.focus();
                    // prevent selection
                    e.preventDefault();
                }
            }).on('click' + this._instance.nameSpace, '.aciTreeButton', function(e){
                var item = _this.itemFrom(e.target);
                if (_this.isBusy(item)){
                    // skip when busy
                    return;
                }
                _this.toggle(item, {
                    collapse: _this._instance.options.collapse,
                    expand: _this._instance.options.expand,
                    unique: _this._instance.options.unique
                });
            });
            this._initHook();
            // we keep the _super reference
            var _super = this._super;
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
            if (this._instance.options.rootData){
                this.loadFrom(null, {
                    success: success,
                    fail: fail,
                    itemData: this._instance.options.rootData
                });
            } else if (this._instance.options.jsonUrl){
                this.ajaxLoad(null, {
                    success: success,
                    fail: fail
                });
            } else {
                success();
            }
            return true;
        },

        _initHook: function(){
        // override this to do extra init
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
        _options: function(object, success, fail, notify){
            var options = $.extend({
                success: null, // success callback
                fail: null, // fail callback
                notify: null, // notify callback (internal use for when already in the requested state)
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
            if (notify){
                if (object && object.notify) {
                    options.notify = function(){
                        notify();
                        object.notify();
                    };
                } else {
                    if (!options.notify && object && object.success) {
                        options.notify = function(){
                            notify();
                            object.success();
                        };
                    } else {
                        options.notify = notify;
                    }
                }
            } else {
                if (!options.notify && object && object.success) {
                    options.notify = object.success;
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
                options.success.call(this, item ? item.first() : null, data);
            }
        },

        // call on fail
        _fail: function(item, options, data){
            if (options && options.fail){
                options.fail.call(this, item ? item.first() : null, data);
            }
        },

        // call on notify (should be same as 'success' but called when already in the requested state)
        _notify: function(item, options, data){
            if (options && options.notify){
                options.notify.call(this, item ? item.first() : null, data);
            }
        },

        // delay callback on busy item
        _delayBusy: function(item, callback){
            var _this = this;
            if ((this._private.delayBusy < 10) && this.isBusy(item)){
                this._private.delayBusy++;
                var _private = this._private;
                setTimeout(function(){
                    _this._delayBusy.call(_this, item, callback);
                    _private.delayBusy--;
                }, 10);
                return;
            }
            callback();
        },

        // process item loading with AJAX
        ajaxLoad: function(item, options){
            var _this = this;
            if (item && this.isBusy(item)){
                this._delayBusy(item, function(){
                    _this.ajaxLoad(item, options);
                });
                return;
            }
            options = this._options(options, function(){
                _this._loading(item);
                _this._trigger(item, 'loaded');
            }, function(){
                _this._loading(item);
                _this._trigger(item, 'loadfail');
            }, function(){
                _this._loading(item);
                _this._trigger(item, 'wasloaded');
            });
            if (!item || this.isFolder(item)){
                this._private.loadQueue.push(function(complete){
                    _this._loading(item, true);
                    if (_this.wasLoad(item)){
                        _this._notify(item, options);
                        complete();
                        return;
                    }
                    $.get(_this._instance.options.jsonUrl + (item ? _this.getId(item) : ''), function(itemList){
                        if (itemList && (itemList instanceof Array) && itemList.length){
                            var process = function(){
                                if (_this.wasLoad(item)){
                                    _this.unload(item, {
                                        success: function(){
                                            _this._createBranch(item, itemList);
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
                                    _this._createBranch(item, itemList);
                                    _this._success(item, options);
                                    complete();
                                }
                            };
                            if (_this.isFolder(item)){
                                process();
                            } else {
                                _this.setFolder(item, {
                                    success: process,
                                    fail: process
                                });
                            }
                        } else {
                            var process = function(){
                                _this._fail(item, options);
                                complete();
                            };
                            if (_this.isFile(item)){
                                process();
                            } else {
                                _this.setFile(item, {
                                    success: process,
                                    fail: process
                                });
                            }
                        }
                    }, 'json').fail(function(){
                        _this._fail(item, options);
                        complete();
                    });
                }, true).run();
            } else {
                this._fail(item, options);
            }
        },

        // process item loading from options.itemData
        loadFrom: function(item, options){
            var _this = this;
            if (item && this.isBusy(item)){
                this._delayBusy(item, function(){
                    _this.loadFrom(item, options);
                });
                return;
            }
            options = this._options(options, function(){
                _this._loading(item);
                _this._trigger(item, 'loaded');
            }, function(){
                _this._loading(item);
                _this._trigger(item, 'loadfail');
            }, function(){
                _this._loading(item);
                _this._trigger(item, 'wasloaded');
            });
            if (!item || this.isFolder(item)){
                this._loading(item, true);
                if (this.wasLoad(item)){
                    this._notify(item, options);
                    return;
                }
                if (options.itemData && (options.itemData instanceof Array) && options.itemData.length){
                    var process = function(){
                        if (_this.wasLoad(item)){
                            _this.unload(item, {
                                success: function(){
                                    _this._createBranch(item, options.itemData);
                                    _this._success(item, options);
                                },
                                fail: options.fail,
                                unanimated: options.unanimated
                            });
                        } else {
                            _this._createBranch(item, options.itemData);
                            _this._success(item, options);
                        }
                    };
                    if (this.isFolder(item)){
                        process();
                    } else {
                        this.setFolder(item, {
                            success: process,
                            fail: process
                        });
                    }
                } else {
                    if (this.isFile(item)){
                        this._fail(item, options);
                    } else {
                        this.setFile(item, {
                            success: options.fail,
                            fail: options.fail
                        });
                    }
                }
            } else {
                this._fail(item, options);
            }
        },

        // unload item
        unload: function(item, options){
            var _this = this;
            options = this._options(options, function(){
                _this._loading(item);
                _this._trigger(item, 'unloaded');
            }, function(){
                _this._loading(item);
                _this._trigger(item, 'unloadfail');
            }, function(){
                _this._loading(item);
                _this._trigger(item, 'notloaded');
            });
            if (!item || this.isFolder(item)){
                this._loading(item, true);
                if (!this.wasLoad(item)){
                    _this._notify(item, options);
                    return;
                }
                this.childrens(item, true).each(function(){
                    var item = $(this);
                    if (_this.isFolder(item)){
                        if (_this.isOpen(item)){
                            _this._trigger(item, 'closed');
                        }
                        if (_this.wasLoad(item)){
                            _this._trigger(item, 'unloaded');
                        }
                    }
                    _this._trigger(item, 'removed');
                });
                if (item){
                    if (this.isOpen(item)){
                        this.close(item, {
                            success: function(){
                                item.first().children('.aciTreeUl').remove();
                                _this._success(item, options);
                            },
                            fail: options.fail,
                            unanimated: options.unanimated
                        });
                    } else {
                        item.first().children('.aciTreeUl').remove();
                        this._success(item, options);
                    }
                } else {
                    this._animate(item, false, !this._instance.options.animateRoot || options.unanimated, function(){
                        _this._instance.jQuery.children('.aciTreeUl').remove();
                        _this._success(item, options);
                    });
                }
            } else {
                this._fail(item, options);
            }
        },

        // remove item
        remove: function(item, options){
            var _this = this;
            options = this._options(options, function(){
                _this._trigger(item, 'removed');
            }, function(){
                _this._trigger(item, 'removefail');
            });
            if (this.isItem(item)){
                if (this.isFolder(item) && this.wasLoad(item)){
                    this.unload(item, {
                        success: function(){
                            _this._success(item, options);
                            item.first().remove();
                        },
                        fail: options.fail,
                        unanimated: options.unanimated
                    });
                } else {
                    this._success(item, options);
                    item.first().remove();
                }
            } else {
                this._fail(item, options);
            }
        },

        // open item childrens
        _openChilds: function(item, options){
            var _this = this;
            if (options.expand){
                var queue = new this._queue(this._instance.options.threads, true, this._instance.options.queueDelay);
                this.folders(this.childrens(item), false).each(function(){
                    var item = $(this);
                    queue.push(function(complete){
                        _this.open(item, {
                            success: complete,
                            fail: complete,
                            expand: true,
                            unanimated: options.unanimated
                        });
                    }, true);
                });
                queue.complete(function(){
                    _this._success(item, options);
                }).run(true);
            } else {
                this._success(item, options);
            }
        },

        // process item open
        _openItem: function(item, options){
            var _this = this;
            if (!options.unanimated && !this.isVisible(item)){
                options.unanimated = true;
            }
            if (options.unique){
                this.closeOthers(item);
                options.unique = false;
            }
            item.first().addClass('aciTreeOpen');
            this._animate(item, true, options.unanimated, function(){
                _this._openChilds(item, options);
            });
        },

        // open item and his childs if requested
        open: function(item, options){
            var _this = this;
            options = this._options(options, function(){
                _this._trigger(item, 'opened');
            }, function(){
                _this._trigger(item, 'openfail');
            }, function(){
                _this._trigger(item, 'wasopened');
            });
            if (this.isFolder(item)){
                if (this.isOpen(item)){
                    options.success = options.notify;
                    this._openChilds(item, options);
                } else {
                    if (this.wasLoad(item)){
                        this._openItem(item, options);
                    } else {
                        this.ajaxLoad(item, {
                            success: function(){
                                _this._openItem(item, options);
                            },
                            fail: options.fail
                        });
                    }
                }
            } else {
                this._fail(item, options);
            }
        },

        // close item childrens
        _closeChilds: function(item, options){
            var _this = this;
            if (this._instance.options.empty){
                options.unanimated = true;
                this.unload(item, options);
            } else if (options.collapse){
                var queue = new this._queue(this._instance.options.threads, true, this._instance.options.queueDelay);
                this.folders(this.childrens(item), true).each(function(){
                    var item = $(this);
                    queue.push(function(complete){
                        _this.close(item, {
                            success: complete,
                            fail: complete,
                            collapse: true,
                            unanimated: true
                        });
                    }, true);
                });
                queue.complete(function(){
                    _this._success(item, options);
                }).run(true);
            } else {
                this._success(item, options);
            }
        },

        // process item close
        _closeItem: function(item, options){
            var _this = this;
            if (!options.unanimated && !this.isVisible(item)){
                options.unanimated = true;
            }
            item.first().removeClass('aciTreeOpen');
            this._animate(item, false, options.unanimated, function(){
                _this._closeChilds(item, options);
            });
        },

        // close item and his childs if requested
        close: function(item, options){
            var _this = this;
            options = this._options(options, function(){
                _this._trigger(item, 'closed');
            }, function(){
                _this._trigger(item, 'closefail');
            }, function(){
                _this._trigger(item, 'wasclosed');
            });
            if (this.isFolder(item)){
                if (this.isOpen(item)){
                    this._closeItem(item, options);
                } else if (this.wasLoad(item)){
                    options.success = options.notify;
                    this._closeChilds(item, options);
                } else {
                    this._notify(item, options);
                }
            } else {
                this._fail(item, options);
            }
        },

        // keep just one branch open
        closeOthers: function(item, options){
            var _this = this;
            options = this._options(options);
            if (this.isItem(item)){
                var queue = new this._queue(this._instance.options.threads, true, this._instance.options.queueDelay);
                var exclude = item.first().add(this.path(item)).add(this.childrens(item, true));
                this.folders(this.childrens(null, true), true).not(exclude).each(function(){
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
                this._fail(item, options);
            }
        },

        // toggle item
        toggle: function(item, options){
            var _this = this;
            options = this._options(options, function(){
                _this._trigger(item, 'toggled');
            }, function(){
                _this._trigger(item, 'togglefail');
            });
            if (this.isFolder(item)){
                if (this.isOpen(item)){
                    this.close(item, options);
                } else {
                    this.open(item, options);
                }
            } else {
                this._fail(item, options);
            }
        },

        // get item path (starting from top parent)
        // when 'reverse' is TRUE returns the path in reverse order
        path: function(item, reverse){
            if (item){
                var path = item.first().parentsUntil(this._instance.jQuery, '.aciTreeLi');
                return reverse ? path : $(path.get().reverse());
            }
            return $([]);
        },

        // test if item is in view
        isVisible: function(item){
            if (item){
                if (this.folders(this.path(item), false).length){
                    // at least a closed parent
                    return false;
                };
                var rect = this._instance.jQuery.get(0).getBoundingClientRect();
                var size = item.first().children('.aciTreeItem');
                var test = size.get(0).getBoundingClientRect();
                var height = size.outerHeight(true);
                if ((test.bottom - height < rect.top) || (test.top + height > rect.bottom) || (test.right < rect.left) || (test.left > rect.right)){
                    // is out of view
                    return false;
                }
                return true;
            }
            return false;
        },

        // open path to item
        openPath: function(item, options){
            var _this = this;
            options = this._options(options);
            if (this.isItem(item)){
                var queue = new this._queue(null, true, this._instance.options.queueDelay);
                this.folders(this.path(item), false).each(function(){
                    var item = $(this);
                    queue.push(function(complete){
                        _this.open(item, {
                            success: complete,
                            fail: complete,
                            unanimated: options.unanimated
                        });
                    }, true);
                });
                queue.complete(function(){
                    _this._success(item, options);
                }).run();
            } else {
                this._fail(item, options);
            }
        },

        // get animation speed by element size
        _speedFraction: function(speed, totalSize, required){
            if ((required < totalSize) && totalSize){
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

        // make item visible
        setVisible: function(item, options){
            var _this = this;
            options = this._options(options, function(){
                _this._trigger(item, 'visible');
            }, null, function(){
                _this._trigger(item, 'wasvisible');
            });
            if (this.isVisible(item)){
                this._notify(item, options);
            } else if (this.isItem(item)){
                var process = function(){
                    var rect = _this._instance.jQuery.get(0).getBoundingClientRect();
                    var size = item.first().children('.aciTreeItem');
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
                if (this.hasParent(item)){
                    this.openPath(item, {
                        success: process,
                        fail: options.fail
                    });
                } else {
                    process();
                }
            } else {
                this._fail(item, options);
            }
        },

        // test if item has parent
        hasParent: function(item){
            return item && (item.first().parent().parent('.aciTreeLi').length > 0);
        },

        // get item parent
        parent: function(item){
            return item ? item.first().parent().parent('.aciTreeLi') : $([]);
        },

        // get item top parent
        topParent: function(item){
            return this.path(item).eq(0);
        },

        // create tree branch
        _createBranch: function(item, itemList){
            if (item){
                item.first().removeClass('aciTreeFolderMaybe').addClass('aciTreeFolder');
            }
            var items = this.append(item, {
                itemData: itemList
            });
            var itemData;
            for(var i in itemList){
                itemData = itemList[i];
                if (itemData.items && (itemData.items instanceof Array) && itemData.items.length){
                    this._createBranch(items.eq(i), itemData.items);
                }
                if (itemData.props && itemData.props.open){
                    this.open(items.eq(i));
                }
            }
        },

        // process item before inserting into the DOM
        _itemHook: function(parent, item, itemData, level){
            if (this._instance.options.callbacks && this._instance.options.callbacks.item){
                this._instance.options.callbacks.item.call(this, parent, item, itemData, level);
            }
        },

        // create LI from data
        _createLi: function(itemData){
            var li = $('<li class="aciTreeLi"></li>').data('itemData' + this._instance.nameSpace, {
                id: itemData.id,
                item: itemData.item,
                props: itemData.props
            });
            var html = '<div class="aciTreeButton"><div></div></div><div class="aciTreeItem">';
            if (itemData.props && itemData.props.icon){
                if (itemData.props.icon instanceof Array){
                    html += '<div class="aciTreeIcon ' + itemData.props.icon[0] + '" style="background-position:' +
                    itemData.props.icon[1] + 'px ' + itemData.props.icon[2] + 'px' + '"></div>';
                } else {
                    html += '<div class="aciTreeIcon ' + itemData.props.icon + '"></div>';
                }
            }
            li.append(html + '<div class="aciTreeText">' + itemData.item + '</div></div>');
            if (itemData.props && (itemData.props.isFolder || (itemData.props.isFolder === null))){
                li.addClass((itemData.props.isFolder || (itemData.items && itemData.items.length)) ? 'aciTreeFolder' : 'aciTreeFolderMaybe');
            } else {
                li.addClass('aciTreeFile');
            }
            return li;
        },

        // create/add one or more items
        _createItems: function(ul, before, after, itemData, level){
            if (itemData){
                var parent;
                if (ul){
                    parent = this.itemFrom(ul);
                } else if (before){
                    parent = this.parent(before);
                } else if (after){
                    parent = this.parent(after);
                }
                var items = [], li
                if (itemData instanceof Array){
                    for(var i in itemData){
                        li = this._createLi(itemData[i]);
                        this._itemHook(parent, li, itemData[i], level);
                        items[items.length] = li.get(0);
                    }
                } else {
                    li = this._createLi(itemData);
                    this._itemHook(parent, li, itemData, level);
                    items[items.length] = li.get(0);
                }
                items = $(items);
                if (ul){
                    ul.append(items);
                } else if (before){
                    before.first().before(items);
                } else if (after){
                    after.first().after(items);
                }
                return items;
            }
            return $([]);
        },

        // ensure there is a UL container
        _ensureUl: function(item){
            var ul = item.first().children('.aciTreeUl');
            if (!ul.length){
                ul = $('<ul class="aciTreeUl" style="display:none"></ul>');
                item.first().append(ul);
            }
            return ul;
        },

        // append one or more items to item
        append: function(item, options){
            var _this = this;
            options = this._options(options, function(){
                _this._trigger(item, 'appended');
            }, function(){
                _this._trigger(item, 'appendfail');
            });
            if (item){
                if (this.isFolder(item)){
                    var ul = this._ensureUl(item);
                    var list = this._createItems(ul, null, null, options.itemData, this.level(item) + 1);
                    if (list.length){
                        item.first().addClass('aciTreeFolder').removeClass('aciTreeFolderMaybe');
                        list.each(function(){
                            _this._trigger($(this), 'added');
                        });
                    } else if (!this.hasChildrens(item)){
                        ul.remove();
                    }
                    this._success(item, options);
                    return list;
                } else {
                    this._fail(item, options);
                    return $([]);
                }
            } else {
                var ul = this._ensureUl(this._instance.jQuery);
                var list = this._createItems(ul, null, null, options.itemData, 0);
                if (list.length){
                    this._animate(null, true, !this._instance.options.animateRoot || options.unanimated);
                    list.each(function(){
                        _this._trigger($(this), 'added');
                    });
                } else if (!this.hasChildrens()){
                    ul.remove();
                }
                this._success(item, options);
                return list;
            }
        },

        // insert one or more items before item
        before: function(item, options){
            var _this = this;
            options = this._options(options, function(){
                _this._trigger(item, 'before');
            }, function(){
                _this._trigger(item, 'beforefail');
            });
            if (this.isItem(item)){
                var list = this._createItems(null, item, null, options.itemData, this.level(item));
                list.each(function(){
                    _this._trigger($(this), 'added');
                });
                this._success(item, options);
                return list;
            } else {
                this._fail(item, options);
                return $([]);
            }
        },

        // insert one or more items after item
        after: function(item, options){
            var _this = this;
            options = this._options(options, function(){
                _this._trigger(item, 'after');
            }, function(){
                _this._trigger(item, 'afterfail');
            });
            if (this.isItem(item)){
                var list = this._createItems(null, null, item, options.itemData, this.level(item));
                list.each(function(){
                    _this._trigger($(this), 'added');
                });
                this._success(item, options);
                return list;
            } else {
                this._fail(item, options);
                return $([]);
            }
        },

        // get item having the element
        itemFrom: function(element){
            if (element){
                var item = $(element).first();
                if (item.get(0) == this._instance.jQuery.get(0)){
                    return $([]);
                } else if (item.hasClass('aciTreeLi')){
                    return item;
                } else {
                    return item.parents('.aciTreeLi:first');
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
            return branch ? item.first().find('.aciTreeLi') : item.first().children('.aciTreeUl').children('.aciTreeLi');
        },

        // filter only folders from items
        // if state is set then filter only open/closed ones
        folders: function(items, state){
            if (typeof state != 'undefined'){
                if (state){
                    return items.filter('.aciTreeOpen');
                } else {
                    return items.filter('.aciTreeFolder,.aciTreeFolderMaybe').not('.aciTreeOpen');
                }
            }
            return items.filter('.aciTreeFolder,.aciTreeFolderMaybe');
        },

        // filter only files from items
        files: function(items){
            return items.filter('.aciTreeFile');
        },

        // test if item is a folder
        isFolder: function(item){
            return item && (item.first().hasClass('aciTreeFolder') || item.first().hasClass('aciTreeFolderMaybe'));
        },

        // test if item is a file
        isFile: function(item){
            return item && item.first().hasClass('aciTreeFile');
        },

        // test if item was loaded
        wasLoad: function(item){
            if (!item){
                return this._instance.jQuery.children('.aciTreeUl').length > 0;
            }
            if (this.isFolder(item)){
                return item.first().children('.aciTreeUl').length > 0;
            }
            return true;
        },

        // set item as folder
        setFolder: function(item, options){
            var _this = this;
            options = this._options(options, function(){
                _this._trigger(item, 'folderset');
            }, null, function(){
                _this._trigger(item, 'wasfolder');
            });
            if (this.isItem(item)){
                if (this.isFile(item)){
                    item.first().removeClass('aciTreeFile').addClass('aciTreeFolder');
                    this._success(item, options);
                } else {
                    this._notify(item, options);
                }
            } else {
                this._fail(item, options);
            }
        },

        // set item as file
        setFile: function(item, options){
            var _this = this;
            options = this._options(options, function(){
                _this._trigger(item, 'fileset');
            }, null, function(){
                _this._trigger(item, 'wasfile');
            });
            if (this.isItem(item)){
                if (this.isFolder(item)){
                    var process = function(){
                        item.first().removeClass('aciTreeFolder aciTreeFolderMaybe aciTreeOpen').addClass('aciTreeFile');
                        _this._success(item, options);
                    };
                    if (this.wasLoad(item)){
                        this.unload(item, {
                            success: process,
                            fail: options.fail,
                            unanimated: options.unanimated
                        });
                    } else {
                        process();
                    }
                } else {
                    this._notify(item, options);
                }
            } else {
                this._fail(item, options);
            }
        },

        // set the icon for item
        // icon - CSS class name or Array [class name, background x position, background y position]
        setIcon: function(item, icon){
            if (this.isItem(item)){
                var itemData = this.itemData(item);
                var oldIcon = itemData.props.icon;
                var html = item.first().children('.aciTreeItem');
                var found = html.children('.aciTreeIcon');
                if (found.length){
                    if (icon){
                        if (icon instanceof Array){
                            found.attr('class', 'aciTreeIcon ' + icon[0]).css('background-position', icon[1] + 'px ' + icon[2] + 'px');
                        } else {
                            found.attr('class', 'aciTreeIcon ' + icon);
                        }
                        itemData.props.icon = icon;
                        this._trigger(item, 'iconset', {
                            oldIcon: oldIcon
                        });
                    } else {
                        found.remove();
                        itemData.props.icon = null;
                        this._trigger(item, 'iconremoved', {
                            oldIcon: oldIcon
                        });
                    }
                } else if (icon){
                    if (icon instanceof Array){
                        html.prepend('<div class="aciTreeIcon ' + icon[0] + '" style="background-position:' +
                            icon[1] + 'px ' + icon[2] + 'px' + '"></div>');
                    } else {
                        html.prepend('<div class="aciTreeIcon ' + icon + '"></div>');
                    }
                    itemData.props.icon = icon;
                    this._trigger(item, 'iconset', {
                        oldIcon: oldIcon
                    });
                } else {
                    this._trigger(item, 'noticon');
                }
                return true;
            }
            return false;
        },

        // set item text content
        setText: function(item, content){
            if (this.isItem(item)){
                var itemData = this.itemData(item);
                var oldText = itemData.item;
                item.first().children('.aciTreeItem').find('.aciTreeText').html(content);
                itemData.item = content;
                this._trigger(item, 'textset', {
                    oldText: oldText
                });
                return true;
            }
            return false;
        },

        // test if item is open
        isOpen: function(item){
            return item && item.first().hasClass('aciTreeOpen');
        },

        // test if item is closed
        isClosed: function(item){
            return !this.isOpen(item);
        },

        // test if item has childrens
        hasChildrens: function(item){
            if (!item){
                item = this._instance.jQuery;
            }
            return item.first().children('.aciTreeUl').children('.aciTreeLi:first').length > 0;
        },

        // test if item has siblings
        hasSiblings: function(item){
            return item && (item.first().siblings('.aciTreeLi:first').length > 0);
        },

        // test if item has another before
        hasPrev: function(item){
            return this.prev(item).length > 0;
        },

        // test if item has another after
        hasNext: function(item){
            return this.next(item).length > 0;
        },

        // get item siblings
        siblings: function(item){
            return item ? item.first().siblings('.aciTreeLi') : $([]);
        },

        // get previous item
        prev: function(item){
            return item ? item.first().prev('.aciTreeLi') : $([]);
        },

        // get next item
        next: function(item){
            return item ? item.first().next('.aciTreeLi') : $([]);
        },

        // get item level (starting from 0)
        // return -1 for invalid items
        level: function(item){
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

        // get item ID
        getId: function(item){
            var itemData = this.itemData(item);
            return itemData ? itemData.id : null;
        },

        // get item data
        itemData: function(item){
            return item ? item.first().data('itemData' + this._instance.nameSpace) : null;
        },

        // set item ID
        setId: function(item, id){
            if (this.isItem(item)){
                var itemData = this.itemData(item);
                var oldId = itemData.id;
                itemData.id = id;
                this._trigger(item, 'idset', {
                    oldId: oldId
                });
                return true;
            }
            return false;
        },

        // get item index starting from 0
        getIndex: function(item){
            return item ? item.first().parent().children('.aciTreeLi').index(item.first()) : null;
        },

        // get item text value
        getText: function(item){
            var itemData = this.itemData(item);
            return itemData ? itemData.item : null;
        },

        // test if it's a valid item
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
                    var ul = item.first().children('.aciTreeUl');
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
            item.first().children('.aciTreeUl').stop(true, true).toggle(state);
            if (callback){
                callback();
            }
        },

        // get first child of item
        first: function(item){
            if (!item){
                item = this._instance.jQuery;
            }
            return item.first().children('.aciTreeUl').children('.aciTreeLi:first');
        },

        // get last child of item
        last: function(item){
            if (!item){
                item = this._instance.jQuery;
            }
            return item.first().children('.aciTreeUl').children('.aciTreeLi:last');
        },

        // test if item is loading
        isBusy: function(item){
            if (item){
                return item.first().hasClass('aciTreeLoad');
            } else {
                return !this._private.loadQueue.empty();
            }
        },

        // set loading state
        _loading: function(item, state){
            if (item){
                item.first().toggleClass('aciTreeLoad', state);
            } else if (state){
                this._loader(state);
            }
        },

        // show loader image
        _loader: function(show){
            var _this = this;
            if (show || this.isBusy()){
                if (!this._private.loaderInterval){
                    this._private.loaderInterval = setInterval(function(){
                        _this._loader();
                    }, this._instance.options.loaderDelay);
                }
                this._instance.jQuery.toggleClass('aciTreeLoad', true);
                clearTimeout(this._private.loaderHide);
                this._private.loaderHide = setTimeout(function(){
                    _this._instance.jQuery.toggleClass('aciTreeLoad', false);
                }, this._instance.options.loaderDelay * 2);
            }
        },

        // test if parent has children
        isChildren: function(parent, children){
            if (!parent){
                parent = this._instance.jQuery;
            }
            return children && parent.has(children);
        },

        // test if parent has immediate children
        isImmediateChildren: function(parent, children){
            if (!parent){
                parent = this._instance.jQuery;
            }
            return children && parent.children('.aciTreeUl').children('.aciTreeLi').is(children);
        },

        // test if items share the same parent
        sameParent: function(item1, item2){
            if (item1 && item2){
                var parent1 = this.parent(item1);
                var parent2 = this.parent(item2);
                return (!parent1.length && !parent2.length) || (parent1.get(0) == parent2.get(0));
            }
            return false;
        },

        // test if items share the same top parent
        sameTopParent: function(item1, item2){
            if (item1 && item2){
                var parent1 = this.topParent(item1);
                var parent2 = this.topParent(item2);
                return (!parent1.length && !parent2.length) || (parent1.get(0) == parent2.get(0));
            }
            return false;
        },

        // destroy control
        destroy: function(){
            var _this = this;
            if (!this.wasInit()){
                this._trigger(null, 'notinit');
                return false;
            }
            if (this.isLocked()){
                this._trigger(null, 'locked');
                return false;
            }
            this._instance.locked = true;
            this._instance.jQuery.toggleClass('aciTreeLoad', true);
            this._private.loadQueue.destroy();
            _this._destroyHook(false);
            // we keep the _super reference
            var _super = this._super;
            this.unload(null, {
                success: function(){
                    clearTimeout(_this._private.loaderHide);
                    clearInterval(_this._private.loaderInterval);
                    _this._destroyHook(true);
                    _this._instance.jQuery.unbind(_this._instance.nameSpace).off(_this._instance.nameSpace, '.aciTreeButton');
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
        },

        _destroyHook: function(unloaded){
        // override this to do extra destroy before/after unload
        }

    };

    // extend the base aciPluginUi class and store into aciPluginClass.plugins
    aciPluginClass.plugins.aciTree = aciPluginClass.aciPluginUi.extend(aciTree_core, 'aciTreeCore');

    // publish the plugin & the default options
    aciPluginClass.publish('aciTree', options);

})(jQuery);
