"use strict";

var fs = require( "fs" );
var path = require( "path" );
var needle = require( "needle" );
var mime = require( "mime" );
var newError = require( "./error" );

var URL_REGEX = /url\(\s*(?:"|')?(.+?)(?:"|')?\s*\)/;
var FORMAT_REGEX = /format\(\s*(?:"|')?(.+?)(?:"|')?\s*\)/;

module.exports = function parseDeclaration( file, decl, cb ) {
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
};