
/*
 * aciTree jQuery Plugin v4.2.0
 * http://acoderinsights.ro
 *
 * Copyright (c) 2013 Dragos Ursu
 * Dual licensed under the MIT or GPL Version 2 licenses.
 *
 * Require jQuery Library >= v1.9.0 http://jquery.com
 * + aciPlugin >= v1.5.1 https://github.com/dragosu/jquery-aciPlugin
 */

/*
 * The aciTree core.
 *
 * A few words about how a item data looks like:
 *
 * for a leaf node (a node that does not have any children):
 *
 * {
 *   id: 'some_file_ID',                // unique item ID
 *   label: 'This is a File Item',      // the item label (text value)
 *   inode: false,                      // FALSE means is a leaf node
 *   icon: 'fileIcon',                  // CSS class name for the icon (if any), can also be a Array ['CSS class name', background-position-x, background-position-y]
 *   random_prop: 'random 1'            // just a random property (you can have any number defined)
 * }
 *
 * for a inner node (a node that have at least a children under it):
 *
 * {
 *   id: 'some_folder_ID',              // unique item ID
 *   label: 'This is a Folder Item',    // the item label (text value)
 *   inode: true,                       // can also be NULL to find at runtime if its an inode (on load will be transformed in a leaf node if there aren't any children)
 *   open: false,                       // if TRUE then the node will be opened when the tree is loaded
 *   icon: 'folderIcon',                // CSS class name for the icon (if any), can also be a Array ['CSS class name', background-position-x, background-position-y]
 *   random_prop: 'random 2',           // just a random property (you can have any number defined)
 *   branch: [{ ... item data ... }, { ... item data ... }, ...],
 *   source: 'myDataSource'             // the data source name to read the children from (if any), by default `options.ajax` is used
 * }
 *
 * The `branch` array can be empty, in this case the children will be loaded when the node will be opened for the first time.
 *
 * Please note that the item data should be valid data (in the expected format). No checking is done and errors can appear on invalid data.
 *
 * One note about a item: a item is always the LI element with the class 'aciTreeLi'.
 * The children of a node are all added under a UL element with the class 'aciTreeUl'.
 *
 * Almost all API functions expect only one item. If you need to process more at once then you'll need to loop between all of them yourself.
 *
 * The 'options' parameter for all API methods (when there is one) it's a object with the properties (not all are required or used):
 *
 * {
 *   uid: string -> operation UID (defaults to `ui`)
 *   success: function (item, options, data) -> callback to be called on success (you can access plugin API with `this` keyword inside the callback)
 *   fail: function (item, options, data) -> callback to be called on fail (you can access plugin API with `this` keyword inside the callback)
 *   notify: function (item, options, data) -> notify callback (internal use for when already in the requested state, will call `success` by default)
 *   expand: true/false -> propagate on open/toggle
 *   collapse: true/false -> propagate on close/toggle
 *   unique: true/false -> close other branches (on open/toggle)?
 *   unanimated: true/false -> if it's TRUE then no animations are to be run (used on open/close/toggle)
 *   itemData: object[item data]/array[item data] -> used when adding/updating items
 * }
 *
 * Note: when using the API methods that support the 'options' parameter, you will need to use the success/fail callbacks if you need to do
 * any processing after the API call. This because there can be async operations that will complete at a later time and the API methods will
 * exit before the job is actually completed. This will happen when items are loaded with AJAX, on animations and other delayed operations (see _queue).
 *
 */

