
/*
 * aciTree jQuery Plugin v4.2.1
 * http://acoderinsights.ro
 *
 * Copyright (c) 2013 Dragos Ursu
 * Dual licensed under the MIT or GPL Version 2 licenses.
 *
 * Require jQuery Library >= v1.9.0 http://jquery.com
 * + aciPlugin >= v1.5.1 https://github.com/dragosu/jquery-aciPlugin
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
 *   ...
 * }
 *
 */

(function($, window, undefined) {

    // extra default options

    var options = {
        checkbox: false,                // if TRUE then each item will have a checkbox
        checkboxChain: true,
        // if TRUE the selection will propagate to the parents/children
        // if -1 the selection will propagate only to parents
        // if +1 the selection will propagate only to children
        // if FALSE the selection will not propagate in any way
        checkboxBreak: true,            // if TRUE then a missing checkbox will break the chaining
        checkboxClick: false            // if TRUE then a click will trigger a state change only when made over the checkbox itself
    };

    // aciTree checkbox extension

    var aciTree_checkbox = {
        // init checkbox
        _checkboxInit: function() {
            this._instance.jQuery.bind('acitree' + this._private.nameSpace, function(event, api, item, eventName, options) {
                switch (eventName) {
                    case 'loaded':
                        // check/update on item load
                        api._checkboxLoad(item);
                        break;
                }
            }).bind('keydown' + this._private.nameSpace, this.proxy(function(e) {
                switch (e.which) {
                    case 32: // space
                        // support 'selectable' extension
                        if (this.extSelectable) {
                            var item = this.selected();
                            if (this.hasCheckbox(item)) {
                                this.check(item, {
                                    check: !this.isChecked(item)
                                });
                                e.stopImmediatePropagation();
                                // prevent page scroll
                                e.preventDefault();
                            }
                        }
                        break;
                }
            })).on('click' + this._private.nameSpace, '.aciTreeItem', this.proxy(function(e) {
                if (!this._instance.options.checkboxClick || $(e.target).is('.aciTreeCheck')) {
                    var item = this.itemFrom(e.target);
                    if (this.hasCheckbox(item)) {
                        this.check(item, {
                            check: !this.isChecked(item)
                        });
                        e.preventDefault();
                    }
                }
            }));
        },
        // override _initHook
        _initHook: function() {
            if (this.extCheckbox()) {
                this._checkboxInit();
            }
            // call the parent
            this._super();
        },
        // override _itemHook
        _itemHook: function(parent, item, itemData, level) {
            if (this.extCheckbox()) {
                // support 'radio' extension
                var radio = this.extRadio && this.hasRadio(item);
                if (!radio && (itemData.checkbox || (itemData.checkbox === undefined))) {
                    this._checkboxDOM.add(item, itemData);
                }
            }
            this._super(parent, item, itemData, level);
        },
        // low level DOM functions
        _checkboxDOM: {
            // add item checkbox
            add: function(item, itemData) {
                item.attr('aria-checked', !!itemData.checked).addClass('aciTreeCheckbox' + (itemData.checked ? ' aciTreeChecked' : '')).children('.aciTreeLine').find('.aciTreeText').wrap('<label></label>').before('<span class="aciTreeCheck" />');
            },
            // remove item checkbox
            remove: function(item) {
                var label = item.removeAttr('aria-checked').removeClass('aciTreeCheckbox aciTreeChecked aciTreeTristate').children('.aciTreeLine').find('label');
                if (label.length) {
                    label.find('*').not('.aciTreeText').remove();
                    label.find('.aciTreeText').unwrap();
                }
            },
            // (un)check items
            check: function(items, state) {
                items.attr('aria-checked', state).toggleClass('aciTreeChecked', state);
            },
            // (un)set tristate items
            tristate: function(items, state) {
                items.toggleClass('aciTreeTristate', state);
            }
        },
        // update items on load, starting from the loaded node
        _checkboxLoad: function(item) {
            if (this._instance.options.checkboxChain === false) {
                // do not update on load
                return;
            }
            var state = undefined;
            if (this.hasCheckbox(item)) {
                if (this.isChecked(item)) {
                    if (!this.checkboxes(this.children(item, false, true), true).length) {
                        // the item is checked but no children are, check them all
                        state = true;
                    }
                } else {
                    // the item is not checked, uncheck all children
                    state = false;
                }
            }
            this._checkboxUpdate(item, state);
        },
        // get children list
        _checkboxChildren: function(item) {
            if (this._instance.options.checkboxBreak) {
                var list = [];
                var process = this.proxy(function(item) {
                    var children = this.children(item, false, true);
                    children.each(this.proxy(function(element) {
                        var item = $(element);
                        if (this.hasCheckbox(item)) {
                            list.push(element);
                            process(item);
                        }
                    }, true));
                });
                process(item);
                return $(list);
            } else {
                var children = this.children(item, true, true);
                return this.checkboxes(children);
            }
        },
        // update checkbox state
        _checkboxUpdate: function(item, state) {
            // update children
            var checkDown = this.proxy(function(item, count, state) {
                var children = this.children(item, false, true);
                var total = 0;
                var checked = 0;
                children.each(this.proxy(function(element) {
                    var item = $(element);
                    var subCount = {
                        total: 0,
                        checked: 0
                    };
                    if (this.hasCheckbox(item)) {
                        if ((state !== undefined) && (this._instance.options.checkboxChain !== -1)) {
                            this._checkboxDOM.check(item, state);
                        }
                        total++;
                        if (this.isChecked(item)) {
                            checked++;
                        }
                        checkDown(item, subCount, state);
                    } else {
                        if (this._instance.options.checkboxBreak) {
                            var reCount = {
                                total: 0,
                                checked: 0
                            };
                            checkDown(item, reCount);
                        } else {
                            checkDown(item, subCount, state);
                        }
                    }
                    total += subCount.total;
                    checked += subCount.checked;
                }, true));
                if (item) {
                    this._checkboxDOM.tristate(item, (checked > 0) && (checked != total));
                    count.total += total;
                    count.checked += checked;
                }
            });
            var count = {
                total: 0,
                checked: 0
            };
            checkDown(item, count, state);
            // update parents
            var checkUp = this.proxy(function(item, tristate, state) {
                var parent = this.parent(item);
                if (parent.length) {
                    if (!tristate) {
                        var children = this._checkboxChildren(parent);
                        var checked = this.checkboxes(children, true).length;
                        var tristate = (checked > 0) && (checked != children.length);
                    }
                    if (this.hasCheckbox(parent)) {
                        if ((state !== undefined) && (this._instance.options.checkboxChain !== 1)) {
                            this._checkboxDOM.check(parent, tristate ? true : state);
                        }
                        this._checkboxDOM.tristate(parent, tristate);
                        checkUp(parent, tristate, state);
                    } else {
                        if (this._instance.options.checkboxBreak) {
                            checkUp(parent);
                        } else {
                            checkUp(parent, tristate, state);
                        }
                    }
                }
            });
            checkUp(item, undefined, state);
        },
        // test if item have a checkbox
        hasCheckbox: function(item) {
            return item && item.hasClass('aciTreeCheckbox');
        },
        // set item with/without a checkbox
        // options.checkbox if there will be a checkbox or not
        // options.checked the new state (if set)
        setCheckbox: function(item, options) {
            options = this._options(options, null, function() {
                this._trigger(item, 'checkboxfail', options);
            });
            if (this.extCheckbox() && this.isItem(item)) {
                // a way to cancel the operation
                if (!this._trigger(item, 'beforecheckbox', options)) {
                    this._fail(item, options);
                    return;
                }
                var checkbox = !!options.checkbox;
                var checked = options.checked;
                if (this.hasCheckbox(item)) {
                    if (checkbox) {
                        if (checked !== undefined) {
                            // change state
                            this.check(item, this._inner(options, {
                                check: checked
                            }));
                        }
                        this._trigger(item, 'checkboxset', options);
                    } else {
                        this._checkboxDOM.remove(item);
                        this._trigger(item, 'checkboxremoved', options);
                    }
                    this._success(item, options);
                } else {
                    if (checkbox) {
                        var process = function() {
                            this._checkboxDOM.add(item, {
                            });
                            if (checked === undefined) {
                                this._trigger(item, 'checkboxadded', options);
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
                        if (this.extRadio && this.hasRadio(item)) {
                            this.setRadio(item, this._inner(options, {
                                success: process,
                                fail: options.fail,
                                radio: false
                            }));
                        } else {
                            process.apply(this);
                        }
                    } else {
                        this._trigger(item, 'notcheckbox', options);
                        this._success(item, options);
                    }
                }
            } else {
                this._fail(item, options);
            }
        },
        // test if it's checked
        isChecked: function(item) {
            if (this.hasCheckbox(item)) {
                return item.hasClass('aciTreeChecked');
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
            if (this.extCheckbox() && this.hasCheckbox(item)) {
                // a way to cancel the check
                if (!this._trigger(item, 'beforecheck', options)) {
                    this._fail(item, options);
                    return;
                }
                var check = options.check;
                this._checkboxDOM.check(item, check);
                if (this._instance.options.checkboxChain !== false) {
                    this._checkboxUpdate(item, check);
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
            var list = items.filter('.aciTreeCheckbox');
            if (state !== undefined) {
                if (state) {
                    return list.filter('.aciTreeChecked');
                } else {
                    return list.not('.aciTreeChecked');
                }
            }
            return list;
        },
        // override `_serialize`
        _serialize: function(item, callback) {
            var data = this._super(item, callback);
            if (data && this.extCheckbox()) {
                if (this.hasCheckbox(item)) {
                    data.checkbox = true;
                    data.checked = this.isChecked(item);
                } else {
                    data.checkbox = false;
                    data.checked = null;
                }
            }
            return data;
        },
        // override `serialize`
        serialize: function(item, what, callback) {
            if (what == 'checkbox') {
                var serialized = '';
                var children = this.children(item, true, true);
                this.checkboxes(children, true).each(this.proxy(function(element) {
                    var item = $(element);
                    if (callback) {
                        serialized += callback.call(this, item, what, this.getId(item));
                    } else {
                        serialized += this._instance.options.serialize.call(this, item, what, this.getId(item));
                    }
                }, true));
                return serialized;
            }
            return this._super(item, what, callback);
        },
        // test if item is in tristate
        isTristate: function(item) {
            return item && item.hasClass('aciTreeTristate');
        },
        // filter tristate items
        tristate: function(items) {
            return items.filter('.aciTreeTristate');
        },
        // test if checkbox is enabled
        extCheckbox: function() {
            return this._instance.options.checkbox;
        },
        // override set option
        option: function(option, value) {
            if (this.wasInit() && !this.isLocked()) {
                if ((option == 'checkbox') && (value != this.extCheckbox())) {
                    if (value) {
                        this._checkboxInit();
                    } else {
                        this._checkboxDone();
                    }
                }
            }
            // call the parent
            this._super(option, value);
        },
        // done checkbox
        _checkboxDone: function(destroy) {
            this._instance.jQuery.unbind(this._private.nameSpace);
            this._instance.jQuery.off(this._private.nameSpace, '.aciTreeItem');
            if (!destroy) {
                this.checkboxes(this.children(null, true, true)).each(this.proxy(function(element) {
                    this.setCheckbox($(element), false);
                }, true));
            }
        },
        // override _destroyHook
        _destroyHook: function(unloaded) {
            if (unloaded) {
                this._checkboxDone(true);
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
