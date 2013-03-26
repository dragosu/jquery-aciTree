
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

(function($){

    // aciTree utils extension
    // adds item update option, branch processing, moving items & item swapping, item search by ID

    var aciTree_utils = {

        __extend: function(){
            $.extend(this._private, {
                // the branch queue
                branchQueue: new this._queue(null, true, this._instance.options.queueDelay)
            });
            // call the parent
            this._super();
        },

        // update item (create tree branch if requested)
        // if options.itemData have the 'items' property set then
        // will be like when calling 'loadFrom' for the item
        update: function(item, options){
            var _this = this;
            options = this._options(options, function(){
                _this._trigger(item, 'updated');
            }, function(){
                _this._trigger(item, 'updatefail');
            });
            if (this.isItem(item)){
                if (options.itemData.props && (options.itemData.props.isFolder || (options.itemData.props.isFolder === null))){
                    var process = function(){
                        _this.setId(item, options.itemData.id);
                        _this.setText(item, options.itemData.item);
                        if (options.itemData.props){
                            _this.setIcon(item, options.itemData.props.icon);
                        }
                        item.first().removeClass('aciTreeFolder aciTreeFolderMaybe').addClass((options.itemData.props.isFolder ||
                            (options.itemData.items && options.itemData.items.length)) ? 'aciTreeFolder' : 'aciTreeFolderMaybe');
                        if (options.itemData.items){
                            if (_this.wasLoad(item)){
                                _this.unload(item, {
                                    success: function(){
                                        _this.loadFrom(item, {
                                            success: options.success,
                                            fail: options.fail,
                                            itemData: options.itemData.items
                                        });
                                    },
                                    fail: options.fail,
                                    unanimated: options.unanimated
                                });
                            } else {
                                _this.loadFrom(item, {
                                    success: options.success,
                                    fail: options.fail,
                                    itemData: options.itemData.items
                                });
                            }
                        } else {
                            _this._success(item, options);
                        }
                    };
                    if (this.isFolder(item)){
                        process();
                    } else {
                        this.setFolder(item, {
                            success: process,
                            fail: options.fail
                        });
                    }
                } else {
                    var process = function(){
                        _this.setId(item, options.itemData.id);
                        _this.setText(item, options.itemData.item);
                        if (options.itemData.props){
                            _this.setIcon(item, options.itemData.props.icon);
                        }
                    };
                    if (this.isFile(item)){
                        process();
                    } else {
                        this.setFile(item, {
                            success: process,
                            fail: options.fail
                        });
                    }
                }
            } else {
                this._fail(item, options);
            }
        },

        // callback call for each children of item
        // when 'load' is TRUE will also try to load nodes
        branch: function(item, callback, load){
            var _this = this;
            var _private = this._private;
            var process = function(item, callback, next){
                var child = next ? _this.next(item) : _this.first(item);
                if (child.length){
                    if (_this.isFolder(child)){
                        if (_this.wasLoad(child)){
                            _private.branchQueue.push(function(){
                                callback(_this, child);
                                process(child, callback);
                                process(child, callback, true);
                            }).run();
                        } else if (load) {
                            _private.branchQueue.push(function(complete){
                                _this.ajaxLoad(child, {
                                    success: function(){
                                        callback(_this, child);
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
                            _private.branchQueue.push(function(){
                                callback(_this, child);
                                process(child, callback, true);
                            }).run();
                        }
                    } else {
                        _private.branchQueue.push(function(){
                            callback(_this, child);
                            process(child, callback, true);
                        }).run();
                    }
                }
            };
            process(item, callback);
        },

        // override isBusy to check branchQueue too
        isBusy: function(item){
            if (item){
                return this._super(item);
            } else {
                return this._super(item) || !this._private.branchQueue.empty();
            }
        },

        // swap two items
        swap: function(item1, item2){
            if (this.isItem(item1) && this.isItem(item2) && !this.isChildren(item1, item2) && !this.isChildren(item2, item1) && (item1.get(0) != item2.get(0))){
                item1 = item1.first();
                item2 = item2.first();
                var prev = this.prev(item1);
                if (prev.length){
                    if (item2.get(0) == prev.get(0)){
                        item2.before(item1);
                    } else {
                        item1.insertAfter(item2);
                        item2.insertAfter(prev);
                    }
                } else {
                    var next = this.next(item1);
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
                this._trigger(null, 'swapped', {
                    item1: item1,
                    item2: item2
                });
                return true;
            } else {
                this._trigger(null, 'swapfail');
            }
            return false;
        },

        // move item up
        moveUp: function(item){
            if (this.isItem(item)){
                var prev = this.prev(item);
                var oldIndex = this.getIndex(item);
                if (prev.length){
                    prev.before(item.first());
                }
                this._trigger(item, 'movedup', {
                    oldIndex: oldIndex
                });
                return true;
            }
            return false;
        },

        // move item down
        moveDown: function(item){
            if (this.isItem(item)){
                var next = this.next(item);
                var oldIndex = this.getIndex(item);
                if (next.length){
                    next.after(item.first());
                }
                this._trigger(item, 'moveddown', {
                    oldIndex: oldIndex
                });
                return true;
            }
            return false;
        },

        // move item in first position
        moveFirst: function(item){
            if (this.isItem(item)){
                var parent = this.parent(item);
                if (!parent.length){
                    parent = this._instance.jQuery;
                }
                var oldIndex = this.getIndex(item);
                parent.children('.aciTreeUl').prepend(item.first());
                this._trigger(item, 'movedfirst', {
                    oldIndex: oldIndex
                });
                return true;
            }
            return false;
        },

        // move item in last position
        moveLast: function(item){
            if (this.isItem(item)){
                var parent = this.parent(item);
                if (!parent.length){
                    parent = this._instance.jQuery;
                }
                var oldIndex = this.getIndex(item);
                parent.children('.aciTreeUl').append(item.first());
                this._trigger(item, 'movedlast', {
                    oldIndex: oldIndex
                });
                return true;
            }
            return false;
        },

        // search a 'path' ID from a parent
        _search: function(parent, pathId){
            var items = this.childrens(parent);
            var item, id, length, found, exact = false;
            for(var i = 0, size = items.length; i < size; i++){
                item = items.eq(i);
                id = String(this.getId(item));
                length = id.length;
                if (length){
                    if (id == pathId.substr(0, length)){
                        found = item;
                        exact = pathId.length == length;
                        break;
                    }
                }
            }
            if (found){
                if (!exact){
                    // try to search childrens
                    var child = this._search(found, pathId);
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
        },

        // search items by ID
        // if 'path' is TRUE then the search will be more optimized
        // and reduced to the first branch that matches the ID
        // but the ID must be set like a path otherwise will not work
        // if 'load' is TRUE will also try to load nodes (works only when 'path' is TRUE)
        searchId: function(id, path, load, options){
            var _this = this;
            options = this._options(options);
            if (id){
                if (path){
                    if (load){
                        var process = function(item){
                            var found = _this._search(item, id);
                            if (found){
                                if (found.exact){
                                    _this._success(found.item, options);
                                } else {
                                    if (_this.wasLoad(found.item)){
                                        _this._fail(item, options);
                                    } else {
                                        _this.ajaxLoad(found.item, {
                                            success: function(){
                                                process(found.item);
                                            },
                                            fail: options.fail
                                        });
                                    }
                                }
                            } else {
                                _this._fail(item, options);
                            }
                        };
                        process();
                        return $([]);
                    } else {
                        var found = this._search(null, id);
                        if (found && found.exact){
                            this._success(found, options);
                            return found.item;
                        }
                    }
                } else {
                    var list = [];
                    this._instance.jQuery.find('.aciTreeLi').each(function(){
                        if (id == _this.getId($(this))){
                            list[list.length] = this;
                        }
                    });
                    if (list.length){
                        var found = $(list);
                        this._success(found, options, found);
                        return found;
                    }
                }
            }
            this._fail(null, options);
            return $([]);
        },

        // override _destroyHook
        _destroyHook: function(unloaded){
            if (!unloaded){
                this._private.branchQueue.destroy();
            }
            // call the parent
            this._super(unloaded);
        }

    };

    // extend the base aciTree class and add the utils stuff
    aciPluginClass.plugins.aciTree = aciPluginClass.plugins.aciTree.extend(aciTree_utils, 'aciTreeUtils');

})(jQuery);
