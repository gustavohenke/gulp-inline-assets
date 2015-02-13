"use strict";

var css = require( "css" );
var gutil = require( "gulp-util" );
var through = require( "through2" );
var parseDeclaration = require( "./lib/parseDeclaration" );

function iterate( file, ast, options, cb ) {
    var iterable, iterator;
    var count = 0;

    switch ( ast.type ) {
        case "font-face":
            iterable = ast.declarations;
            iterator = parseDeclaration;
            break;

        case "stylesheet":
            ast = ast.stylesheet;

        case "document":
        case "host":
        case "media":
        case "supports":
            iterable = ast.rules;
            iterator = iterate;
            break;
    }

    // If there's nothing to iterate, invoke the callback soon
    if ( !iterable || !iterable.length ) {
        return cb();
    }

    iterable.forEach(function ( item ) {
        var finished = false;
        iterator( file, item, options, function ( err ) {
            count++;

            // If we aren't finished yet but there's an error or the last iteration happened,
            // then this means we're good to invoke the callback
            if ( !finished && ( err || count === iterable.length ) ) {
                cb( err );
                finished = true;
            }
        });
    });
}

module.exports = function( options ) {
    return through.obj(function ( file, enc, cb ) {
        var str, ast;

        if ( file.isNull() ) {
            return cb( null, file );
        }

        str = file.contents.toString( "utf8" );

        try {
            ast = css.parse( str );
        } catch ( e ) {
            // If some error occurs while parsing the file, we'll not do anything with it
            return cb( null, file );
        }

        iterate( file, ast, options || {}, function ( err ) {
            if ( err ) {
                return cb( new gutil.PluginError( "gulp-inline-assets", err.message ) );
            }

            file.contents = new Buffer( css.stringify( ast ) );
            cb( null, file );
        });
    });
};