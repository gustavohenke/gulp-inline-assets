var assert = require( "assert" );
var fs = require( "fs" );
var path = require( "path" );
var http = require( "http" );
var gutil = require( "gulp-util" );
var inline = require( "../" );

var fixture = function ( file ) {
    var path = __dirname + "/fixtures/" + file;
    return new gutil.File({
        cwd: __dirname,
        base: __dirname + "/fixtures/" + file.substring( 0, file.lastIndexOf( "/" ) ),
        path: path,
        contents: fs.readFileSync( path )
    });
};

var server = http.createServer(function ( req, res ) {
    res.statusCode = 200;
    res.setHeader( "content-type", "application/font-woff" );
    fs.createReadStream( __dirname + "/fixtures/font.woff" ).pipe( res );
}).listen( 8765 );

describe( "", function () {
    after(function () {
        server.close();
    });

    describe( "local resources", function () {
        it( "should be fetched", function ( cb ) {
            var stream = inline();

            stream.on( "data", function ( file ) {
                assert.equal(
                    file.contents.toString( "utf8" ),
                    fs.readFileSync( __dirname + "/expected/output.css", "utf8" )
                );
                cb();
            });
            stream.write( fixture( "local.css" ) );
        });

        it( "should be fetched when they are unquoted", function ( cb ) {
            var stream = inline();

            stream.on( "data", function ( file ) {
                assert.equal(
                    file.contents.toString( "utf8" ),
                    fs.readFileSync( __dirname + "/expected/unquoted.css", "utf8" )
                );
                cb();
            });
            stream.write( fixture( "unquoted.css" ) );
        });

        it( "should trigger error when they're not available", function ( cb ) {
            var stream = inline();

            stream.on( "data", function ( file ) {
                assert.fail( file, null, "should not emit file", "==" );
                cb();
            }).on( "error", function ( err ) {
                assert.equal(
                    err.message,
                    "Could not read file: " +
                    path.join( __dirname, "fixtures", "font-unavailable.woff" )
                );
                cb();
            });
            stream.write( fixture( "local-unavailable.css" ) );
        });
    });

    describe( "external resources", function () {
        it( "should be fetched when they start with http://", function ( cb ) {
            var stream = inline();

            stream.on( "data", function ( file ) {
                assert.equal(
                    file.contents.toString( "utf8" ),
                    fs.readFileSync( __dirname + "/expected/output.css", "utf8" )
                );
                cb();
            });
            stream.write( fixture( "remote1.css" ) );
        });

        it( "should be fetched when they start with //", function ( cb ) {
            var stream = inline();

            stream.on( "data", function ( file ) {
                assert.equal(
                    file.contents.toString( "utf8" ),
                    fs.readFileSync( __dirname + "/expected/output.css", "utf8" )
                );
                cb();
            });
            stream.write( fixture( "remote2.css" ) );
        });

        it( "should trigger error when they're not available", function ( cb ) {
            var stream = inline();

            stream.on( "data", function ( file ) {
                assert.fail( file, null, "should not emit file", "==" );
                cb();
            }).on( "error", function ( err ) {
                assert.equal(
                    err.message,
                    "Could not fetch http://localhost:8766/"
                );
                cb();
            });
            stream.write( fixture( "remote-unavailable.css" ) );
        });
    });

    it( "should ignore unknown formats", function ( cb ) {
        var stream = inline();
        stream.on( "data", function ( file ) {
            assert.equal(
                file.contents.toString( "utf8" ),
                fs.readFileSync( __dirname + "/fixtures/unknown-format", "utf8" )
            );
            cb();
        });
        stream.write( fixture( "unknown-format" ) );
    });
});