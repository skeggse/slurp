var Emitter = require('events').EventEmitter;
var util = require('util');

var debug = require('debug')('slurp');

var hasOwn = Object.prototype.hasOwnProperty;
var slice = Array.prototype.slice;

function pluralize(count, single, plural) {
  if (count === 1)
    return '1 ' + single;
  return count + ' ' + plural;
}

/**
 * The Slurp constructor, which simply initializes an empty registry.
 *
 * @constructor
 */
function Slurp() {
  Emitter.call(this);

  this._registry = {};
  this._intercepts = [];
  this._spinning = 0;

  this.setMaxListeners(1000);

  var self = this;

  /**
   * Overridable function which defers the callback for a tick.
   *
   * @param {*...} values The values to pass to the callback when invoked.
   * @param {function(*)} callback The callback to invoke.
   * @private
   */
  this._tick = function() {
    var context = this, args = slice.call(arguments), callback = args.pop();
    typeof callback === 'function' &&
    self.tick(function() {
      callback.apply(context, args);
    });
  };
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
  debug('adding intercept');
  this._intercepts.push(fn);
};

/**
 * Resolve an intercept, for use in slurp.resolve.
 *
 * @param {string} name
 * @return {*}
 * @public
 */
Slurp.prototype.getIntercept = function(name) {
  var value, i = this._intercepts.length - 1;
  for (; i >= 0; i--) {
    try {
      value = this._intercepts[i](name);
    } catch (err) {
      return this.emit('error', err, name);
    }
    if (value !== undefined) {
      return value;
    }
  }
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
  debug('resolving ' + name);
  if (typeof name !== 'string') {
    if (name && name.toString) {
      name = name.toString();
    } else {
      throw new TypeError('name must be a string');
    }
  }
  var self = this, value = this.getIntercept(name);
  if (value !== undefined) {
    debug('using intercept for ' + name);
    return this._tick(value, callback);
  }
  // really getting a creator, not a value
  if (value = this._registry[name]) {
    debug('using existing value for ' + name);
    this._tick(value, function(creator) {
      self._spinning++;
      creator(use);
    });
  } else {
    // TODO: what if a tick hasn't yet passed?
    debug('waiting for ' + name);
    this.once(name, function(creator) {
      self._spinning++;
      creator(use);
    });
  }

  function use(err, value) {
    if (err) {
      return self.emit('error', err, name);
    }
    debug('resolved ' + name);
    self._spinning--;
    callback && callback.call(self, value);
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
  if (!Array.isArray(dependencies)) {
    throw new TypeError('dependencies must be an array');
  }
  if (dependencies.length === 0) {
    debug('resolving zero dependencies');
    return this._tick.call(context, callback);
  }
  var needed = dependencies.length, modules = new Array(needed);
  var txt = pluralize(needed, 'dependency', 'dependencies');
  debug('resolving ' + txt);
  dependencies.forEach(function(dep, i) {
    this.resolve(dep, function(value) {
      modules[i] = value;
      if (!--needed) {
        debug('resolved ' + txt);
        callback.apply(context, modules);
      }
    });
  }, this);
};

/**
 * Synchronously checks if the instance is aware of the given name.
 *
 * @param {string} name
 * @return {boolean}
 * @public
 */
Slurp.prototype.peek = function(name) {
  return !!this._registry[name];
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
    if (self._spinning) {
      callback(self._spinning);
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
  debug('registering ' + name);
  this.creator(name, function(done) {
    if (!running) {
      running = true;
      debug('initializing ' + name);
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
  function postConstruct(err, value) {
    if (err) {
      return self.emit('error', err, name);
    }
    debug('initialized ' + name);
    self.value(name, value);
  }
};

/**
 * Register a service factory. The provided callback will be called every time
 * the factory is injected.
 *
 * @param {string} name
 * @param {!Array.<string>} dependencies
 * @param {function(...*)} callback
 * @param {?Object} context
 * @public
 */
Slurp.prototype.factory = function(name, dependencies, callback, context) {
  var self = this;
  debug('registering factory ' + name);
  this.creator(name, function(done) {
    self.exec(dependencies, function() {
      var args = slice.call(arguments);
      args.push(finish);
      self._spinning++;
      callback.apply(context, args);
      // just for the _spinning? worth?
      function finish(err, value) {
        if (err) {
          return self.emit('error', err, name);
        }
        self._spinning--;
        done(null, value);
      }
    });
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
  if (typeof name !== 'string') {
    throw new TypeError('name must be a string');
  }
  if (typeof creator !== 'function') {
    throw new TypeError('creator must be a function');
  }
  context && (creator = creator.bind(context));
  this._registry[name] = creator;
  this._tick(name, creator, this.emit);
};

/**
 * Registers a static value which is passed to the service or factory callback.
 *
 * @param {string} name
 * @param {function} value
 * @public
 */
Slurp.prototype.value = function(name, value) {
  if (value === undefined) {
    throw new TypeError('value must be defined');
  }
  this.creator(name, function(callback) {
    callback(null, value);
  });
};

/**
 * Overridable function which defers the callback for a tick.
 *
 * @param {function) callback The callback to invoke.
 * @protected
 */
Slurp.prototype.tick = process.nextTick;

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
