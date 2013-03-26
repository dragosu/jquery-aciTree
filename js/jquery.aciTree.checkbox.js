
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
 * The are a few extra keys for the 'props' entry:
 *
 * {
 *   ...
 *   props: {                           // a list of item properties
 *     ...
 *     checkbox: true,                  // TRUE means the item will have a checkbox
 *     checked: false,                  // if should be checked or not
 *     checkboxName: 'check_field'      // the checkbox name attribute ('options.checkboxName' will be used by default)
 *   },
 *   ...
 * }
 *
 * Note: the item ID must be unique.
 *
 * The checkbox value is the item ID.
 */

(function($){

    // extra default options

    var options = {
        checkbox: false,                // if TRUE then each item will have a checkbox
        checkboxName: 'check[]'         // default checkbox field name (the [] need to be included)
    };

    // aciTree checkbox extension

    var aciTree_checkbox = {

        // init checkbox
        _initCheckbox: function(){
            var _this = this;
            this._instance.jQuery.bind('acitree' + this._private.nameSpace, function(e, api, item, data){
                switch (data.event){
                    case 'loaded':
                        if (item){
                            _this._loadCheckbox(item);
                        }
                        break;
                    case 'focused':
                        // support 'selectable' extension
                        _this._checkbox(_this.selected()).focus();
                        break;
                    case 'selected':
                        // support 'selectable' extension
                        _this._checkbox(item).focus();
                        break;
                }
            }).bind('keydown' + this._private.nameSpace, function(e){
                switch (e.which){
                    case 9: // tab
                    case 32: // space
                        // support 'selectable' extension
                        if (_this.isSelected){
                            var selected = _this.selected();
                            if (_this.hasCheckbox(selected)){
                                if (_this._lastFocus().get(0) == _this._instance.jQuery.get(0)){
                                    _this._checkbox(selected).focus().trigger(e);
                                }
                                e.stopImmediatePropagation();
                            }
                        }
                        break;
                }
            }).on('click' + this._private.nameSpace, '.aciTreeItem', function(e){
                if ($(e.target).hasClass('aciTreeItem')){
                    var item = _this.itemFrom(e.target);
                    if (_this.hasCheckbox(item)){
                        _this._checkbox(item).focus();
                        _this.check(item, !_this.isChecked(item));
                        e.preventDefault();
                    }
                }
            }).on('focus' + this._private.nameSpace, 'input[type=checkbox]', function(e){
                // support 'selectable' extension
                var item = _this.itemFrom(e.target);
                if (_this.isSelected && !_this.isSelected(item)){
                    _this.select(item, true);
                }
            }).on('click' + this._private.nameSpace, 'input[type=checkbox]', function(e){
                // update item states
                var item = _this.itemFrom(e.target);
                _this.check(item, $(this).is(':checked'));
            }).on('keydown' + this._private.nameSpace, 'input[type=checkbox]', function(e){
                // prevent key handling
                switch (e.which){
                    case 38: // up
                    case 40: // down
                    case 37: // left
                    case 39: // right
                    case 33: // pgup
                    case 34: // pgdown
                    case 36: // home
                    case 35: // end
                    case 13: // enter
                    case 27: // escape
                        e.preventDefault();
                        break;
                    case 9: // tab
                    case 32: // space
                        // support 'selectable' extension
                        if (_this.isSelected){
                            var item = _this.itemFrom(e.target);
                            if (!_this.isSelected(item)){
                                return false;
                            }
                        }
                        e.stopPropagation();
                        break;
                }
            });
        },

        // return the checkbox
        _checkbox: function(item){
            return item ? item.first().children('.aciTreeItem').find('input[type=checkbox]') : $([]);
        },

        // override _initHook
        _initHook: function(){
            if (this._instance.options.checkbox){
                this._initCheckbox();
            }
            // call the parent
            this._super();
        },

        // override _itemHook
        _itemHook: function(parent, item, itemData, level){
            if (this._instance.options.checkbox){
                // support 'radio' extension
                var radio = this.hasRadio && this.hasRadio(item);
                if (!radio && ((itemData.props && itemData.props.checkbox) || !itemData.props || (typeof itemData.props.checkbox == 'undefined'))){
                    this._addCheckbox(item, itemData);
                }
            }
            this._super(parent, item, itemData, level);
        },

        // support selectable
        _selectHook: function(item){
            var result = this._super(item);
            if ((typeof result != 'undefined') && !result){
                return false;
            }
            var selected = this.selected();
            if (!this.hasCheckbox(selected) && this.hasCheckbox(item)){
                var checkbox = this._checkbox(item);
                if (checkbox.is(':focus')){
                    checkbox.blur();
                    this._instance.jQuery.focus();
                    return false;
                }
            }
        },

        // add item checkbox
        _addCheckbox: function(item, itemData){
            var name = itemData.props && itemData.props.checkboxName ? itemData.props.checkboxName : this._instance.options.checkboxName;
            item.first().addClass('aciTreeCheckbox').children('.aciTreeItem').find('.aciTreeText').wrap('<label></label>').before('<input type="checkbox" name="' +
                name + '" value="' + this.getId(item) + '"' + (itemData.props && itemData.props.checked ? ' checked="checked"' : '') + ' />');
        },

        // remove item checkbox
        _removeCheckbox: function(item){
            var label = item.first().removeClass('aciTreeCheckbox').children('.aciTreeItem').find('label');
            if (label.length){
                label.find('*').not('.aciTreeText').remove();
                label.find('.aciTreeText').unwrap();
            }
        },

        // override setId
        setId: function(item, id){
            var result = this._super(item, id);
            if (result && this.hasCheckbox(item)){
                // update field value
                this._checkbox(item).attr('value', id);
            }
            return result;
        },

        // update item on load
        _loadCheckbox: function(item){
            if (this.hasCheckbox(item)){
                if (this.isChecked(item)){
                    if (this.checkboxes(this.childrens(item), true).length){
                        // if there is a child checked, only check the parents (all loaded childs should be in the correct state)
                        this._parentCheckbox(item);
                    } else {
                        // the item is checked but no childrens are, check them all (all loaded childs should be in the correct state)
                        this._childCheckbox(item);
                    }
                } else {
                    // the item is not checked, uncheck all childrens (all loaded childs should be in the correct state)
                    this._childCheckbox(item);
                }
            }
        },

        // check/uncheck all childrens based on item
        _childCheckbox: function(item){
            var _this = this;
            var state = this._checkbox(item).removeClass('aciTreeTristate').is(':checked');
            var process = function(item){
                _this.checkboxes(_this.childrens(item)).each(function(){
                    _this._checkbox($(this)).prop('checked', state).removeClass('aciTreeTristate');
                    process($(this));
                });
            };
            process(item);
        },

        // check/uncheck parents based on direct childrens
        _parentCheckbox: function(item){
            var _this = this;
            this.path(item, true).each(function(){
                if (!_this.hasCheckbox($(this))){
                    // break on missing checkbox
                    return false;
                }
                var list = _this.checkboxes(_this.childrens($(this)));
                if (list.length){
                    var checked = _this.checkboxes(list, true).length;
                    if (checked){
                        // there is at least a child checked
                        var tristate = (checked != list.length) || (list.find('.aciTreeTristate').length > 0);
                        _this._checkbox($(this)).prop('checked', true).toggleClass('aciTreeTristate', tristate);
                    } else {
                        // there are no childs checked
                        _this._checkbox($(this)).prop('checked', false).removeClass('aciTreeTristate');
                    }
                } else {
                    _this._checkbox($(this)).removeClass('aciTreeTristate');
                }
            });
        },

        // test if item have a checkbox
        hasCheckbox: function(item){
            return item && item.hasClass('aciTreeCheckbox');
        },

        // change new checkbox state by parents/childrens
        _stateCheckbox: function(item){
            var parent = this.parent(item);
            var list = this.checkboxes(this.childrens(item));
            var checked = this.checkboxes(list, true);
            if (this.hasCheckbox(parent)){
                // parent checkbox exists
                if (this.isChecked(parent)){
                    // if parent is checked
                    var siblings = this.checkboxes(this.siblings(item));
                    if (siblings.length){
                        if (checked.length){
                            this._parentCheckbox(checked);
                        } else {
                            this._parentCheckbox(item);
                        }
                    } else {
                        this._checkbox(item).prop('checked', true);
                        this._trigger(item, 'checkboxadded');
                        if (list.length && !checked.length){
                            this.check(item, true);
                        }
                        return;
                    }
                } else {
                    // if parent is not checked
                    if (checked.length){
                        this._parentCheckbox(checked);
                    }
                }
            } else {
                // there is no parent checkbox
                if (checked.length){
                    this._parentCheckbox(checked);
                }
            }
            this._trigger(item, 'checkboxadded');
        },

        // set item with/without a checkbox
        setCheckbox: function(item, checkbox, name, state){
            if (checkbox == this.hasCheckbox(item)){
                if (checkbox){
                    if  (typeof name != 'undefined'){
                        // change name
                        this._checkbox(item).attr('name', name ? name : this._instance.options.checkboxName);
                        this._trigger(item, 'nameset');
                    }
                    if  (typeof state != 'undefined'){
                        // change state
                        this.check(item, state);
                    }
                }
            } else if (checkbox){
                // support 'radio' extension
                if (this.setRadio && this.hasRadio(item)){
                    this.setRadio(item, false);
                }
                this._addCheckbox(item, {
                    id: this.getId(item),
                    props: {
                        hasCheckbox: true,
                        checkboxName: name
                    }
                });
                if  (typeof state == 'undefined'){
                    this._stateCheckbox(item);
                } else {
                    this._trigger(item, 'checkboxadded');
                    // change state
                    this.check(item, state);
                }
            } else {
                this._removeCheckbox(item);
                this._parentCheckbox(item);
                this._trigger(item, 'checkboxremoved');
            }
        },

        // test if it's checked
        isChecked: function(item){
            if (this.hasCheckbox(item)){
                return this._checkbox(item).is(':checked');
            }
            // support 'radio' extension
            if (this._super){
                return this._super(item);
            }
            return false;
        },

        // (un)check item
        check: function(item, state){
            if (this.hasCheckbox(item)){
                this._checkbox(item).prop('checked', state);
                this._childCheckbox(item);
                this._parentCheckbox(item);
                this._trigger(item, state ? 'checked' : 'unchecked');
                return true;
            }
            // support 'radio' extension
            if (this._super){
                return this._super(item, state);
            }
            return false;
        },

        // filter items with checkbox by state (if set)
        checkboxes: function(items, state){
            var _this = this, list = [];
            if (this._instance.options.checkbox){
                if (typeof state == 'undefined'){
                    return items.filter('.aciTreeCheckbox');
                }
                items.filter('.aciTreeCheckbox').each(function(){
                    if (state == _this._checkbox($(this)).is(':checked')){
                        list[list.length] = this;
                    }
                });
            }
            return $(list);
        },

        // override set option
        option: function(option, value){
            if (this.wasInit() && !this.isLocked()){
                if ((option == 'checkbox') && (value != this._instance.options.checkbox)) {
                    if (value){
                        this._initCheckbox();
                    } else {
                        this._doneCheckbox();
                    }
                }
            }
            // call the parent
            this._super(option, value);
        },

        // done checkbox
        _doneCheckbox: function(destroy){
            var _this = this;
            this._instance.jQuery.unbind(this._private.nameSpace);
            this._instance.jQuery.off(this._private.nameSpace, '.aciTreeItem');
            this._instance.jQuery.off(this._private.nameSpace, 'input[type=checkbox]');
            if (!destroy){
                this.checkboxes(this.childrens(null, true)).each(function(){
                    _this.setCheckbox($(this), false);
                });
            }
        },

        // override _destroyHook
        _destroyHook: function(unloaded){
            if (unloaded){
                this._doneCheckbox(true);
            }
            // call the parent
            this._super(unloaded);
        }

    };

    // extend the base aciTree class and add the checkbox stuff
    aciPluginClass.plugins.aciTree = aciPluginClass.plugins.aciTree.extend(aciTree_checkbox, 'aciTreeCheckbox');

    // add extra default options
    aciPluginClass.defaults('aciTree', options);

})(jQuery);
