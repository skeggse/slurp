var expect = require('expect.js');

var create = require('..');

describe('Slurp', function() {
  var slurp;

  beforeEach(function() {
    slurp = create();
  });

  describe('#value', function() {
    it('should expose an injectable constructor', function() {
      slurp.value('thing1', {hello: true});
      slurp.value('thing2', {hello: false});

      expect(slurp.registry.thing1()).to.eql({hello: true});
      expect(slurp.registry.thing2()).to.eql({hello: false});
    });
  });

  describe('#constructor', function() {
    it('should expose an injectable constructor', function() {
      slurp.constructor('thing1', function() {
        return {hello: true};
      });
      slurp.constructor('thing2', function() {
        return {hello: false};
      });

      expect(slurp.registry.thing1()).to.eql({hello: true});
      expect(slurp.registry.thing2()).to.eql({hello: false});
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

      slurp.service('hello', ['thing1', 'thing2'], function(thing1, thing2) {
        var invert = false;
        this.find = function(two) {
          if (invert) {
            two = !two;
          }
          invert = !invert;
          return two ? thing2 : thing1;
        };

        return this;
      }, {});

      var first = false;
      slurp.exec(['hello'], function(hello) {
        expect(hello.find(true)).to.eql({hello: false});
        expect(hello.find(true)).to.eql({hello: true});
        expect(hello.find(false)).to.eql({hello: true});
        first = true;
      });

      slurp.exec(['hello'], function(hello) {
        expect(hello.find(false)).to.eql({hello: false});
        expect(hello.find(true)).to.eql({hello: false});
        expect(hello.find(true)).to.eql({hello: true});
        expect(hello.find(false)).to.eql({hello: true});
        expect(hello.find(false)).to.eql({hello: false});
        expect(first).to.be.ok();
        done();
      });
    });
  });

  describe('#factory', function() {
    it('should resolve dependencies and expose a constructor', function(done) {
      slurp.value('thing1', {hello: true});
      slurp.value('thing2', {hello: false});

      slurp.factory('hello', ['thing1', 'thing2'], function(thing1, thing2) {
        return function() {
          var invert = false;
          return {find: function(two) {
            if (invert) {
              two = !two;
            }
            invert = !invert;
            return two ? thing2 : thing1;
          }};
        };
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
        done();
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
  });
});
