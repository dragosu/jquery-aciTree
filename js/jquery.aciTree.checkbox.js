
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
 * This extension adds checkbox support to aciTree,
 * should be used with the selectable extension.
 *
 * The are a few extra keys for the item data:
 *
 * {
 *   ...
 *   checkbox: true,                    // TRUE means the item will have a checkbox
 *   checked: false,                    // if should be checked or not
 *   checkboxName: 'check_field'        // the checkbox name attribute ('options.checkboxName' will be used by default)
 *   ...
 * }
 *
 * Note: the item ID must be unique.
 *
 * The checkbox value is the item ID.
 */

(function($, window, undefined) {

    // extra default options

    var options = {
        checkbox: false,                // if TRUE then each item will have a checkbox
        checkboxName: 'check[]',        // default checkbox field name (the [] need to be included)
        checkboxChain: true             // when TRUE the checkboxes will be chained together (the selection will propagate to the parents/childrens)
    };

    // aciTree checkbox extension

    var aciTree_checkbox = {
        // init checkbox
        _initCheckbox: function() {
            this._instance.jQuery.bind('acitree' + this._private.nameSpace, function(event, api, item, eventName, options) {
                switch (eventName) {
                    case 'loaded':
                        if (item && (api._instance.options.checkboxChain !== false)) {
                            api._loadCheckbox(item);
                        }
                        break;
                    case 'focused':
                        // support 'selectable' extension
                        api._checkbox(api.selected()).focus();
                        break;
                    case 'selected':
                        // support 'selectable' extension
                        api._checkbox(item).focus();
                        break;
                }
            }).bind('keydown' + this._private.nameSpace, this.proxy(function(e) {
                switch (e.which) {
                    case 9: // tab
                    case 32: // space
                        // support 'selectable' extension
                        if (this.isSelectable) {
                            var selected = this.selected();
                            if (this.hasCheckbox(selected)) {
                                if (this._lastFocus().get(0) == this._instance.jQuery.get(0)) {
                                    this._checkbox(selected).focus().trigger(e);
                                }
                                e.stopImmediatePropagation();
                            }
                        }
                        break;
                }
            })).on('click' + this._private.nameSpace, '.aciTreeItem', this.proxy(function(e) {
                if ($(e.target).hasClass('aciTreeItem')) {
                    var item = this.itemFrom(e.target);
                    if (this.hasCheckbox(item)) {
                        this._checkbox(item).focus();
                        this.check(item, {
                            check: !this.isChecked(item)
                        });
                        e.preventDefault();
                    }
                }
            })).on('focus' + this._private.nameSpace, 'input[type=checkbox]', this.proxy(function(e) {
                // support 'selectable' extension
                var item = this.itemFrom(e.target);
                if (this.isSelectable && !this.isSelected(item)) {
                    this.select(item, true);
                }
            })).on('click' + this._private.nameSpace, 'input[type=checkbox]', this.proxy(function(element, e) {
                // update item states
                var item = this.itemFrom(e.target);
                this.check(item, {
                    check: $(element).is(':checked')
                });
            }, true)).on('keydown' + this._private.nameSpace, 'input[type=checkbox]', this.proxy(function(e) {
                // prevent key handling
                switch (e.which) {
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
                        if (this.isSelectable) {
                            var item = this.itemFrom(e.target);
                            if (!this.isSelected(item)) {
                                return false;
                            }
                        }
                        e.stopPropagation();
                        break;
                }
            }));
        },
        // return the checkbox
        _checkbox: function(item) {
            return item ? item.first().children('.aciTreeLine').find('input[type=checkbox]') : $([]);
        },
        // override _initHook
        _initHook: function() {
            if (this.isCheckbox()) {
                this._initCheckbox();
            }
            // call the parent
            this._super();
        },
        // override _itemHook
        _itemHook: function(parent, item, itemData, level) {
            if (this.isCheckbox()) {
                // support 'radio' extension
                var radio = this.isRadio && this.hasRadio(item);
                if (!radio && (itemData.checkbox || (itemData.checkbox === undefined))) {
                    this._addCheckbox(item, itemData);
                }
            }
            this._super(parent, item, itemData, level);
        },
        // support selectable
        _selectHook: function(unselected, selected) {
            var result = this._super(unselected, selected);
            if (result) {
                return true;
            }
            if (this.isCheckbox() && this.hasCheckbox(unselected) && !this.hasCheckbox(selected)) {
                var checkbox = this._checkbox(unselected);
                if (checkbox.is(':focus')) {
                    checkbox.blur();
                    this._instance.jQuery.focus();
                    return true;
                }
            }
        },
        // add item checkbox
        _addCheckbox: function(item, itemData) {
            var name = itemData.checkboxName ? itemData.checkboxName : this._instance.options.checkboxName;
            item.first().addClass('aciTreeCheckbox').children('.aciTreeLine').find('.aciTreeText').wrap('<label></label>').before('<input type="checkbox" name="' +
                    name + '" value="' + this.getId(item) + '"' + (itemData.checked ? ' checked="checked"' : '') + ' />');
        },
        // remove item checkbox
        _removeCheckbox: function(item) {
            var label = item.first().removeClass('aciTreeCheckbox').children('.aciTreeLine').find('label');
            if (label.length) {
                label.find('*').not('.aciTreeText').remove();
                label.find('.aciTreeText').unwrap();
            }
        },
        // override setId
        setId: function(item, options) {
            options = this._options(options, function(item) {
                if (this.isCheckbox() && this.hasCheckbox(item)) {
                    // update field value
                    this._checkbox(item).attr('value', this.getId(item));
                }
            });
            this._super(item, options);
        },
        // update item on load
        _loadCheckbox: function(item) {
            if (this.hasCheckbox(item)) {
                if (this.isChecked(item)) {
                    if (this.checkboxes(this.childrens(item), true).length) {
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
        _childCheckbox: function(item) {
            if (this._instance.options.checkboxChain === -1) {
                // do not update the childrens
                return;
            }
            var state = this._checkbox(item).removeClass('aciTreeTristate').is(':checked');
            var process = this.proxy(function(item) {
                this.checkboxes(this.childrens(item)).each(this.proxy(function(element) {
                    this._checkbox($(element)).prop('checked', state).removeClass('aciTreeTristate');
                    process($(element));
                }, true));
            });
            process(item);
        },
        // check/uncheck parents based on direct childrens
        _parentCheckbox: function(item) {
            if (this._instance.options.checkboxChain === 1) {
                // do not update the parents
                return;
            }
            this.path(item, true).each(this.proxy(function(element) {
                if (!this.hasCheckbox($(element))) {
                    // break on missing checkbox
                    return false;
                }
                var list = this.checkboxes(this.childrens($(element)));
                if (list.length) {
                    var checked = this.checkboxes(list, true).length;
                    if (checked) {
                        // there is at least a child checked
                        var tristate = (checked != list.length) || (list.find('.aciTreeTristate').length > 0);
                        this._checkbox($(element)).prop('checked', true).toggleClass('aciTreeTristate', tristate);
                    } else {
                        // there are no childs checked
                        this._checkbox($(element)).prop('checked', false).removeClass('aciTreeTristate');
                    }
                } else {
                    this._checkbox($(element)).removeClass('aciTreeTristate');
                }
            }, true));
        },
        // test if item have a checkbox
        hasCheckbox: function(item) {
            return item && item.hasClass('aciTreeCheckbox');
        },
        // change new checkbox state by parents/childrens
        _stateCheckbox: function(item, options) {
            var parent = this.parent(item);
            var list = this.checkboxes(this.childrens(item));
            var checked = this.checkboxes(list, true);
            if (this.hasCheckbox(parent)) {
                // parent checkbox exists
                if (this.isChecked(parent)) {
                    // if parent is checked
                    var siblings = this.checkboxes(this.siblings(item));
                    if (siblings.length) {
                        if (checked.length) {
                            this._parentCheckbox(checked);
                        } else {
                            this._parentCheckbox(item);
                        }
                    } else {
                        if (this._instance.options.checkboxChain !== -1) {
                            this._checkbox(item).prop('checked', true);
                        }
                        this._trigger(item, 'checkboxadded', options);
                        if (list.length && !checked.length && (this._instance.options.checkboxChain !== 1)) {
                            this.check(item, this._inner(options, {
                                check: true
                            }));
                        }
                        return;
                    }
                } else {
                    // if parent is not checked
                    if (checked.length) {
                        this._parentCheckbox(checked);
                    }
                }
            } else {
                // there is no parent checkbox
                if (checked.length) {
                    this._parentCheckbox(checked);
                }
            }
            this._trigger(item, 'checkboxadded', options);
        },
        // set item with/without a checkbox
        // options.checkbox if there will be a checkbox or not
        // options.checked the new state (if set)
        // options.checkboxName the new name (if set)
        setCheckbox: function(item, options) {
            options = this._options(options, null, function() {
                this._trigger(item, 'checkboxfail', options);
            });
            if (this.isCheckbox() && this.isItem(item)) {
                // a way to cancel the operation
                if (!this._trigger(item, 'beforecheckbox', options)) {
                    this._fail(item, options);
                    return;
                }
                var checkbox = !!options.checkbox;
                var checked = options.checked;
                var checkboxName = options.checkboxName;
                if (checkbox == this.hasCheckbox(item)) {
                    if (checkbox) {
                        if (checkboxName !== undefined) {
                            // change name
                            this._checkbox(item).attr('name', checkboxName ? checkboxName : this._instance.options.checkboxName);
                        }
                        if (checked !== undefined) {
                            // change state
                            this.check(item, this._inner(options, {
                                check: checked
                            }));
                        }
                        this._trigger(item, 'checkboxset', options);
                    } else {
                        this._trigger(item, 'notcheckbox', options);
                    }
                    this._success(item, options);
                } else if (checkbox) {
                    var process = function() {
                        this._addCheckbox(item, {
                            id: this.getId(item),
                            checkboxName: checkboxName
                        });
                        if (checked === undefined) {
                            if (this._instance.options.checkboxChain !== false) {
                                this._stateCheckbox(item, options);
                            } else {
                                this._trigger(item, 'checkboxadded', options);
                            }
                        } else {
                            // change state
                            this.check(item, this._inner(options, {
                                check: checked
                            }));
                            this._trigger(item, 'checkboxadded', options);
                        }
                        this._success(item, options);
                    };
                    // support 'radio' extension
                    if (this.isRadio && this.hasRadio(item)) {
                        this.setRadio(item, this._inner(options, {
                            success: process,
                            fail: options.fail,
                            radio: false
                        }));
                    } else {
                        process.apply(this);
                    }
                } else {
                    this._removeCheckbox(item);
                    if (this._instance.options.checkboxChain !== false) {
                        this._parentCheckbox(item);
                    }
                    this._trigger(item, 'checkboxremoved', options);
                    this._success(item, options);
                }
            } else {
                this._fail(item, options);
            }
        },
        // test if it's checked
        isChecked: function(item) {
            if (this.hasCheckbox(item)) {
                return this._checkbox(item).is(':checked');
            }
            // support 'radio' extension
            if (this._super) {
                return this._super(item);
            }
            return false;
        },
        // (un)check item
        // options.check is the new state
        check: function(item, options) {
            options = this._options(options, null, function() {
                this._trigger(item, 'checkfail', options);
            });
            if (this.isCheckbox() && this.hasCheckbox(item)) {
                // a way to cancel the check
                if (!this._trigger(item, 'beforecheck', options)) {
                    this._fail(item, options);
                    return;
                }
                var check = options.check;
                this._checkbox(item).prop('checked', check);
                if (this._instance.options.checkboxChain !== false) {
                    this._childCheckbox(item);
                    this._parentCheckbox(item);
                }
                this._trigger(item, check ? 'checked' : 'unchecked', options);
                this._success(item, options);
            } else {
                // support 'radio' extension
                if (this._super) {
                    this._super(item, options);
                } else {
                    this._fail(item, options);
                }
            }
        },
        // filter items with checkbox by state (if set)
        checkboxes: function(items, state) {
            var list = [];
            if (state === undefined) {
                return items.filter('.aciTreeCheckbox');
            }
            items.filter('.aciTreeCheckbox').each(this.proxy(function(element) {
                if (state == this._checkbox($(element)).is(':checked')) {
                    list[list.length] = element;
                }
            }, true));
            return $(list);
        },
        // test if checkbox is enabled
        isCheckbox: function() {
            return this._instance.options.checkbox;
        },
        // override set option
        option: function(option, value) {
            if (this.wasInit() && !this.isLocked()) {
                if ((option == 'checkbox') && (value != this.isCheckbox())) {
                    if (value) {
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
        _doneCheckbox: function(destroy) {
            this._instance.jQuery.unbind(this._private.nameSpace);
            this._instance.jQuery.off(this._private.nameSpace, '.aciTreeItem');
            this._instance.jQuery.off(this._private.nameSpace, 'input[type=checkbox]');
            if (!destroy) {
                this.checkboxes(this.childrens(null, true)).each(this.proxy(function(element) {
                    this.setCheckbox($(element), false);
                }, true));
            }
        },
        // override _destroyHook
        _destroyHook: function(unloaded) {
            if (unloaded) {
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

})(jQuery, this);
