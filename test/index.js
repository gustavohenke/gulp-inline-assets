var assert = require( "assert" );
var fs = require( "fs" );
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

    it( "should fetch local resources", function ( cb ) {
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

    it( "should fetch external resources starting with http://", function ( cb ) {
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

    it( "should fetch external resources starting with //", function ( cb ) {
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