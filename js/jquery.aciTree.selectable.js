
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

    // extra default options

    var options = {
        selectable: true,               // if TRUE then one item can be selected (and the tree navigation with the keyboard will be enabled)
        // when selectable is used you should set the 'tabIndex' attribute >= 0 on the container if you want to be focusable with the keyboard (will be set to -1 by default)
        textSelection: false,           // if FALSE then the tree item text can't be selected
        callbacks: {
            // selected : function(api, item, state)
            selected: null              // called to draw item selection
        }
    };

    // aciTree selectable extension
    // adds item selection & keyboard navigation (left/right, up/down, pageup/pagedown, home/end, space, enter, escape)
    // dblclick also toggles the item

    var aciTree_selectable = {

        __extend: function(){
            // add extra data
            this._instance.focus = false;
            // call the parent
            this._super();
        },

        // init selectable
        _initSelectable: function(){
            var _this = this;
            if (typeof _this._instance.jQuery.attr('tabindex') == 'undefined'){
                _this._instance.jQuery.attr('tabindex', -1);
            }
            _this._instance.jQuery.bind('focus' + _this._private.nameSpace, function(){
                _this._instance.focus = true;
            }).bind('blur' + _this._private.nameSpace, function(){
                _this._instance.focus = false;
            }).bind('keydown' + _this._private.nameSpace, function(e){
                if (!_this._instance.focus){
                    // do not handle if we do not have focus
                    return;
                }
                var selected = _this.getSelected();
                var select = $([]);
                switch (e.which){
                    case 38: // up
                        select = selected.length ? _this._prevOpen(selected) : _this.getFirst();
                        break;
                    case 40: // down
                        select = selected.length ? _this._nextOpen(selected) : _this.getFirst();
                        break;
                    case 37: // left
                        if (selected.length){
                            if (_this.isOpen(selected)){
                                _this.close(selected, {
                                    collapse: _this._instance.options.collapse,
                                    expand: _this._instance.options.expand,
                                    unique: _this._instance.options.unique
                                });
                            } else {
                                select = _this.getParent(selected);
                            }
                        } else {
                            select = _this.getFirst();
                        }
                        break;
                    case 39: // right
                        if (selected.length){
                            if (_this.isFolder(selected) && _this.isClosed(selected)){
                                _this.open(selected, {
                                    collapse: _this._instance.options.collapse,
                                    expand: _this._instance.options.expand,
                                    unique: _this._instance.options.unique
                                });
                            } else {
                                select = _this.getFirst(selected);
                            }
                        } else {
                            select = _this.getFirst();
                        }
                        break;
                    case 33: // pgup
                        select = selected.length ? _this._prevPage(selected) : _this.getFirst();
                        break;
                    case 34: // pgdown
                        select = selected.length ? _this._nextPage(selected) : _this.getFirst();
                        break;
                    case 36: // home
                        select = _this.getFirst();
                        break;
                    case 35: // end
                        select = _this._lastOpen();
                        break;
                    case 13: // enter
                        if (selected.length && _this.isFolder(selected) && _this.isClosed(selected)){
                            _this.open(selected, {
                                collapse: _this._instance.options.collapse,
                                expand: _this._instance.options.expand,
                                unique: _this._instance.options.unique
                            });
                        }
                        break;
                    case 27: // escape
                        if (selected.length && _this.isOpen(selected)){
                            _this.close(selected, {
                                collapse: _this._instance.options.collapse,
                                expand: _this._instance.options.expand,
                                unique: _this._instance.options.unique
                            });
                        }
                        break;
                    case 32: // space
                        if (selected.length && _this.isFolder(selected)){
                            _this.toggle(selected, {
                                collapse: _this._instance.options.collapse,
                                expand: _this._instance.options.expand,
                                unique: _this._instance.options.unique
                            });
                        }
                        break;
                }
                if (select.length && (select.get(0) != selected.get(0))){
                    _this._selected(_this, select, true);
                    return false;
                }
            });
            _this._instance.jQuery.on('click' + _this._private.nameSpace, 'div.aciTreeItem', function(e){
                var item = $(e.target).parent();
                _this._selected(_this, item, true);
            }).on('dblclick' + _this._private.nameSpace, 'div.aciTreeItem', function(e){
                var item = $(e.target).parent();
                if (_this.isFolder(item)){
                    _this.toggle(item, {
                        collapse: _this._instance.options.collapse,
                        expand: _this._instance.options.expand,
                        unique: _this._instance.options.unique
                    });
                }
            });
        },

        // override _init
        _init: function(){
            if (this._instance.options.selectable){
                this._initSelectable();
            }
            // call the parent
            this._super();
        },

        // override _item
        _item: function(api, item, itemData, level){
            if (!this._instance.options.textSelection){
                // make text unselectable
                this._selectable(item.find('>div.aciTreeItem'));
            }
            this._super(api, item, itemData, level);
        },

        // make element (un)selectable
        _selectable: function(element, state){
            if (state){
                element.css({
                    '-webkit-user-select': 'text',
                    '-moz-user-select': 'text',
                    '-ms-user-select': 'text',
                    '-o-user-select': 'text',
                    'user-select': 'text'
                }).attr({
                    'unselectable': null,
                    'onselectstart': null
                }).unbind('selectstart' + this._private.nameSpace);
            } else {
                element.css({
                    '-webkit-user-select': 'none',
                    '-moz-user-select': '-moz-none',
                    '-ms-user-select': 'none',
                    '-o-user-select': 'none',
                    'user-select': 'none'
                }).attr({
                    'unselectable': 'on',
                    'onselectstart': 'return false'
                }).bind('selectstart' + this._private.nameSpace, function(){
                    return true;
                });
            }
        },

        // get last visible child starting from item
        _lastOpen: function(item){
            var _this = this;
            var opened = function(item){
                var last = _this.getLast(item);
                if (_this.isOpen(last)){
                    return opened(last);
                } else {
                    return last;
                }
            };
            if (!item){
                item = _this.getLast();
            }
            if (_this.isOpen(item)){
                return opened(item);
            } else {
                return item;
            }
        },

        // get prev visible starting with item
        _prevOpen: function(item){
            var prev = this.getPrev(item);
            if (prev.length){
                return this._lastOpen(prev);
            } else {
                var parent = this.getParent(item);
                return parent.length ? parent : item;
            }
        },

        // get next visible starting with item
        _nextOpen: function(item){
            var _this = this;
            var opened = function(item){
                var parent = _this.getParent(item);
                if (parent.length){
                    var next = _this.getNext(parent);
                    if (next.length){
                        return next;
                    } else {
                        return opened(parent);
                    }
                }
                return null;
            };
            if (_this.isOpen(item)){
                return _this.getFirst(item);
            } else {
                var next = _this.getNext(item);
                if (next.length){
                    return next;
                } else {
                    next = opened(item);
                    return next ? next : item;
                }
            }
        },

        // get item height
        _itemHeight: function(item){
            var size = item.first().find('>div.aciTreeItem');
            return size.outerHeight(true);
        },

        // get prev visible starting with item with a 'page' size
        _prevPage: function(item){
            var now = this._itemHeight(item);
            var space = this._instance.jQuery.height();
            var last = $([]), prev = item;
            do {
                prev = this._prevOpen(prev);
                if (prev.length){
                    if (prev.get(0) == last.get(0)){
                        break;
                    }
                    now += this._itemHeight(prev);
                    last = prev;
                } else {
                    break;
                }
            } while (now < space);
            return prev;
        },

        // get next visible starting with item with a 'page' size
        _nextPage: function(item){
            var now = this._itemHeight(item);
            var space = this._instance.jQuery.height();
            var last = $([]), next = item;
            do {
                next = this._nextOpen(next);
                if (next.length){
                    if (next.get(0) == last.get(0)){
                        break;
                    }
                    now += this._itemHeight(next);
                    last = next;
                } else {
                    break;
                }
            } while (now < space);
            return next;
        },

        // process item selection
        _selected: function(api, item, state){
            if (this._instance.options.callbacks && this._instance.options.callbacks.selected){
                this._instance.options.callbacks.selected(api, item, state);
                return;
            }
            this.select(item, state);
            if (state){
                this.setVisible(item);
            }
        },

        // select/deselect item
        select: function(item, state){
            var _this = this;
            var unselect = _this._instance.jQuery.find('li.aciTreeSelected');
            if (item && state){
                unselect = unselect.not(item);
            }
            unselect.removeClass('aciTreeSelected').each(function(){
                _this._trigger($(this), 'unselected');
            });
            if (_this.isItem(item) && state){
                item.first().addClass('aciTreeSelected');
                _this._trigger(item, 'selected');
            }
        },

        // get selected item
        getSelected: function(){
            return this._instance.jQuery.find('li.aciTreeSelected:first');
        },

        // test if item is selected
        isSelected: function(item){
            return item && item.first().hasClass('aciTreeSelected');
        },

        // override set option
        option: function(option, value){
            var _this = this;
            if ((option == 'selectable') && (value != _this._instance.options.selectable)) {
                if (value){
                    _this._initSelectable();
                } else {
                    _this._doneSelectable();
                }
            }
            if ((option == 'textSelection') && (value != _this._instance.options.textSelection)) {
                if (value){
                    _this._instance.jQuery.find('div.aciTreeItem').each(function(){
                        _this._selectable($(this), true);
                    });
                } else {
                    _this._instance.jQuery.find('div.aciTreeItem').each(function(){
                        _this._selectable($(this));
                    });
                }
            }
            // call the parent
            _this._super(option, value);
        },

        // done selectable
        _doneSelectable: function(){
            var selected = this.getSelected();
            if (selected.length){
                this._selected(this, selected, false);
            }
            this._instance.focus = false;
            this._instance.jQuery.off('click' + this._private.nameSpace + ' dblclick' + this._private.nameSpace, 'div.aciTreeItem');
            this._instance.jQuery.unbind(this._private.nameSpace);
        },

        // override _destroy
        _destroy: function(){
            var _this = this;
            _this._doneSelectable();
            _this._instance.jQuery.find('div.aciTreeItem').each(function(){
                _this._selectable($(this), true);
            });
            // call the parent
            this._super();
        }

    };

    // extend the base aciTree class and add the selectable stuff
    aciPluginClass.plugins.aciTree = aciPluginClass.plugins.aciTree.extend(aciTree_selectable, 'aciTreeSelectable');

    // add extra default options
    aciPluginClass.defaults('aciTree', options);

})(jQuery);
