
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
 * This extension adds the possibility to sort the tree items.
 * Require aciSortable https://github.com/dragosu/jquery-aciSortable and the utils extension for reordering items.
 */

(function($, window, undefined) {

    // extra default options

    var options = {
        sortable: false,             // if TRUE then the tree items can be sorted
        // called by the aciSortable inside the 'drag' callback
        sortDrag: function(item, placeholder, isValid, helper) {
            if (!isValid) {
                helper.html(this.getLabel(item));
            }
        },
        // called by the aciSortable inside the 'valid' callback
        sortValid: function(item, hover, before, isContainer, placeholder, helper) {
            if (isContainer) {
                helper.html('move ' + this.getLabel(item) + ' to ' + this.getLabel(this.itemFrom(hover)));
                placeholder.removeClass('aciTreeAfter aciTreeBefore');
            } else if (before !== null) {
                if (before) {
                    helper.html('move ' + this.getLabel(item) + ' before ' + this.getLabel(hover));
                    placeholder.removeClass('aciTreeAfter').addClass('aciTreeBefore');
                } else {
                    helper.html('move ' + this.getLabel(item) + ' after ' + this.getLabel(hover));
                    placeholder.removeClass('aciTreeBefore').addClass('aciTreeAfter');
                }
            }
        }
    };

    // aciTree sortable extension

    var aciTree_sortable = {
        __extend: function() {
            // add extra data
            $.extend(this._private, {
                openTimeout: null
            });
            // call the parent
            this._super();
        },
        // init sortable
        _initSortable: function() {
            this._instance.jQuery.aciSortable({
                container: '.aciTreeUl',
                item: '.aciTreeLi',
                child: 50,
                childHolder: '<ul class="aciTreeUl aciTreeChild"></ul>',
                childHolderSelector: '.aciTreeChild',
                placeholder: '<li class="aciTreeLi aciTreePlaceholder"><div></div></li>',
                placeholderSelector: '.aciTreePlaceholder',
                helper: '<div class="aciTreeHelper"></div>',
                helperSelector: '.aciTreeHelper',
                before: this.proxy(function(item) {
                    this._instance.jQuery.focus();
                    var options = this._options();
                    // a way to cancel the drag
                    if (!this._trigger(item, 'beforedrag', options)) {
                        this._trigger(item, 'dragfail', options);
                        return false;
                    }
                    return true;
                }),
                start: this.proxy(function(item, placeholder, helper) {
                    this._instance.jQuery.addClass('aciTreeDragDrop');
                    helper.css({
                        opacity: 1
                    }).html(this.getLabel(item));
                }),
                drag: this.proxy(function(item, placeholder, isValid, helper) {
                    if (!isValid) {
                        window.clearTimeout(this._private.openTimeout);
                    }
                    if (this._instance.options.sortDrag) {
                        this._instance.options.sortDrag.apply(this, arguments);
                    }
                }),
                valid: this.proxy(function(item, hover, before, isContainer, placeholder, helper) {
                    window.clearTimeout(this._private.openTimeout);
                    if (!isContainer && this.isFolder(hover)) {
                        if (!this.isOpen(hover) && !hover.data('opening' + this._private.nameSpace)) {
                            this._private.openTimeout = window.setTimeout(this.proxy(function() {
                                hover.data('opening' + this._private.nameSpace, true);
                                this.open(hover, {
                                    success: function(item) {
                                        item.removeData('opening' + this._private.nameSpace);
                                    },
                                    fail: function(item) {
                                        item.removeData('opening' + this._private.nameSpace);
                                    }
                                });
                            }), 1000);
                        }
                    }
                    var options = this._options({
                        hover: hover,
                        before: before,
                        isContainer: isContainer,
                        placeholder: placeholder,
                        helper: helper
                    });
                    // a way to cancel the drag
                    if (!this._trigger(item, 'checkdrop', options)) {
                        return false;
                    }
                    if (this._instance.options.sortValid) {
                        this._instance.options.sortValid.apply(this, arguments);
                    }
                    return true;
                }),
                create: this.proxy(function(api, item, hover) {
                    if (this.isFile(hover)) {
                        hover.append(api._instance.options.childHolder);
                        return true;
                    }
                    return false;
                }, true),
                end: this.proxy(function(item, placeholder, helper) {
                    window.clearTimeout(this._private.openTimeout);
                    var options = {
                        placeholder: placeholder,
                        helper: helper
                    };
                    options = this._options(options, function() {
                        this._trigger(item, 'sorted', options);
                    }, function() {
                        this._trigger(item, 'dropfail', options);
                    });
                    if (placeholder.parent().length) {
                        var prev = this.prev(placeholder);
                        if (prev.length) {
                            // add after a item
                            placeholder.detach();
                            this.moveAfter(item, this._inner(options, {
                                success: options.success,
                                fail: options.fail,
                                after: prev
                            }));
                        } else {
                            var next = this.next(placeholder);
                            if (next.length) {
                                // add before a item
                                placeholder.detach();
                                this.moveBefore(item, this._inner(options, {
                                    success: options.success,
                                    fail: options.fail,
                                    before: next
                                }));
                            } else {
                                // add as a child
                                var parent = this.parent(placeholder);
                                var container = placeholder.parent();
                                placeholder.detach();
                                container.remove();
                                if (this.isFile(parent)) {
                                    // we can set asChild only for files
                                    this.asChild(item, this._inner(options, {
                                        success: function() {
                                            this._success(item, options);
                                            this.open(parent);
                                        },
                                        fail: options.fail,
                                        parent: parent
                                    }));
                                } else {
                                    this._fail(item, options);
                                }
                            }
                        }
                    } else {
                        this._fail(item, options);
                    }
                    if (helper.parent().length) {
                        // the helper is inserted in the DOM
                        var top = $(window).scrollTop();
                        var left = $(window).scrollLeft();
                        var rect = item.get(0).getBoundingClientRect();
                        // animate helper to item position
                        helper.animate({
                            top: rect.top + top,
                            left: rect.left + left,
                            opacity: 0
                        },
                        {
                            complete: function() {
                                // when completed detach the helper
                                helper.detach();
                            }
                        });
                    }
                    this._instance.jQuery.removeClass('aciTreeDragDrop');
                })
            });
        },
        // override _initHook
        _initHook: function() {
            if (this.isSortable()) {
                this._initSortable();
            }
            // call the parent
            this._super();
        },
        // test if sortable is enabled
        isSortable: function() {
            return this._instance.options.sortable;
        },
        // override set option
        option: function(option, value) {
            if (this.wasInit() && !this.isLocked()) {
                if ((option == 'sortable') && (value != this.isSortable())) {
                    if (value) {
                        this._initSortable();
                    } else {
                        this._doneSortable();
                    }
                }
            }
            // call the parent
            this._super(option, value);
        },
        // done sortable
        _doneSortable: function() {
            this._instance.jQuery.unbind(this._private.nameSpace);
            this._instance.jQuery.aciSortable('destroy');
        },
        // override _destroyHook
        _destroyHook: function(unloaded) {
            if (unloaded) {
                this._doneSortable();
            }
            // call the parent
            this._super(unloaded);
        }
    };

    // extend the base aciTree class and add the sortable stuff
    aciPluginClass.plugins.aciTree = aciPluginClass.plugins.aciTree.extend(aciTree_sortable, 'aciTreeSortable');

    // add extra default options
    aciPluginClass.defaults('aciTree', options);

})(jQuery, this);
