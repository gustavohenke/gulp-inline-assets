"use strict";
var gutil = require( "gulp-util" );

module.exports = function newError ( msg ) {
    return new gutil.PluginError( "gulp-inline-assets", msg );
};