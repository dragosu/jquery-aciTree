
/*
 * aciTree jQuery Plugin v3.4.0
 * http://acoderinsights.ro
 *
 * Copyright (c) 2013 Dragos Ursu
 * Dual licensed under the MIT or GPL Version 2 licenses.
 *
 * Require jQuery Library >= v1.7.1 http://jquery.com
 * + aciPlugin >= v1.4.0 https://github.com/dragosu/jquery-aciPlugin
 */

/*
 * A few utility functions for aciTree.
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
            var process = this.proxy(function(item, callback, next) {
                var child = next ? this.next(item) : this.first(item);
                if (child.length) {
                    if (this.isFolder(child)) {
                        if (this.wasLoad(child)) {
                            this._private.branchQueue.push(function() {
                                callback.call(this, child);
                                process(child, callback);
                                process(child, callback, true);
                            }).run();
                        } else if (load) {
                            this._private.branchQueue.push(function(complete) {
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
                            this._private.branchQueue.push(function() {
                                callback.call(this, child);
                                process(child, callback, true);
                            }).run();
                        }
                    } else {
                        this._private.branchQueue.push(function() {
                            callback.call(this, child);
                            process(child, callback, true);
                        }).run();
                    }
                }
            });
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
        // swap two items (they can't be parent & child)
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
                this._updateFirstLast(parent.length ? parent : null, item1);
                this._updateVisibleState(parent.length ? parent : null, item1);
                this._updateLevel(item2);
                parent = this.parent(item2);
                this._updateFirstLast(parent.length ? parent : null, item2);
                this._updateVisibleState(parent.length ? parent : null, item2);
                this._updateOddEven(item1.add(item2));
                this._trigger(null, 'swapped', options);
                this._success(null, options);
            } else {
                this._fail(null, options);
            }
        },
        // update item level
        _updateItemLevel: function(item, fromLevel, toLevel) {
            item.removeClass('aciTreeLevel' + fromLevel).addClass('aciTreeLevel' + toLevel);
            var entry = item.children('.aciTreeLine').find('.aciTreeEntry');
            if (fromLevel < toLevel) {
                for (var i = fromLevel; i < toLevel; i++) {
                    entry.wrap('<div class="aciTreeBranch aciTreeLevel' + i + '"></div>');
                }
            } else if (fromLevel > toLevel) {
                for (var i = toLevel; i < fromLevel; i++) {
                    entry.unwrap();
                }
            }
        },
        // update child level
        _updateChildLevel: function(item, fromLevel, toLevel) {
            this.childrens(item).each(this.proxy(function(element) {
                var item = $(element);
                this._updateItemLevel(item, fromLevel, toLevel);
                if (this.isFolder(item)) {
                    this.childrens(item).each(this.proxy(function(element) {
                        this._updateChildLevel($(element), fromLevel + 1, toLevel + 1);
                    }, true));
                }
            }, true));
        },
        // update item level
        _updateLevel: function(item) {
            var level = this.level(item);
            var found = window.parseInt(item.attr('class').match(/aciTreeLevel[0-9]+/)[0].match(/[0-9]+/));
            if (level != found) {
                this._updateItemLevel(item, found, level);
                this._updateChildLevel(item, found + 1, level + 1);
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
            options.index = window.Math.max(this.getIndex(item) - 1, 0);
            this.setIndex(item, options);
        },
        // move item down
        moveDown: function(item, options) {
            options = this._options(options);
            options.index = window.Math.min(this.getIndex(item) + 1, this.siblings(item).length);
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
            options.index = this.siblings(item).length;
            this.setIndex(item, options);
        },
        // move item before another (they can't be parent & child)
        // options.before is the element before which the item will be moved
        moveBefore: function(item, options) {
            options = this._options(options, null, function() {
                this._trigger(item, 'movefail', options);
            }, function() {
                this._trigger(item, 'wasbefore', options);
            });
            var before = options.before;
            if (this.isItem(item) && this.isItem(before) && !this.isChildren(item, before) && (item.get(0) != before.get(0))) {
                // a way to cancel the operation
                if (!this._trigger(item, 'beforemove', options)) {
                    this._fail(item, options);
                    return;
                }
                if (this.prev(before).get(0) == item.get(0)) {
                    this._notify(item, options);
                } else {
                    item = item.first();
                    before = before.first();
                    var parent = this.parent(item);
                    var prev = this.prev(item);
                    if (!prev.length) {
                        prev = parent.length ? parent : this.first();
                    }
                    item.insertBefore(before);
                    if (parent.length && !this.hasChildrens(parent)) {
                        this.setFile(parent);
                    }
                    this._updateLevel(item);
                    this._updateFirstLast(parent.length ? parent : null);
                    parent = this.parent(item);
                    this._updateFirstLast(parent.length ? parent : null, item.add(before));
                    this._updateVisibleState(parent.length ? parent : null, item);
                    this._updateOddEven(item.add(before).add(prev));
                    this._trigger(item, 'moved', options);
                    this._success(item, options);
                }
            } else {
                this._fail(item, options);
            }
        },
        // move item after another (they can't be parent & child)
        // options.after is the element after which the item will be moved
        moveAfter: function(item, options) {
            options = this._options(options, null, function() {
                this._trigger(item, 'movefail', options);
            }, function() {
                this._trigger(item, 'wasafter', options);
            });
            var after = options.after;
            if (this.isItem(item) && this.isItem(after) && !this.isChildren(item, after) && (item.get(0) != after.get(0))) {
                // a way to cancel the operation
                if (!this._trigger(item, 'beforemove', options)) {
                    this._fail(item, options);
                    return;
                }
                if (this.next(after).get(0) == item.get(0)) {
                    this._notify(item, options);
                } else {
                    item = item.first();
                    after = after.first();
                    var parent = this.parent(item);
                    var prev = this.prev(item);
                    if (!prev.length) {
                        prev = parent.length ? parent : this.first();
                    }
                    item.insertAfter(after);
                    if (parent.length && !this.hasChildrens(parent)) {
                        this.setFile(parent);
                    }
                    this._updateLevel(item);
                    this._updateFirstLast(parent.length ? parent : null);
                    parent = this.parent(item);
                    this._updateFirstLast(parent.length ? parent : null, item.add(after));
                    this._updateVisibleState(parent.length ? parent : null, item);
                    this._updateOddEven(item.add(after).add(prev));
                    this._trigger(item, 'moved', options);
                    this._success(item, options);
                }
            } else {
                this._fail(item, options);
            }
        },
        // move item to be a child of another (they can't be parent & child and the targeted parent item must be empty)
        // options.parent is the parent element on which the item will be added
        asChild: function(item, options) {
            options = this._options(options, null, function() {
                this._trigger(item, 'childfail', options);
            });
            var parent = options.parent;
            if (this.isItem(item) && this.isItem(parent) && !this.isChildren(item, parent) && !this.hasChildrens(parent) && (item.get(0) != parent.get(0))) {
                // a way to cancel the operation
                if (!this._trigger(item, 'beforechild', options)) {
                    this._fail(item, options);
                    return;
                }
                item = item.first();
                parent = parent.first();
                var process = function() {
                    var oldParent = this.parent(item);
                    var prev = this.prev(item);
                    if (!prev.length) {
                        prev = oldParent.length ? oldParent : this.first();
                    }
                    var container = this._createContainer(parent);
                    container.append(item);
                    if (oldParent.length && !this.hasChildrens(oldParent)) {
                        this.setFile(oldParent);
                    }
                    this._updateLevel(item);
                    this._updateFirstLast(oldParent.length ? oldParent : null);
                    this._updateFirstLast(parent.length ? parent : null, item);
                    this._updateVisibleState(parent.length ? parent : null, item);
                    this._updateOddEven(item.add(prev));
                    this._trigger(item, 'childset', options);
                    this._success(item, options);
                };
                if (this.isFolder(parent)) {
                    process.apply(this);
                } else {
                    this.setFolder(parent, this._inner(options, {
                        success: process,
                        fail: options.fail
                    }));
                }
            } else {
                this._fail(item, options);
            }
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
            options = this._options(options);
            var id = options.id;
            if (path) {
                if (load) {
                    var process = this.proxy(function(item) {
                        var found = this._search(item, id);
                        if (found) {
                            if (found.exact) {
                                this._success(found.item, options);
                            } else {
                                if (this.wasLoad(found.item)) {
                                    this._fail(item, options);
                                } else {
                                    this.ajaxLoad(found.item, this._inner(options, {
                                        success: function() {
                                            process(found.item);
                                        },
                                        fail: options.fail
                                    }));
                                }
                            }
                        } else {
                            this._fail(item, options);
                        }
                    });
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
                this._instance.jQuery.find('.aciTreeLi').each(this.proxy(function(element) {
                    if (id == this.getId($(element))) {
                        found = $(element);
                        return false;
                    }
                }, true));
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
