
/*
 * aciTree jQuery Plugin v3.6.0
 * http://acoderinsights.ro
 *
 * Copyright (c) 2013 Dragos Ursu
 * Dual licensed under the MIT or GPL Version 2 licenses.
 *
 * Require jQuery Library >= v1.7.1 http://jquery.com
 * + aciPlugin >= v1.5.0 https://github.com/dragosu/jquery-aciPlugin
 */

/*
 * This extension adds debug capabilities, for now it will just log the aciTree events.
 */

(function($, window, undefined) {

    // extra default options

    var options = {
        logTo: null        // selector for the element where to log the errors to
    };

    // aciTree debug extension

    var aciTree_debug = {
        __extend: function() {
            $.extend(this._private, {
                logTo: null
            });
            // call the parent
            this._super();
        },
        // init debug
        _initDebug: function() {
            if (this._instance.options.logTo) {
                this._private.logTo = $(this._instance.options.logTo);
            }
            this._instance.jQuery.bind('acitree' + this._private.nameSpace, this.proxy(function(event, api, item, eventName, options) {
                var message = 'aciTree event:' + eventName + ' for:' + (item ? api.getId(item) : 'ROOT') + ' uid:' + options.uid +
                        ' success:' + (options.success ? 'Y' : 'N') + ' fail:' + (options.fail ? 'Y' : 'N') + ' expand:' + (options.expand ? 'Y' : 'N') +
                        ' collapse:' + (options.collapse ? 'Y' : 'N') + ' unique:' + (options.unique ? 'Y' : 'N') + ' animated:' + (options.unanimated ? 'N' : 'Y');
                if (this._private.logTo) {
                    this._private.logTo.prepend(message.replace(/([^\s]+:)/g, '<span style="color:#888">$1</span>') + '<br>');
                } else if (console && console.log) {
                    console.log(message);
                } else {
                    throw new Error(message);
                }
            }));
        },
        // override _initHook
        _initHook: function() {
            this._initDebug();
            // call the parent
            this._super();
        },
        // override set option
        option: function(option, value) {
            if ((option == 'logTo') && (value != this._instance.options.logTo)) {
                this._private.logTo = value ? $(value) : null;
            }
            // call the parent
            this._super(option, value);
        },
        // done debug
        _doneDebug: function() {
            this._instance.jQuery.unbind(this._private.nameSpace);
        },
        // override _destroyHook
        _destroyHook: function(unloaded) {
            if (unloaded) {
                this._doneDebug();
            }
            // call the parent
            this._super(unloaded);
        }
    };

    // extend the base aciTree class and add the hash stuff
    aciPluginClass.plugins.aciTree = aciPluginClass.plugins.aciTree.extend(aciTree_debug, 'aciTreeDebug');

    // add extra default options
    aciPluginClass.defaults('aciTree', options);

})(jQuery, this);
