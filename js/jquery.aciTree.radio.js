
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
 * This extension adds radio-button support to aciTree,
 * should be used with the selectable extension.
 *
 * The are a few extra keys for the item data:
 *
 * {
 *   ...
 *   radio: true,                       // TRUE means the item will have a radio button
 *   checked: false,                    // if should be checked or not
 *   ...
 * }
 *
 */

(function($, window, undefined) {

    // extra default options

    var options = {
        radio: false,                   // if TRUE then each item will have a radio button
        radioChain: true,               // if TRUE the selection will propagate to the parents/children
        radioBreak: true,               // if TRUE then a missing radio button will break the chaining
        radioClick: false               // if TRUE then a click will trigger a state change only when made over the radio-button itself
    };

    // aciTree radio extension

    var aciTree_radio = {
        // init radio
        _radioInit: function() {
            this._instance.jQuery.bind('acitree' + this._private.nameSpace, function(event, api, item, eventName, options) {
                switch (eventName) {
                    case 'loaded':
                        if (item) {
                            // check/update on item load
                            api._radioLoad(item);
                        }
                        break;
                }
            }).bind('keydown' + this._private.nameSpace, this.proxy(function(e) {
                switch (e.which) {
                    case 32: // space
                        // support 'selectable' extension
                        if (this.extSelectable) {
                            var item = this.selected();
                            if (this.hasRadio(item)) {
                                if (!this.isChecked(item)) {
                                    this.check(item, {
                                        check: true
                                    });
                                }
                                e.stopImmediatePropagation();
                                // prevent page scroll
                                e.preventDefault();
                            }
                        }
                        break;
                }
            })).on('click' + this._private.nameSpace, '.aciTreeItem', this.proxy(function(e) {
                if (!this._instance.options.radioClick || $(e.target).is('.aciTreeCheck')) {
                    var item = this.itemFrom(e.target);
                    if (this.hasRadio(item)) {
                        if (!this.isChecked(item)) {
                            this.check(item, {
                                check: true
                            });
                        }
                        e.preventDefault();
                    }
                }
            }));
        },
        // override _initHook
        _initHook: function() {
            if (this.extRadio()) {
                this._radioInit();
            }
            // call the parent
            this._super();
        },
        // override _itemHook
        _itemHook: function(parent, item, itemData, level) {
            if (this.extRadio()) {
                // support 'checkbox' extension
                var checkbox = this.extCheckbox && this.hasCheckbox(item);
                if (!checkbox && (itemData.radio || (itemData.radio === undefined))) {
                    this._radioDOM.add(parent, item, itemData);
                }
            }
            this._super(parent, item, itemData, level);
        },
        // low level DOM functions
        _radioDOM: {
            // add item radio
            add: function(parent, item, itemData) {
                item.attr('aria-checked', !!itemData.checked).addClass('aciTreeRadio' + (itemData.checked ? ' aciTreeChecked' : '')).children('.aciTreeLine').find('.aciTreeText').wrap('<label></label>').before('<span class="aciTreeCheck" />');
            },
            // remove item radio
            remove: function(item) {
                var label = item.removeAttr('aria-checked').removeClass('aciTreeRadio aciTreeChecked').children('.aciTreeLine').find('label');
                if (label.length) {
                    label.find('*').not('.aciTreeText').remove();
                    label.find('.aciTreeText').unwrap();
                }
            },
            // (un)check items
            check: function(items, state) {
                items.attr('aria-checked', state).toggleClass('aciTreeChecked', state);
            }
        },
        // update item on load
        _radioLoad: function(item) {
            if (!this._instance.options.radioChain) {
                // do not update on load
                return;
            }
            if (this.hasRadio(item)) {
                if (this.isChecked(item)) {
                    if (!this.radios(this.children(item, false, true), true).length) {
                        // the item is checked but no children are, check the children
                        this._radioUpdate(item, true);
                    }
                } else {
                    // the item is not checked, uncheck children
                    this._radioUpdate(item);
                }
            }
        },
        // get children list
        _radioChildren: function(item) {
            if (this._instance.options.radioBreak) {
                var list = [];
                var process = this.proxy(function(item) {
                    var children = this.children(item, false, true);
                    children.each(this.proxy(function(element) {
                        var item = $(element);
                        if (this.hasRadio(item)) {
                            list.push(element);
                            process(item);
                        }
                    }, true));
                });
                process(item);
                return $(list);
            } else {
                var children = this.children(item, true, true);
                return this.radios(children);
            }
        },
        // get children across items
        _radioLevel: function(items) {
            var list = [];
            items.each(this.proxy(function(element) {
                var item = $(element);
                var children = this.children(item, false, true);
                children.each(this.proxy(function(element) {
                    var item = $(element);
                    if (!this._instance.options.radioBreak || this.hasRadio(item)) {
                        list.push(element);
                    }
                }, true));
            }, true));
            return $(list);
        },
        // update radio state
        _radioUpdate: function(item, state) {
            // update siblings
            var siblings = this.proxy(function(item) {
                var siblings = this.siblings(item, true);
                this._radioDOM.check(this.radios(siblings), false);
                siblings.each(this.proxy(function(element) {
                    var item = $(element);
                    if (!this._instance.options.radioBreak || this.hasRadio(item)) {
                        this._radioDOM.check(this._radioChildren(item), false);
                    }
                }, true));
            });
            if (state) {
                siblings(item);
            }
            // update children
            var checkDown = this.proxy(function(item) {
                var children = this._radioLevel(item);
                var radios = this.radios(children);
                if (radios.length) {
                    var checked = this.radios(children, true);
                    if (checked.length) {
                        checked = checked.first();
                        this._radioDOM.check(checked, true);
                        siblings(checked);
                        checkDown(checked);
                    } else {
                        checked = radios.first();
                        this._radioDOM.check(checked, true);
                        siblings(checked);
                        checkDown(checked);
                    }
                } else if (children.length) {
                    checkDown(children);
                }
            });
            if (state) {
                checkDown(item);
            } else {
                this._radioDOM.check(this._radioChildren(item), false);
            }
            // update parents
            var checkUp = this.proxy(function(item) {
                var parent = this.parent(item);
                if (parent.length) {
                    if (this.hasRadio(parent)) {
                        if (state) {
                            siblings(parent);
                        }
                        this._radioDOM.check(parent, state);
                        checkUp(parent);
                    } else {
                        if (!this._instance.options.radioBreak) {
                            if (state) {
                                siblings(parent);
                            }
                            checkUp(parent);
                        }
                    }
                }
            });
            if (state !== undefined) {
                checkUp(item);
            }
        },
        // test if item have a radio
        hasRadio: function(item) {
            return item && item.hasClass('aciTreeRadio');
        },
        // set item with/without a radio
        // options.radio if there will be a radio-button or not
        // options.checked the new state (if set)
        setRadio: function(item, options) {
            options = this._options(options, null, function() {
                this._trigger(item, 'radiofail', options);
            });
            if (this.extRadio() && this.isItem(item)) {
                // a way to cancel the operation
                if (!this._trigger(item, 'beforeradio', options)) {
                    this._fail(item, options);
                    return;
                }
                var radio = !!options.radio;
                var checked = options.checked;
                if (this.hasRadio(item)) {
                    if (radio) {
                        if (checked !== undefined) {
                            // change state
                            this.check(item, this._inner(options, {
                                check: checked
                            }));
                        }
                        this._trigger(item, 'radioset', options);
                    } else {
                        this._radioDOM.remove(item);
                        this._trigger(item, 'radioremoved', options);
                    }
                    this._success(item, options);
                } else {
                    if (radio) {
                        var process = function() {
                            this._radioDOM.add(this.parent(item), item, {
                            });
                            if (checked === undefined) {
                                this._trigger(item, 'radioadded', options);
                            } else {
                                // change state
                                this.check(item, this._inner(options, {
                                    check: checked
                                }));
                                this._trigger(item, 'radioadded', options);
                            }
                            this._success(item, options);
                        };
                        // support 'checkbox' extension
                        if (this.extCheckbox && this.hasCheckbox(item)) {
                            this.setCheckbox(item, this._inner(options, {
                                success: process,
                                fail: options.fail,
                                checkbox: false
                            }));
                        } else {
                            process.apply(this);
                        }
                    } else {
                        this._trigger(item, 'notradio', options);
                        this._success(item, options);
                    }
                }
            } else {
                this._fail(item, options);
            }
        },
        // test if it's checked
        isChecked: function(item) {
            if (this.hasRadio(item)) {
                return item.hasClass('aciTreeChecked');
            }
            // support 'checkbox' extension
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
            if (this.extRadio() && this.hasRadio(item)) {
                // a way to cancel the check
                if (!this._trigger(item, 'beforecheck', options)) {
                    this._fail(item, options);
                    return;
                }
                var check = options.check;
                this._radioDOM.check(item, check);
                if (this._instance.options.radioChain) {
                    this._radioUpdate(item, check);
                }
                this._trigger(item, check ? 'checked' : 'unchecked', options);
                this._success(item, options);
            } else {
                // support 'checkbox' extension
                if (this._super) {
                    this._super(item, options);
                } else {
                    this._fail(item, options);
                }
            }
        },
        // filter items with radio by state (if set)
        radios: function(items, state) {
            var list = items.filter('.aciTreeRadio');
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
            if (data && this.extRadio()) {
                if (this.hasRadio(item)) {
                    data.radio = true;
                    data.checked = this.isChecked(item);
                } else {
                    data.radio = false;
                    data.checked = null;
                }
            }
            return data;
        },
        // override `serialize`
        serialize: function(item, what, callback) {
            if (what == 'radio') {
                var serialized = '';
                var children = this.children(item, true, true);
                this.radios(children, true).each(this.proxy(function(element) {
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
        // test if radio is enabled
        extRadio: function() {
            return this._instance.options.radio;
        },
        // override set option
        option: function(option, value) {
            if (this.wasInit() && !this.isLocked()) {
                if ((option == 'radio') && (value != this.extRadio())) {
                    if (value) {
                        this._radioInit();
                    } else {
                        this._radioDone();
                    }
                }
            }
            // call the parent
            this._super(option, value);
        },
        // done radio
        _radioDone: function(destroy) {
            this._instance.jQuery.unbind(this._private.nameSpace);
            this._instance.jQuery.off(this._private.nameSpace, '.aciTreeItem');
            if (!destroy) {
                this.radios(this.children(null, true, true)).each(this.proxy(function(element) {
                    this.setRadio($(element), false);
                }, true));
            }
        },
        // override _destroyHook
        _destroyHook: function(unloaded) {
            if (unloaded) {
                this._radioDone(true);
            }
            // call the parent
            this._super(unloaded);
        }

    };

    // extend the base aciTree class and add the radio stuff
    aciPluginClass.plugins.aciTree = aciPluginClass.plugins.aciTree.extend(aciTree_radio, 'aciTreeRadio');

    // add extra default options
    aciPluginClass.defaults('aciTree', options);

})(jQuery, this);
