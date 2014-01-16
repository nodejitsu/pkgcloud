/*
 * storage-object-test.js: Tests for Rackspace Cloudfiles containers
 *
 * (C) 2010 Nodejitsu Inc.
 * MIT LICENSE
 *
 */

var path = require('path'),
  fs = require('fs'),
  should = require('should'),
  pkgcloud = require('../../../lib/pkgcloud'),
  helpers = require('../../helpers'),
  async = require('async'),
  hock = require('hock'),
  File = require('../../../lib/pkgcloud/core/storage/file').File,
  mock = !!process.env.MOCK,
  Buffer = require("buffer").Buffer;

if (!mock) {
  return; // these tests are disabled when running for real
}

describe('pkgcloud/rackspace/storage/storage-object', function () {
  describe('The pkgcloud Rackspace Storage client', function () {

    var client, server, authServer;

    /**
     * Generates a container file list response of specified size for large container tests.
     * Results remain alphabetical by appending incrementing numbers to the file names, e.g. FILE00000, FILE019999.
     * @param start
     * @param end
     * @returns {Array}
     */
    var generateFilesResponse = function (start, end) {
      var files = [];
      function padToFive(number) {
        if (number<=99999) { number = ("0000"+number).slice(-5); }
        return number;
      }

      for (var i = start; i < end; i++) {
        files.push({
          "hash": "cb5c530452af82fb875dc0fb1a00a2c4",
          "last_modified": "2013-05-20T22:48:08.059180",
          "bytes": 2027,
          "name": "FILE" + padToFive(i),
          "content_type": "application/octet-stream"
        });
      }

      return files;
    };

    before(function (done) {
      client = helpers.createClient('rackspace', 'storage');

      if (!mock) {
        return done();
      }

      async.parallel([
        function (next) {
          hock.createHock(12346, function (err, hockClient) {
            should.not.exist(err);
            should.exist(hockClient);

            authServer = hockClient;
            next();
          });
        },
        function (next) {
          hock.createHock(12345, function (err, hockClient) {
            should.not.exist(err);
            should.exist(hockClient);

            server = hockClient;
            next();
          });
        }
      ], done);
    });

    it('getFiles should return a list of files', function (done) {

      if (mock) {
        authServer
          .post('/v2.0/tokens', {
            auth: {
              'RAX-KSKEY:apiKeyCredentials': {
                username: 'MOCK-USERNAME',
                apiKey: 'MOCK-API-KEY'
              }
            }
          })
          .reply(200, helpers.getRackspaceAuthResponse());

        server
          .get('/v1/MossoCloudFS_00aa00aa-aa00-aa00-aa00-aa00aa00aa00/0.1.7-215?format=json')
          .replyWithFile(200, __dirname + '/../../fixtures/rackspace/getFiles.json');
      }

      client.getFiles('0.1.7-215', function (err, files) {
        should.not.exist(err);
        should.exist(files);
        files.should.have.length(5);
        files.forEach(function (f) {
          f.should.be.instanceof(File);
        });
        authServer && authServer.done();
        server && server.done();
        done();
      });
    });

    it('getFiles with undefined limit should return up to 10,000 files', function (done) {

      if (!mock) {
        return done();
      }

      server
        .get('/v1/MossoCloudFS_00aa00aa-aa00-aa00-aa00-aa00aa00aa00/0.1.7-215?format=json')
        .reply(200, generateFilesResponse(0, 10000));

      client.getFiles('0.1.7-215', function (err, files) {
        should.not.exist(err);
        should.exist(files);
        files.length.should.equal(10000);
        server && server.done();
        done();
      });
    });

    it('getFiles with limit should return reduced set', function (done) {

      if (mock) {
        server
          .get('/v1/MossoCloudFS_00aa00aa-aa00-aa00-aa00-aa00aa00aa00/0.1.7-215?format=json&limit=3')
          .replyWithFile(200, __dirname + '/../../fixtures/rackspace/getContainersLimit.json');
      }

      client.getFiles('0.1.7-215', { limit: 3 }, function (err, files) {
        should.not.exist(err);
        should.exist(files);
        files.should.have.length(3);
        files.forEach(function (f) {
          f.should.be.instanceof(File);
        });
        server && server.done();
        done();
      });
    });

    it('getFiles with limit > 10,000 should make multiple requests as necessary', function (done) {

      if (!mock) {
        return done();
      }

      server
        .get('/v1/MossoCloudFS_00aa00aa-aa00-aa00-aa00-aa00aa00aa00/0.1.7-215?format=json')
        .reply(200, generateFilesResponse(0, 10000))
        .get('/v1/MossoCloudFS_00aa00aa-aa00-aa00-aa00-aa00aa00aa00/0.1.7-215?format=json&marker=FILE09999')
        .reply(200, generateFilesResponse(10000, 20000))
        .get('/v1/MossoCloudFS_00aa00aa-aa00-aa00-aa00-aa00aa00aa00/0.1.7-215?format=json&limit=3400&marker=FILE19999')
        .reply(200, generateFilesResponse(20000, 23400));

      client.getFiles('0.1.7-215', { limit: 23400 }, function (err, files) {
        should.not.exist(err);
        should.exist(files);
        files.should.have.length(23400);
        server && server.done();
        done();
      });
    });

    it('getFiles with limit = Infinity should return all files', function (done) {

      if (!mock) {
        return done();
      }

      server
        .get('/v1/MossoCloudFS_00aa00aa-aa00-aa00-aa00-aa00aa00aa00/0.1.7-215?format=json')
        .reply(200, generateFilesResponse(0, 10000))
        .get('/v1/MossoCloudFS_00aa00aa-aa00-aa00-aa00-aa00aa00aa00/0.1.7-215?format=json&marker=FILE09999')
        .reply(200, generateFilesResponse(10000, 20000))
        .get('/v1/MossoCloudFS_00aa00aa-aa00-aa00-aa00-aa00aa00aa00/0.1.7-215?format=json&marker=FILE19999')
        .reply(200, []);

      client.getFiles('0.1.7-215', { limit: Infinity }, function (err, files) {
        should.not.exist(err);
        should.exist(files);
        files.should.have.length(20000);
        server && server.done();
        done();
      });
    });

    it('getFiles with marker should start offset appropriately', function (done) {

      if (mock) {
        server
          .get('/v1/MossoCloudFS_00aa00aa-aa00-aa00-aa00-aa00aa00aa00/0.1.7-215?format=json&marker=ubuntu-10.04-x86_64%2Fconf%2Fdistributions')
          .replyWithFile(200, __dirname + '/../../fixtures/rackspace/getFilesMarker.json');
      }

      client.getFiles('0.1.7-215', { marker: 'ubuntu-10.04-x86_64/conf/distributions' }, function (err, files) {
        should.not.exist(err);
        should.exist(files);
        files.should.have.length(1);
        files.forEach(function (f) {
          f.should.be.instanceof(File);
        });
        server && server.done();
        done();
      });
    });

    it('getFiles with marker and limit should start offset appropriately', function (done) {

      if (mock) {
        server
          .get('/v1/MossoCloudFS_00aa00aa-aa00-aa00-aa00-aa00aa00aa00/0.1.7-215?format=json&limit=4&marker=CHANGELOG')
          .replyWithFile(200, __dirname + '/../../fixtures/rackspace/getFilesLimitMarker.json');
      }

      client.getFiles('0.1.7-215', { limit: 4, marker: 'CHANGELOG' }, function (err, files) {
        should.not.exist(err);
        should.exist(files);
        files.should.have.length(4);
        files.forEach(function (f) {
          f.should.be.instanceof(File);
        });
        server && server.done();
        done();
      });
    });

    it('getFile should URL encode the file name', function (done) {
      if (mock) {
        server
          .head('/v1/MossoCloudFS_00aa00aa-aa00-aa00-aa00-aa00aa00aa00/0.1.7-215/~!%40%23%24%25%5E%26*()_%2B/~!%40%23%24%25%5E%26*()_%2B?format=json')
          .reply(200);
      }

      client.getFile('0.1.7-215', '~!@#$%^&*()_+/~!@#$%^&*()_+', function (err, file) {
        should.not.exist(err);
        should.exist(file);
        file.should.be.instanceof(File);
        server && server.done();
        done();
      });
    });

    it('upload should complete successfully when returned checksum matches - local file upload', function (done) {
      var filepath = __dirname + '/../../fixtures/fillerama.txt';

      if (mock) {
        server
          .put('/v1/MossoCloudFS_00aa00aa-aa00-aa00-aa00-aa00aa00aa00/0.1.7-215/upload.txt', fs.readFileSync(filepath, 'utf8'))
          .reply(201, '', {
            ETag: '9b0d0a115145c13f1281818adc2bbcbe'
          });
      }

      client.upload({
        container: '0.1.7-215',
        remote: 'upload.txt',
        local: filepath
      }, function (err, result) {
        should.not.exist(err);
        server && server.done();
        done();
      });
    });

    it('upload should complete successfully when returned checksum matches - stream upload', function (done) {
      var filepath = __dirname + '/../../fixtures/fillerama.txt';

      if (mock) {
        server
          .put('/v1/MossoCloudFS_00aa00aa-aa00-aa00-aa00-aa00aa00aa00/0.1.7-215/upload.txt', fs.readFileSync(filepath, 'utf8'))
          .reply(201, '', {
            ETag: '9b0d0a115145c13f1281818adc2bbcbe'
          });
      }

      var stream = client.upload({
        container: '0.1.7-215',
        remote: 'upload.txt'
      }, function (err, result) {
        should.not.exist(err);
        server && server.done();
        done();
      });

      fs.createReadStream(filepath).pipe(stream);
    });

    it('upload should remove file and return error on checksum mismatch - local file upload', function (done) {
      var filepath = __dirname + '/../../fixtures/fillerama.txt';

      if (mock) {
        server
          .put('/v1/MossoCloudFS_00aa00aa-aa00-aa00-aa00-aa00aa00aa00/0.1.7-215/upload.txt', fs.readFileSync(filepath, 'utf8'))
          .reply(201, '', {
            ETag: '12bad12bad12bad12bad12bad12bad12'
          })
          .delete('/v1/MossoCloudFS_00aa00aa-aa00-aa00-aa00-aa00aa00aa00/0.1.7-215/upload.txt')
          .reply(204);
      }

      client.upload({
        container: '0.1.7-215',
        remote: 'upload.txt',
        local: filepath
      }, function (err, result) {
        should.exist(err);
        err.should.be.an.instanceOf(Error);
        server && server.done();
        done();
      });
    });

    it('upload should remove file and return error on checksum mismatch - stream upload', function (done) {
      var filepath = __dirname + '/../../fixtures/fillerama.txt';

      if (mock) {
        server
          .put('/v1/MossoCloudFS_00aa00aa-aa00-aa00-aa00-aa00aa00aa00/0.1.7-215/upload.txt', fs.readFileSync(filepath, 'utf8'))
          .reply(201, '', {
            ETag: '12bad12bad12bad12bad12bad12bad12'
          })
          .delete('/v1/MossoCloudFS_00aa00aa-aa00-aa00-aa00-aa00aa00aa00/0.1.7-215/upload.txt')
          .reply(204);
      }

      var stream = client.upload({
        container: '0.1.7-215',
        remote: 'upload.txt'
      }, function (err, result) {
        should.exist(err);
        err.should.be.an.instanceOf(Error);
        server && server.done();
        done();
      });

      fs.createReadStream(filepath).pipe(stream);
    });

    it('extract should ask server to extract the uploaded tar file', function(done) {
      
      var data = "H4sIABub81EAA+3TzUrEMBAH8CiIeNKTXvMC1nxuVzx58CiC9uBNam1kQZt1N4X1XXwDX9IJXVi6UDxo6sH/D4akadJOmY7z/owlJkhubTdOulEo040dJpXMTS6tjuuSriTjNnViUbsM5YJztvCPs+atHdxH25wbI6FxOap/9hDqZcjCKqR5RyzwxJjB+iurN/WXiuqvpdGMizTp9P3z+rO94322y9h1WfGbO37P1+IaO6BQFO8U8fqzd/Jo6JGXRXG7nsYTHxSHW1t2NusnlX/Nyvn8pc6KehWumso/zZpnutkGdzq9kNrQv3E+Nb/yudAX+z9t93/f/0LIrf5XNEP/j0H+dQIAAAAAAAAAAAAAAAAAAADwY194ELb5ACgAAA==";
      var tmp = "./foo.tar.gz";
      fs.writeFileSync(tmp, new Buffer(data, "base64"));
      
      if (mock) {
        authServer
          .post('/v2.0/tokens', {
            auth: {
              'RAX-KSKEY:apiKeyCredentials': {
                username: 'MOCK-USERNAME',
                apiKey: 'MOCK-API-KEY'
              }
            }
          })
          .reply(200, helpers.getRackspaceAuthResponse());

        server
          .put('/v1/MossoCloudFS_00aa00aa-aa00-aa00-aa00-aa00aa00aa00?extract-archive=tar.gz', new Buffer(data, "base64").toString())
          .replyWithFile(200, __dirname + '/../../fixtures/rackspace/extract.json');
      }
      
      
      
      client.extract({
        local: tmp
      }, function(e, ok, resp) {
        should.not.exist(e);
        should.exist(resp);
        server && server.done();
        
        fs.unlinkSync(tmp);
        done();
      });
      
    });

    after(function (done) {
      if (!mock) {
        return done();
      }
      

      async.parallel([
        function (next) {
          authServer.close(next);
        },
        function (next) {
          server.close(next);
        }
      ], done)
    });
  });
});

