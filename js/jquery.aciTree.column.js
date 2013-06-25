
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
 * This extension adds multiple column support to aciTree.
 *
 * The 'columnData' option is used to tell what are the columns and show one or
 * more values that will be read from the 'itemData'.
 *
 * Column data is an array of column definitions, each column definition is
 * one object:
 *
 * {
 *   width: 100,
 *   props: 'column_x',
 *   value: 'default'
 * }
 *
 * where the 'width' is the column width in [px], if undefined - then the value
 * from the CSS will be used; the 'props' is the property name that will be
 * read from the 'itemData', if undefined or the 'itemData[column.props]'
 * is undefined, then a default value will be set for the column: the 'value'.
 *
 */

(function($, window, undefined) {

    // extra default options

    var options = {
        columnData: []                  // column definitions data
    };

    // aciTree columns extension
    // adds item columns, set width with CSS or using the API

    var aciTree_column = {
        // override _initHook
        _initHook: function() {
            if (this._instance.options.columnData.length) {
                // check column width
                var index = 0, found = false, data;
                for (var i in this._instance.options.columnData) {
                    data = this._instance.options.columnData[i];
                    if (data.width !== undefined) {
                        // update column width
                        this._updateCss('.aciTree.aciTree' + this._instance.index + ' .aciTreeColumn' + index, 'width:' + data.width + 'px;');
                        found = true;
                    }
                    index++;
                }
                if (found) {
                    // at least a column width set
                    this._updateWidth();
                }
            }
            // call the parent
            this._super();
        },
        // read property value from a CSS class name
        _getCss: function(className, property, numeric) {
            var id = '_getCss_' + window.String(className).replace(/[^a-z0-9_-]/ig, '_');
            var test = $('body').find('#' + id);
            if (!test.length) {
                if (className instanceof Array) {
                    var style = '', end = '';
                    for (var i in className) {
                        style += '<div class="' + className[i] + '">';
                        end += '</div>';
                    }
                    style += end;
                } else {
                    var style = '<div class="' + className + '"></div>';
                }
                $('body').append('<div id="' + id + '" style="position:relative;width:0px;height:0px;line-height:0px">' + style + '</div>');
                test = $('body').find('#' + id);
            }
            var value = test.find('*:last').css(property);
            if (numeric) {
                value = parseInt(value);
                if (isNaN(value)) {
                    value = null;
                }
            }
            return value;
        },
        // dynamically change a CSS class definition
        _updateCss: function(className, definition) {
            var id = '_updateCss_' + window.String(className).replace('>', '_gt_').replace(/[^a-z0-9_-]/ig, '_');
            var style = '<style id="' + id + '" type="text/css">' + className + '{' + definition + '}</style>';
            var test = $('body').find('#' + id);
            if (test.length) {
                test.replaceWith(style);
            } else {
                $('body').prepend(style);
            }
        },
        // get column width by index (0 based)
        getWidth: function(column) {
            if (column < this._instance.options.columnData.length) {
                return this._getCss(['aciTree aciTree' + this._instance.index, 'aciTreeColumn' + column], 'width', true);
            }
            return null;
        },
        // set column width by index (0 based)
        setWidth: function(column, width) {
            if (column < this._instance.options.columnData.length) {
                this._updateCss('.aciTree.aciTree' + this._instance.index + ' .aciTreeColumn' + column, 'width:' + width + 'px;');
                this._updateWidth();
            }
        },
        // update item margins
        _updateWidth: function() {
            var index = 0, width = 0;
            for (var i in this._instance.options.columnData) {
                if (this.isColumn(index)) {
                    width += this.getWidth(index);
                }
                index++;
            }
            var icon = this._getCss(['aciTree', 'aciTreeIcon'], 'width', true);
            // add item padding
            width += this._getCss(['aciTree', 'aciTreeItem'], 'padding-left', true) + this._getCss(['aciTree', 'aciTreeItem'], 'padding-right', true);
            this._updateCss('.aciTree.aciTree' + this._instance.index + ' .aciTreeItem', 'margin-right:' + (icon + width) + 'px;');
            this._updateCss('.aciTree[dir=rtl].aciTree' + this._instance.index + ' .aciTreeItem', 'margin-right:0;margin-left:' + (icon + width) + 'px;');
        },
        // test if column is visible by index (0 based)
        isColumn: function(column) {
            if (column < this._instance.options.columnData.length) {
                return this._getCss(['aciTree aciTree' + this._instance.index, 'aciTreeColumn' + column], 'display') != 'none';
            }
            return false;
        },
        // set column by index (0 based) to be visible or hidden
        // if show is undefined then the column visibility will be toggled
        toggleColumn: function(column, show) {
            if (column < this._instance.options.columnData.length) {
                if (show === undefined) {
                    var show = !this.isColumn(column);
                }
                this._updateCss('.aciTree.aciTree' + this._instance.index + ' .aciTreeColumn' + column, 'display:' + (show ? 'inherit' : 'none') + ';');
                this._updateWidth();
            }
        },
        // override _itemHook
        _itemHook: function(parent, item, itemData, level) {
            if (this._instance.options.columnData.length) {
                var position = item.children('.aciTreeLine').find('.aciTreeEntry');
                var index = 0, data, column;
                for (var i in this._instance.options.columnData) {
                    data = this._instance.options.columnData[i];
                    column = this._createColumn(itemData, data, index);
                    position.prepend(column);
                    index++;
                }
            }
            // call the parent
            this._super(parent, item, itemData, level);
        },
        // create column markup
        _createColumn: function(itemData, columnData, index) {
            var value = columnData.props && (itemData[columnData.props] !== undefined) ? itemData[columnData.props] :
                    ((columnData.value === undefined) ? '' : columnData.value);
            return $('<div class="aciTreeColumn aciTreeColumn' + index + '">' + (value.length ? value : '&nbsp;') + '</div>');
        }

    };

    // extend the base aciTree class and add the columns stuff
    aciPluginClass.plugins.aciTree = aciPluginClass.plugins.aciTree.extend(aciTree_column, 'aciTreeColumn');

    // add extra default options
    aciPluginClass.defaults('aciTree', options);

})(jQuery, this);
