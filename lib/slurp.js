var Emitter = require('events').EventEmitter;
var util = require('util');

/**
 * The Slurp constructor, which simply initializes an empty registry.
 *
 * @constructor
 */
var Slurp = function Slurp() {
  this.registry = {};
};

util.inherits(Slurp, Emitter);

/**
 * Directly execute the callback with the required dependencies. The
 * dependencies are injected into the callback as arguments.
 *
 * @param {!Array.<string>} dependencies
 * @param {function(...Object)} callback
 * @param {?Object} context
 */
Slurp.prototype.exec = function(dependencies, callback, context) {
  var self = this;
  var injection = new Array(dependencies.length), needed = 0;
  dependencies.forEach(function(dep, i) {
    var inject = this.registry[dep];
    if (inject) {
      injection[i] = inject();
    } else {
      needed++;
      this.once(dep, function(inject) {
        injection[i] = inject();
        if (!--needed) {
          callback.apply(context, injection);
        }
      });
    }
  }, this);
  if (!needed) {
    callback.apply(context, injection);
  }
};

/**
 * Register a service for all to see. The provided callback is executed once,
 * and never again. The returned object will be used until/unless it is
 * re-defined.
 *
 * @param {string} name
 * @param {!Array.<string>} dependencies
 * @param {function(...Object)} callback
 * @param {?Object} context
 */
Slurp.prototype.service = function(name, dependencies, callback, context) {
  this.exec(dependencies, function() {
    var instance = callback.apply(context, arguments);
    this.value(name, instance);
  }, this);
};

/**
 * Register a service factory. The provided callback should return the service
 * constructor function when provided the requested dependencies. Similar to
 * Slurp.service, callback will be called once, but the returned constructor
 * will play again and again.
 *
 * @param {string} name
 * @param {!Array.<string>} dependencies
 * @param {function(...Object)} callback
 * @param {?Object} context
 */
Slurp.prototype.factory = function(name, dependencies, callback, context) {
  this.exec(dependencies, function() {
    var constructor = callback.apply(context, arguments);
    this.constructor(name, constructor);
  }, this);
};

/**
 * Simply registers a constructor, but does not provide dependencies. The
 * constructor function will be called, optionally with the provided context,
 * and the returned value will be injected into one component.
 *
 * @param {string} name
 * @param {function} constructor
 * @param {?Object} context
 */
Slurp.prototype.constructor = function(name, constructor, context) {
  constructor = constructor.bind(context);
  this.registry[name] = constructor;
  this.emit(name, constructor);
};

/**
 * Registers a static value which is passed to the service or factory callback.
 *
 * @param {string} name
 * @param {function} value
 */
Slurp.prototype.value = function(name, value) {
  this.constructor(name, function() {
    return value;
  });
};

/**
 * Create a new Slurp instance.
 *
 * @return {Slurp}
 */
module.exports = function createSlurp() {
  return new Slurp();
};
