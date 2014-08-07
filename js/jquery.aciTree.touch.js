
/*
 * aciTree jQuery Plugin v4.5.0-rc.7
 * http://acoderinsights.ro
 *
 * Copyright (c) 2014 Dragos Ursu
 * Dual licensed under the MIT or GPL Version 2 licenses.
 *
 * Require jQuery Library >= v1.9.0 http://jquery.com
 * + aciPlugin >= v1.5.1 https://github.com/dragosu/jquery-aciPlugin
 */

/*
 * This extension adds touch events support.
 * Require touchSwipe https://github.com/mattbryson/TouchSwipe-Jquery-Plugin
 */

(function($, window, undefined) {

    // extra default options

    var options = {
    };

    // aciTree touch extension

    var aciTree_touch = {
        __extend: function() {
            // add extra data
            $.extend(this._private, {
                openTimeout: null,
                dragDrop: null // the items used in drag & drop
            });
            // call the parent
            this._super();
        },
        // init touch
        _touchInit: function() {
            
        },
        // override `_initHook`
        _initHook: function() {
            this._touchInit();
            // call the parent
            this._super();
        },
        // override set `option`
        option: function(option, value) {
            if (this.wasInit() && !this.isLocked()) {
                if ((option == 'touch') && (value != this.extTouch())) {
                    if (value) {
                        this._touchInit();
                    } else {
                        this._touchDone();
                    }
                }
            }
            // call the parent
            this._super(option, value);
        },
        // done touch
        _touchDone: function() {

        },
        // override `_destroyHook`
        _destroyHook: function(unloaded) {
            this._touchDone();
            // call the parent
            this._super(unloaded);
        }
    };

    // extend the base aciTree class and add the touch stuff
    aciPluginClass.plugins.aciTree = aciPluginClass.plugins.aciTree.extend(aciTree_touch, 'aciTreeTouch');

    // add extra default options
    aciPluginClass.defaults('aciTree', options);

})(jQuery, this);