(function($, window, undefined) {

    // default options

    var options = {
        // the AJAX options (see jQuery.ajax) where the `success` and `error` are overridden by aciTree
        ajax: {
            url: null,                  // URL from where to take the data, something like 'path/script?nodeId=' (the node ID value will be added for each request)
            dataType: 'json'
        },
        dataSource: null,               // a list of data sources to be used (each entry in `options.ajax` format)
        rootData: null,                 // initial ROOT data for the Tree (if NULL then one initial AJAX request is made on init)
        queue: {
            async: 4,                   // the number of simultaneous async (AJAX) tasks
            interval: 50,               // interval [ms] after which to insert a `delay`
            delay: 20                   // how many [ms] delay between tasks (after `interval` expiration)
        },
        loaderDelay: 500,               // how many msec to wait before showing the main loader? (on lengthy operations)
        expand: false,                  // if TRUE then all children of a node are expanded when the node is opened
        collapse: false,                // if TRUE then all children of a node are collapsed when the node is closed
        unique: false,                  // if TRUE then a single tree branch will stay open, the oters are closed when a node is opened
        empty: false,                   // if TRUE then all children of a node are removed when the node is closed
        show: {// show node/ROOT animation (default is slideDown)
            props: {
                'height': 'show'
            },
            duration: 'medium',
            easing: 'linear'
        },
        animateRoot: true,              // if the ROOT should be animated on init
        hide: {// hide node animation (default is slideUp)
            props: {
                'height': 'hide'
            },
            duration: 'medium',
            easing: 'linear'
        },
        view: {// scroll item into view animation
            duration: 'medium',
            easing: 'linear'
        },
        // called for each AJAX request when a node needs to be loaded
        // `settings` is the `options.ajax` object or an entry from `options.dataSource`
        ajaxHook: function(item, settings) {
            // the default implementation changes the URL by adding the item ID at the end
            settings.url += (item ? this.getId(item) : '');
        },
        // called after each item is created but before is inserted into the DOM
        itemHook: function(parent, item, itemData, level) {
            // there is no default implementation
        },
        // called for each `value` to be added to the serialized string
        // `value` is the current serialized value (from the `item`)
        serialize: function(item, what, value) {
            if (typeof what == 'object') {
                return value;
            } else {
                // the default implementation uses a `|` (pipe) character to separate values
                return '|' + value;
            }
        }
    };

    // aciTree plugin core

    var aciTree_core = {
        // add extra data
        __extend: function() {
            $.extend(this._instance, {
                locked: false,
                queue: new this._queue(this, this._instance.options.queue)
            });
            $.extend(this._private, {
                // timeouts for the loader
                loaderHide: null,
                loaderInterval: null,
                // busy delay count
                delayBusy: 0
            });
        },
        // init the treeview
        init: function(options) {
            options = this._options(options);
            // check if was init already
            if (this.wasInit()) {
                this._trigger(null, 'wasinit', options);
                this._fail(null, options);
                return;
            }
            // check if it's locked
            if (this.isLocked()) {
                this._trigger(null, 'locked', options);
                this._fail(null, options);
                return;
            }
            // a way to cancel the init
            if (!this._trigger(null, 'beforeinit', options)) {
                this._trigger(null, 'initfail', options);
                this._fail(null, options);
                return;
            }
            this._instance.locked = true;
            this._instance.jQuery.addClass('aciTree' + this._instance.index).attr('role', 'tree').on('click' + this._instance.nameSpace, '.aciTreeButton', this.proxy(function(e) {
                // process click on button
                var item = this.itemFrom(e.target);
                // skip when busy
                if (!this.isBusy(item)) {
                    this.toggle(item, {
                        collapse: this._instance.options.collapse,
                        expand: this._instance.options.expand,
                        unique: this._instance.options.unique
                    });
                }
            })).on('mouseenter' + this._instance.nameSpace + ' mouseleave' + this._instance.nameSpace, '.aciTreeButton', function(e) {
                // set the aciTreeHover class
                var element = $(e.target);
                if (!element.hasClass('aciTreeButton')) {
                    element = element.parents('.aciTreeButton:first');
                }
                element.toggleClass('aciTreeHover', e.type == 'mouseenter');
            }).on('mouseenter' + this._instance.nameSpace + ' mouseleave' + this._instance.nameSpace, '.aciTreeLine', function(e) {
                // set the aciTreeHover class
                var element = $(e.target);
                if (!element.hasClass('aciTreeLine')) {
                    element = element.parents('.aciTreeLine:first');
                }
                element.toggleClass('aciTreeHover', e.type == 'mouseenter');
            });
            this._initHook();
            // call on success
            var success = this.proxy(function() {
                // call the parent
                this._super();
                this._instance.locked = false;
                this._trigger(null, 'init', options);
                this._success(null, options);
            });
            // call on fail
            var fail = this.proxy(function() {
                // call the parent
                this._super();
                this._instance.locked = false;
                this._trigger(null, 'initfail', options);
                this._fail(null, options);
            });
            if (this._instance.options.rootData) {
                // the rootData was set, init from it
                this.loadFrom(null, this._inner(options, {
                    success: success,
                    fail: fail,
                    itemData: this._instance.options.rootData
                }));
            } else if (this._instance.options.ajax.url) {
                // the AJAX url was set, init with AJAX
                this.ajaxLoad(null, this._inner(options, {
                    success: success,
                    fail: fail
                }));
            } else {
                success.apply(this);
            }
        },
        _initHook: function() {
            // override this to do extra init
        },
        // check locked state
        isLocked: function() {
            return this._instance.locked;
        },
        // get a formatted message
        _format: function(raw, params) {
            if (!(params instanceof Array)) {
                return raw;
            }
            var parts = raw.split(/(%[0-9]+)/gm);
            var compile = '', part, index, last = false, len;
            var test = new window.RegExp('^%[0-9]+$');
            for (var i in parts) {
                part = parts[i];
                len = part.length;
                if (len) {
                    if (!last && test.test(part)) {
                        index = window.parseInt(part.substr(1)) - 1;
                        if ((index >= 0) && (index < params.length)) {
                            compile += params[index];
                            continue;
                        }
                    } else {
                        last = false;
                        if (part.substr(len - 1) == '%') {
                            if (part.substr(len - 2) != '%%') {
                                last = true;
                            }
                            part = part.substr(0, len - 1);
                        }
                    }
                    compile += part;
                }
            }
            return compile;
        },
        // low level DOM functions
        _coreDOM: {
            // set as leaf node
            leaf: function(items) {
                items.removeClass('aciTreeInode aciTreeInodeMaybe aciTreeOpen').removeAttr('aria-expanded').addClass('aciTreeLeaf');
            },
            // set as inner node
            inode: function(items, branch) {
                items.removeClass('aciTreeLeaf').attr('aria-expanded', false).addClass(branch ? 'aciTreeInode' : 'aciTreeInodeMaybe');
            },
            // set as open/closed
            toggle: function(items, state) {
                items.attr('aria-expanded', state).toggleClass('aciTreeOpen', state);
            }
        },
        // a small queue implementation
        _queue: function(context, options) {
            var locked = false;
            var fifo = [], fifoAsync = [];
            var load = 0, loadAsync = 0, schedule = 0;
            // run the queue
            var run = function() {
                if (locked) {
                    return;
                }
                var now = new window.Date().getTime();
                if (schedule > now) {
                    return;
                }
                var callback, async = false;
                if (load == 0) {
                    callback = fifo.shift();
                }
                if (!callback && (loadAsync < options.async)) {
                    callback = fifoAsync.shift();
                    async = true;
                }
                if (callback) {
                    if (async) {
                        loadAsync++;
                        callback.call(context, function() {
                            loadAsync--;
                        });
                    } else {
                        load++;
                        callback.call(context, function() {
                            if (now - schedule > options.interval) {
                                schedule = now + options.delay;
                            }
                            load--;
                        });
                    }
                }
            };
            var interval = [];
            var start = function() {
                for (var i = 0; i < 16; i++) {
                    interval[i] = window.setInterval(run, 1);
                }
            };
            var stop = function() {
                for (var i in interval) {
                    window.clearInterval(interval[i]);
                }
            };
            start();
            this.init = function() {
                this.destroy();
                start();
                return this;
            };
            // push a 'callback' for later call
            this.push = function(callback, async) {
                if (!locked) {
                    if (async) {
                        fifoAsync.push(callback);
                    } else {
                        fifo.push(callback);
                    }
                }
                return this;
            };
            // test if its busy
            this.busy = function() {
                return (load != 0) || (loadAsync != 0) || (fifo.length != 0) || (fifoAsync.length != 0);
            };
            // destroy queue
            this.destroy = function() {
                locked = true;
                stop();
                fifo = [];
                fifoAsync = [];
                load = 0;
                loadAsync = 0;
                schedule = 0;
                locked = false;
                return this;
            };
        },
        // used with a queue to execute something at the end
        _task: function(queue, endCallback) {
            var counter = 0, finish = false;
            // push a 'callback' for later call
            this.push = function(callback, async) {
                counter++;
                queue.push(function(complete) {
                    var context = this;
                    callback.call(this, function() {
                        complete();
                        counter--;
                        if ((counter < 1) && !finish) {
                            finish = true;
                            endCallback.call(context);
                        }
                    });
                }, async);
            };
        },
        // options object (need to be in this form for all API functions
        // that have a 'options' parameter, not all properties are required)
        _options: function(object, success, fail, notify) {
            var options = $.extend({
                uid: 'ui',
                success: null, // success callback
                fail: null, // fail callback
                notify: null, // notify callback (internal use for when already in the requested state)
                expand: this._instance.options.expand, // propagate (on open)
                collapse: this._instance.options.collapse, // propagate (on close)
                unique: this._instance.options.unique, // keep a single branch open (on open)
                unanimated: false, // unanimated (open/close/toggle)
                itemData: {
                } // item data (init[Array], append[Array/object], after/before[Array/object])
            },
            object);
            if (success) {
                // success callback
                if (object && object.success) {
                    options.success = function() {
                        success.apply(this, arguments);
                        object.success.apply(this, arguments);
                    };
                } else {
                    options.success = success;
                }
            }
            if (fail) {
                // fail callback
                if (object && object.fail) {
                    options.fail = function() {
                        fail.apply(this, arguments);
                        object.fail.apply(this, arguments);
                    };
                } else {
                    options.fail = fail;
                }
            }
            if (notify) {
                // notify callback
                if (object && object.notify) {
                    options.notify = function() {
                        notify.apply(this, arguments);
                        object.notify.apply(this, arguments);
                    };
                } else {
                    if (!options.notify && object && object.success) {
                        options.notify = function() {
                            notify.apply(this, arguments);
                            object.success.apply(this, arguments);
                        };
                    } else {
                        options.notify = notify;
                    }
                }
            } else {
                if (!options.notify && object && object.success) {
                    // by default, run success callback
                    options.notify = object.success;
                }
            }
            return options;
        },
        // pass options to inner methods
        _inner: function(options, override) {
            // removing success/fail/notify from options
            return $.extend({
            }, options, {
                success: null,
                fail: null,
                notify: null
            },
            override);
        },
        // trigger event
        _trigger: function(item, eventName, options) {
            var event = $.Event('acitree');
            if (!options) {
                options = this._options();
            }
            this._instance.jQuery.trigger(event, [this, item, eventName, options]);
            return !event.isDefaultPrevented();
        },
        // call on success
        _success: function(item, options) {
            if (options && options.success) {
                options.success.call(this, item, options);
            }
        },
        // call on fail
        _fail: function(item, options) {
            if (options && options.fail) {
                options.fail.call(this, item, options);
            }
        },
        // call on notify (should be same as 'success' but called when already in the requested state)
        _notify: function(item, options) {
            if (options && options.notify) {
                options.notify.call(this, item, options);
            }
        },
        // delay callback on busy item
        _delayBusy: function(item, callback) {
            if ((this._private.delayBusy < 10) && this.isBusy(item)) {
                this._private.delayBusy++;
                window.setTimeout(this.proxy(function() {
                    this._delayBusy.call(this, item, callback);
                    this._private.delayBusy--;
                }), 10);
                return;
            }
            callback.apply(this);
        },
        // return the data source for item
        _dataSource: function(item) {
            var dataSource = this._instance.options.dataSource;
            if (dataSource) {
                var data = this.itemData(item);
                if (data && data.source && dataSource[data.source]) {
                    return dataSource[data.source];
                }
                var parent;
                do {
                    parent = this.parent(item);
                    data = this.itemData(parent);
                    if (data && data.source && dataSource[data.source]) {
                        return dataSource[data.source];
                    }
                } while (parent.length);
            }
            return this._instance.options.ajax;
        },
        // process item loading with AJAX
        // loaded data need to be array of item objects
        // each item can have children (defined as itemData.branch - array of item data objects)
        ajaxLoad: function(item, options) {
            if (item && this.isBusy(item)) {
                // delay the load if busy
                this._delayBusy(item, function() {
                    this.ajaxLoad(item, options);
                });
                return;
            }
            options = this._options(options, function() {
                this._loading(item);
                this._trigger(item, 'loaded', options);
            }, function() {
                this._loading(item);
                this._trigger(item, 'loadfail', options);
            }, function() {
                this._loading(item);
                this._trigger(item, 'wasloaded', options);
            });
            if (!item || this.isInode(item)) {
                // add the task to the queue
                this._instance.queue.push(function(complete) {
                    // a way to cancel the load
                    if (!this._trigger(item, 'beforeload', options)) {
                        this._fail(item, options);
                        complete();
                        return;
                    }
                    this._loading(item, true);
                    if (this.wasLoad(item)) {
                        // was load already
                        this._notify(item, options);
                        complete();
                        return;
                    }
                    // loaded data need to be array of item objects
                    var settings = $.extend({
                    }, this._dataSource(item));
                    this._instance.options.ajaxHook.call(this, item, settings);
                    settings.success = this.proxy(function(itemList) {
                        if (itemList && (itemList instanceof Array) && itemList.length) {
                            // the AJAX returned some items
                            var process = function() {
                                if (this.wasLoad(item)) {
                                    this._notify(item, options);
                                    complete();
                                } else {
                                    // create a branch from itemList
                                    this._createBranch(item, this._inner(options, {
                                        success: function() {
                                            this._success(item, options);
                                            complete();
                                        },
                                        fail: function() {
                                            this._fail(item, options);
                                            complete();
                                        },
                                        itemData: itemList
                                    }));
                                }
                            };
                            if (!item || this.isInode(item)) {
                                process.apply(this);
                            } else {
                                this.setInode(item, this._inner(options, {
                                    success: process,
                                    fail: options.fail
                                }));
                            }
                        } else {
                            // the AJAX response was not just right (or not a inode)
                            var process = function() {
                                this._fail(item, options);
                                complete();
                            };
                            if (!item || this.isLeaf(item)) {
                                process.apply(this);
                            } else {
                                this.setLeaf(item, this._inner(options, {
                                    success: process,
                                    fail: process
                                }));
                            }
                        }
                    });
                    settings.error = this.proxy(function() {
                        // AJAX failed
                        this._fail(item, options);
                        complete();
                    });
                    $.ajax(settings);
                }, true);
            } else {
                this._fail(item, options);
            }
        },
        // process item loading
        // options.itemData need to be array of item objects
        // each item can have children (defined as itemData.branch - array of item data objects)
        loadFrom: function(item, options) {
            if (item && this.isBusy(item)) {
                // delay the load if busy
                this._delayBusy(item, function() {
                    this.loadFrom(item, options);
                });
                return;
            }
            options = this._options(options, function() {
                this._loading(item);
                this._trigger(item, 'loaded', options);
            }, function() {
                this._loading(item);
                this._trigger(item, 'loadfail', options);
            }, function() {
                this._loading(item);
                this._trigger(item, 'wasloaded', options);
            });
            if (!item || this.isInode(item)) {
                // a way to cancel the load
                if (!this._trigger(item, 'beforeload', options)) {
                    this._fail(item, options);
                    return;
                }
                this._loading(item, true);
                if (this.wasLoad(item)) {
                    // was load already
                    this._notify(item, options);
                    return;
                }
                // data need to be array of item objects
                if (options.itemData && (options.itemData instanceof Array) && options.itemData.length) {
                    // create the branch from itemData
                    var process = function() {
                        if (this.wasLoad(item)) {
                            this._notify(item, options);
                        } else {
                            this._createBranch(item, options);
                        }
                    };
                    if (!item || this.isInode(item)) {
                        process.apply(this);
                    } else {
                        this.setInode(item, this._inner(options, {
                            success: process,
                            fail: options.fail
                        }));
                    }
                } else {
                    // this is not a inode
                    if (!item || this.isLeaf(item)) {
                        this._fail(item, options);
                    } else {
                        this.setLeaf(item, this._inner(options, {
                            success: options.fail,
                            fail: options.fail
                        }));
                    }
                }
            } else {
                this._fail(item, options);
            }
        },
        // unload item
        unload: function(item, options) {
            options = this._options(options, function() {
                this._loading(item);
                this._trigger(item, 'unloaded', options);
            }, function() {
                this._loading(item);
                this._trigger(item, 'unloadfail', options);
            }, function() {
                this._loading(item);
                this._trigger(item, 'notloaded', options);
            });
            if (!item || this.isInode(item)) {
                // a way to cancel the unload
                if (!this._trigger(item, 'beforeunload', options)) {
                    this._fail(item, options);
                    return;
                }
                this._loading(item, true);
                if (!this.wasLoad(item)) {
                    // if was not loaded
                    this._notify(item, options);
                    return;
                }
                var cancel = false;
                var children = this.children(item, true);
                children.each(this.proxy(function(element) {
                    var item = $(element);
                    if (this.isInode(item)) {
                        if (this.isOpen(item)) {
                            // a way to cancel from beforeclose
                            if (!this._trigger(item, 'beforeclose', options)) {
                                cancel = true;
                                return false;
                            }
                        }
                        if (this.wasLoad(item)) {
                            // a way to cancel from beforeunload
                            if (!this._trigger(item, 'beforeunload', options)) {
                                cancel = true;
                                return false;
                            }
                        }
                    }
                    // a way to cancel before beforeremove
                    if (!this._trigger(item, 'beforeremove', options)) {
                        cancel = true;
                        return false;
                    }
                }, true));
                if (cancel) {
                    // it was canceled
                    this._fail(item, options);
                    return;
                }
                children.each(this.proxy(function(element) {
                    // trigger the events before DOM changes
                    var item = $(element);
                    if (this.isInode(item)) {
                        if (this.isOpen(item)) {
                            this._trigger(item, 'closed', options);
                        }
                        if (this.wasLoad(item)) {
                            this._trigger(item, 'unloaded', options);
                        }
                    }
                    this._trigger(item, 'removed', options);
                }, true));
                // process the child remove
                if (item) {
                    if (this.isOpen(item)) {
                        this.close(item, this._inner(options, {
                            success: function() {
                                this._removeContainer(item);
                                this._success(item, options);
                            },
                            fail: options.fail
                        }));
                    } else {
                        this._removeContainer(item);
                        this._success(item, options);
                    }
                } else {
                    this._animate(item, false, !this._instance.options.animateRoot || options.unanimated, function() {
                        this._removeContainer();
                        this._success(item, options);
                    });
                }
            } else {
                this._fail(item, options);
            }
        },
        // remove item
        remove: function(item, options) {
            options = this._options(options, function() {
                if (this.isOpenPath(item)) {
                    item.removeClass('aciTreeVisible');
                    this._updateOddEven(item);
                }
                this._trigger(item, 'removed', options);
            }, function() {
                this._trigger(item, 'removefail', options);
            });
            if (this.isItem(item)) {
                // a way to cancel the remove
                if (!this._trigger(item, 'beforeremove', options)) {
                    this._fail(item, options);
                    return;
                }
                if (this.isInode(item) && this.wasLoad(item)) {
                    // unload the inode then remove
                    this.unload(item, this._inner(options, {
                        success: function() {
                            this._success(item, options);
                            this._removeItem(item);
                        },
                        fail: options.fail
                    }));
                } else if (this.hasSiblings(item, true)) {
                    // just remove the item
                    this._success(item, options);
                    this._removeItem(item);
                } else {
                    // no siblings, unload the parent
                    var parent = this.parent(item);
                    this.unload(parent.length ? parent : null, this._inner(options, {
                        success: options.success,
                        fail: options.fail
                    }));
                }
            } else {
                this._fail(item, options);
            }
        },
        // open item children
        _openChildren: function(item, options) {
            if (options.expand) {
                var queue = this._instance.queue;
                this.inodes(this.children(item)).each(function() {
                    var item = $(this);
                    // queue node opening
                    queue.push(function(complete) {
                        this.open(item, this._inner(options));
                        complete();
                    });
                });
                queue.push(function(complete) {
                    this._success(item, options);
                    complete();
                });
            } else {
                this._success(item, options);
            }
        },
        // process item open
        _openItem: function(item, options) {
            if (!options.unanimated && !this.isVisible(item)) {
                options.unanimated = true;
            }
            if (options.unique) {
                // close other opened nodes
                this.closeOthers(item);
                options.unique = false;
            }
            // open the node
            this._coreDOM.toggle(item, true);
            this._updateOddEvenChildren(item);
            this._animate(item, true, options.unanimated, function() {
                this._openChildren(item, options);
            });
        },
        // open item and his children if requested
        open: function(item, options) {
            options = this._options(options, function() {
                if (this.isOpenPath(item)) {
                    // if all parents are open, update items after it
                    this._updateVisible(item);
                    this._updateOddEven(item);
                }
                this._trigger(item, 'opened', options);
            }, function() {
                this._trigger(item, 'openfail', options);
            }, function() {
                this._trigger(item, 'wasopened', options);
            });
            if (this.isInode(item)) {
                // a way to cancel the open
                if (!this._trigger(item, 'beforeopen', options)) {
                    this._fail(item, options);
                    return;
                }
                if (this.isOpen(item)) {
                    options.success = options.notify;
                    this._openChildren(item, options);
                } else {
                    if (this.wasLoad(item)) {
                        this._openItem(item, options);
                    } else {
                        // try to load the node, then open
                        this.ajaxLoad(item, this._inner(options, {
                            success: function() {
                                this._openItem(item, options);
                            },
                            fail: options.fail
                        }));
                    }
                }
            } else {
                this._fail(item, options);
            }
        },
        // close item children
        _closeChildren: function(item, options) {
            if (this._instance.options.empty) {
                // unload on close
                options.unanimated = true;
                this.unload(item, options);
            } else if (options.collapse) {
                var queue = this._instance.queue;
                this.inodes(this.children(item)).each(function() {
                    var item = $(this);
                    // queue node close
                    queue.push(function(complete) {
                        this.close(item, this._inner(options, {
                            unanimated: true
                        }));
                        complete();
                    });
                });
                queue.push(function(complete) {
                    this._success(item, options);
                    complete();
                });
            } else {
                this._success(item, options);
            }
        },
        // process item close
        _closeItem: function(item, options) {
            if (!options.unanimated && !this.isVisible(item)) {
                options.unanimated = true;
            }
            // close the item
            this._coreDOM.toggle(item, false);
            this._animate(item, false, options.unanimated, function() {
                this._closeChildren(item, options);
            });
        },
        // close item and his children if requested
        close: function(item, options) {
            options = this._options(options, function() {
                if (this.isOpenPath(item)) {
                    // if all parents are open, update items after it
                    this._updateVisible(item);
                    this._updateOddEven(item);
                }
                this._trigger(item, 'closed', options);
            }, function() {
                this._trigger(item, 'closefail', options);
            }, function() {
                this._trigger(item, 'wasclosed', options);
            });
            if (this.isInode(item)) {
                // a way to cancel the close
                if (!this._trigger(item, 'beforeclose', options)) {
                    this._fail(item, options);
                    return;
                }
                if (this.isOpen(item)) {
                    this._closeItem(item, options);
                } else if (this.wasLoad(item)) {
                    options.success = options.notify;
                    this._closeChildren(item, options);
                } else {
                    this._notify(item, options);
                }
            } else {
                this._fail(item, options);
            }
        },
        // update visible state
        _updateVisible: function(item) {
            if (this.isOpenPath(item)) {
                if (!item.hasClass('aciTreeHidden')) {
                    item.addClass('aciTreeVisible');
                    var children = this.children(item);
                    this.inodes(children, true).each(this.proxy(function(element) {
                        var item = $(element);
                        if (!item.hasClass('aciTreeVisible')) {
                            this._updateVisible(item);
                        }
                    }, true));
                    children.addClass('aciTreeVisible');
                }
            } else {
                if (item.hasClass('aciTreeVisible')) {
                    item.removeClass('aciTreeVisible').find('.aciTreeVisible').removeClass('aciTreeVisible');
                }
            }
        },
        // keep just one branch open
        closeOthers: function(item, options) {
            options = this._options(options);
            if (this.isItem(item)) {
                var queue = this._instance.queue;
                var exclude = item.add(this.path(item)).add(this.children(item, true));
                // close all other open nodes (not including this item and his parents)
                this.inodes(this.children(null, true, true), true).not(exclude).each(function() {
                    var item = $(this);
                    // add node to close queue
                    queue.push(function(complete) {
                        this.close(item, this._inner(options));
                        complete();
                    });
                });
                queue.push(function(complete) {
                    this._success(item, options);
                    complete();
                });
            } else {
                this._fail(item, options);
            }
        },
        // toggle item
        toggle: function(item, options) {
            options = this._options(options, function() {
                this._trigger(item, 'toggled', options);
            }, function() {
                this._trigger(item, 'togglefail', options);
            });
            if (this.isInode(item)) {
                // a way to cancel the toggle
                if (!this._trigger(item, 'beforetoggle', options)) {
                    this._fail(item, options);
                    return;
                }
                if (this.isOpen(item)) {
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
        path: function(item, reverse) {
            if (item) {
                var path = item.parentsUntil(this._instance.jQuery, '.aciTreeLi');
                return reverse ? path : $(path.get().reverse());
            }
            return $([]);
        },
        // test if item is in view
        // when 'center' is TRUE will test if it's centered in view
        isVisible: function(item, center) {
            if (item && this.isOpenPath(item)) {
                // the item path need to be open
                var rect = this._instance.jQuery.get(0).getBoundingClientRect();
                var size = item.children('.aciTreeLine').find('.aciTreeItem');
                var test = size.get(0).getBoundingClientRect();
                var height = size.outerHeight(true);
                var offset = center ? this._instance.jQuery.innerHeight() / 2 : 0;
                if ((test.bottom - height < rect.top + offset) || (test.top + height > rect.bottom - offset)) {
                    // is out of view
                    return false;
                }
                return true;
            }
            return false;
        },
        // open path to item
        openPath: function(item, options) {
            options = this._options(options);
            if (this.isItem(item)) {
                var queue = this._instance.queue;
                // process closed nodes
                this.inodes(this.path(item), false).each(function() {
                    var item = $(this);
                    // add node to open queue
                    queue.push(function(complete) {
                        this.open(item, this._inner(options));
                        complete();
                    });
                });
                queue.push(function(complete) {
                    this._success(item, options);
                    complete();
                });
            } else {
                this._fail(item, options);
            }
        },
        // test if path to item is open
        isOpenPath: function(item) {
            var parent = this.parent(item);
            return parent.length ? parent.hasClass('aciTreeVisible') : true;
        },
        // get animation speed by element size
        _speedFraction: function(speed, totalSize, required) {
            if ((required < totalSize) && totalSize) {
                var numeric = parseInt(speed);
                if (isNaN(numeric)) {
                    // predefined string values
                    switch (speed) {
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
        // bring item in view
        // options.center says if should be in center of the view
        setVisible: function(item, options) {
            options = this._options(options, function() {
                this._trigger(item, 'visible', options);
            }, function() {
                this._trigger(item, 'visiblefail', options);
            }, function() {
                this._trigger(item, 'wasvisible', options);
            });
            if (this.isItem(item)) {
                // a way to cancel the operation
                if (!this._trigger(item, 'beforevisible', options)) {
                    this._fail(item, options);
                    return;
                }
                if (this.isVisible(item)) {
                    // is visible already
                    this._notify(item, options);
                    return;
                }
                var process = function() {
                    // compute position with getBoundingClientRect
                    var rect = this._instance.jQuery.get(0).getBoundingClientRect();
                    var size = item.children('.aciTreeLine').find('.aciTreeItem');
                    var test = size.get(0).getBoundingClientRect();
                    var height = size.outerHeight(true);
                    var offset = options.center ? this._instance.jQuery.innerHeight() / 2 : 0;
                    if (test.bottom - height < rect.top + offset) {
                        // item somewhere before the first visible
                        var diff = rect.top + offset - test.bottom + height;
                        if (!options.unanimated && this._instance.options.view) {
                            this._instance.jQuery.stop(true).animate({
                                scrollTop: this._instance.jQuery.scrollTop() - diff
                            },
                            {
                                duration: this._speedFraction(this._instance.options.view.duration, rect.bottom - rect.top, diff),
                                easing: this._instance.options.view.easing,
                                complete: this.proxy(function() {
                                    this._success(item, options);
                                })
                            });
                        } else {
                            this._instance.jQuery.stop(true).get(0).scrollTop = this._instance.jQuery.scrollTop() - diff;
                            this._success(item, options);
                        }
                    } else if (test.top + height > rect.bottom - offset) {
                        // item somewhere after the last visible
                        var diff = test.top - rect.bottom + offset + height;
                        if (!options.unanimated && this._instance.options.view) {
                            this._instance.jQuery.stop(true).animate({
                                scrollTop: this._instance.jQuery.scrollTop() + diff
                            },
                            {
                                duration: this._speedFraction(this._instance.options.view.duration, rect.bottom - rect.top, diff),
                                easing: this._instance.options.view.easing,
                                complete: this.proxy(function() {
                                    this._success(item, options);
                                })
                            });
                        } else {
                            this._instance.jQuery.stop(true).get(0).scrollTop = this._instance.jQuery.scrollTop() + diff;
                            this._success(item, options);
                        }
                    } else {
                        this._success(item, options);
                    }
                };
                if (this.hasParent(item)) {
                    // first we need to open the path to item
                    this.openPath(item, this._inner(options, {
                        success: process,
                        fail: options.fail
                    }));
                } else {
                    process.apply(this);
                }
            } else {
                this._fail(item, options);
            }
        },
        // test if item has parent
        hasParent: function(item) {
            return this.parent(item).length > 0;
        },
        // get item parent
        parent: function(item) {
            return item ? item.parent().parent('.aciTreeLi') : $([]);
        },
        // get item top parent
        topParent: function(item) {
            return this.path(item).eq(0);
        },
        // create tree branch
        // options.itemData need to be the same format as for .append
        _createBranch: function(item, options) {
            var task = new this._task(this._instance.queue, function() {
                this._success(item, options);
            });
            var process = this.proxy(function(item, itemList) {
                if (item) {
                    item.first().removeClass('aciTreeInodeMaybe').addClass('aciTreeInode');
                }
                // use .append to add new items
                this.append(item, this._inner(options, {
                    success: function(item, options) {
                        var itemData;
                        for (var i in options.itemData) {
                            itemData = options.itemData[i];
                            // children need to be array of item objects
                            if (itemData.branch && (itemData.branch instanceof Array) && itemData.branch.length) {
                                (function(item, itemData) {
                                    // queue the children creation
                                    task.push(function(complete) {
                                        process(item, itemData.branch);
                                        if (itemData.open) {
                                            this.open(item);
                                        }
                                        complete();
                                    });
                                })(options.items.eq(i), itemData);
                            } else if (itemData.open) {
                                this.open(options.items.eq(i), this._inner(options));
                            }
                        }
                    },
                    fail: options.fail,
                    itemData: itemList
                }));
            });
            // run at least once
            task.push(function(complete) {
                process(item, options.itemData);
                complete();
            });
        },
        // update first/last state position
        _updateFirstLast: function(parent, clear) {
            if (clear) {
                clear.removeClass('aciTreeFirst aciTreeLast');
            }
            this.first(parent).addClass('aciTreeFirst');
            this.last(parent).addClass('aciTreeLast');
        },
        // set aciTreeOdd/aciTreeEven classes
        _setOddEven: function(items, odd) {
            items.filter(':odd').removeClass(odd ? 'aciTreeEven' : 'aciTreeOdd').addClass(odd ? 'aciTreeOdd' : 'aciTreeEven');
            items.filter(':even').removeClass(odd ? 'aciTreeOdd' : 'aciTreeEven').addClass(odd ? 'aciTreeEven' : 'aciTreeOdd');
        },
        // update odd/even row state
        _updateOddEven: function(items) {
            // consider only visible items
            var visible = this._instance.jQuery.find('.aciTreeVisible');
            var index = 0;
            if (items) {
                // search the item to start with (by index)
                items.each(function() {
                    var found = visible.index(this);
                    if (found != -1) {
                        index = Math.min(found, index);
                    }
                });
                index = Math.max(index - 1, 0);
            }
            var odd = true;
            if (index > 0) {
                // determine with what to start with (odd/even)
                var first = visible.eq(index);
                if (first.hasClass('aciTreOdd')) {
                    odd = false;
                }
                // process only after index
                visible = visible.filter(':gt(' + index + ')');
            }
            this._setOddEven(visible, odd);
        },
        // update odd/even row state
        _updateOddEvenChildren: function(item) {
            var odd = item.hasClass('aciTreeOdd');
            var children = this.children(item);
            this._setOddEven(children, odd);
        },
        // process item before inserting into the DOM
        _itemHook: function(parent, item, itemData, level) {
            if (this._instance.options.itemHook) {
                this._instance.options.itemHook.apply(this, arguments);
            }
        },
        // create item by itemData
        _createItem: function(itemData, level) {
            var item = $('<li class="aciTreeLi aciTreeLevel' + level + '" role="treeitem" aria-level="' + (level + 1) + '" tabindex="-1" aria-selected="false"></li>').data('itemData' + this._instance.nameSpace, $.extend({
            }, itemData, {
                branch: itemData.branch && itemData.branch.length
            }));
            var start = '<div class="aciTreeLine">', end = '';
            for (var i = 0; i < level; i++) {
                start += '<div class="aciTreeBranch aciTreeLevel' + i + '">';
                end += '</div>';
            }
            start += '<div class="aciTreeEntry"><span class="aciTreeButton"><span></span></span><span class="aciTreeItem">';
            if (itemData.icon) {
                if (itemData.icon instanceof Array) {
                    start += '<span class="aciTreeIcon ' + itemData.icon[0] + '" style="background-position:' +
                            itemData.icon[1] + 'px ' + itemData.icon[2] + 'px' + '"></span>';
                } else {
                    start += '<span class="aciTreeIcon ' + itemData.icon + '"></span>';
                }
            }
            item.append(start + '<span class="aciTreeText">' + itemData.label + '</span></span></div>' + end + '</div>');
            if (itemData.inode || (itemData.inode === null)) {
                this._coreDOM.inode(item, itemData.inode || (itemData.branch && itemData.branch.length));
            } else {
                this._coreDOM.leaf(item);
            }
            return item;
        },
        // remove item
        _removeItem: function(item) {
            var parent = this.parent(item);
            item.remove();
            this._updateFirstLast(parent.length ? parent : null);
        },
        // create/add one or more items
        _createItems: function(ul, before, after, itemData, level) {
            if (itemData) {
                var parent;
                if (ul) {
                    parent = this.itemFrom(ul);
                } else if (before) {
                    parent = this.parent(before);
                } else if (after) {
                    parent = this.parent(after);
                }
                var items = [], item;
                if (itemData instanceof Array) {
                    // this is a list of items
                    for (var i in itemData) {
                        item = this._createItem(itemData[i], level);
                        this._itemHook(parent, item, itemData[i], level);
                        items[items.length] = item.get(0);
                    }
                } else {
                    // only one item
                    item = this._createItem(itemData, level);
                    this._itemHook(parent, item, itemData, level);
                    items[items.length] = item.get(0);
                }
                items = $(items);
                // add the new items
                if (ul) {
                    ul.append(items);
                } else if (before) {
                    before.before(items);
                } else if (after) {
                    after.after(items);
                }
                return items;
            }
            return $([]);
        },
        // create children container
        _createContainer: function(item) {
            if (!item) {
                item = this._instance.jQuery;
            }
            // ensure we have a UL in place
            var container = item.children('.aciTreeUl');
            if (!container.length) {
                container = $('<ul class="aciTreeUl" role="group" style="display:none"></ul>');
                item.append(container);
            }
            return container;
        },
        // remove children container
        _removeContainer: function(item) {
            if (!item) {
                item = this._instance.jQuery;
            }
            item.children('.aciTreeUl').remove();
        },
        // append one or more items to item
        // options.itemData can be a item object or array of item objects
        // options.items will keep a list of added items
        append: function(item, options) {
            options = this._options(options, function() {
                this._trigger(item, 'appended', options);
            }, function() {
                this._trigger(item, 'appendfail', options);
            });
            if (item) {
                if (this.isInode(item)) {
                    // a way to cancel the append
                    if (!this._trigger(item, 'beforeappend', options)) {
                        this._fail(item, options);
                        return;
                    }
                    var last = this.last(item);
                    var container = this._createContainer(item);
                    var list = this._createItems(container, null, null, options.itemData, this.level(item) + 1);
                    if (list.length) {
                        // some items created
                        item.addClass('aciTreeInode').removeClass('aciTreeInodeMaybe');
                        this._updateFirstLast(item, last);
                        if (this.isHidden(item)) {
                            list.addClass('aciTreeHidden');
                        } else if (this.isOpenPath(item) && this.isOpen(item)) {
                            list.addClass('aciTreeVisible');
                            this._updateOddEven(list.first());
                        }
                        // trigger added for each item
                        list.each(this.proxy(function(element) {
                            this._trigger($(element), 'added', options);
                        }, true));
                    } else if (!this.hasChildren(item, true)) {
                        container.remove();
                    }
                    options.items = list;
                    this._success(item, options);
                } else {
                    this._fail(item, options);
                }
            } else {
                // a way to cancel the append
                if (!this._trigger(item, 'beforeappend', options)) {
                    this._fail(item, options);
                    return;
                }
                var last = this.last();
                var container = this._createContainer();
                var list = this._createItems(container, null, null, options.itemData, 0);
                if (list.length) {
                    // some items created
                    this._updateFirstLast(null, last);
                    list.addClass('aciTreeVisible');
                    this._updateOddEven();
                    // trigger added for each item
                    list.each(this.proxy(function(element) {
                        this._trigger($(element), 'added', options);
                    }, true));
                    this._animate(null, true, !this._instance.options.animateRoot || options.unanimated);
                } else if (!this.hasChildren(null, true)) {
                    container.remove();
                }
                options.items = list;
                this._success(item, options);
            }
        },
        // insert one or more items before item
        // options.itemData can be a item object or array of item objects
        // options.items will keep a list of added items
        before: function(item, options) {
            options = this._options(options, function() {
                this._trigger(item, 'before', options);
            }, function() {
                this._trigger(item, 'beforefail', options);
            });
            if (this.isItem(item)) {
                // a way to cancel before
                if (!this._trigger(item, 'beforebefore', options)) {
                    this._fail(item, options);
                    return;
                }
                var prev = this.prev(item);
                var list = this._createItems(null, item, null, options.itemData, this.level(item));
                if (list.length) {
                    // some items created
                    if (!prev.length) {
                        item.removeClass('aciTreeFirst');
                        list.first().addClass('aciTreeFirst');
                    }
                    var parent = this.parent(item);
                    if (parent.length && this.isHidden(parent)) {
                        list.addClass('aciTreeHidden');
                    } else if (this.isOpenPath(item)) {
                        list.addClass('aciTreeVisible');
                        this._updateOddEven(list.first());
                    }
                    // trigger added for each item
                    list.each(this.proxy(function(element) {
                        this._trigger($(element), 'added', options);
                    }, true));
                }
                options.items = list;
                this._success(item, options);
            } else {
                this._fail(item, options);
            }
        },
        // insert one or more items after item
        // options.itemData can be a item object or array of item objects
        // options.items will keep a list of added items
        after: function(item, options) {
            options = this._options(options, function() {
                this._trigger(item, 'after', options);
            }, function() {
                this._trigger(item, 'afterfail', options);
            });
            if (this.isItem(item)) {
                // a way to cancel after
                if (!this._trigger(item, 'beforeafter', options)) {
                    this._fail(item, options);
                    return;
                }
                var next = this.next(item);
                var list = this._createItems(null, null, item, options.itemData, this.level(item));
                if (list.length) {
                    // some items created
                    if (!next.length) {
                        item.removeClass('aciTreeLast');
                        list.last().addClass('aciTreeLast');
                    }
                    var parent = this.parent(item);
                    if (parent.length && this.isHidden(parent)) {
                        list.addClass('aciTreeHidden');
                    } else if (this.isOpenPath(item)) {
                        list.addClass('aciTreeVisible');
                        this._updateOddEven(list.first());
                    }
                    // trigger added for each item
                    list.each(this.proxy(function(element) {
                        this._trigger($(element), 'added', options);
                    }, true));
                }
                options.items = list;
                this._success(item, options);
            } else {
                this._fail(item, options);
            }
        },
        // get item having the element
        itemFrom: function(element) {
            if (element) {
                var item = $(element);
                if (item.get(0) == this._instance.jQuery.get(0)) {
                    return $([]);
                } else {
                    return item.closest('.aciTreeLi');
                }
            }
            return $([]);
        },
        // get item children
        // if `branch` is TRUE then all children are returned
        // if `hidden` is TRUE then the hidden items will be considered too
        children: function(item, branch, hidden) {
            if (!item) {
                item = this._instance.jQuery;
            }
            return branch ? item.find('.aciTreeLi' + (hidden ? '' : ':not(.aciTreeHidden)')) :
                    item.children('.aciTreeUl').children('.aciTreeLi' + (hidden ? '' : ':not(.aciTreeHidden)'));
        },
        // get first/last items from parent
        _firstLast: function(parent) {
            if (!parent) {
                parent = this._instance.jQuery;
            }
            return parent.children('.aciTreeUl').children('.aciTreeFirst,.aciTreeLast');
        },
        // filter only the visible items (items with all parents opened)
        // if 'view' is TRUE then only the items in view are returned
        visible: function(items, view) {
            items = items.filter('.aciTreeVisible');
            if (view) {
                var visible = $.grep(items.get(), this.proxy(function(item) {
                    return this.isVisible($(item));
                }));
                items = $(visible);
            }
            return items;
        },
        // filter only inner nodes from items
        // if state is set then filter only open/closed ones
        inodes: function(items, state) {
            if (state !== undefined) {
                if (state) {
                    return items.filter('.aciTreeOpen');
                } else {
                    return items.filter('.aciTreeInode,.aciTreeInodeMaybe').not('.aciTreeOpen');
                }
            }
            return items.filter('.aciTreeInode,.aciTreeInodeMaybe');
        },
        // filter only leaf nodes from items
        leaves: function(items) {
            return items.filter('.aciTreeLeaf');
        },
        // test if is a inner node
        isInode: function(item) {
            return item && (item.hasClass('aciTreeInode') || item.hasClass('aciTreeInodeMaybe'));
        },
        // test if is a leaf node
        isLeaf: function(item) {
            return item && item.hasClass('aciTreeLeaf');
        },
        // test if item was loaded
        wasLoad: function(item) {
            if (!item) {
                return this._instance.jQuery.children('.aciTreeUl').length > 0;
            }
            if (this.isInode(item)) {
                return item.children('.aciTreeUl').length > 0;
            }
            return true;
        },
        // set item as inner node
        setInode: function(item, options) {
            options = this._options(options, function() {
                this._trigger(item, 'inodeset', options);
            }, function() {
                this._trigger(item, 'inodefail', options);
            }, function() {
                this._trigger(item, 'wasinode', options);
            });
            if (this.isItem(item)) {
                // a way to cancel the operation
                if (!this._trigger(item, 'beforeinode', options)) {
                    this._fail(item, options);
                    return;
                }
                if (this.isLeaf(item)) {
                    this._coreDOM.inode(item);
                    this._success(item, options);
                } else {
                    this._notify(item, options);
                }
            } else {
                this._fail(item, options);
            }
        },
        // set item as leaf node
        setLeaf: function(item, options) {
            options = this._options(options, function() {
                this._trigger(item, 'leafset', options);
            }, function() {
                this._trigger(item, 'leaffail', options);
            }, function() {
                this._trigger(item, 'wasleaf', options);
            });
            if (this.isItem(item)) {
                // a way to cancel the operation
                if (!this._trigger(item, 'beforeleaf', options)) {
                    this._fail(item, options);
                    return;
                }
                if (this.isInode(item)) {
                    var process = function() {
                        this._coreDOM.leaf(item);
                        this._success(item, options);
                    };
                    if (this.wasLoad(item)) {
                        // first unload the node
                        this.unload(item, this._inner(options, {
                            success: process,
                            fail: options.fail
                        }));
                    } else {
                        process.apply(this);
                    }
                } else {
                    this._notify(item, options);
                }
            } else {
                this._fail(item, options);
            }
        },
        // set the icon for item
        // options.icon - CSS class name or Array [class name, background x position, background y position]
        // options.oldIcon will keep the old icon
        setIcon: function(item, options) {
            options = this._options(options, null, function() {
                this._trigger(item, 'iconfail', options);
            });
            if (this.isItem(item)) {
                // a way to cancel the operation
                if (!this._trigger(item, 'beforeicon', options)) {
                    this._fail(item, options);
                    return;
                }
                var icon = options.icon;
                var itemData = this.itemData(item);
                options.oldIcon = itemData.icon;
                var parent = item.children('.aciTreeLine').find('.aciTreeItem');
                var found = parent.children('.aciTreeIcon');
                if (found.length) {
                    // already there is a icon
                    if (icon) {
                        if (icon instanceof Array) {
                            found.attr('class', 'aciTreeIcon ' + icon[0]).css('background-position', icon[1] + 'px ' + icon[2] + 'px');
                        } else {
                            found.attr('class', 'aciTreeIcon ' + icon);
                        }
                        itemData.icon = icon;
                        this._trigger(item, 'iconset', options);
                    } else {
                        found.remove();
                        itemData.icon = null;
                        this._trigger(item, 'iconremoved', options);
                    }
                } else if (icon) {
                    // add a icon
                    if (icon instanceof Array) {
                        parent.prepend('<div class="aciTreeIcon ' + icon[0] + '" style="background-position:' +
                                icon[1] + 'px ' + icon[2] + 'px' + '"></div>');
                    } else {
                        parent.prepend('<div class="aciTreeIcon ' + icon + '"></div>');
                    }
                    itemData.icon = icon;
                    this._trigger(item, 'iconadded', options);
                } else {
                    this._trigger(item, 'noticon', options);
                }
                this._success(item, options);
            } else {
                this._fail(item, options);
            }
        },
        // get item icon
        getIcon: function(item) {
            var itemData = this.itemData(item);
            return itemData ? itemData.icon : null;
        },
        // set item label
        // options.label is the new label
        // options.oldLabel will keep the old label
        setLabel: function(item, options) {
            options = this._options(options, null, function(item, options) {
                this._trigger(item, 'labelfail', options);
            }, function() {
                this._trigger(item, 'waslabel', options);
            });
            if (this.isItem(item)) {
                // a way to cancel the operation
                if (!this._trigger(item, 'beforelabel', options)) {
                    this._fail(item, options);
                    return;
                }
                var label = options.label;
                var itemData = this.itemData(item);
                options.oldLabel = itemData.label;
                if (label == options.oldLabel) {
                    this._notify(item, options);
                } else {
                    // set the label
                    item.children('.aciTreeLine').find('.aciTreeText').html(label);
                    itemData.label = label;
                    this._trigger(item, 'labelset', options);
                    this._success(item, options);
                }
            } else {
                this._fail(item, options);
            }
        },
        // set item as hidden
        hide: function(item, options) {
            options = this._options(options, function() {
                this._trigger(item, 'hidden', options);
            }, function() {
                this._trigger(item, 'hidefail', options);
            }, function() {
                this._trigger(item, 'washidden', options);
            });
            if (this.isItem(item)) {
                // a way to cancel the hide
                if (!this._trigger(item, 'beforehide', options)) {
                    this._fail(item, options);
                    return;
                }
                if (this.isHidden(item)) {
                    this._notify(item, options);
                } else {
                    item.removeClass('aciTreeVisible').addClass('aciTreeHidden');
                    this.children(item, true).removeClass('aciTreeVisible').addClass('aciTreeHidden');
                    var parent = this.parent(item);
                    this._updateFirstLast(parent.length ? parent : null, item);
                    this._updateOddEven(item);
                    this._success(item, options);
                }
            } else {
                this._fail(item, options);
            }
        },
        // test if item is hidden
        isHidden: function(item) {
            return item && item.hasClass('aciTreeHidden');
        },
        // test if any of parents are hidden
        isHiddenPath: function(item) {
            var parent = this.parent(item);
            return parent.length ? parent.hasClass('aciTreeHidden') : false;
        },
        // update hidden state
        _updateHidden: function(item) {
            if (this.isHiddenPath(item)) {
                if (!item.hasClass('aciTreeHidden')) {
                    item.addClass('aciTreeHidden');
                    this._updateVisible(item);
                }
            } else {
                this._updateVisible(item);
            }
        },
        // filter only the hidden items
        hidden: function(items) {
            return items.filter('.aciTreeHidden');
        },
        // show hidden item
        _showHidden: function(item) {
            var parent = null;
            var path = this.path(item);
            path.each(this.proxy(function(element) {
                var item = $(element);
                if (this.isHidden(item)) {
                    item.removeClass('aciTreeHidden');
                    if (this.isOpenPath(item) && (!parent || this.isOpen(parent))) {
                        item.addClass('aciTreeVisible');
                    }
                    this._updateFirstLast(parent, this._firstLast(parent));
                }
                parent = item;
            }, true));
            item.removeClass('aciTreeHidden');
            if (this.isOpenPath(item) && (!parent || this.isOpen(parent))) {
                item.addClass('aciTreeVisible');
            }
            this._updateFirstLast(parent, this._firstLast(parent));
        },
        // show hidden item
        show: function(item, options) {
            options = this._options(options, function() {
                this._trigger(item, 'shown', options);
            }, function() {
                this._trigger(item, 'showfail', options);
            }, function() {
                this._trigger(item, 'wasshown', options);
            });
            if (this.isItem(item)) {
                // a way to cancel the hide
                if (!this._trigger(item, 'beforeshow', options)) {
                    this._fail(item, options);
                    return;
                }
                if (this.isHidden(item)) {
                    this._showHidden(item);
                    var parent = this.topParent(item);
                    this._updateOddEven(parent.length ? parent : item);
                    this._success(item, options);
                } else {
                    this._notify(item, options);
                }
            } else {
                this._fail(item, options);
            }
        },
        // test if item is open
        isOpen: function(item) {
            return item && item.hasClass('aciTreeOpen');
        },
        // test if item is closed
        isClosed: function(item) {
            return !this.isOpen(item);
        },
        // test if item has children
        // if `hidden` is TRUE then the hidden items will be considered too
        hasChildren: function(item, hidden) {
            return this.children(item, null, hidden).length > 0;
        },
        // test if item has siblings
        // if `hidden` is TRUE then the hidden items will be considered too
        hasSiblings: function(item, hidden) {
            return this.siblings(item, hidden).length > 0;
        },
        // test if item has another before
        // if `hidden` is TRUE then the hidden items will be considered too
        hasPrev: function(item, hidden) {
            return this.prev(item, hidden).length > 0;
        },
        // test if item has another after
        // if `hidden` is TRUE then the hidden items will be considered too
        hasNext: function(item, hidden) {
            return this.next(item, hidden).length > 0;
        },
        // get item siblings
        // if `hidden` is TRUE then the hidden items will be considered too
        siblings: function(item, hidden) {
            return item ? item.siblings('.aciTreeLi' + (hidden ? '' : ':not(.aciTreeHidden)')) : $([]);
        },
        // get previous item
        // if `hidden` is TRUE then the hidden items will be considered too
        prev: function(item, hidden) {
            return item ? (hidden ? item.prev('.aciTreeLi') : item.prevAll('.aciTreeLi:not(.aciTreeHidden):first')) : $([]);
        },
        // get next item
        // if `hidden` is TRUE then the hidden items will be considered too
        next: function(item, hidden) {
            return item ? (hidden ? item.next('.aciTreeLi') : item.nextAll('.aciTreeLi:not(.aciTreeHidden):first')) : $([]);
        },
        // get item level (starting from 0)
        // return -1 for invalid items
        level: function(item) {
            var level = -1;
            if (item) {
                while (item.hasClass('aciTreeLi')) {
                    item = item.parent().parent();
                    level++;
                }
            }
            return level;
        },
        // get item ID
        getId: function(item) {
            var itemData = this.itemData(item);
            return itemData ? itemData.id : null;
        },
        // get item data
        itemData: function(item) {
            return item ? item.data('itemData' + this._instance.nameSpace) : null;
        },
        // set item ID
        // options.id is the new item ID
        // options.oldId will keep the old ID
        setId: function(item, options) {
            options = this._options(options, null, function() {
                this._trigger(item, 'idfail', options);
            }, function() {
                this._trigger(item, 'wasid', options);
            });
            if (this.isItem(item)) {
                // a way to cancel the operation
                if (!this._trigger(item, 'beforeid', options)) {
                    this._fail(item, options);
                    return;
                }
                var id = options.id;
                var itemData = this.itemData(item);
                options.oldId = itemData.id;
                if (id == options.oldId) {
                    this._notify(item, options);
                } else {
                    // set the new ID
                    itemData.id = id;
                    this._trigger(item, 'idset', options);
                    this._success(item, options);
                }
            } else {
                this._fail(item, options);
            }
        },
        // get item index starting from 0
        getIndex: function(item) {
            return item ? item.parent().children('.aciTreeLi').index(item) : null;
        },
        // set item 0 based index
        // options.index is the new index
        // options.oldIndex will keep the old index
        setIndex: function(item, options) {
            var index = options.index;
            options = this._options(options, null, function() {
                this._trigger(item, 'indexfail', options);
            }, function() {
                this._trigger(item, 'wasindex', options);
            });
            if (this.isItem(item)) {
                // a way to cancel the operation
                if (!this._trigger(item, 'beforeindex', options)) {
                    this._fail(item, options);
                    return;
                }
                options.oldIndex = this.getIndex(item);
                var siblings = this.siblings(item);
                if ((index != options.oldIndex) && siblings.length) {
                    // set the new index
                    if (index < 1) {
                        siblings.first().before(item);
                    } else if (index >= siblings.length) {
                        siblings.last().after(item);
                    } else {
                        siblings.eq(index).before(item);
                    }
                    var parent = this.parent(item);
                    this._updateFirstLast(parent.length ? parent : null, item.add([siblings.get(0), siblings.get(-1)]));
                    this._updateOddEven(parent);
                    this._trigger(item, 'indexset', options);
                    this._success(item, options);
                } else {
                    this._notify(item, options);
                }
            } else {
                this._fail(item, options);
            }
        },
        // get item label
        getLabel: function(item) {
            var itemData = this.itemData(item);
            return itemData ? itemData.label : null;
        },
        // test if it's a valid item
        isItem: function(item) {
            return item && item.hasClass('aciTreeLi');
        },
        // item animation
        _animate: function(item, state, unanimated, callback) {
            if (!item) {
                item = this._instance.jQuery;
            }
            if (!unanimated) {
                var type = state ? this._instance.options.show : this._instance.options.hide;
                if (type) {
                    var ul = item.children('.aciTreeUl');
                    if (ul.length) {
                        ul.stop(true, true).animate(type.props, {
                            duration: type.duration,
                            easing: type.easing,
                            complete: callback ? this.proxy(callback) : null
                        });
                    } else if (callback) {
                        callback.apply(this);
                    }
                    return;
                }
            }
            item.children('.aciTreeUl').stop(true, true).toggle(state);
            if (callback) {
                callback.apply(this);
            }
        },
        // get first child of item
        // if `hidden` is TRUE then the hidden items will be considered too
        first: function(item, hidden) {
            if (!item) {
                item = this._instance.jQuery;
            }
            return item.children('.aciTreeUl').children('.aciTreeLi' + (hidden ? '' : ':not(.aciTreeHidden)') + ':first');
        },
        // test if item is the first one for it's parent
        // if `hidden` is TRUE then the hidden items will be considered too
        isFirst: function(item, hidden) {
            if (item) {
                var parent = this.parent(item);
                return this.first(parent.length ? parent : null, hidden).is(item);
            }
            return false;
        },
        // get last child of item
        // if `hidden` is TRUE then the hidden items will be considered too
        last: function(item, hidden) {
            if (!item) {
                item = this._instance.jQuery;
            }
            return item.children('.aciTreeUl').children('.aciTreeLi' + (hidden ? '' : ':not(.aciTreeHidden)') + ':last');
        },
        // test if item is the last one for it's parent
        // if `hidden` is TRUE then the hidden items will be considered too
        isLast: function(item, hidden) {
            if (item) {
                var parent = this.parent(item);
                return this.last(parent.length ? parent : null, hidden).is(item);
            }
            return false;
        },
        // test if item is loading
        isBusy: function(item) {
            if (item) {
                return item.hasClass('aciTreeLoad');
            } else {
                return this._instance.queue.busy();
            }
        },
        // set loading state
        _loading: function(item, state) {
            if (item) {
                if (state) {
                    item.attr('aria-busy', true);
                } else {
                    item.removeAttr('aria-busy');
                }
                item.toggleClass('aciTreeLoad', state);
            } else if (state) {
                this._loader(state);
            }
        },
        // show loader image
        _loader: function(show) {
            if (show || this.isBusy()) {
                if (!this._private.loaderInterval) {
                    this._private.loaderInterval = window.setInterval(this.proxy(function() {
                        this._loader();
                    }), this._instance.options.loaderDelay);
                }
                this._instance.jQuery.addClass('aciTreeLoad');
                window.clearTimeout(this._private.loaderHide);
                this._private.loaderHide = window.setTimeout(this.proxy(function() {
                    this._instance.jQuery.removeClass('aciTreeLoad');
                }), this._instance.options.loaderDelay * 2);
            }
        },
        // test if parent has children
        isChildren: function(parent, children) {
            if (!parent) {
                parent = this._instance.jQuery;
            }
            return children && (parent.has(children).length > 0);
        },
        // test if parent has immediate children
        isImmediateChildren: function(parent, children) {
            if (!parent) {
                parent = this._instance.jQuery;
            }
            return children && parent.children('.aciTreeUl').children('.aciTreeLi').is(children);
        },
        // test if items share the same parent
        sameParent: function(item1, item2) {
            if (item1 && item2) {
                var parent1 = this.parent(item1);
                var parent2 = this.parent(item2);
                return (!parent1.length && !parent2.length) || (parent1.get(0) == parent2.get(0));
            }
            return false;
        },
        // test if items share the same top parent
        sameTopParent: function(item1, item2) {
            if (item1 && item2) {
                var parent1 = this.topParent(item1);
                var parent2 = this.topParent(item2);
                return (!parent1.length && !parent2.length) || (parent1.get(0) == parent2.get(0));
            }
            return false;
        },
        // return updated item data
        _serialize: function(item, callback) {
            var data = this.itemData(item);
            if (this.isInode(item)) {
                data.inode = true;
                if (this.wasLoad(item)) {
                    data.open = this.isOpen(item);
                    data.branch = [];
                    this.children(item, false, true).each(this.proxy(function(element) {
                        var entry = this._serialize($(element), callback);
                        if (callback) {
                            entry = callback.call(this, $(element), {
                            }, entry);
                        } else {
                            entry = this._instance.options.serialize.call(this, $(element), {
                            }, entry);
                        }
                        if (entry) {
                            data.branch.push(entry);
                        }
                    }, true));
                } else {
                    data.open = false;
                    data.branch = null;
                }
            } else {
                data.inode = false;
                data.open = null;
                data.branch = null;
            }
            return data;
        },
        // return serialized data
        // callback(item, what, value)
        serialize: function(item, what, callback) {
            // override this to provide serialized data
            if (typeof what == 'object') {
                if (item) {
                    var data = this._serialize(item, callback);
                    if (callback) {
                        data = callback.call(this, item, {
                        }, data);
                    } else {
                        data = this._instance.options.serialize.call(this, item, {
                        }, data);
                    }
                    return data;
                } else {
                    var list = [];
                    this.children(null, false, true).each(this.proxy(function(element) {
                        var data = this._serialize($(element), callback);
                        if (callback) {
                            data = callback.call(this, $(element), {
                            }, data);
                        } else {
                            data = this._instance.options.serialize.call(this, $(element), {
                            }, data);
                        }
                        if (data) {
                            list.push(data);
                        }
                    }, true));
                    return list;
                }
            }
            return '';
        },
        // destroy control
        destroy: function(options) {
            options = this._options(options);
            // check if was init
            if (!this.wasInit()) {
                this._trigger(null, 'notinit', options);
                this._fail(null, options);
                return;
            }
            // check if is locked
            if (this.isLocked()) {
                this._trigger(null, 'locked', options);
                this._fail(null, options);
                return;
            }
            // a way to cancel the destroy
            if (!this._trigger(null, 'beforedestroy', options)) {
                this._trigger(null, 'destroyfail', options);
                this._fail(null, options);
                return;
            }
            this._instance.locked = true;
            this._instance.jQuery.addClass('aciTreeLoad').attr('aria-busy', true);
            this._instance.queue.destroy();
            this._destroyHook(false);
            // unload the entire treeview
            this.unload(null, this._inner(options, {
                success: this.proxy(function() {
                    window.clearTimeout(this._private.loaderHide);
                    window.clearInterval(this._private.loaderInterval);
                    this._destroyHook(true);
                    this._instance.jQuery.unbind(this._instance.nameSpace).off(this._instance.nameSpace, '.aciTreeButton').off(this._instance.nameSpace, '.aciTreeLine');
                    this._instance.jQuery.removeClass('aciTree' + this._instance.index + ' aciTreeLoad').removeAttr('role aria-busy');
                    this._instance.locked = false;
                    // call the parent
                    this._super();
                    this._trigger(null, 'destroyed', options);
                    this._success(null, options);
                }),
                fail: function() {
                    this._instance.jQuery.removeClass('aciTreeLoad');
                    this._instance.locked = false;
                    this._trigger(null, 'destroyfail', options);
                    this._fail(null, options);
                }
            }));
        },
        _destroyHook: function(unloaded) {
            // override this to do extra destroy before/after unload
        }

    };

    // extend the base aciPluginUi class and store into aciPluginClass.plugins
    aciPluginClass.plugins.aciTree = aciPluginClass.aciPluginUi.extend(aciTree_core, 'aciTreeCore');

    // publish the plugin & the default options
    aciPluginClass.publish('aciTree', options);

})(jQuery, this);
