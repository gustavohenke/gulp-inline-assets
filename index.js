var fs = require( "fs" );
var path = require( "path" );

var css = require( "css" );
var gutil = require( "gulp-util" );
var needle = require( "needle" );
var through = require( "through2" );
var mime = require( "mime" );

var URL_REGEX = /url\(\s*(?:"|')?(.+?)(?:"|')?\s*\)/;
var FORMAT_REGEX = /format\(\s*(?:"|')?(.+?)(?:"|')?\s*\)/;

function newError( msg ) {
    return new gutil.PluginError( "gulp-inline-assets", msg );
}

function parseDeclaration( file, decl, cb ) {
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
        var formattedUrl, url, format, stream, type;
        var dataUri = "";

        part = part.trim();
        url = part.match( URL_REGEX );
        format = part.match( FORMAT_REGEX );

        // If no URL is specified, let's ignore it
        if ( !url ) {
            count++;
            return finish();
        }

        url = url[ 1 ].trim();
        format = format ? format[ 1 ].trim() : null;

        if ( /^(?:http|\/\/)/.test( url ) ) {
            formattedUrl = url.replace( /^\/\//, "http://" );
            stream = needle.get( formattedUrl, {
                compressed: true
            }, function ( err, response ) {
                var status;

                if ( err ) {
                    return cb( newError( "Could not fetch " + formattedUrl + " - " + err.code ) );
                }

                // Validate the status code we received
                status = response.statusCode;
                if ( status < 200 || status > 299 ) {
                    return cb( newError(
                        "Could not fetch " + formattedUrl +
                        " - status " + status
                    ));
                }

                type = response.headers[ "content-type" ];
            });
        } else {
            formattedUrl = path.resolve( path.dirname( file.path ), url );
            stream = fs.createReadStream( formattedUrl );
            stream.on( "error", function () {
                cb( newError( "Could not read file: " + formattedUrl ) );
            });

            // Use the mime type based in the format first, and then the file extension, if we're
            // not dealing with a @font-face rule
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

function iterate( file, ast, cb ) {
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
        iterator( file, item, function ( err ) {
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

module.exports = function() {
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

        iterate( file, ast, function ( err ) {
            if ( err ) {
                return cb( err );
            }

            file.contents = new Buffer( css.stringify( ast ) );
            cb( null, file );
        });
    });
};