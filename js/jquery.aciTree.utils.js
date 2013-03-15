
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

(function($){

    // aciTree utils extension
    // adds item update option, branch processing, moving items & item swapping, item search by ID

    var aciTree_utils = {

        __extend: function(){
            // the branch queue
            this._instance._branchQueue = new this._queue(null, true, this._instance.options.queueDelay);
            // call the parent
            this._super();
        },

        // update item (create tree branch if requested)
        // if options.itemData have the 'items' property set then
        // will be like when calling 'initFrom' for the item
        update: function(item, options){
            var _this = this;
            options = _this._options(options);
            if (_this.isItem(item)){
                if (options.itemData.props && (options.itemData.props.isFolder || (options.itemData.props.isFolder === null))){
                    var process = function(){
                        _this.setId(item, options.itemData.id);
                        _this.setItem(item, options.itemData.item);
                        if (options.itemData.props){
                            _this.setIcon(item, options.itemData.props.icon);
                        }
                        item = item.first();
                        item.removeClass('aciTreeFolder aciTreeFolderMaybe').addClass((options.itemData.props.isFolder ||
                            (options.itemData.items && options.itemData.items.length)) ? 'aciTreeFolder' : 'aciTreeFolderMaybe');
                        if (options.itemData.items){
                            if (_this.wasLoad(item)){
                                _this.unload(item, {
                                    success: function(){
                                        _this.initFrom(item, {
                                            success: options.success,
                                            fail: options.fail,
                                            itemData: options.itemData.items
                                        });
                                    },
                                    fail: options.fail,
                                    unanimated: options.unanimated
                                });
                            } else {
                                _this.initFrom(item, {
                                    success: options.success,
                                    fail: options.fail,
                                    itemData: options.itemData.items
                                });
                            }
                        } else {
                            _this._success(item, options);
                        }
                    };
                    _this.setFolder(item, {
                        success: process,
                        fail: options.fail
                    });
                } else {
                    var process = function(){
                        _this.setId(item, options.itemData.id);
                        _this.setItem(item, options.itemData.item);
                        if (options.itemData.props){
                            _this.setIcon(item, options.itemData.props.icon);
                        }
                    };
                    _this.setFile(item, {
                        success: process,
                        fail: options.fail
                    });
                }
            } else {
                _this._fail(item, options);
            }
        },

        // callback call for each item childrens
        // when 'load' is TRUE will also try to load nodes
        branch: function(item, callback, load){
            var _this = this;
            var process = function(item, callback, next){
                var child = next ? _this.getNext(item) : _this.getFirst(item);
                if (child.length){
                    if (_this.isFolder(child)){
                        if (_this.wasLoad(child)){
                            _this._instance._branchQueue.push(function(){
                                callback(_this, child);
                                process(child, callback);
                                process(child, callback, true);
                            }).run();
                        } else if (load) {
                            _this._instance._branchQueue.push(function(complete){
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
                            _this._instance._branchQueue.push(function(){
                                callback(_this, child);
                                process(child, callback, true);
                            }).run();
                        }
                    } else {
                        _this._instance._branchQueue.push(function(){
                            callback(_this, child);
                            process(child, callback, true);
                        }).run();
                    }
                }
            };
            process(item, callback);
        },

        // override isBusy to check _branchQueue too
        isBusy: function(item){
            if (item){
                return this._super(item);
            } else {
                return this._super(item) || !this._instance._branchQueue.empty();
            }
        },

        // swap two items
        swap: function(item1, item2){
            if (this.isItem(item1) && this.isItem(item2) && !this.isChildren(item1, item2) && !this.isChildren(item2, item1) && (item1.get(0) != item2.get(0))){
                item1 = item1.first();
                item2 = item2.first();
                var prev = this.getPrev(item1);
                if (prev.length){
                    if (item2.get(0) == prev.get(0)){
                        item2.before(item1);
                    } else {
                        item1.insertAfter(item2);
                        item2.insertAfter(prev);
                    }
                } else {
                    var next = this.getNext(item1);
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
            }
            return false;
        },

        // move item up
        moveUp: function(item){
            if (this.isItem(item)){
                var prev = this.getPrev(item);
                var old = this.getIndex(item);
                if (prev.length){
                    prev.before(item.first());
                }
                this._trigger(item, 'movedup', {
                    oldIndex: old
                });
                return true;
            }
            return false;
        },

        // move item down
        moveDown: function(item){
            if (this.isItem(item)){
                var next = this.getNext(item);
                var old = this.getIndex(item);
                if (next.length){
                    next.after(item.first());
                }
                this._trigger(item, 'moveddown', {
                    oldIndex: old
                });
                return true;
            }
            return false;
        },

        // move item in first position
        moveFirst: function(item){
            if (this.isItem(item)){
                var parent = this.getParent(item);
                if (!parent.length){
                    parent = this._instance.jQuery;
                }
                var old = this.getIndex(item);
                parent.find('>ul.aciTreeUl').prepend(item.first());
                this._trigger(item, 'movedfirst', {
                    oldIndex: old
                });
                return true;
            }
            return false;
        },

        // move item in last position
        moveLast: function(item){
            if (this.isItem(item)){
                var parent = this.getParent(item);
                if (!parent.length){
                    parent = this._instance.jQuery;
                }
                var old = this.getIndex(item);
                parent.find('>ul.aciTreeUl').append(item.first());
                this._trigger(item, 'movedlast', {
                    oldIndex: old
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
                id = item.data('id' + this._instance.nameSpace);
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
            options = _this._options(options);
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
                        var found = _this._search(null, id);
                        if (found && found.exact){
                            _this._success(found, options);
                            return found.item;
                        }
                    }
                } else {
                    var list = [];
                    var data = 'id' + _this._instance.nameSpace;
                    _this._instance.jQuery.find('li.aciTreeLi').each(function(){
                        if ($(this).data(data) == id){
                            list[list.length] = this;
                        }
                    });
                    if (list.length){
                        var found = $(list);
                        _this._success(found, options, found);
                        return found
                    }
                }
            }
            _this._fail(null, options);
            return $([]);
        }

    };

    // extend the base aciTree class and add the utils stuff
    aciPluginClass.plugins.aciTree = aciPluginClass.plugins.aciTree.extend(aciTree_utils);

})(jQuery);
