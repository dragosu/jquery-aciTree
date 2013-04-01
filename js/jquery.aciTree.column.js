
/*
 * aciTree jQuery Plugin v3.0.0-rc.3
 * http://acoderinsights.ro
 *
 * Copyright (c) 2013 Dragos Ursu
 * Dual licensed under the MIT or GPL Version 2 licenses.
 *
 * Require jQuery Library >= v1.7.1 http://jquery.com
 * + aciPlugin >= v1.1.1 https://github.com/dragosu/jquery-aciPlugin
 *
 * Date: Apr Mon 1 19:20 2013 +0200
 */

/*
 * This extension adds multiple column support to aciTree.
 *
 * In this version there is no extra public API functionality added, just
 * a new option: 'columnData' to tell what are the columns and show one or
 * more values that will be read from the 'itemData.props'.
 *
 * Column data is a array of column definitions, each column definition is
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
 * read from the 'itemData.props', if undefined or the
 * 'itemData.props[column.props]' is undefined, then a default value will be
 * set for the column: the 'value'.
 *
 */

(function($){

    // extra default options

    var options = {
        columnData: []                  // column definitions data
    };

    // aciTree columns extension
    // adds item columns, set width with CSS or using the API

    var aciTree_column = {

        // override _initHook
        _initHook: function(){
            // check column width
            var index = 0, width = 0, found = false, data;
            for(var i in this._instance.options.columnData){
                data = this._instance.options.columnData[i];
                if (typeof data.width != 'undefined') {
                    width += data.width;
                    found = true;
                } else {
                    // get it from CSS
                    width += this._getCss(['aciTree', 'aciTreeColumn' + index], 'width', true);
                }
                index++;
            }
            if (found){
                // at least a column width set
                var icon = this._getCss(['aciTree', 'aciTreeIcon'], 'width', true);
                this._updateCss('.aciTree .aciTreeItem', 'margin-right:' + (icon + width) + 'px;');
                this._updateCss('.aciTree[dir=rtl] .aciTreeItem', 'margin-left:' + (icon + width) + 'px;');
            }
            // call the parent
            this._super();
        },

        // read property value from a CSS class name
        _getCss: function(className, property, numeric){
            var id = '_getCss_' + String(className).replace(/[^a-z0-9_-]/ig, '_');
            var test = $('body').find('#' + id);
            if (!test.length){
                if (className instanceof Array){
                    var style = '', end = '';
                    for(var i in className){
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
            if (numeric){
                value = parseInt(value);
                if (isNaN(value)){
                    value = null;
                }
            }
            return value;
        },

        // dynamically change a CSS class definition
        _updateCss: function(className, definition){
            var id = '_updateCss_' + String(className).replace('>', '_gt_').replace(/[^a-z0-9_-]/ig, '_');
            var style = '<style id="' + id + '" type="text/css">' + className + '{' + definition + ';}</style>';
            var test = $('body').find('#' + id);
            if (test.length){
                test.replaceWith(style);
            } else {
                $('body').prepend(style);
            }
        },

        // override _itemHook
        _itemHook: function(parent, item, itemData, level){
            var position = item.children('.aciTreeLine').find('.aciTreeEntry');
            var index = 0, data, column;
            for(var i in this._instance.options.columnData){
                data = this._instance.options.columnData[i];
                column = this._createColumn(itemData, data, index);
                position.prepend(column);
                index++;
            }
            // call the parent
            this._super(parent, item, itemData, level);
        },

        _createColumn: function(itemData, columnData, index){
            var style = (typeof columnData.width != 'undefined') ? ' style="width:' + columnData.width + 'px"' : '';
            var value = columnData.props && itemData.props && (typeof itemData.props[columnData.props] != 'undefined') ? itemData.props[columnData.props] :
            ((typeof columnData.value == 'undefined') ? '' : columnData.value);
            return $('<div class="aciTreeColumn aciTreeColumn' + index + '"' + style + '>' + (value.length ? value : '&nbsp;') + '</div>');
        }

    };

    // extend the base aciTree class and add the columns stuff
    aciPluginClass.plugins.aciTree = aciPluginClass.plugins.aciTree.extend(aciTree_column, 'aciTreeColumn');

    // add extra default options
    aciPluginClass.defaults('aciTree', options);

})(jQuery);
