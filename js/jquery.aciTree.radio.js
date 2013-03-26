
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
 *     radio: true,                     // TRUE means the item will have a radio button
 *     checked: false,                  // if should be checked or not
 *     radioName: 'radio_field'         // the radio button name attribute ('options.radioName' will be used by default)
 *   },
 *   ...
 * }
 *
 * Note: the radio button name need to be the same for all direct childrens of a parent.
 * When using the default 'options.radioName' the parent item ID will be added at the end like: '[options.radioName]-[parentId]'.
 * The item ID must be unique.
 *
 * The radio button value is the item ID.
 */

(function($){

    // extra default options

    var options = {
        radio: false,                   // if TRUE then each item will have a radio button
        radioName: 'radio'              // default radio button field name
    };

    // aciTree radio extension

    var aciTree_radio = {

        // init radio
        _initRadio: function(){
            var _this = this;
            this._instance.jQuery.bind('acitree' + this._private.nameSpace, function(e, api, item, data){
                switch (data.event){
                    case 'loaded':
                        if (item){
                            _this._loadRadio(item);
                        }
                        break;
                    case 'focused':
                        // support 'selectable' extension
                        _this._radio(_this.selected()).focus();
                        break;
                    case 'selected':
                        // support 'selectable' extension
                        _this._radio(item).focus();
                        break;
                }
            }).bind('keydown' + this._private.nameSpace, function(e){
                switch (e.which){
                    case 9: // tab
                    case 32: // space
                        // support 'selectable' extension
                        if (_this.isSelected){
                            var selected = _this.selected();
                            if (_this.hasRadio(selected)){
                                if (_this._lastFocus().get(0) == _this._instance.jQuery.get(0)){
                                    _this._radio(selected).focus().trigger(e);
                                }
                                e.stopImmediatePropagation();
                            }
                        }
                        break;
                }
            }).on('click' + this._private.nameSpace, '.aciTreeItem', function(e){
                if ($(e.target).hasClass('aciTreeItem')){
                    var item = _this.itemFrom(e.target);
                    if (_this.hasRadio(item) && !_this.isChecked(item)){
                        _this._radio(item).focus();
                        _this.check(item, true);
                        e.preventDefault();
                    }
                }
            }).on('focus' + this._private.nameSpace, 'input[type=radio]', function(e){
                // support 'selectable' extension
                var item = _this.itemFrom(e.target);
                if (_this.isSelected && !_this.isSelected(item)){
                    _this.select(item, true);
                }
            }).on('click' + this._private.nameSpace, 'input[type=radio]', function(e){
                // update item states
                var item = _this.itemFrom(e.target);
                _this.check(item, $(this).is(':checked'));
            }).on('keydown' + this._private.nameSpace, 'input[type=radio]', function(e){
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

        // return the radio
        _radio: function(item){
            return item.first().children('.aciTreeItem').find('input[type=radio]');
        },

        // override _initHook
        _initHook: function(){
            if (this._instance.options.radio){
                this._initRadio();
            }
            // call the parent
            this._super();
        },

        // override _itemHook
        _itemHook: function(parent, item, itemData, level){
            if (this._instance.options.radio){
                // support 'checkbox' extension
                var checkbox = this.hasCheckbox && this.hasCheckbox(item);
                if (!checkbox && ((itemData.props && itemData.props.radio) || !itemData.props || (typeof itemData.props.radio == 'undefined'))){
                    this._addRadio(parent, item, itemData);
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
            if (!this.hasRadio(selected) && this.hasRadio(item)){
                var radio = this._radio(item);
                if (radio.is(':focus')){
                    radio.blur();
                    this._instance.jQuery.focus();
                    return false;
                }
            }
        },

        // add item radio
        _addRadio: function(parent, item, itemData){
            var id = String(itemData.id).replace(/[^a-z0-9_-]/ig, '');
            var name = itemData.props && itemData.props.radioName ? itemData.props.radioName : null;
            if (!name){
                var parentId = this.getId(parent);
                name = this._instance.options.radioName + '-' + (parentId ? String(parentId).replace(/[^a-z0-9_-]/ig, '') : 'root');
            }
            item.first().addClass('aciTreeRadio').children('.aciTreeItem').find('.aciTreeText').wrap('<label></label>').before('<input type="radio" name="' +
                name + '" value="' + this.getId(item) + '"' + (itemData.props && itemData.props.checked ? ' checked="checked"' : '') + ' />');
        },

        // remove item radio
        _removeRadio: function(item){
            var label = item.first().removeClass('aciTreeRadio').children('.aciTreeItem').find('label');
            if (label.length){
                label.find('*').not('.aciTreeText').remove();
                label.find('.aciTreeText').unwrap();
            }
        },

        // override setId
        setId: function(item, id){
            var result = this._super(item, id);
            if (result && this.hasRadio(item)){
                // update field value
                this._radio(item).attr('value', id);
            }
            return result;
        },

        // update item on load
        _loadRadio: function(item){
            if (this.hasRadio(item)){
                if (this.isChecked(item)){
                    if (!this.radios(this.childrens(item), true).length){
                        // the item is checked but no childrens are, check them (all loaded childs should be in the correct state)
                        this._childRadio(item);
                    }
                } else {
                    // the item is not checked, uncheck childrens (all loaded childs should be in the correct state)
                    this._childRadio(item);
                }
            }
        },

        // check/uncheck childrens based on item
        _childRadio: function(item){
            var _this = this;
            var process = function(item, state){
                var radios = _this.radios(_this.childrens(item));
                if (state){
                    var checked = _this.radios(radios, true);
                    if (checked.length){
                        process(checked, true);
                        radios = radios.not(checked.first());
                    } else if (radios.length) {
                        _this._radio(radios).prop('checked', true);
                        process(radios, true);
                        radios = radios.slice(1);
                    }
                }
                radios.each(function(){
                    _this._radio($(this)).prop('checked', false);
                    process($(this), false);
                });
            };
            var state = this._radio(item).is(':checked');
            process(item, state);
        },

        // check/uncheck parents based on childrens
        _parentRadio: function(item){
            var _this = this;
            var process = function(item){
                // uncheck siblings
                _this.radios(_this.siblings(item)).each(function(){
                    _this._radio($(this)).prop('checked', false);
                    _this._childRadio($(this));
                });
            };
            process(item);
            var state = this._radio(item).is(':checked');
            // update parent items
            this.path(item, true).each(function(){
                if (!_this.hasRadio($(this))){
                    // break on missing radio
                    return false;
                }
                _this._radio($(this)).prop('checked', state);
                process($(this));
            });
        },

        // test if item have a radio
        hasRadio: function(item){
            return item && item.hasClass('aciTreeRadio');
        },

        // change new radio state by parents/childrens
        _stateRadio: function(item){
            var parent = this.parent(item);
            var checked = this.radios(this.childrens(item), true);
            if (this.hasRadio(parent)){
                // parent radio exists
                if (this.isChecked(parent)){
                    // if parent is checked
                    var siblings = this.radios(this.siblings(item), true);
                    if (siblings.length){
                        this._childRadio(item);
                    } else {
                        this._trigger(item, 'radioadded');
                        this.check(item, true);
                        return;
                    }
                } else {
                    // if parent is not checked
                    this._childRadio(item);
                }
            } else {
                // there is no parent radio
                if (checked.length){
                    this._parentRadio(checked);
                }
            }
            this._trigger(item, 'radioadded');
        },

        // set item with/without a radio
        setRadio: function(item, radio, name, state){
            if (radio == this.hasRadio(item)){
                if (radio){
                    if  (typeof name != 'undefined'){
                        // change name
                        if (!name){
                            var parentId = this.getId(this.parent(item));
                            var name = this._instance.options.radioName + '-' + (parentId ? String(parentId).replace(/[^a-z0-9_-]/ig, '') : 'root');
                        }
                        this._radio(item).attr('name', name);
                        this._trigger(item, 'nameset');
                    }
                    if  (typeof state != 'undefined'){
                        // change state
                        this.check(item, state);
                    }
                }
            } else if (radio){
                // support 'checkbox' extension
                if (this.setCheckbox && this.hasCheckbox(item)){
                    this.setCheckbox(item, false);
                }
                this._addRadio(this.parent(item), item.first(), {
                    id: this.getId(item),
                    props: {
                        hasRadio: true,
                        radioName: name
                    }
                });
                if  (typeof state == 'undefined'){
                    this._stateRadio(item);
                } else {
                    this._trigger(item, 'radioadded');
                    // change state
                    this.check(item, state);
                }
            } else {
                var state = this._radio(item).is(':checked');
                this._removeRadio(item.first());
                this._trigger(item, 'radioremoved');
                if (state){
                    this.check(this.radios(this.siblings(item)).first(), true);
                }
            }
        },

        // test if it's checked
        isChecked: function(item){
            if (this.hasRadio(item)){
                return this._radio(item).is(':checked');
            }
            // support 'checkbox' extension
            if (this._super){
                return this._super(item);
            }
            return false;
        },

        // (un)check item
        check: function(item, state){
            if (this.hasRadio(item)){
                this._radio(item).prop('checked', state);
                this._childRadio(item);
                this._parentRadio(item);
                this._trigger(item, state ? 'checked' : 'unchecked');
                return true;
            }
            // support 'checkbox' extension
            if (this._super){
                return this._super(item, state);
            }
            return false;
        },

        // filter items with radio by state (if set)
        radios: function(items, state){
            var _this = this, list = [];
            if (this._instance.options.radio){
                if (typeof state == 'undefined'){
                    return items.filter('.aciTreeRadio');
                }
                items.filter('.aciTreeRadio').each(function(){
                    if (state == _this._radio($(this)).is(':checked')){
                        list[list.length] = this;
                    }
                });
            }
            return $(list);
        },

        // override set option
        option: function(option, value){
            if (this.wasInit() && !this.isLocked()){
                if ((option == 'radio') && (value != this._instance.options.radio)) {
                    if (value){
                        this._initRadio();
                    } else {
                        this._doneRadio();
                    }
                }
            }
            // call the parent
            this._super(option, value);
        },

        // done radio
        _doneRadio: function(destroy){
            var _this = this;
            this._instance.jQuery.unbind(this._private.nameSpace);
            this._instance.jQuery.off(this._private.nameSpace, '.aciTreeItem');
            this._instance.jQuery.off(this._private.nameSpace, 'input[type=radio]');
            if (!destroy){
                this.radios(this.childrens(null, true)).each(function(){
                    _this.setRadio($(this), false);
                });
            }
        },

        // override _destroyHook
        _destroyHook: function(unloaded){
            if (unloaded){
                this._doneRadio(true);
            }
            // call the parent
            this._super(unloaded);
        }

    };

    // extend the base aciTree class and add the radio stuff
    aciPluginClass.plugins.aciTree = aciPluginClass.plugins.aciTree.extend(aciTree_radio, 'aciTreeRadio');

    // add extra default options
    aciPluginClass.defaults('aciTree', options);

})(jQuery);
