var expect = require('expect.js');
var sinon = require('sinon');

var create = require('..');

describe('Slurp', function() {
  var slurp, spy;

  beforeEach(function() {
    slurp = create();
    spy = sinon.spy();
  });

  // assumes working slurp.value
  describe('#exec', function() {
    it('should inject existing dependencies', function() {
      slurp.value('thing1', {hello: true});
      slurp.value('thing2', {hello: false});

      slurp.exec(['thing1', 'thing2'], spy);

      expect(spy.calledOnce).to.be.ok();
      expect(spy.args).to.eql([[{hello: true}, {hello: false}]]);
    });

    it('should wait for unknown dependencies', function() {
      slurp.value('thing1', {hello: true});

      slurp.exec(['thing1', 'thing2'], spy);

      expect(spy.called).to.not.be.ok();

      slurp.value('thing2', {hello: false});

      expect(spy.calledOnce).to.be.ok();
      expect(spy.args).to.eql([[{hello: true}, {hello: false}]]);
    });

    it('should wait for all unknown dependencies', function() {
      slurp.exec(['thing1', 'thing2'], spy);

      expect(spy.called).to.not.be.ok();

      slurp.value('thing1', {hello: true});

      expect(spy.called).to.not.be.ok();

      slurp.value('thing2', {hello: false});

      expect(spy.calledOnce).to.be.ok();
      expect(spy.args).to.eql([[{hello: true}, {hello: false}]]);
    });
  });

  describe('#service', function() {
    it('should resolve dependencies and expose a consistent constructor', function() {
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

      slurp.exec(['hello'], spy = sinon.spy(function(hello) {
        expect(hello.find(true)).to.eql({hello: false});
        expect(hello.find(true)).to.eql({hello: true});
        expect(hello.find(false)).to.eql({hello: true});
      }));

      expect(spy.calledOnce).to.be.ok();

      slurp.exec(['hello'], spy = sinon.spy(function(hello) {
        expect(hello.find(false)).to.eql({hello: false});
        expect(hello.find(true)).to.eql({hello: false});
        expect(hello.find(true)).to.eql({hello: true});
        expect(hello.find(false)).to.eql({hello: true});
        expect(hello.find(false)).to.eql({hello: false});
      }));

      expect(spy.calledOnce).to.be.ok();
    });
  });

  describe('#factory', function() {
    it('should resolve dependencies and expose a constructor', function() {
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

      slurp.exec(['hello'], function(hello) {
        expect(hello.find(true)).to.eql({hello: false});
        expect(hello.find(true)).to.eql({hello: true});
        expect(hello.find(false)).to.eql({hello: true});
      });

      slurp.exec(['hello'], function(hello) {
        expect(hello.find(false)).to.eql({hello: true});
        expect(hello.find(true)).to.eql({hello: true});
        expect(hello.find(true)).to.eql({hello: false});
        expect(hello.find(false)).to.eql({hello: false});
        expect(hello.find(false)).to.eql({hello: true});
      });
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

  describe('#value', function() {
    it('should expose an injectable constructor', function() {
      slurp.value('thing1', {hello: true});
      slurp.value('thing2', {hello: false});

      expect(slurp.registry.thing1()).to.eql({hello: true});
      expect(slurp.registry.thing2()).to.eql({hello: false});
    });
  });
});
