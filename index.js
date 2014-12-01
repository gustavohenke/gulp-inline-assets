var fs = require( "fs" );
var path = require( "path" );

var css = require( "css" );
var needle = require( "needle" );
var through = require( "through2" );
var mime = require( "mime" );

var CURRENT_DIR = "/";
var URL_REGEX = /url\(\s+(?:"|')(.+?)(?:"|')\s+\)/;
var FORMAT_REGEX = /format\(\s+(?:"|')(.+?)(?:"|')\s+\)/;

function parseDeclaration( decl, cb ) {
    var count = 0;
    var valueParts = decl.value;
    var finish = function () {
        if ( count === valueParts.length ) {
            decl.value = valueParts.join( "," );
            cb();
        }
    };

    if ( decl.property !== "src" ) {
        return cb();
    }

    valueParts = valueParts.split( "," );
    valueParts.forEach(function ( part, i ) {
        var url, format, stream, type;
        var dataUri = "";

        part = part.trim();
        url = part.match( URL_REGEX )[ 1 ];
        format = part.match( FORMAT_REGEX )[ 1 ];

        if ( !url || !format ) {
            count++;
            return finish();
        }

        if ( /^http|\/\//.test( url ) ) {
            url = url.replace( /^\/\//, "http://" );
            stream = needle.get( url, {
                compressed: true
            }, function ( err, response ) {
                type = response.headers[ "content-type" ];
            });
        } else {
            stream = fs.createReadStream( path.join( CURRENT_DIR, url ) );
            type = mime.lookup( format || url );
        }

        stream.on( "readable", function () {
            var data;
            while ( data = this.read() ) {
                dataUri += data.toString( "base64" );
            }
        });

        stream.on( "end", function () {
            setTimeout(function () {
                count++;
                dataUri = "data:" + type + ";base64," + dataUri;
                valueParts[ i ] = part.replace( url, dataUri );

                finish();
            }, 0 );
        });
    });
}

function iterate( ast, cb ) {
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
        iterator( item, function () {
            count++;

            if ( count === iterable.length ) {
                cb();
            }
        });
    });
}

module.exports = function() {
    return through.obj(function ( file, enc, cb ) {
        var str, ast;

        if ( file.isNull() ) {
            cb( null, file );
            return;
        }

        CURRENT_DIR = file.base;
        str = file.contents.toString( "utf8" );
        ast = css.parse( str );

        iterate( ast, function () {
            file.contents = new Buffer( css.stringify( ast ) );
            cb( null, file );
        });
    });
};