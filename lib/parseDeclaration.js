"use strict";

var fs = require( "fs" );
var path = require( "path" );
var url = require( "url" );
var needle = require( "needle" );
var mime = require( "mime" );

var URL_REGEX = /url\(\s*(?:"|')?(.+?)(?:"|')?\s*\)/;
var FORMAT_REGEX = /format\(\s*(?:"|')?(.+?)(?:"|')?\s*\)/;

module.exports = parseDeclaration;

function parseDeclaration( file, decl, options, cb ) {
    var count = 0;
    var valueParts = decl.value;
    var finish = function () {
        count++;
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
        var url, format;

        part = part.trim();
        url = part.match( URL_REGEX );
        format = part.match( FORMAT_REGEX );

        // If no URL is specified, let's ignore it
        if ( !url ) {
            return finish();
        }

        url = url[ 1 ].trim();
        format = format ? format[ 1 ].trim() : null;

        read( file, url, format, function ( err, result ) {
            var data;
            if ( err ) {
                return options.ignoreErrors !== true ? cb( err ) : finish();
            }

            data = "data:" + result.type + ";base64," + result.contents.toString( "base64" );
            valueParts[ i ] = part.replace( url, data );
            finish();
        });
    });
}

function read ( file, url, format, cb ) {
    var stream, type;
    var contents = [];

    if ( /^(?:http|\/\/)/.test( url ) ) {
        url = formatExternalUrl( url );
        stream = needle.get( url, {
            compressed: true,
            rejectUnauthorized: false
        }, function ( err, response ) {
            var status;
            if ( err ) {
                return cb( new Error( "Could not fetch " + url ) );
            }

            // Validate the status code we received
            status = response.statusCode;
            if ( status < 200 || status > 299 ) {
                return cb( new Error( "Could not fetch " + url +  " - status " + status ) );
            }

            type = response.headers[ "content-type" ];
        });
    } else {
        url = formatLocalUrl( file, url );
        stream = fs.createReadStream( url );
        stream.on( "error", function () {
            cb( new Error( "Could not read file: " + url ) );
        });

        // Use the mime type based in the format first, and then the file extension, if we're
        // not dealing with a @font-face rule
        type = mime.lookup( format || url );
    }

    stream.on( "data", function ( chunk ) {
        contents.push( chunk );
    });

    stream.on( "end", function () {
        // Use a timeout to ensure that needle's callback will run before this function
        setTimeout(function () {
            cb( null, {
                type: type,
                contents: Buffer.concat( contents )
            });
        }, 0 );
    });
}

function formatExternalUrl ( str ) {
    return str.replace( /^\/\//, "https://" );
}

function formatLocalUrl ( file, str ) {
    // Fonts generally contain a hash/query string, so we'll remove them before we read that file
    var urlObj = url.parse( str );
    delete urlObj.hash;
    delete urlObj.search;
    delete urlObj.query;

    str = url.format( urlObj );
    return path.resolve( path.dirname( file.path ), str );
}