
/*
 * aciTree jQuery Plugin v3.0.0-rc.7
 * http://acoderinsights.ro
 *
 * Copyright (c) 2013 Dragos Ursu
 * Dual licensed under the MIT or GPL Version 2 licenses.
 *
 * Require jQuery Library >= v1.7.1 http://jquery.com
 * + aciPlugin >= v1.1.1 https://github.com/dragosu/jquery-aciPlugin
 *
 * Date: Apr Mon 29 09:40 2013 +0200
 */

/*
 * This extension adds save/restore support for item states (open/selected) using local storage.
 * The states are saved on item select/open and restored on treeview init.
 * Require jStorage https://github.com/andris9/jStorage and the utils extension for finding items by ID.
 */

(function($, window, undefined) {

    // extra default options

    var options = {
        persist: null           // the storage key name to keep the states (should be unique/treeview)
    };

    // aciTree persist extension
    // save/restore item state in/from local storage

    var aciTree_persist = {
        __extend: function() {
            $.extend(this._private, {
                // timeouts for the save operation
                selectTimeout: null,
                stateTimeout: null
            });
            // call the parent
            this._super();
        },
        // override _initHook
        _initHook: function() {
            var _this = this;
            // test for jStorage presence
            if ($.jStorage) {
                this._instance.jQuery.bind('acitree' + this._private.nameSpace, function(event, api, item, eventName, options) {
                    if (!_this._instance.options.persist || (options.uid == 'ui.persist')) {
                        // skip processing itself
                        return;
                    }
                    switch (eventName) {
                        case 'init':
                            api._persistRestore();
                            break;
                        case 'selected':
                            // support 'selectable' extension
                            api._persistLater(true);
                            break;
                        case 'unselected':
                            // support 'selectable' extension
                            api._persistLater(true);
                            break;
                        case 'opened':
                            api._persistLater(false);
                            break;
                        case 'closed':
                            api._persistLater(false);
                            break;
                    }
                });
            }
            // call the parent
            this._super();
        },
        // persist states
        _persistLater: function(selected) {
            var _this = this;
            if (selected) {
                window.clearTimeout(this._private.selectTimeout);
                this._private.selectTimeout = window.setTimeout(function() {
                    _this._persistSelected();
                }, 250);
            } else {
                window.clearTimeout(this._private.stateTimeout);
                this._private.stateTimeout = window.setTimeout(function() {
                    _this._persistOpen();
                }, 250);
            }
        },
        // restore item states
        _persistRestore: function() {
            var queue = new this._queue(null, true).context(this);
            var opened = $.jStorage.get('aciTree_' + this._instance.options.persist + '_opened');
            if (opened instanceof Array) {
                // open all saved items
                for (var i in opened) {
                    (function(id) {
                        // add item to queue
                        queue.push(function(complete) {
                            this.searchId(null, null, {
                                success: function(item) {
                                    this.open(item, {
                                        uid: 'ui.persist',
                                        success: complete,
                                        fail: complete
                                    });
                                },
                                fail: complete,
                                id: id
                            });
                        }, true);
                    })(opened[i]);
                }
            }
            // support selectable extension
            if (this.isSelectable) {
                var selected = $.jStorage.get('aciTree_' + this._instance.options.persist + '_selected');
                if (selected) {
                    // select item
                    queue.push(function(complete) {
                        this.searchId(null, null, {
                            success: function(item) {
                                this.select(item, {
                                    uid: 'ui.persist',
                                    success: function(item) {
                                        this.setVisible(item, {
                                            center: true
                                        });
                                        complete();
                                    },
                                    fail: complete,
                                    select: true
                                });
                            },
                            fail: complete,
                            id: selected
                        });
                    }, true);
                }
            }
            queue.run();
        },
        // persist selected item
        _persistSelected: function() {
            // support selectable extension
            if (this.isSelectable) {
                var selected = this.selected();
                $.jStorage.set('aciTree_' + this._instance.options.persist + '_selected', this.getId(selected));
            }
        },
        // persist opened items
        _persistOpen: function() {
            var _this = this;
            var opened = [];
            this.visible(this.folders(this.childrens(null, true), true)).each(function() {
                opened[opened.length] = _this.getId($(this));
            })
            $.jStorage.set('aciTree_' + this._instance.options.persist + '_opened', opened);
        },
        // test if there is any saved data
        isPersist: function() {
            if ($.jStorage && this._instance.options.persist) {
                var selected = $.jStorage.get('aciTree_' + this._instance.options.persist + '_selected');
                if (selected) {
                    return true;
                }
                var opened = $.jStorage.get('aciTree_' + this._instance.options.persist + '_opened');
                if (opened instanceof Array) {
                    return true;
                }
            }
            return false;
        },
        // remove any saved states
        unpersist: function() {
            if ($.jStorage && this._instance.options.persist) {
                $.jStorage.deleteKey('aciTree_' + this._instance.options.persist + '_selected');
                $.jStorage.deleteKey('aciTree_' + this._instance.options.persist + '_opened');
            }
        },
        // override _destroyHook
        _destroyHook: function(unloaded) {
            this._instance.jQuery.unbind(this._private.nameSpace);
            // call the parent
            this._super(unloaded);
        }
    };

    // extend the base aciTree class and add the persist stuff
    aciPluginClass.plugins.aciTree = aciPluginClass.plugins.aciTree.extend(aciTree_persist, 'aciTreePersist');

    // add extra default options
    aciPluginClass.defaults('aciTree', options);

})(jQuery, this);
