var Emitter = require('events').EventEmitter;
var util = require('util');

var hasOwn = Object.prototype.hasOwnProperty;
var slice = Array.prototype.slice;

/**
 * The Slurp constructor, which simply initializes an empty registry.
 *
 * @constructor
 */
function Slurp() {
  Emitter.call(this);

  this.registry = {};
  this.intercepts = [];
  this.spinning = 0;
}

util.inherits(Slurp, Emitter);

/**
 * Register an intercept, overrides module loading. Intercepts are called in
 * reverse order of loading, meaning you can
 *
 * @param {function(string): *} fn
 * @public
 */
Slurp.prototype.intercept = function(fn) {
  this.intercepts.push(fn);
};

/**
 * Resolves an individual module, uses intercepts first if defined. Will call
 * back with a value, not a creator. The callback is optional, if you wish to
 * use resolve to launch the injection process.
 *
 * @param {string} name
 * @param {function(*)=} callback
 * @public
 */
Slurp.prototype.resolve = function(name, callback) {
  var self = this, value, i = this.intercepts.length - 1;
  for (; i >= 0; i--) {
    value = this.intercepts[i](name);
    if (value) {
      return callback && process.nextTick(function() {
        callback(value);
      });
    }
  }
  // really getting a creator, not a value
  if (value = this.registry[name]) {
    process.nextTick(function() {
      self.spinning++;
      value(function(err, value) {
        if (err) {
          return self.emit('error', err);
        }
        self.spinning--;
        callback && callback(value);
      });
    });
  } else {
    this.once(name, function(creator) {
      self.spinning++;
      creator(function(err, value) {
        if (err) {
          return self.emit('error', err);
        }
        self.spinning--;
        callback && callback(value);
      });
    });
  }
};

/**
 * Directly execute the callback with the required dependencies. The
 * dependencies are injected into the callback as arguments.
 *
 * @param {!Array.<string>} dependencies
 * @param {function(...*)} callback
 * @param {?Object} context
 * @public
 */
Slurp.prototype.exec = function(dependencies, callback, context) {
  if (dependencies.length === 0) {
    return process.nextTick(function() {
      callback.call(context);
    });
  }
  var needed = dependencies.length, modules = new Array(needed);
  dependencies.forEach(function(dep, i) {
    this.resolve(dep, function(value) {
      modules[i] = value;
      if (!--needed)
        callback.apply(context, modules);
    });
  }, this);
};

/**
 * Waits the duration, and calls back with missing modules, if any. Duration in
 * milliseconds.
 *
 * Note: this works by checking the number of listeners on the instance. You
 * should not leave listeners on the Slurp any longer than necessary.
 *
 * @param {number} duration
 * @param {function(Array.<string>)} callback
 * @public
 */
Slurp.prototype.timeout = function(duration, callback) {
  var self = this;
  setTimeout(function() {
    var event, listeners;
    // TODO: improve callback parameters
    if (self.spinning) {
      callback(self.spinning);
    } else if (self._events) {
      listeners = [];
      for (event in self._events)
        hasOwn.call(self._events, event) && self._events[event] &&
          listeners.push(event);

      if (listeners.length)
        callback(listeners);
    }
  }, duration);
};

/**
 * Register a service for all to see. The provided callback is executed once,
 * and never again. The returned object will be used until/unless it is
 * re-defined.
 *
 * @param {string} name
 * @param {!Array.<string>} dependencies
 * @param {function(...*)} callback
 * @param {?Object} context
 * @public
 */
Slurp.prototype.service = function(name, dependencies, callback, context) {
  var self = this, running = false;
  function postConstruct(err, value) {
    if (err) {
      return self.emit('error', err, name);
    }
    self.value(name, value);
  }
  this.creator(name, function(done) {
    if (!running) {
      running = true;
      this.exec(dependencies, function() {
        var args = slice.call(arguments);
        args.push(postConstruct);
        callback.apply(context, args);
      });
    }
    this.once(name, function(creator) {
      creator(done);
    });
  }, this);
};

/**
 * Register a service factory. The provided callback should return the service
 * creator function when provided the requested dependencies. Similar to
 * Slurp.service, callback will be called once, but the returned creator
 * will play again and again.
 *
 * @param {string} name
 * @param {!Array.<string>} dependencies
 * @param {function(...*)} callback
 * @param {?Object} context
 * @public
 */
Slurp.prototype.factory = function(name, dependencies, callback, context) {
  var self = this;
  this.exec(dependencies, function() {
    var args = slice.call(arguments);
    args.push(function(err, creator) {
      if (err) {
        return self.emit('error', err, name);
      }
      self.spinning--;
      self.creator(name, creator);
    });
    self.spinning++;
    callback.apply(context, args);
  });
};

/**
 * Simply registers a creator, but does not provide dependencies. The
 * creator function will be called, optionally with the provided context,
 * and the returned value will be injected into one component.
 *
 * @param {string} name
 * @param {function} creator
 * @param {?Object} context
 * @public
 */
Slurp.prototype.creator = function(name, creator, context) {
  creator = creator.bind(context);
  this.registry[name] = creator;
  process.nextTick(this.emit.bind(this, name, creator));
};

/**
 * Registers a static value which is passed to the service or factory callback.
 *
 * @param {string} name
 * @param {function} value
 * @public
 */
Slurp.prototype.value = function(name, value) {
  this.creator(name, function(callback) {
    callback(null, value);
  });
};

/**
 * Create a new Slurp instance.
 *
 * @return {Slurp}
 */
var createSlurp = function createSlurp() {
  return new Slurp();
};

createSlurp.Slurp = Slurp;
module.exports = createSlurp;
