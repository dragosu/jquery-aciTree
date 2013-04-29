
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
 * A few utility functions for aciTree.
 *
 */

(function($, window, undefined) {

    // aciTree utils extension
    // adds item update option, branch processing, moving items & item swapping, item search by ID

    var aciTree_utils = {
        __extend: function() {
            $.extend(this._private, {
                // the branch queue
                branchQueue: new this._queue(this._instance.options.threads, true).context(this)
            });
            // call the parent
            this._super();
        },
        // update item (create tree branch if requested)
        // if options.itemData have the 'childs' property set then
        // will be like when calling 'loadFrom' for the item
        update: function(item, options) {
            options = this._options(options, function() {
                this._trigger(item, 'updated', options);
            }, function() {
                this._trigger(item, 'updatefail', options);
            });
            if (this.isItem(item)) {
                // a way to cancel the operation
                if (!this._trigger(item, 'beforeupdate', options)) {
                    this._fail(item, options);
                    return;
                }
                var details = function() {
                    if (options.itemData.id !== undefined) {
                        this.setId(item, {
                            id: options.itemData.id
                        });
                    }
                    if (options.itemData.label !== undefined) {
                        this.setLabel(item, {
                            label: options.itemData.label
                        });
                    }
                    if (options.itemData.icon !== undefined) {
                        this.setIcon(item, {
                            icon: options.itemData.icon
                        });
                    }
                };
                if (options.itemData.isFolder || (options.itemData.isFolder === null)) {
                    var process = function() {
                        // set item ID/text/icon
                        details.apply(this);
                        item.first().removeClass('aciTreeFolder aciTreeFolderMaybe').addClass((options.itemData.isFolder ||
                                (options.itemData.childs && options.itemData.childs.length)) ? 'aciTreeFolder' : 'aciTreeFolderMaybe');
                        if (options.itemData.childs) {
                            if (this.wasLoad(item)) {
                                this.unload(item, this._inner(options, {
                                    success: function() {
                                        this.loadFrom(item, this._inner(options, {
                                            success: options.success,
                                            fail: options.fail,
                                            itemData: options.itemData.childs
                                        }));
                                    },
                                    fail: options.fail
                                }));
                            } else {
                                this.loadFrom(item, this._inner(options, {
                                    success: options.success,
                                    fail: options.fail,
                                    itemData: options.itemData.childs
                                }));
                            }
                        } else {
                            this._success(item, options);
                        }
                    };
                    if (this.isFolder(item)) {
                        process.apply(this);
                    } else {
                        this.setFolder(item, this._inner(options, {
                            success: process,
                            fail: options.fail
                        }));
                    }
                } else {
                    if (this.isFile(item)) {
                        details.apply(this);
                    } else {
                        this.setFile(item, this._inner(options, {
                            success: details,
                            fail: options.fail
                        }));
                    }
                }
            } else {
                this._fail(item, options);
            }
        },
        // callback call for each children of item
        // when 'load' is TRUE will also try to load nodes
        branch: function(item, callback, load) {
            var _this = this;
            var _private = this._private;
            var process = function(item, callback, next) {
                var child = next ? _this.next(item) : _this.first(item);
                if (child.length) {
                    if (_this.isFolder(child)) {
                        if (_this.wasLoad(child)) {
                            _private.branchQueue.push(function() {
                                callback.call(this, child);
                                process(child, callback);
                                process(child, callback, true);
                            }).run();
                        } else if (load) {
                            _private.branchQueue.push(function(complete) {
                                this.ajaxLoad(child, {
                                    success: function() {
                                        callback.call(this, child);
                                        process(child, callback);
                                        process(child, callback, true);
                                        complete();
                                    },
                                    fail: function() {
                                        process(child, callback, true);
                                        complete();
                                    }
                                });
                            }, true).run();
                        } else {
                            _private.branchQueue.push(function() {
                                callback.call(this, child);
                                process(child, callback, true);
                            }).run();
                        }
                    } else {
                        _private.branchQueue.push(function() {
                            callback.call(this, child);
                            process(child, callback, true);
                        }).run();
                    }
                }
            };
            process(item, callback);
        },
        // override isBusy to check branchQueue too
        isBusy: function(item) {
            if (item) {
                return this._super(item);
            } else {
                return this._super(item) || !this._private.branchQueue.empty();
            }
        },
        // swap two items
        // options.item1 & options.item2 are the swapped items
        swap: function(options) {
            options = this._options(options, null, function() {
                this._trigger(null, 'swapfail', options);
            });
            var item1 = options.item1;
            var item2 = options.item2;
            if (this.isItem(item1) && this.isItem(item2) && !this.isChildren(item1, item2) && !this.isChildren(item2, item1) && (item1.get(0) != item2.get(0))) {
                // a way to cancel the operation
                if (!this._trigger(null, 'beforeswap', options)) {
                    this._fail(null, options);
                    return;
                }
                item1 = item1.first();
                item2 = item2.first();
                var prev = this.prev(item1);
                if (prev.length) {
                    if (item2.get(0) == prev.get(0)) {
                        item2.before(item1);
                    } else {
                        item1.insertAfter(item2);
                        item2.insertAfter(prev);
                    }
                } else {
                    var next = this.next(item1);
                    if (next.length) {
                        if (item2.get(0) == next.get(0)) {
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
                this._updateLevel(item1);
                var parent = this.parent(item1);
                this._updateFirstLast(parent.length ? parent : null, item1.add(item2));
                this._updateVisibleState(parent.length ? parent : null, item1);
                this._updateLevel(item2);
                parent = this.parent(item2);
                this._updateFirstLast(parent.length ? parent : null, item2.add(item1));
                this._updateVisibleState(parent.length ? parent : null, item2);
                this._updateOddEven(item1.add(item2));
                this._trigger(null, 'swapped', options);
                this._success(null, options);
            } else {
                this._fail(null, options);
            }
        },
        // update item level
        _updateLevel: function(item) {
            var level = this.level(item);
            var count = item.find('.aciTreeBranch').length;
            if (count < level) {
                var entry = item.find('.aciTreeEntry');
                for (var i = level - 1; i >= count; i--) {
                    entry.wrap('<div class="aciTreeBranch aciTreeLevel' + i + '"></div>');
                }
            } else if (count > level) {
                var entry = item.find('.aciTreeEntry');
                for (var i = level; i < count; i++) {
                    entry.unwrap();
                }
            }
        },
        // update item visible state
        _updateVisibleState: function(parent, item) {
            if (parent) {
                if (this.isOpenPath(parent) && this.isOpen(parent)) {
                    item.first().addClass('aciTreeVisible');
                    this._updateVisible(item, true);
                } else {
                    this._updateVisible(item, false);
                    item.first().removeClass('aciTreeVisible');
                }
            } else {
                item.first().addClass('aciTreeVisible');
                this._updateVisible(item, true);
            }
        },
        // move item up
        moveUp: function(item, options) {
            options = this._options(options);
            options.index = this.getIndex(item) - 1;
            this.setIndex(item, options);
        },
        // move item down
        moveDown: function(item, options) {
            options = this._options(options);
            options.index = this.getIndex(item) + 1;
            this.setIndex(item, options);
        },
        // move item in first position
        moveFirst: function(item, options) {
            options = this._options(options);
            options.index = 0;
            this.setIndex(item, options);
        },
        // move item in last position
        moveLast: function(item, options) {
            options = this._options(options);
            options.index = Number.MAX_VALUE;
            this.setIndex(item, options);
        },
        // search a 'path' ID from a parent
        _search: function(parent, pathId) {
            var items = this.childrens(parent);
            var item, id, length, found, exact = false;
            for (var i = 0, size = items.length; i < size; i++) {
                item = items.eq(i);
                id = window.String(this.getId(item));
                length = id.length;
                if (length) {
                    if (id == pathId.substr(0, length)) {
                        found = item;
                        exact = pathId.length == length;
                        break;
                    }
                }
            }
            if (found) {
                if (!exact) {
                    // try to search childrens
                    var child = this._search(found, pathId);
                    if (child) {
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
        },
        // search items by ID
        // options.id is the ID to search for
        // if 'path' is TRUE then the search will be more optimized
        // and reduced to the first branch that matches the ID
        // but the ID must be set like a path otherwise will not work
        // if 'load' is TRUE will also try to load nodes (works only when 'path' is TRUE)
        searchId: function(path, load, options) {
            var _this = this;
            options = this._options(options);
            var id = options.id;
            if (path) {
                if (load) {
                    var process = function(item) {
                        var found = _this._search(item, id);
                        if (found) {
                            if (found.exact) {
                                _this._success(found.item, options);
                            } else {
                                if (_this.wasLoad(found.item)) {
                                    _this._fail(item, options);
                                } else {
                                    _this.ajaxLoad(found.item, _this._inner(options, {
                                        success: function() {
                                            process(found.item);
                                        },
                                        fail: options.fail
                                    }));
                                }
                            }
                        } else {
                            _this._fail(item, options);
                        }
                    };
                    process();
                } else {
                    var found = this._search(null, id);
                    if (found && found.exact) {
                        this._success(found.item, options);
                    } else {
                        this._fail(null, options);
                    }
                }
            } else {
                var found = $();
                this._instance.jQuery.find('.aciTreeLi').each(function() {
                    if (id == _this.getId($(this))) {
                        found = $(this);
                        return false;
                    }
                });
                if (found.length) {
                    this._success(found, options);
                } else {
                    this._fail(null, options);
                }
            }
        },
        // override _destroyHook
        _destroyHook: function(unloaded) {
            if (!unloaded) {
                this._private.branchQueue.destroy();
            }
            // call the parent
            this._super(unloaded);
        }

    };

    // extend the base aciTree class and add the utils stuff
    aciPluginClass.plugins.aciTree = aciPluginClass.plugins.aciTree.extend(aciTree_utils, 'aciTreeUtils');

})(jQuery, this);
