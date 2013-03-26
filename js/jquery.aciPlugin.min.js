
/*
 * aciPlugin little jQuery plugin helper v1.1.1
 * http://acoderinsights.ro
 *
 * Copyright (c) 2013 Dragos Ursu
 * Dual licensed under the MIT or GPL Version 2 licenses.
 *
 * Require jQuery Library >= v1.2.3 http://jquery.com
 *
 * Date: Tue Mar 19 20:30 2013 +0200
 */

(function(b){if(typeof aciPluginClass!="undefined"){return}var a;this.aciPluginClass=function(){};aciPluginClass.extend=function(d,g){f.extend=arguments.callee;function f(){if(a){this._instance={};return this.__construct.apply(this,arguments)}}a=false;f.prototype=new this();a=true;var e=this.prototype;for(var c in d){f.prototype[c]=(typeof d[c]=="function")?(function(h){return function(){var l=this._parent;this._parent=e;var k=this._super;this._super=e[h];var m=this._private;if(this._instance&&g){var j=this._instance._private;if(typeof j[g]=="undefined"){j[g]={nameSpace:"."+g}}this._private=j[g]}var i=d[h].apply(this,arguments);this._parent=l;this._super=k;this._private=m;return i}})(c):d[c]}return f};aciPluginClass.aciPluginUi=aciPluginClass.extend({__construct:function(h,i,f,e,g){var c="."+h;var d=i.data(c);if(d){this._instance=d._instance;return d.__request(f,e,g)}i.data(c,this);b.extend(this._instance,{_private:{},nameSpace:c,jQuery:i,options:b.extend({},b.fn[h].defaults,(typeof f=="object")?f:{}),wasInit:false});this.__extend();return this.__request(f,e,g)},__extend:function(){},__request:function(d,c,e){if((typeof d=="undefined")||(typeof d=="object")){if(this._instance.options.autoInit){this.init()}}else{if(typeof d=="string"){switch(d){case"init":this.init();break;case"api":return{object:this};case"options":if(typeof c=="undefined"){return{object:this.options()}}else{if(typeof c=="string"){return{object:this.options(c)}}else{this.options(c)}}break;case"option":this.option(c,e);break;case"destroy":this.destroy();break}}}return this._instance.jQuery},init:function(){if(!this._instance.wasInit){this._instance.wasInit=true;return true}return false},wasInit:function(){return this._instance.wasInit},options:function(c){if(c){if(typeof c=="string"){return this._instance.options[c]}else{for(var d in c){this.option(d,c[d])}}}else{return this._instance.options}},option:function(c,d){this._instance.options[c]=d},destroy:function(){if(this._instance.wasInit){this._instance.wasInit=false;this._instance.jQuery.removeData(this._instance.nameSpace);return true}return false}});aciPluginClass.plugins={};aciPluginClass.publish=function(c,d){b.fn[c]=function(f,j,k){var e=null;for(var h=0,g=this.length;h<g;h++){e=new aciPluginClass.plugins[c](c,b(this[h]),f,j,k);if(!(e instanceof jQuery)){return e.object}}return this};b.fn[c].defaults=b.extend({autoInit:true},(typeof d=="object")?d:{})};aciPluginClass.defaults=function(c,d){b.extend(b.fn[c].defaults,(typeof d=="object")?d:{})}})(jQuery);
