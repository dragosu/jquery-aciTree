
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
 * This extension adds inplace edit support to aciTree,
 * should be used with the selectable extension.
 */

(function($, window, undefined) {

    // extra default options

    var options = {
        editable: false                 // if TRUE then each item will be inplace editable
    };

    // aciTree editable extension
    // ads inplace item editing by pressing F2 key or mouse click (to enter edit mode)
    // press enter/escape to save/cancel the text edit

    var aciTree_editable = {
        // init editable
        _initEditable: function() {
            this._instance.jQuery.bind('acitree' + this._private.nameSpace, function(event, api, item, eventName, options) {
                switch (eventName) {
                    case 'blurred':
                        // support 'selectable' extension
                        var edited = api.edited();
                        if (edited.length) {
                            // cancel edit/save the changes
                            api.edit(edited, {
                                edit: false,
                                save: true
                            });
                        }
                        break;
                    case 'unselected':
                        // support 'selectable' extension
                        if (api.isEdited(item)) {
                            // cancel edit/save the changes
                            api.edit(item, {
                                edit: false,
                                save: true
                            });
                        }
                        break;
                }
            }).bind('click' + this._private.nameSpace, this.proxy(function() {
                // click on the tree
                var edited = this.edited();
                if (edited.length) {
                    // cancel edit/save the changes
                    this.edit(edited, {
                        edit: false,
                        save: true
                    });
                }
            })).bind('keydown' + this._private.nameSpace, this.proxy(function(e) {
                switch (e.which) {
                    case 113: // F2
                        // support 'selectable' extension
                        if (this.isSelectable) {
                            var selected = this.selected();
                            if (!this.isEdited(selected)) {
                                // enable edit on F2 key
                                this.edit(selected, {
                                    edit: true
                                });
                            }
                        }
                        break;
                }
            })).on('mouseup' + this._private.nameSpace, '.aciTreeItem', this.proxy(function(e) {
                if ($(e.target).is('.aciTreeItem,.aciTreeText')) {
                    var item = this.itemFrom(e.target);
                    // support 'selectable' extension
                    if (this.isSelectable && this.isSelected(item)) {
                        // enable edit on selected item
                        this.edit(item, {
                            edit: true
                        });
                    }
                }
            })).on('dblclick' + this._private.nameSpace, '.aciTreeItem', this.proxy(function(e) {
                // support 'selectable' extension
                if (this.isSelectable && !this.isSelectable()) {
                    var item = this.itemFrom(e.target);
                    // enable edit mode
                    this.edit(item, {
                        edit: true
                    });
                }
            })).on('keydown' + this._private.nameSpace, 'input[type=text]', this.proxy(function(e) {
                // key handling
                switch (e.which) {
                    case 13: // enter
                        var item = this.itemFrom(e.target);
                        this.edit(item, {
                            edit: false,
                            save: true
                        });
                        this._instance.jQuery.focus();
                        e.stopPropagation();
                        break;
                    case 27: // escape
                        var item = this.itemFrom(e.target);
                        this.edit(item, {
                            edit: false
                        });
                        this._instance.jQuery.focus();
                        e.preventDefault();
                        e.stopPropagation();
                        break;
                    case 38: // up
                    case 40: // down
                    case 37: // left
                    case 39: // right
                    case 33: // pgup
                    case 34: // pgdown
                    case 36: // home
                    case 35: // end
                    case 32: // space
                        e.stopPropagation();
                        break;
                }
            })).on('blur' + this._private.nameSpace, 'input[type=text]', this.proxy(function() {
                if (this.isSelectable && !this.isSelectable()) {
                    var edited = this.edited();
                    // cancel edit/save the changes
                    this.edit(edited, {
                        edit: false,
                        save: true
                    });
                }
            })).on('dblclick' + this._private.nameSpace, 'input[type=text]', function(e) {
                e.stopPropagation();
            });
        },
        // override _initHook
        _initHook: function() {
            if (this.isEditable()) {
                this._initEditable();
            }
            // call the parent
            this._super();
        },
        // return the edit field
        _editbox: function(item) {
            return item ? item.first().children('.aciTreeLine').find('input[type=text]') : $([]);
        },
        // add item edit field
        _addEditbox: function(item) {
            var line = item.first().addClass('aciTreeEdited').children('.aciTreeLine');
            var id = 'editable_' + window.String(this.getId(item)).replace(/[^a-z0-9_-]/ig, '');
            line.find('.aciTreeText').html('<input id="' + id + '" type="text" value="" />');
            line.find('label').attr('for', id);
            this._editbox(item).val(this.getLabel(item));
        },
        // remove item edit field
        _removeEditbox: function(item) {
            var line = item.first().removeClass('aciTreeEdited').children('.aciTreeLine');
            line.find('.aciTreeText').html(this.getLabel(item));
            line.find('label').removeAttr('for');
        },
        // get edited item
        edited: function() {
            return this._instance.jQuery.find('.aciTreeEdited:first');
        },
        // test if item is edited
        isEdited: function(item) {
            return item && item.first().hasClass('aciTreeEdited');
        },
        // set focus to the input
        _focusEdit: function(item) {
            var field = this._editbox(item).focus().trigger('click').get(0);
            if (field) {
                if (typeof field.selectionStart == 'number') {
                    field.selectionStart = field.selectionEnd = field.value.length;
                } else if (field.createTextRange !== undefined) {
                    var range = field.createTextRange();
                    range.collapse(false);
                    range.select();
                }
            }
        },
        // override setLabel
        setLabel: function(item, options) {
            options = this._options(options, function(item) {
                if (this.isEditable() && this.isEdited(item)) {
                    var focus = this._editbox(item).is(':focus');
                    // add the edit box
                    this._addEditbox(item);
                    if (focus) {
                        // focus on the input
                        this._focusEdit(item);
                    }
                }
            });
            this._super(item, options);
        },
        // item inplace edit/stop edit
        // options.edit is the new state
        // options.save tell if is to be saved
        edit: function(item, options) {
            options = this._options(options, null, function() {
                this._trigger(item, 'editfail', options);
            });
            if (this.isEditable() && this.isItem(item)) {
                // a way to cancel the edit
                if (!this._trigger(item, 'beforeedit', options)) {
                    this._fail(item, options);
                    return;
                }
                var edit = options.edit;
                var save = options.save;
                if (edit && this.isEdited(item)) {
                    // was edited already
                    if (save) {
                        var text = this._editbox(item).val();
                        this.setLabel(item, {
                            label: text
                        });
                    }
                    this._trigger(edited, 'wasedit', options);
                } else {
                    var edited = this.edited();
                    if (edited.length) {
                        // a item was edited
                        var text = this._editbox(edited).val();
                        this._removeEditbox(edited);
                        if (save) {
                            this.setLabel(edited, {
                                label: text
                            });
                        }
                        this._trigger(edited, 'editstop', options);
                    }
                    if (edit) {
                        // support selectable
                        if (this.isSelectable && !this.isSelected(item)) {
                            this.select(item, true);
                        }
                        this._addEditbox(item);
                        this._focusEdit(item);
                        this._trigger(item, 'editstart', options);
                    }
                }
                this._success(item, options);
            } else {
                this._fail(item, options);
            }
        },
        // test if editable is enabled
        isEditable: function() {
            return this._instance.options.editable;
        },
        // override set option
        option: function(option, value) {
            if (this.wasInit() && !this.isLocked()) {
                if ((option == 'editable') && (value != this.isEditable())) {
                    if (value) {
                        this._initEditable();
                    } else {
                        this._doneEditable();
                    }
                }
            }
            // call the parent
            this._super(option, value);
        },
        // done editable
        _doneEditable: function() {
            this._instance.jQuery.unbind(this._private.nameSpace);
            this._instance.jQuery.off(this._private.nameSpace, '.aciTreeItem');
            this._instance.jQuery.off(this._private.nameSpace, 'input[type=text]');
            var edited = this.edited();
            if (edited.length) {
                this.edit(edited, {
                    edit: false,
                    save: true
                });
            }
        },
        // override _destroyHook
        _destroyHook: function(unloaded) {
            if (unloaded) {
                this._doneEditable();
            }
            // call the parent
            this._super(unloaded);
        }

    };

    // extend the base aciTree class and add the editable stuff
    aciPluginClass.plugins.aciTree = aciPluginClass.plugins.aciTree.extend(aciTree_editable, 'aciTreeEditable');

    // add extra default options
    aciPluginClass.defaults('aciTree', options);

})(jQuery, this);
