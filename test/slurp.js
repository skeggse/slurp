var expect = require('expect.js');

var create = require('..');

describe('Slurp', function() {
  var slurp;

  beforeEach(function() {
    slurp = create();
  });

  describe('#value', function() {
    it('should expose an injectable creator', function(done) {
      slurp.value('thing1', {hello: true});
      slurp.value('thing2', {hello: false});

      var first = false;
      slurp.registry.thing1(function(err, res) {
        expect(err).to.not.be.ok();
        expect(res).to.eql({hello: true});
        first = true;
      });
      slurp.registry.thing2(function(err, res) {
        expect(err).to.not.be.ok();
        expect(res).to.eql({hello: false});
        expect(first).to.be.ok();
        done();
      });
    });
  });

  describe('#creator', function() {
    it('should expose an injectable creator', function(done) {
      slurp.creator('thing1', function(callback) {
        callback(null, {hello: true});
      });
      slurp.creator('thing2', function(callback) {
        callback(null, {hello: false});
      });

      var first = false;
      slurp.registry.thing1(function(err, res) {
        expect(err).to.not.be.ok();
        expect(res).to.eql({hello: true});
        first = true;
      });
      slurp.registry.thing2(function(err, res) {
        expect(err).to.not.be.ok();
        expect(res).to.eql({hello: false});
        expect(first).to.be.ok();
        done();
      });
    });
  });

  describe('#resolve', function() {
    it('should inject the existing dependecy', function(done) {
      slurp.value('thing1', {hello: true});
      slurp.resolve('thing1', function(thing1) {
        expect(thing1).to.eql({hello: true});
        done();
      });
    });
  });

  // assumes working slurp.value
  describe('#exec', function() {
    it('should inject no dependencies', function(done) {
      slurp.exec([], function() {
        expect(arguments).to.eql([]);
        done();
      });
    });

    it('should inject existing dependencies', function(done) {
      slurp.value('thing1', {hello: true});
      slurp.value('thing2', {hello: false});
      slurp.exec(['thing1', 'thing2'], function() {
        expect(arguments).to.eql([{hello: true}, {hello: false}]);
        done();
      });
    });

    it('should wait for unknown dependencies', function(done) {
      var found = false;

      slurp.value('thing1', {hello: true});
      slurp.exec(['thing1', 'thing2'], function() {
        expect(found).to.be.ok();
        expect(arguments).to.eql([{hello: true}, {hello: false}]);
        done();
      });
      slurp.value('thing2', {hello: false});

      found = true;
    });

    it('should wait for all unknown dependencies', function(done) {
      var found = false;

      slurp.exec(['thing1', 'thing2'], function() {
        expect(found).to.be.ok();
        expect(arguments).to.eql([{hello: true}, {hello: false}]);
        done();
      });
      slurp.value('thing1', {hello: true});
      slurp.value('thing2', {hello: false});

      found = true;
    });
  });

  describe('#service', function() {
    it('should resolve dependencies and expose a consistent constructor', function(done) {
      slurp.value('thing1', {hello: true});
      slurp.value('thing2', {hello: false});

      slurp.service('hello', ['thing1', 'thing2'], function(thing1, thing2, callback) {
        var invert = false;
        callback(null, {
          find: function(two) {
            if (invert) {
              two = !two;
            }
            invert = !invert;
            return two ? thing2 : thing1;
          }
        });
      });

      var first = false;
      slurp.exec(['hello'], function(hello) {
        expect(hello.find(true)).to.eql({hello: false});
        expect(hello.find(true)).to.eql({hello: true});
        expect(hello.find(false)).to.eql({hello: true});
        first = true;
      });

      slurp.exec(['hello'], function(hello) {
        expect(first).to.be.ok();
        expect(hello.find(false)).to.eql({hello: false});
        expect(hello.find(true)).to.eql({hello: false});
        expect(hello.find(true)).to.eql({hello: true});
        expect(hello.find(false)).to.eql({hello: true});
        expect(hello.find(false)).to.eql({hello: false});
        done();
      });
    });

    it('should not construct until injected', function(done) {
      var sent = false;
      setTimeout(function() {
        if (sent) {
          return;
        }
        sent = true;
        done();
      }, 10);
      slurp.service('hello', [], function(callback) {
        console.log('oops');
        if (sent) {
          return;
        }
        sent = true;
        done(new Error("this shouldn't happen"));
      });
    });

    it('should not construct a complex tree until injected', function(done) {
      var sent = false;
      setTimeout(function() {
        if (sent) {
          return;
        }
        sent = true;
        done();
      }, 10);
      slurp.service('hello', [], function(callback) {
        if (sent) {
          return;
        }
        sent = true;
        done(new Error("the service should not be instantiated"));
      });
      slurp.service('other', ['hello'], function(hello, callback) {
        if (sent) {
          return;
        }
        sent = true;
        done(new Error("the service should not be instantiated"));
      });
    });
  });

  describe('#factory', function() {
    it('should resolve dependencies and expose a constructor', function(done) {
      slurp.value('thing1', {hello: true});
      slurp.value('thing2', {hello: false});

      slurp.factory('hello', ['thing1', 'thing2'], function(thing1, thing2, callback) {
        callback(null, function(callback) {
          var invert = false;
          callback(null, {
            find: function(two) {
              if (invert) {
                two = !two;
              }
              invert = !invert;
              return two ? thing2 : thing1;
            }
          });
        });
      }, {});

      var first = false;
      slurp.exec(['hello'], function(hello) {
        expect(hello.find(true)).to.eql({hello: false});
        expect(hello.find(true)).to.eql({hello: true});
        expect(hello.find(false)).to.eql({hello: true});
        first = true;
      });

      slurp.exec(['hello'], function(hello) {
        expect(hello.find(false)).to.eql({hello: true});
        expect(hello.find(true)).to.eql({hello: true});
        expect(hello.find(true)).to.eql({hello: false});
        expect(hello.find(false)).to.eql({hello: false});
        expect(hello.find(false)).to.eql({hello: true});
        expect(first).to.be.ok();
        done();
      });
    });
  });

  describe('#intercept', function() {
    it('should intercept injects', function(done) {
      slurp.value('hello', {name: 'hello'});
      slurp.value('yellow', {name: 'yellow'});
      slurp.intercept(function(name) {
        if (name === 'hello')
          return {sometimes: true};
      });

      slurp.exec(['hello', 'yellow'], function(hello, yellow) {
        expect(hello).to.eql({sometimes: true});
        expect(yellow).to.eql({name: 'yellow'});

        slurp.intercept(function(name) {
          if (name === 'hello')
            return {always: true};
        });

        slurp.exec(['hello', 'yellow'], function(hello, yellow) {
          expect(hello).to.eql({always: true});
          expect(yellow).to.eql({name: 'yellow'});
          done();
        });
      });
    });
  });

  describe('#timeout', function() {
    it('should handle unfinished injections', function(done) {
      slurp.exec(['things', 'others'], function() {
        done(new Error('we should never get here'));
      });

      slurp.value('others', 'hello');

      slurp.timeout(10, function(things) {
        expect(things).to.eql(['things']);
        done();
      });
    });

    it('should ignore finished injections', function(done) {
      slurp.exec(['things', 'others'], function(things, others) {
        expect(things).to.equal('others');
        expect(others).to.equal('hello');
        setTimeout(done, 15);
      });

      slurp.value('others', 'hello');
      slurp.value('things', 'others');

      slurp.timeout(10, function(things) {
        done(new Error('we should never get here'));
      });
    });

    it('should handle unfinished constructors', function(done) {
      slurp.service('others', [], function(callback) {
        // doing nothing :p
      });
      slurp.exec(['things', 'others'], function(things, others) {
        expect(things).to.equal('others');
        expect(others).to.equal('hello');
        setTimeout(done, 15);
      });

      slurp.value('things', 'others');

      slurp.timeout(10, function(things) {
        expect(things).to.eql(1);
        done();
      });
    });
  });
});
