
/*
 * aciTree jQuery Plugin v3.0.0-rc.5
 * http://acoderinsights.ro
 *
 * Copyright (c) 2013 Dragos Ursu
 * Dual licensed under the MIT or GPL Version 2 licenses.
 *
 * Require jQuery Library >= v1.7.1 http://jquery.com
 * + aciPlugin >= v1.1.1 https://github.com/dragosu/jquery-aciPlugin
 *
 * Date: Apr Mon 15 20:10 2013 +0200
 */

/*
 * This extension adds inplace edit support to aciTree.
 */

(function($){

    // extra default options

    var options = {
        editable: false                 // if TRUE then each item will be inplace editable
    };

    // aciTree editable extension
    // ads inplace item editing by pressing F2 key or mouse click (to enter edit mode)
    // press enter/escape to save/cancel the text edit

    var aciTree_editable = {

        // init editable
        _initEditable: function(){
            var _this = this;
            this._instance.jQuery.bind('acitree' + this._private.nameSpace, function(event, api, item, eventName, options){
                switch (eventName){
                    case 'blurred':
                        // support 'selectable' extension
                        var edited = api.edited();
                        api.edit(edited, false, true);
                        break;
                    case 'unselected':
                        // support 'selectable' extension
                        api.edit(item, false, true);
                        break;
                }
            }).bind('click' + this._private.nameSpace, function(){
                var edited = _this.edited();
                _this.edit(edited, {
                    edit: false,
                    save: true
                });
            }).bind('keydown' + this._private.nameSpace, function(e){
                switch (e.which){
                    case 113: // F2
                        // support 'selectable' extension
                        if (_this.isSelectable){
                            var selected = _this.selected();
                            _this.edit(selected, {
                                edit: true
                            });
                        }
                        break;
                }
            }).on('mouseup' + this._private.nameSpace, '.aciTreeItem', function(e){
                if ($(e.target).is('.aciTreeItem,.aciTreeText')){
                    var item = _this.itemFrom(e.target);
                    // support 'selectable' extension
                    if (_this.isSelectable && _this.isSelectable()){
                        if (_this.isSelected(item)){
                            _this.edit(item, {
                                edit: true
                            });
                        }
                    }
                }
            }).on('dblclick' + this._private.nameSpace, '.aciTreeItem', function(e){
                // support 'selectable' extension
                if (_this.isSelectable && !_this.isSelectable()){
                    var item = _this.itemFrom(e.target);
                    _this.edit(item, {
                        edit: true
                    });
                }
            }).on('keydown' + this._private.nameSpace, 'input[type=text]', function(e){
                // key handling
                switch (e.which){
                    case 13: // enter
                        var item = _this.itemFrom(e.target);
                        _this.edit(item, {
                            edit: false,
                            save: true
                        });
                        _this._instance.jQuery.focus();
                        e.stopPropagation();
                        break;
                    case 27: // escape
                        var item = _this.itemFrom(e.target);
                        _this.edit(item, {
                            edit: false
                        });
                        _this._instance.jQuery.focus();
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
            }).on('blur' + this._private.nameSpace, 'input[type=text]', function(){
                if (_this.isSelectable && !_this.isSelectable()){
                    var edited = _this.edited();
                    _this.edit(edited, {
                        edit: false,
                        save: true
                    });
                }
            }).on('dblclick' + this._private.nameSpace, 'input[type=text]', function(e){
                e.stopPropagation();
            });
        },

        // override _initHook
        _initHook: function(){
            if (this.isEditable()){
                this._initEditable();
            }
            // call the parent
            this._super();
        },

        // return the edit field
        _editbox: function(item){
            return item ? item.first().children('.aciTreeLine').find('input[type=text]') : $([]);
        },

        // add item edit field
        _addEditbox: function(item){
            var line = item.first().addClass('aciTreeEdited').children('.aciTreeLine');
            var id = 'editable_' + String(this.getId(item)).replace(/[^a-z0-9_-]/ig, '');
            line.find('.aciTreeText').html('<input id="' + id + '" type="text" value="" />');
            line.find('label').attr('for', id);
            this._editbox(item).val(this.getLabel(item));
        },

        // remove item edit field
        _removeEditbox: function(item){
            var line = item.first().removeClass('aciTreeEdited').children('.aciTreeLine');
            line.find('.aciTreeText').html(this.getLabel(item));
            line.find('label').removeAttr('for');
        },

        // get edited item
        edited: function(){
            return this._instance.jQuery.find('.aciTreeEdited:first');
        },

        // test if item is edited
        isEdited: function(item){
            return item && item.first().hasClass('aciTreeEdited');
        },

        // set focus to the input
        _focusEdit: function(item){
            var field = this._editbox(item).focus().trigger('click').get(0);
            if (field){
                if (typeof field.selectionStart == 'number') {
                    field.selectionStart = field.selectionEnd = field.value.length;
                } else if (typeof field.createTextRange != 'undefined') {
                    var range = field.createTextRange();
                    range.collapse(false);
                    range.select();
                }
            }
        },

        // override setLabel
        setLabel: function(item, options){
            options = this._options(options, function(item){
                if (this.isEditable() && this.isEdited(item)){
                    var focus = this._editbox(item).is(':focus');
                    this._addEditbox(item);
                    if (focus){
                        this._focusEdit(item);
                    }
                }
            });
            this._super(item, options);
        },

        // item inplace edit/stop edit
        // options.edit is the new state
        // options.save tell if is to be saved
        edit: function(item, options){
            options = this._options(options, null, function(){
                this._trigger(item, 'editfail', options);
            });
            if (this.isEditable() && this.isItem(item)){
                if (!this._trigger(item, 'beforeedit', options)){
                    this._fail(item, options);
                    return;
                }
                var edit = options.edit;
                var save = options.save;
                if (edit && this.isEdited(item)){
                    if (save){
                        var text = this._editbox(item).val();
                        this.setLabel(item, {
                            label: text
                        });
                    }
                    this._trigger(edited, 'wasedit', options);
                } else {
                    var edited = this.edited();
                    if (edited.length){
                        var text = this._editbox(edited).val();
                        this._removeEditbox(edited);
                        if (save){
                            this.setLabel(edited, {
                                label: text
                            });
                        }
                        this._trigger(edited, 'editstop', options);
                    }
                    if (edit) {
                        // support selectable
                        if (this.isSelectable && !this.isSelected(item)){
                            this.select(item, true);
                        }
                        this._addEditbox(item);
                        this._focusEdit(item);
                        this._trigger(item, 'editstart', options);
                    }
                }
                this._success(this, options);
            } else {
                this._fail(this, options);
            }
        },

        // test if editable is enabled
        isEditable: function(){
            return this._instance.options.editable;
        },

        // override set option
        option: function(option, value){
            if (this.wasInit() && !this.isLocked()){
                if ((option == 'editable') && (value != this.isEditable())) {
                    if (value){
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
        _doneEditable: function(){
            this._instance.jQuery.unbind(this._private.nameSpace);
            this._instance.jQuery.off(this._private.nameSpace, '.aciTreeItem');
            this._instance.jQuery.off(this._private.nameSpace, 'input[type=text]');
            var edited = this.edited();
            if (edited.length){
                this.edit(edited, {
                    edit: false,
                    save: true
                });
            }
        },

        // override _destroyHook
        _destroyHook: function(unloaded){
            this._doneEditable();
            // call the parent
            this._super(unloaded);
        }

    };

    // extend the base aciTree class and add the editable stuff
    aciPluginClass.plugins.aciTree = aciPluginClass.plugins.aciTree.extend(aciTree_editable, 'aciTreeEditable');

    // add extra default options
    aciPluginClass.defaults('aciTree', options);

})(jQuery);
