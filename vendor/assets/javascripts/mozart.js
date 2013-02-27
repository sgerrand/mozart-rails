(function(){
var require = function (file, cwd) {
    var resolved = require.resolve(file, cwd || '/');
    var mod = require.modules[resolved];
    if (!mod) throw new Error(
        'Failed to resolve module ' + file + ', tried ' + resolved
    );
    var cached = require.cache[resolved];
    var res = cached? cached.exports : mod();
    return res;
};

require.paths = [];
require.modules = {};
require.cache = {};
require.extensions = [".js",".coffee",".json"];

require._core = {
    'assert': true,
    'events': true,
    'fs': true,
    'path': true,
    'vm': true
};

require.resolve = (function () {
    return function (x, cwd) {
        if (!cwd) cwd = '/';
        
        if (require._core[x]) return x;
        var path = require.modules.path();
        cwd = path.resolve('/', cwd);
        var y = cwd || '/';
        
        if (x.match(/^(?:\.\.?\/|\/)/)) {
            var m = loadAsFileSync(path.resolve(y, x))
                || loadAsDirectorySync(path.resolve(y, x));
            if (m) return m;
        }
        
        var n = loadNodeModulesSync(x, y);
        if (n) return n;
        
        throw new Error("Cannot find module '" + x + "'");
        
        function loadAsFileSync (x) {
            x = path.normalize(x);
            if (require.modules[x]) {
                return x;
            }
            
            for (var i = 0; i < require.extensions.length; i++) {
                var ext = require.extensions[i];
                if (require.modules[x + ext]) return x + ext;
            }
        }
        
        function loadAsDirectorySync (x) {
            x = x.replace(/\/+$/, '');
            var pkgfile = path.normalize(x + '/package.json');
            if (require.modules[pkgfile]) {
                var pkg = require.modules[pkgfile]();
                var b = pkg.browserify;
                if (typeof b === 'object' && b.main) {
                    var m = loadAsFileSync(path.resolve(x, b.main));
                    if (m) return m;
                }
                else if (typeof b === 'string') {
                    var m = loadAsFileSync(path.resolve(x, b));
                    if (m) return m;
                }
                else if (pkg.main) {
                    var m = loadAsFileSync(path.resolve(x, pkg.main));
                    if (m) return m;
                }
            }
            
            return loadAsFileSync(x + '/index');
        }
        
        function loadNodeModulesSync (x, start) {
            var dirs = nodeModulesPathsSync(start);
            for (var i = 0; i < dirs.length; i++) {
                var dir = dirs[i];
                var m = loadAsFileSync(dir + '/' + x);
                if (m) return m;
                var n = loadAsDirectorySync(dir + '/' + x);
                if (n) return n;
            }
            
            var m = loadAsFileSync(x);
            if (m) return m;
        }
        
        function nodeModulesPathsSync (start) {
            var parts;
            if (start === '/') parts = [ '' ];
            else parts = path.normalize(start).split('/');
            
            var dirs = [];
            for (var i = parts.length - 1; i >= 0; i--) {
                if (parts[i] === 'node_modules') continue;
                var dir = parts.slice(0, i + 1).join('/') + '/node_modules';
                dirs.push(dir);
            }
            
            return dirs;
        }
    };
})();

require.alias = function (from, to) {
    var path = require.modules.path();
    var res = null;
    try {
        res = require.resolve(from + '/package.json', '/');
    }
    catch (err) {
        res = require.resolve(from, '/');
    }
    var basedir = path.dirname(res);
    
    var keys = (Object.keys || function (obj) {
        var res = [];
        for (var key in obj) res.push(key);
        return res;
    })(require.modules);
    
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (key.slice(0, basedir.length + 1) === basedir + '/') {
            var f = key.slice(basedir.length);
            require.modules[to + f] = require.modules[basedir + f];
        }
        else if (key === basedir) {
            require.modules[to] = require.modules[basedir];
        }
    }
};

(function () {
    var process = {};
    var global = typeof window !== 'undefined' ? window : {};
    var definedProcess = false;
    
    require.define = function (filename, fn) {
        if (!definedProcess && require.modules.__browserify_process) {
            process = require.modules.__browserify_process();
            definedProcess = true;
        }
        
        var dirname = require._core[filename]
            ? ''
            : require.modules.path().dirname(filename)
        ;
        
        var require_ = function (file) {
            var requiredModule = require(file, dirname);
            var cached = require.cache[require.resolve(file, dirname)];

            if (cached && cached.parent === null) {
                cached.parent = module_;
            }

            return requiredModule;
        };
        require_.resolve = function (name) {
            return require.resolve(name, dirname);
        };
        require_.modules = require.modules;
        require_.define = require.define;
        require_.cache = require.cache;
        var module_ = {
            id : filename,
            filename: filename,
            exports : {},
            loaded : false,
            parent: null
        };
        
        require.modules[filename] = function () {
            require.cache[filename] = module_;
            fn.call(
                module_.exports,
                require_,
                module_,
                module_.exports,
                dirname,
                filename,
                process,
                global
            );
            module_.loaded = true;
            return module_.exports;
        };
    };
})();


require.define("path",function(require,module,exports,__dirname,__filename,process,global){function filter (xs, fn) {
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (fn(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length; i >= 0; i--) {
    var last = parts[i];
    if (last == '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Regex to split a filename into [*, dir, basename, ext]
// posix version
var splitPathRe = /^(.+\/(?!$)|\/)?((?:.+?)?(\.[^.]*)?)$/;

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
var resolvedPath = '',
    resolvedAbsolute = false;

for (var i = arguments.length; i >= -1 && !resolvedAbsolute; i--) {
  var path = (i >= 0)
      ? arguments[i]
      : process.cwd();

  // Skip empty and invalid entries
  if (typeof path !== 'string' || !path) {
    continue;
  }

  resolvedPath = path + '/' + resolvedPath;
  resolvedAbsolute = path.charAt(0) === '/';
}

// At this point the path should be resolved to a full absolute path, but
// handle relative paths to be safe (might happen when process.cwd() fails)

// Normalize the path
resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
var isAbsolute = path.charAt(0) === '/',
    trailingSlash = path.slice(-1) === '/';

// Normalize the path
path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }
  
  return (isAbsolute ? '/' : '') + path;
};


// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    return p && typeof p === 'string';
  }).join('/'));
};


exports.dirname = function(path) {
  var dir = splitPathRe.exec(path)[1] || '';
  var isWindows = false;
  if (!dir) {
    // No dirname
    return '.';
  } else if (dir.length === 1 ||
      (isWindows && dir.length <= 3 && dir.charAt(1) === ':')) {
    // It is just a slash or a drive letter with a slash
    return dir;
  } else {
    // It is a full dirname, strip trailing slash
    return dir.substring(0, dir.length - 1);
  }
};


exports.basename = function(path, ext) {
  var f = splitPathRe.exec(path)[2] || '';
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPathRe.exec(path)[3] || '';
};

});

require.define("__browserify_process",function(require,module,exports,__dirname,__filename,process,global){var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
        && window.setImmediate;
    var canPost = typeof window !== 'undefined'
        && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            if (ev.source === window && ev.data === 'browserify-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('browserify-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

process.binding = function (name) {
    if (name === 'evals') return (require)('vm')
    else throw new Error('No such module. (Possibly not yet loaded)')
};

(function () {
    var cwd = '/';
    var path;
    process.cwd = function () { return cwd };
    process.chdir = function (dir) {
        if (!path) path = require('path');
        cwd = path.resolve(dir, cwd);
    };
})();

});

require.define("/collection.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var BoundView, Collection, Util, View,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  View = require('./view').View;

  Util = require('./util');

  exports.Collection = Collection = (function(_super) {

    __extends(Collection, _super);

    function Collection() {
      this.draw = __bind(this.draw, this);

      this.createView = __bind(this.createView, this);

      this.refresh = __bind(this.refresh, this);

      this.afterRender = __bind(this.afterRender, this);

      this.release = __bind(this.release, this);

      this.init = __bind(this.init, this);
      return Collection.__super__.constructor.apply(this, arguments);
    }

    Collection.prototype.tag = 'ul';

    Collection.prototype.skipTemplate = true;

    Collection.prototype.init = function() {
      var _base, _ref;
      Collection.__super__.init.apply(this, arguments);
      Util.log('collection', 'init');
      this.itemViews = {};
      if (this.filterAttribute != null) {
        this.bind('change:filterAttribute', this.draw);
        this.bind('change:filterText', this.draw);
      }
      if (this.sortAttribute != null) {
        this.bind('change:sortAttribute', this.draw);
        this.bind('change:sortDescending', this.draw);
      }
      if (this.pageSize == null) {
        this.set("pageSize", 10000);
      }
      if (this.pageCurrent == null) {
        this.set("pageCurrent", 0);
      }
      this.bind('change:pageSize', this.draw);
      this.bind('change:pageCurrent', this.draw);
      if ((_ref = this.method) == null) {
        this.method = 'all';
      }
      this.bind('change:collection', this.afterRender);
      this.bind('change:method', this.afterRender);
      return typeof (_base = this.collection).bind === "function" ? _base.bind('change', this.afterRender) : void 0;
    };

    Collection.prototype.release = function() {
      var _base;
      if (typeof (_base = this.collection).unbind === "function") {
        _base.unbind('change', this.afterRender);
      }
      return Collection.__super__.release.apply(this, arguments);
    };

    Collection.prototype.afterRender = function() {
      this.refresh();
      return this.draw();
    };

    Collection.prototype.refresh = function() {
      var id, item, toDestroy, view, _i, _len, _ref, _ref1, _ref2, _results;
      Util.log('collection', 'refresh');
      if (this.collection[this.method + "AsMap"] != null) {
        this.dataSet = this.collection[this.method + "AsMap"]();
      } else {
        this.dataSet = {};
        _ref = this.collection;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          item = _ref[_i];
          this.dataSet[item.id] = item;
        }
      }
      toDestroy = [];
      _ref1 = this.itemViews;
      for (id in _ref1) {
        view = _ref1[id];
        if (this.dataSet[id] == null) {
          toDestroy.push(id);
        }
      }
      _results = [];
      while (toDestroy.length > 0) {
        id = toDestroy.pop();
        Util.log('collection', 'destroyView', id, this.itemViews[id]);
        this.removeView(this.itemViews[id]);
        if ((_ref2 = this.itemViews[id].element) != null) {
          _ref2.remove();
        }
        this.layout.queueReleaseView(this.itemViews[id]);
        _results.push(delete this.itemViews[id]);
      }
      return _results;
    };

    Collection.prototype.createView = function(instance) {
      var obj, view;
      Util.log('collection', 'createView', instance, 'layout', this.layout.rootElement);
      obj = {
        content: instance,
        parent: this
      };
      if (this.viewClass === View) {
        obj.tag = 'li';
      }
      if (this.viewClassTemplateName != null) {
        obj.templateName = this.viewClassTemplateName;
      }
      if (this.viewClassTemplateFunction != null) {
        obj.templateFunction = this.viewClassTemplateFunction;
      }
      if (this.collectionTag != null) {
        obj.tag = this.collectionTag;
      }
      if (this.collectionClassNames != null) {
        obj.classNames = this.collectionClassNames;
      }
      if (this.tooltips != null) {
        obj.tooltips = this.tooltips;
      }
      view = this.layout.createView(this.viewClass, obj);
      this.element.append(view.createElement());
      this.itemViews[instance.id] = view;
      this.addView(view);
      return this.layout.queueRenderView(view);
    };

    Collection.prototype.draw = function() {
      var count, dcount, field, hide, id, item, st, start, vcount, view, vl, _i, _j, _k, _len, _len1, _len2, _ref, _ref1, _ref2, _ref3, _ref4;
      _ref = this.itemViews;
      for (id in _ref) {
        view = _ref[id];
        if ((_ref1 = view.element) != null) {
          _ref1.detach();
        }
      }
      this.displayOrder = _(this.dataSet).values();
      this.hidden = {};
      if (this.sortAttribute != null) {
        Util.sortBy(this.displayOrder, this.sortAttribute);
      }
      if (this.sortDescending) {
        this.displayOrder.reverse();
      }
      if ((this.filterText != null) && (this.filterAttribute != null) && this.filterText.length > 0) {
        st = this.filterText.toString().toLowerCase();
        _ref2 = this.displayOrder;
        for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
          item = _ref2[_i];
          hide = true;
          _ref3 = this.filterAttribute.split(',');
          for (_j = 0, _len1 = _ref3.length; _j < _len1; _j++) {
            field = _ref3[_j];
            vl = Util.getPath(item, field);
            if (vl != null) {
              hide = hide && (vl.toString().toLowerCase().indexOf(st) === -1);
            }
            if (hide) {
              this.hidden[item.id] = 1;
            }
          }
        }
      }
      start = this.pageCurrent * this.pageSize;
      count = 0;
      vcount = 0;
      dcount = 0;
      _ref4 = this.displayOrder;
      for (_k = 0, _len2 = _ref4.length; _k < _len2; _k++) {
        item = _ref4[_k];
        if (this.hidden[item.id] == null) {
          if (!(count < start || dcount >= this.pageSize)) {
            if (this.itemViews[item.id] == null) {
              this.createView(item);
            }
            this.element.append(this.itemViews[item.id].element);
            dcount++;
          }
          vcount++;
        }
        count++;
      }
      this.set("pageTotal", Math.ceil(vcount / this.pageSize));
      if (this.pageCurrent > this.pageTotal) {
        return this.set("pageCurrent", this.pageTotal - 1);
      }
    };

    return Collection;

  })(View);

  exports.BoundView = BoundView = (function(_super) {

    __extends(BoundView, _super);

    function BoundView() {
      return BoundView.__super__.constructor.apply(this, arguments);
    }

    BoundView.prototype.init = function() {
      BoundView.__super__.init.apply(this, arguments);
      return this.content.bind('change', this.redraw);
    };

    BoundView.prototype.release = function() {
      this.content.unbind('change', this.redraw);
      return BoundView.__super__.release.apply(this, arguments);
    };

    return BoundView;

  })(View);

}).call(this);

});

require.define("/view.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var MztObject, Util, View,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  MztObject = require('./object').MztObject;

  Util = require('./util');

  exports.View = View = (function(_super) {

    __extends(View, _super);

    function View() {
      this.copyHtmlAttrsToElement = __bind(this.copyHtmlAttrsToElement, this);

      this.getHtmlAttrsMap = __bind(this.getHtmlAttrsMap, this);

      this.createElement = __bind(this.createElement, this);

      this.release = __bind(this.release, this);

      this.hasAncestor = __bind(this.hasAncestor, this);

      this.removeView = __bind(this.removeView, this);

      this.namedChildViewExists = __bind(this.namedChildViewExists, this);

      this.childView = __bind(this.childView, this);

      this.addView = __bind(this.addView, this);

      this.redraw = __bind(this.redraw, this);

      this.postRender = __bind(this.postRender, this);

      this.replaceElement = __bind(this.replaceElement, this);

      this.findElementInPreparedContent = __bind(this.findElementInPreparedContent, this);

      this.reassignElements = __bind(this.reassignElements, this);

      this.prepareElement = __bind(this.prepareElement, this);

      this.init = __bind(this.init, this);
      return View.__super__.constructor.apply(this, arguments);
    }

    View.prototype.tag = 'div';

    View.prototype.disableHtmlAttributes = false;

    View.prototype.idPrefix = 'view';

    View.prototype.init = function() {
      var _ref, _ref1, _ref2;
      if ((_ref = this.id) == null) {
        this.id = ("" + this.idPrefix + "-") + this._mozartId;
      }
      this.childViews = {};
      if ((_ref1 = this.context) == null) {
        this.context = {};
      }
      this.namedChildViews = {};
      this.valid = true;
      this.domBindings = {};
      if ((_ref2 = this.display) == null) {
        this.display = true;
      }
      if (this.parent != null) {
        this.parent.addView(this);
      }
      if (!((this.templateFunction != null) || (this.skipTemplate != null))) {
        if (this.templateName == null) {
          Util.error('View: View has no templateName or templateFunction', "view", this);
        }
        this.templateFunction = HandlebarsTemplates[this.templateName];
      }
      Util.log('views', "view " + this.id + " init");
      return this.bind('change:display', this.redraw);
    };

    View.prototype.prepareElement = function() {
      if (this.released) {
        return;
      }
      this.newElement = this.createElement();
      if (!this.skipTemplate && this.display) {
        return this.newElement.innerHTML = this.templateFunction(this, {
          data: this
        });
      }
    };

    View.prototype.reassignElements = function() {
      var id, view, _ref;
      _ref = this.childViews;
      for (id in _ref) {
        view = _ref[id];
        view.reassignElements();
      }
      if (this.parent != null) {
        return this.el = this.parent.findElementInPreparedContent(this.id);
      }
    };

    View.prototype.findElementInPreparedContent = function(id) {
      var x;
      if (!this.newElement) {
        return null;
      }
      x = this._find(this.newElement, id);
      return x;
    };

    View.prototype._find = function(ele, id) {
      var e, x, _i, _len, _ref;
      if (ele.id === id) {
        return ele;
      }
      _ref = ele.children;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        e = _ref[_i];
        x = this._find(e, id);
        if (x != null) {
          return x;
        }
      }
      return null;
    };

    View.prototype.replaceElement = function() {
      var id, view, _ref;
      if (this.released) {
        return;
      }
      if (!this.el) {
        return;
      }
      _ref = this.childViews;
      for (id in _ref) {
        view = _ref[id];
        view.replaceElement();
      }
      if (this.el !== this.newElement) {
        this.oldEl = this.el;
        this.el.parentNode.replaceChild(this.newElement, this.el);
        if ((this.layout != null) && this.el === this.layout.rootEl) {
          this.layout.rootEl = this.newElement;
        }
        this.el = this.newElement;
        delete this.oldEl;
      }
      return this.element = $(this.el);
    };

    View.prototype.beforeRender = function() {};

    View.prototype.afterRender = function() {};

    View.prototype.postRender = function() {
      if (this.released) {
        return;
      }
      this.createDomBinds();
      return this.afterRender();
    };

    View.prototype.redraw = function() {
      if (this.released) {
        return;
      }
      return this.layout.queueRenderView(this);
    };

    View.prototype.addView = function(view) {
      this.childViews[view.id] = view;
      if (view.name != null) {
        return this.namedChildViews[view.name] = view;
      }
    };

    View.prototype.childView = function(name) {
      return this.namedChildViews[name];
    };

    View.prototype.namedChildViewExists = function(name) {
      return this.namedChildViews[name] != null;
    };

    View.prototype.releaseChildren = function() {
      var id, view, _ref;
      _ref = this.childViews;
      for (id in _ref) {
        view = _ref[id];
        this.layout.queueReleaseView(view);
      }
      this.childViews = {};
      return this.namedChildViews = {};
    };

    View.prototype.removeView = function(view) {
      if (this.childViews != null) {
        return delete this.childViews[view.id];
      }
    };

    View.prototype.hasAncestor = function(view) {
      var p;
      p = this.parent;
      while (p != null) {
        if (p.id === view.id) {
          return true;
        }
        p = p.parent;
      }
      return false;
    };

    View.prototype.release = function() {
      if (this.released) {
        return;
      }
      Util.log('views', this.layout, "releasing view " + this.id);
      this.removeDomBinds();
      this.unbind();
      if (this.parent != null) {
        this.parent.removeView(this);
      }
      this.releaseChildren();
      this.layout.releaseView(this);
      return View.__super__.release.apply(this, arguments);
    };

    View.prototype.createElement = function() {
      var element, k, v, _ref;
      if (this.display === false) {
        element = document.createElement("script");
        element.setAttribute('id', this.id);
        return element;
      }
      element = document.createElement(this.tag);
      element.setAttribute('id', this.id);
      element.setAttribute('view', '');
      if (!this.disableHtmlAttributes) {
        _ref = this.getHtmlAttrsMap();
        for (k in _ref) {
          v = _ref[k];
          element.setAttribute(k, v);
        }
      }
      return element;
    };

    View.prototype.getHtmlAttrsMap = function() {
      var k, map, v;
      map = {};
      for (k in this) {
        v = this[k];
        if (typeof this[k] === 'string' && Util.stringEndsWith(k, 'Html')) {
          map[Util.sliceStringBefore(k, 'Html')] = v;
        }
      }
      return map;
    };

    View.prototype.copyHtmlAttrsToElement = function(element) {
      element.attr(this.getHtmlAttrsMap());
      return element;
    };

    View.prototype.registerDomBind = function(bindId, target) {
      var attr, obj, path, _ref;
      _ref = Util.parsePath(target), path = _ref[0], attr = _ref[1];
      if (path != null) {
        obj = Util.getPath(this, path);
      } else {
        obj = this;
      }
      if (obj == null) {
        Util.error("View.registerDomBind (bind helper) - cannot find object " + path);
      }
      return this.domBindings[bindId] = {
        view: this,
        target: obj,
        attribute: attr,
        element: null
      };
    };

    View.prototype.createDomBinds = function() {
      var bindId, binding, _ref, _results;
      _ref = this.domBindings;
      _results = [];
      for (bindId in _ref) {
        binding = _ref[bindId];
        if (!(binding.element === null)) {
          continue;
        }
        binding.element = $("#" + bindId);
        if (binding.element == null) {
          Util.error("View.createDomBinds - cannot find element " + bindId);
        }
        binding.targetsynapse = new Synapse(binding.target);
        binding.elementsynapse = new Synapse(binding.element[0]);
        _results.push(binding.elementsynapse.observe(binding.targetsynapse, binding.attribute));
      }
      return _results;
    };

    View.prototype.removeDomBinds = function() {
      var bindId, binding, _ref;
      _ref = this.domBindings;
      for (bindId in _ref) {
        binding = _ref[bindId];
        if (binding.element === !null) {
          binding.elementsynapse.stopSyncWith(binding.targetsynapse);
        }
      }
      return this.domBindings = {};
    };

    return View;

  })(MztObject);

}).call(this);

});

require.define("/object.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var Events, MztObject, Synapse, Util,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; },
    __hasProp = {}.hasOwnProperty,
    __slice = [].slice;

  Util = require('./util');

  Events = require('./events').Events;

  Synapse = require('./synapse').Synapse;

  exports.MztObject = MztObject = (function() {
    var MODULEKEYWORDS, NOTIFY, OBSERVE, SYNC;

    SYNC = 0;

    OBSERVE = 1;

    NOTIFY = 2;

    MODULEKEYWORDS = ['extended', 'included'];

    function MztObject() {
      this.unbind = __bind(this.unbind, this);

      this.trigger = __bind(this.trigger, this);

      this.one = __bind(this.one, this);

      this.bind = __bind(this.bind, this);

      this.set = __bind(this.set, this);

      this.get = __bind(this.get, this);
      this._mozartId = Util.getId();
    }

    MztObject.include = function(obj) {
      var key, value, _ref;
      for (key in obj) {
        value = obj[key];
        if (__indexOf.call(MODULEKEYWORDS, key) < 0) {
          this[key] = value;
        }
      }
      if ((_ref = obj.extended) != null) {
        _ref.apply(this);
      }
      return this;
    };

    MztObject.extend = function(obj) {
      var key, value, _ref;
      for (key in obj) {
        value = obj[key];
        if (__indexOf.call(MODULEKEYWORDS, key) < 0) {
          this.prototype[key] = value;
        }
      }
      if ((_ref = obj.included) != null) {
        _ref.apply(this);
      }
      return this;
    };

    MztObject.create = function(options) {
      var inst, k, v;
      inst = new this();
      inst._mozartId = Util.getId();
      inst._pathCount = 0;
      inst._paths = {};
      for (k in options) {
        v = options[k];
        inst[k] = v;
      }
      inst._synapse = new Synapse(inst);
      inst.createDeclaredBinds();
      inst.createLookups();
      if (typeof inst.init === "function") {
        inst.init();
      }
      return inst;
    };

    MztObject.prototype.toString = function() {
      return "obj-" + this._mozartId;
    };

    MztObject.prototype.get = function(key) {
      if (Util.isFunction(this[key])) {
        return this[key]();
      } else {
        return this[key];
      }
    };

    MztObject.prototype.set = function(key, value) {
      var oldValue;
      if (typeof this[key] === 'function') {
        throw new Error('Cannot set a function');
      } else if (value === null || value instanceof MztObject) {
        oldValue = this[key];
        if ((oldValue != null) && oldValue instanceof MztObject) {
          if (oldValue._paths[this] !== void 0) {
            this._removePath(key, oldValue);
            if (oldValue._pathCount === 0) {
              if (value === null) {
                if (_(oldValue._synapse._notifying).keys().length > 0 || _(oldValue._synapse._observing).keys().length > 0) {
                  throw new Error('Cannot set a value with bindings to null');
                }
              } else {
                oldValue._synapse.transferAllSync(value._synapse);
              }
            }
          }
        }
        this[key] = value;
        if (value != null) {
          this._addPath(key, value);
        }
      } else {
        this[key] = value;
      }
      if (oldValue !== value) {
        this.trigger("change");
        return this.trigger("change:" + key);
      }
    };

    MztObject.prototype.createDeclaredBinds = function() {
      var attr, key, obj, path, type, v, _ref, _results;
      _results = [];
      for (key in this) {
        v = this[key];
        if (!(!Util.isFunction(this[key]) && Util.stringEndsWith(key, "Binding"))) {
          continue;
        }
        key = Util.sliceStringBefore(key, "Binding");
        type = SYNC;
        if (Util.stringEndsWith(key, 'Observe')) {
          key = Util.sliceStringBefore(key, "Observe");
          type = OBSERVE;
        } else if (Util.stringEndsWith(key, 'Notify')) {
          key = Util.sliceStringBefore(key, "Notify");
          type = NOTIFY;
        }
        if (this[key] == null) {
          this[key] = null;
          _ref = Util.parsePath(v), path = _ref[0], attr = _ref[1];
          if (path != null) {
            if (path === 'this') {
              if (this.context == null) {
                throw new Error("createDeclaredBinds - cannot use a 'this' binding on an object with no context");
              }
              obj = this.context;
            } else if (this.parent != null) {
              obj = Util.getPath(this.parent, path);
            } else {
              obj = Util.getPath(path);
            }
          } else {
            if (this.parent == null) {
              throw new Error("createDeclaredBinds - a property is bound on parent when parent does not exist");
            }
            obj = this.parent;
          }
          if (obj == null) {
            throw new Error("createDeclaredBinds - cannot find object '" + v + "'");
          }
          switch (type) {
            case SYNC:
              _results.push(this._synapse.syncWith(obj, key, attr));
              break;
            case OBSERVE:
              _results.push(this._synapse.observe(obj, attr, key));
              break;
            case NOTIFY:
              _results.push(this._synapse.notify(obj, key, attr));
              break;
            default:
              _results.push(void 0);
          }
        } else {
          _results.push(void 0);
        }
      }
      return _results;
    };

    MztObject.prototype.createLookups = function() {
      var key, v, _results;
      _results = [];
      for (key in this) {
        v = this[key];
        if (!(!Util.isFunction(this[key]) && Util.stringEndsWith(key, "Lookup"))) {
          continue;
        }
        key = Util.sliceStringBefore(key, "Lookup");
        _results.push(this[key] = Util._getPath(v));
      }
      return _results;
    };

    MztObject.prototype._addPath = function(key, value) {
      if (value._paths[this] == null) {
        value._paths[this] = key;
        return value._pathCount++;
      }
    };

    MztObject.prototype._removePath = function(key, value) {
      delete value._paths[this];
      return value._pathCount--;
    };

    MztObject.prototype.release = function() {
      var k, v;
      if (this.released) {
        return;
      }
      this.unbind();
      this._synapse.destroy();
      for (k in this) {
        if (!__hasProp.call(this, k)) continue;
        v = this[k];
        this[k] = void 0;
        delete this[k];
      }
      return this.released = true;
    };

    MztObject.prototype.bind = function() {
      var args;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      Events.bind.apply(Events, [this._mozartId].concat(__slice.call(args)));
      return this;
    };

    MztObject.prototype.one = function() {
      var args;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      Events.one.apply(Events, [this._mozartId].concat(__slice.call(args)));
      return this;
    };

    MztObject.prototype.trigger = function() {
      var args;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      Util.log.apply(Util, ['events', this, "triggering"].concat(__slice.call(args)));
      Events.trigger.apply(Events, [this._mozartId].concat(__slice.call(args)));
      return this;
    };

    MztObject.prototype.unbind = function() {
      var args;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      Events.unbind.apply(Events, [this._mozartId].concat(__slice.call(args)));
      return this;
    };

    return MztObject;

  })();

}).call(this);

});

require.define("/util.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var Util, _idCounter, _logging,
    __slice = [].slice,
    _this = this;

  _logging = {};

  _idCounter = 0;

  Util = module.exports = {
    toString: Object.prototype.toString,
    getType: function(object) {
      return this.toString.call(object).match(/^\[object\s(.*)\]$/)[1];
    },
    isObject: function(object) {
      return this.getType(object) === 'Object';
    },
    isFunction: function(object) {
      return this.getType(object) === 'Function';
    },
    isArray: function(object) {
      return this.getType(object) === 'Array';
    },
    isString: function(object) {
      return this.getType(object) === 'String';
    },
    isBoolean: function(object) {
      return this.getType(object) === 'Boolean';
    },
    log: function() {
      var attrs, type;
      type = arguments[0], attrs = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
      if ((_logging[type] != null) && (typeof console !== "undefined" && console !== null)) {
        return console.log.apply(console, [type + ":"].concat(__slice.call(attrs)));
      }
    },
    showLog: function(type) {
      return _logging[type] = true;
    },
    hideLog: function(type) {
      return _logging[type] = false;
    },
    error: function() {
      var attrs, message;
      message = arguments[0], attrs = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
      if (typeof console !== "undefined" && console !== null) {
        console.error("Exception:", message, attrs);
      }
      throw message;
    },
    warn: function() {
      var attrs, message;
      message = arguments[0], attrs = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
      if (typeof console !== "undefined" && console !== null) {
        return console.log("Warning:", message, attrs);
      }
    },
    clone: function(obj) {
      return $.extend({}, obj);
    },
    getPath: function(context, path) {
      var value;
      value = this._getPath(context, path);
      if (value === void 0) {
        throw new Error("Object " + context + " has no " + path);
      }
      return value;
    },
    _getPath: function(context, path) {
      var properties, property, value;
      if ((context != null) && !(path != null)) {
        path = context;
        context = Mozart.root;
      }
      if (path[0].toUpperCase() === path[0]) {
        context = Mozart.root;
      }
      properties = path.split('.');
      while (properties.length > 0) {
        property = properties.shift();
        if (property !== 'this') {
          if (context[property] === void 0) {
            return void 0;
          }
          if (context.get != null) {
            value = context.get(property);
          } else {
            value = context[property];
          }
          if (value === null && properties.length > 0) {
            return void 0;
          }
        } else {
          value = context;
        }
        context = value;
      }
      return value;
    },
    getId: function() {
      return ++_idCounter;
    },
    parsePath: function(path) {
      var lastprop, props;
      if (path.indexOf('.') === -1) {
        return [null, path];
      }
      props = path.split('.');
      lastprop = props.pop();
      return [props.join('.'), lastprop];
    },
    toMap: function(itemArray, idfield) {
      var item, map, _i, _len;
      if (idfield == null) {
        idfield = 'id';
      }
      map = {};
      for (_i = 0, _len = itemArray.length; _i < _len; _i++) {
        item = itemArray[_i];
        map[item[idfield]] = item;
      }
      return map;
    },
    sortBy: function(sortArray, fields) {
      fields = Util.parseSort(fields);
      return sortArray.sort(function(a, b) {
        var av, bv, field, _i, _len;
        for (_i = 0, _len = fields.length; _i < _len; _i++) {
          field = fields[_i];
          if (typeof a[field] === 'function') {
            av = a[field]();
          } else {
            av = a[field];
          }
          if (typeof b[field] === 'function') {
            bv = b[field]();
          } else {
            bv = b[field];
          }
          if ((av != null) && (bv != null)) {
            if (av == null) {
              return -1;
            }
            if (bv == null) {
              return 1;
            }
            av = av.toString().toLowerCase();
            bv = bv.toString().toLowerCase();
            if (av > bv) {
              return 1;
            } else if (av < bv) {
              return -1;
            }
          }
        }
      });
    },
    parseSort: function(str, state) {
      var c, current, out;
      if (state == null) {
        state = {
          pos: 0
        };
      }
      out = [];
      current = "";
      while (state.pos < str.length) {
        c = str[state.pos++];
        switch (c) {
          case ',':
            if (current.length > 0) {
              out.push(current);
              current = "";
            }
            break;
          case '[':
            if (current.length > 0) {
              throw new Error('parseSort: Unexpected Character [ at ' + state.pos.toString());
            }
            out.push(this.parseSort(str, state));
            break;
          case ']':
            if (current.length > 0) {
              out.push(current);
            }
            return out;
          default:
            current += c;
        }
      }
      if (current.length > 0) {
        out.push(current);
        current = "";
      }
      return out;
    },
    toCapsCase: function(name) {
      var x;
      x = name.replace(/^[a-z]{1,1}/g, function(match) {
        return match.toUpperCase();
      });
      x = x.replace(/_[a-z]{1,1}/g, function(match) {
        return match.toUpperCase();
      });
      x = x.replace(/_/g, " ");
      return x;
    },
    toSnakeCase: function(name) {
      var x;
      x = name.replace(/[A-Z]{1,1}/g, function(match) {
        return "_" + match.toLowerCase();
      });
      return x.replace(/^_/, "");
    },
    sliceStringBefore: function(str, token) {
      return str.slice(0, str.length - token.length);
    },
    sliceStringAfter: function(str, token) {
      return str.slice(token.length);
    },
    stringEndsWith: function(str, token) {
      var len;
      len = token.length;
      return (str.length >= len) && (str.slice(-len) === token);
    },
    stringStartsWith: function(str, token) {
      var len;
      len = token.length;
      return (str.length >= len) && (str.slice(0, len) === token);
    }
  };

}).call(this);

});

require.define("/events.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var Events;

  exports.Events = Events = (function() {

    function Events() {}

    Events.callbacks = {};

    Events.eventInit = function(objectId, eventName) {
      var _base, _base1, _ref, _ref1;
      if ((_ref = (_base = Events.callbacks)[objectId]) == null) {
        _base[objectId] = {
          count: 0,
          events: {}
        };
      }
      return (_ref1 = (_base1 = Events.callbacks[objectId].events)[eventName]) != null ? _ref1 : _base1[eventName] = {};
    };

    Events.trigger = function(objectId, eventName, data) {
      var callbackFunction, id, list, _i, _len, _ref, _results;
      if ((Events.callbacks[objectId] != null) && (Events.callbacks[objectId].events[eventName] != null)) {
        list = [];
        _ref = Events.callbacks[objectId].events[eventName];
        for (id in _ref) {
          callbackFunction = _ref[id];
          if (callbackFunction.fn.call == null) {
            Util.log("general", 'callback issue ', callbackFunction.fn);
          }
          callbackFunction.fn.call(this, data);
          if (callbackFunction.once) {
            list.push({
              objectId: objectId,
              eventName: eventName,
              id: id
            });
          }
        }
        _results = [];
        for (_i = 0, _len = list.length; _i < _len; _i++) {
          callbackFunction = list[_i];
          _results.push(delete Events.callbacks[callbackFunction.objectId].events[callbackFunction.eventName][callbackFunction.id]);
        }
        return _results;
      }
    };

    Events.one = function(objectId, eventName, callback) {
      Events.eventInit(objectId, eventName);
      return Events.callbacks[objectId].events[eventName][Events.callbacks[objectId].count++] = {
        fn: callback,
        once: true
      };
    };

    Events.bind = function(objectId, eventName, callback) {
      Events.eventInit(objectId, eventName);
      return Events.callbacks[objectId].events[eventName][Events.callbacks[objectId].count++] = {
        fn: callback
      };
    };

    Events.unbind = function(objectId, eventName, callback) {
      var callbackFunction, id, list, _i, _len, _ref;
      if ((callback != null) && (Events.callbacks[objectId] != null) && (Events.callbacks[objectId].events[eventName] != null)) {
        list = [];
        _ref = Events.callbacks[objectId].events[eventName];
        for (id in _ref) {
          callbackFunction = _ref[id];
          if (callbackFunction.fn === callback) {
            list.push(id);
          }
        }
        for (_i = 0, _len = list.length; _i < _len; _i++) {
          id = list[_i];
          delete Events.callbacks[objectId].events[eventName][id];
        }
        return;
      }
      if ((eventName != null) && (Events.callbacks[objectId] != null) && (Events.callbacks[objectId].events[eventName] != null)) {
        delete Events.callbacks[objectId].events[eventName];
        return;
      }
      return delete Events.callbacks[objectId];
    };

    Events.getBinds = function(objectId, eventName) {
      return _(Events.callbacks[objectId].events[eventName]).values();
    };

    return Events;

  })();

}).call(this);

});

require.define("/synapse.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var Synapse, SynapseCore, connect, connectOne, defaultConnectOptions, detectEvent, detectInterface, detectOtherInterface, offEvent, onEvent, triggerEvent,
    __slice = [].slice;

  SynapseCore = require('./synapse-core');

  exports.Synapse = Synapse = (function() {

    Synapse.guid = 1;

    Synapse.cache = {};

    Synapse.limitedApi = 'observe notify syncWith stopObserving pauseObserving resumeObserving stopNotifying pauseNotifying resumeNotifying'.split(' ');

    function Synapse(object) {
      var cached, hook, _i, _len, _ref;
      if (object instanceof Synapse) {
        return object;
      }
      if ((cached = Synapse.cache[object[Synapse.expando]])) {
        return cached;
      }
      _ref = Synapse.hooks;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        hook = _ref[_i];
        if (hook.checkObjectType(object)) {
          break;
        }
        hook = null;
      }
      if (hook == null) {
        throw new Error("An appropriate hook was not determined for " + (SynapseCore.getType(object)) + " types");
      }
      this.raw = (typeof hook.coerceObject === "function" ? hook.coerceObject(object) : void 0) || object;
      this.hook = hook;
      Synapse.cache[this.guid = object[Synapse.expando] = Synapse.guid++] = this;
      this._observing = {};
      this._notifying = {};
    }

    Synapse.prototype.get = function() {
      var _ref;
      return (_ref = this.hook).getHandler.apply(_ref, [this.raw].concat(__slice.call(arguments)));
    };

    Synapse.prototype.set = function() {
      var _ref;
      (_ref = this.hook).setHandler.apply(_ref, [this.raw].concat(__slice.call(arguments)));
      return this;
    };

    Synapse.getSynapseFor = function(object) {
      return Synapse.cache[object[Synapse.expando]];
    };

    Synapse.check = function() {
      var guid, orphans, synapse, _ref;
      orphans = [];
      _ref = Synapse.cache;
      for (guid in _ref) {
        synapse = _ref[guid];
        if (synapse.raw == null) {
          orphans.push(guid);
        }
      }
      return orphans;
    };

    Synapse.prototype.observe = function() {
      var args, other;
      other = arguments[0], args = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
      other = new Synapse(other);
      connect.apply(null, [other, this].concat(__slice.call(args)));
      return this;
    };

    Synapse.prototype.notify = function() {
      var args, other;
      other = arguments[0], args = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
      other = new Synapse(other);
      connect.apply(null, [this, other].concat(__slice.call(args)));
      return this;
    };

    Synapse.prototype.syncWith = function(other, source, target) {
      other = new Synapse(other);
      this.observe(other, target, source).notify(other, source, target);
      return this;
    };

    Synapse.prototype.stopObserving = function(subject) {
      var channel, event, guid, meta, _i, _j, _k, _l, _len, _len1, _len2, _len3, _ref, _ref1, _ref2, _ref3;
      if (subject != null) {
        if ((meta = this._observing[subject.guid])) {
          _ref = meta.channels;
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            channel = _ref[_i];
            _ref1 = channel.events;
            for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
              event = _ref1[_j];
              offEvent(subject, event, channel.handler);
            }
          }
          delete this._observing[subject.guid];
          delete subject._notifying[this.guid];
        }
      } else {
        for (guid in this._observing) {
          meta = this._observing[guid];
          subject = Synapse.cache[guid];
          _ref2 = meta.channels;
          for (_k = 0, _len2 = _ref2.length; _k < _len2; _k++) {
            channel = _ref2[_k];
            _ref3 = channel.events;
            for (_l = 0, _len3 = _ref3.length; _l < _len3; _l++) {
              event = _ref3[_l];
              offEvent(subject, event, channel.handler);
            }
          }
          delete subject._notifying[this.guid];
        }
        this._observing = {};
      }
      return this;
    };

    Synapse.prototype.transferObserveBindingsTo = function(observer, subject) {
      var channel, meta, _i, _len, _ref;
      if ((meta = this._observing[subject.guid])) {
        _ref = meta.channels;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          channel = _ref[_i];
          observer.observe(subject, channel.subjectInterface, channel.observerInterface);
        }
      }
      return this.stopObserving(subject);
    };

    Synapse.prototype.stopSyncWith = function(target) {
      if (target != null) {
        this.stopObserving(target);
        return this.stopNotifying(target);
      } else {
        this.stopObserving();
        return this.stopNotifying();
      }
    };

    Synapse.prototype.transferAllSync = function(replacement) {
      var guid, obj, other, _ref, _ref1, _results;
      _ref = this._notifying;
      for (guid in _ref) {
        obj = _ref[guid];
        other = Synapse.cache[guid];
        this.pauseObserving(other);
        this.transferNotifyBindingsTo(replacement, other);
      }
      _ref1 = this._observing;
      _results = [];
      for (guid in _ref1) {
        obj = _ref1[guid];
        other = Synapse.cache[guid];
        _results.push(this.transferObserveBindingsTo(replacement, other));
      }
      return _results;
    };

    Synapse.prototype.transferSyncTo = function(replacement, other) {
      this.pauseObserving(other);
      this.transferNotifyBindingsTo(replacement, other);
      return this.transferObserveBindingsTo(replacement, other);
    };

    Synapse.prototype.pauseObserving = function(subject) {
      var guid, meta;
      if (subject != null) {
        if ((meta = this._observing[subject.guid])) {
          meta.open = false;
        }
      } else {
        for (guid in this._observing) {
          this._observing[guid].open = false;
        }
      }
      return this;
    };

    Synapse.prototype.resumeObserving = function(subject) {
      var guid, meta;
      if (subject != null) {
        if ((meta = this._observing[subject.guid])) {
          meta.open = true;
        }
      } else {
        for (guid in this._observing) {
          this._observing[guid].open = true;
        }
      }
      return this;
    };

    Synapse.prototype.stopNotifying = function(observer) {
      var channel, event, guid, meta, _i, _j, _k, _l, _len, _len1, _len2, _len3, _ref, _ref1, _ref2, _ref3;
      if (observer != null) {
        if ((meta = this._notifying[observer.guid])) {
          _ref = meta.channels;
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            channel = _ref[_i];
            _ref1 = channel.events;
            for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
              event = _ref1[_j];
              offEvent(this, event, channel.handler);
            }
          }
          delete this._notifying[observer.guid];
          delete observer._observing[this.guid];
        }
      } else {
        for (guid in this._notifying) {
          meta = this._notifying[guid];
          observer = Synapse.cache[guid];
          _ref2 = meta.channels;
          for (_k = 0, _len2 = _ref2.length; _k < _len2; _k++) {
            channel = _ref2[_k];
            _ref3 = channel.events;
            for (_l = 0, _len3 = _ref3.length; _l < _len3; _l++) {
              event = _ref3[_l];
              offEvent(this, event, channel.handler);
            }
          }
          delete observer._observing[this.guid];
        }
        this._notifying = {};
      }
      return this;
    };

    Synapse.prototype.transferNotifyBindingsTo = function(subject, observer) {
      var channel, meta, _i, _len, _ref;
      if ((meta = this._notifying[observer.guid])) {
        _ref = meta.channels;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          channel = _ref[_i];
          subject.notify(observer, channel.subjectInterface, channel.observerInterface);
        }
      }
      return this.stopNotifying(observer);
    };

    Synapse.prototype.pauseNotifying = function(observer) {
      var guid, meta;
      if (observer != null) {
        if ((meta = this._notifying[observer.guid])) {
          meta.open = false;
        }
      } else {
        for (guid in this._notifying) {
          this._notifying[guid].open = false;
        }
      }
      return this;
    };

    Synapse.prototype.resumeNotifying = function(observer) {
      var guid, meta;
      if (observer != null) {
        if ((meta = this._notifying[observer.guid])) {
          meta.open = true;
        }
      } else {
        for (guid in this._notifying) {
          this._notifying[guid].open = true;
        }
      }
      return this;
    };

    Synapse.prototype.destroy = function() {
      this.stopObserving();
      this.stopNotifying();
      delete Synapse.cache[this.raw[Synapse.expando]];
      return delete this.raw;
    };

    return Synapse;

  })();

  Synapse.expando = 'Synapse' + Math.random().toString().replace(/\D/g, '');

  Synapse.hooks = [];

  detectEvent = function() {
    var args, object, value, _ref;
    object = arguments[0], args = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
    if ((object.hook.detectEvent != null) && (value = (_ref = object.hook).detectEvent.apply(_ref, [object.raw].concat(__slice.call(args))))) {
      return value;
    }
    throw new Error("" + object.hook.typeName + " types do not support events");
  };

  onEvent = function() {
    var args, object, value, _base;
    object = arguments[0], args = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
    if ((value = typeof (_base = object.hook).onEventHandler === "function" ? _base.onEventHandler.apply(_base, [object.raw].concat(__slice.call(args))) : void 0)) {
      return object;
    }
    throw new Error("" + object.hook.typeName + " types do not support events");
  };

  offEvent = function() {
    var args, object, value, _base;
    object = arguments[0], args = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
    if ((value = typeof (_base = object.hook).offEventHandler === "function" ? _base.offEventHandler.apply(_base, [object.raw].concat(__slice.call(args))) : void 0)) {
      return object;
    }
    throw new Error("" + object.hook.typeName + " types do not support events");
  };

  triggerEvent = function() {
    var args, object, value, _base;
    object = arguments[0], args = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
    if ((value = typeof (_base = object.hook).triggerEventHandler === "function" ? _base.triggerEventHandler.apply(_base, [object.raw].concat(__slice.call(args))) : void 0)) {
      return object;
    }
    throw new Error("" + object.hook.typeName + " types do not support events");
  };

  detectInterface = function(object) {
    var _base;
    return typeof (_base = object.hook).detectInterface === "function" ? _base.detectInterface(object.raw) : void 0;
  };

  detectOtherInterface = function(object) {
    var _base;
    return typeof (_base = object.hook).detectOtherInterface === "function" ? _base.detectOtherInterface(object.raw) : void 0;
  };

  defaultConnectOptions = {
    event: null,
    subjectInterface: null,
    observerInterface: null,
    converter: null,
    triggerOnBind: true
  };

  connectOne = function(subject, observer, options) {
    var channel, converter, event, events, handler, key, observerInterface, observerMeta, subjectInterface, subjectMeta, triggerOnBind, value, _i, _len;
    for (key in defaultConnectOptions) {
      value = defaultConnectOptions[key];
      if (!(options[key] != null)) {
        options[key] = value;
      }
    }
    if ((converter = options.converter) && !SynapseCore.isFunction(converter)) {
      if (!(converter = observer.raw[converter])) {
        throw Error("Property " + options.coverter + " is undefined on " + observer.raw);
      }
    }
    if (!(subjectInterface = options.subjectInterface)) {
      if (!(subjectInterface = detectInterface(subject) || detectOtherInterface(observer))) {
        throw new Error("An interface for " + subject.hook.typeName + " objects could not be detected");
      }
    }
    if (!(observerInterface = options.observerInterface)) {
      if (!(observerInterface = detectInterface(observer) || detectOtherInterface(subject))) {
        throw new Error("An interface for " + observer.hook.typeName + " objects could not be detected");
      }
    }
    if (!(events = options.event)) {
      events = detectEvent(subject, subjectInterface);
    }
    if (!SynapseCore.isArray(events)) {
      events = [events];
    }
    triggerOnBind = options.triggerOnBind;
    if (!(observerMeta = observer._observing[subject.guid])) {
      observerMeta = observer._observing[subject.guid] = {
        open: true,
        channels: []
      };
    }
    if (!(subjectMeta = subject._notifying[observer.guid])) {
      subjectMeta = subject._notifying[observer.guid] = {
        open: true,
        channels: []
      };
    }
    handler = function() {
      var origValue, _ref, _ref1;
      if (((_ref = observer._observing[subject.guid]) != null ? _ref.open : void 0) === true && ((_ref1 = subject._notifying[observer.guid]) != null ? _ref1.open : void 0) === true) {
        if (SynapseCore.isFunction(subjectInterface)) {
          value = subjectInterface(subject);
        } else {
          value = subject.get(subjectInterface);
        }
        if (converter) {
          value = converter(value, observer, observerInterface);
        }
        if (SynapseCore.isFunction(observerInterface)) {
          origValue = observerInterface(observer);
        } else {
          origValue = observer.get(observerInterface);
        }
        if (origValue !== value) {
          if (SynapseCore.isFunction(observerInterface)) {
            return observerInterface(observer, value);
          } else {
            return observer.set(observerInterface, value);
          }
        }
      }
    };
    channel = {
      subjectInterface: subjectInterface,
      observerInterface: observerInterface,
      events: events,
      handler: handler
    };
    observerMeta.channels.push(channel);
    subjectMeta.channels.push(channel);
    for (_i = 0, _len = events.length; _i < _len; _i++) {
      event = events[_i];
      onEvent(subject, event, handler);
      if (triggerOnBind) {
        triggerEvent(subject, event);
      }
    }
  };

  connect = function() {
    var arg0, arg1, args, observer, opt, options, subject, _i, _len;
    subject = arguments[0], observer = arguments[1], args = 3 <= arguments.length ? __slice.call(arguments, 2) : [];
    options = args;
    arg0 = args[0];
    arg1 = args[1];
    if (SynapseCore.isFunction(arg0)) {
      options = {
        converter: arg0
      };
    } else if (SynapseCore.isArray(arg0) || !SynapseCore.isObject(arg0)) {
      options = {
        subjectInterface: arg0,
        observerInterface: arg1
      };
    }
    if (!SynapseCore.isArray(options)) {
      options = [options];
    }
    for (_i = 0, _len = options.length; _i < _len; _i++) {
      opt = options[_i];
      connectOne(subject, observer, opt);
    }
  };

}).call(this);

});

require.define("/synapse-core.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {

  module.exports = {
    toString: Object.prototype.toString,
    getType: function(object) {
      return this.toString.call(object).match(/^\[object\s(.*)\]$/)[1];
    },
    isObject: function(object) {
      return this.getType(object) === 'Object';
    },
    isArray: function(object) {
      return this.getType(object) === 'Array';
    },
    isFunction: function(object) {
      return this.getType(object) === 'Function';
    },
    isString: function(object) {
      return this.getType(object) === 'String';
    },
    isBoolean: function(object) {
      return this.getType(object) === 'Boolean';
    }
  };

}).call(this);

});

require.define("/control.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var Control, View,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  View = require('./view').View;

  exports.Control = Control = (function(_super) {

    __extends(Control, _super);

    function Control() {
      this.afterRender = __bind(this.afterRender, this);
      return Control.__super__.constructor.apply(this, arguments);
    }

    Control.prototype.idPrefix = 'control';

    Control.prototype.error = function(help) {
      this.help = help;
      return this.errorState = true;
    };

    Control.prototype.afterRender = function() {
      if (this.errorState) {
        return this.element.addClass('error');
      }
    };

    return Control;

  })(View);

}).call(this);

});

require.define("/controller.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var Controller, MztObject,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  MztObject = require('./object').MztObject;

  exports.Controller = Controller = (function(_super) {

    __extends(Controller, _super);

    function Controller() {
      return Controller.__super__.constructor.apply(this, arguments);
    }

    return Controller;

  })(MztObject);

}).call(this);

});

require.define("/data-index.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var BooleanIndex, DataIndex, MapIndex, MztObject,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  MztObject = require('./object').MztObject;

  exports.DataIndex = DataIndex = (function(_super) {

    __extends(DataIndex, _super);

    function DataIndex() {
      return DataIndex.__super__.constructor.apply(this, arguments);
    }

    DataIndex.indexTypes = {};

    DataIndex.prototype.load = function() {
      throw new Error("Mozart.DataIndex: Abstract, Not Implemented");
    };

    DataIndex.prototype.add = function(record) {
      throw new Error("Mozart.DataIndex: Abstract, Not Implemented");
    };

    DataIndex.prototype.remove = function(record) {
      throw new Error("Mozart.DataIndex: Abstract, Not Implemented");
    };

    DataIndex.prototype.update = function(record, oldValue, newValue) {
      throw new Error("Mozart.DataIndex: Abstract, Not Implemented");
    };

    DataIndex.prototype.rebuild = function() {
      throw new Error("Mozart.DataIndex: Abstract, Not Implemented");
    };

    DataIndex.registerIndexClassType = function(idxType, classType) {
      return this.indexTypes[idxType] = classType;
    };

    DataIndex.getIndexClassType = function(idxType) {
      return this.indexTypes[idxType];
    };

    return DataIndex;

  })(MztObject);

  exports.MapIndex = MapIndex = (function(_super) {

    __extends(MapIndex, _super);

    function MapIndex() {
      return MapIndex.__super__.constructor.apply(this, arguments);
    }

    MapIndex.prototype.init = function() {
      this.map = {};
      return this.rebuild();
    };

    MapIndex.prototype.load = function(value) {
      if (this.map[value] != null) {
        return this.map[value];
      }
      return {};
    };

    MapIndex.prototype.update = function(record, oldValue, newValue) {
      var _base, _ref;
      if (this.map[oldValue] != null) {
        delete this.map[oldValue][record.id];
        if (_(this.map[oldValue]).keys().length === 0) {
          delete this.map[oldValue];
        }
      }
      if ((_ref = (_base = this.map)[newValue]) == null) {
        _base[newValue] = {};
      }
      return this.map[newValue][record.id] = record;
    };

    MapIndex.prototype.add = function(record) {
      var _base, _name, _ref;
      if ((_ref = (_base = this.map)[_name = record[this.attribute]]) == null) {
        _base[_name] = {};
      }
      return this.map[record[this.attribute]][record.id] = record;
    };

    MapIndex.prototype.remove = function(record) {
      var ids, value, _ref, _results;
      _ref = this.map;
      _results = [];
      for (value in _ref) {
        ids = _ref[value];
        delete ids[record.id];
        if (_(ids).keys().length === 0) {
          _results.push(delete this.map[value]);
        } else {
          _results.push(void 0);
        }
      }
      return _results;
    };

    MapIndex.prototype.rebuild = function() {
      var record, _i, _len, _ref, _results;
      this.map = {};
      _ref = this.modelClass.all();
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        record = _ref[_i];
        _results.push(this.add(record));
      }
      return _results;
    };

    return MapIndex;

  })(DataIndex);

  DataIndex.registerIndexClassType('map', MapIndex);

  exports.BooleanIndex = BooleanIndex = (function(_super) {

    __extends(BooleanIndex, _super);

    function BooleanIndex() {
      return BooleanIndex.__super__.constructor.apply(this, arguments);
    }

    BooleanIndex.prototype.init = function() {
      this.value = this.options.value;
      return this.rebuild();
    };

    BooleanIndex.prototype.load = function(value) {
      if (value === this.value) {
        return this.valueIds;
      } else {
        return this.nonValueIds;
      }
    };

    BooleanIndex.prototype.update = function(record, oldValue, newValue) {
      if (oldValue === this.value) {
        delete this.valueIds[record.id];
      } else {
        delete this.nonValueIds[record.id];
      }
      if (newValue === this.value) {
        return this.valueIds[record.id] = record;
      } else {
        return this.nonValueIds[record.id] = record;
      }
    };

    BooleanIndex.prototype.add = function(record) {
      if (record[this.attribute] === this.value) {
        return this.valueIds[record.id] = record;
      } else {
        return this.nonValueIds[record.id] = record;
      }
    };

    BooleanIndex.prototype.remove = function(record) {
      delete this.valueIds[record.id];
      return delete this.nonValueIds[record.id];
    };

    BooleanIndex.prototype.rebuild = function() {
      var record, _i, _len, _ref, _results;
      this.valueIds = {};
      this.nonValueIds = {};
      _ref = this.modelClass.all();
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        record = _ref[_i];
        _results.push(this.add(record));
      }
      return _results;
    };

    return BooleanIndex;

  })(DataIndex);

  DataIndex.registerIndexClassType('boolean', BooleanIndex);

}).call(this);

});

require.define("/dom-manager.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var DOMManager, MztObject, Util,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  Util = require('./util');

  MztObject = require('./object').MztObject;

  exports.DOMManager = DOMManager = (function(_super) {
    var viewEventMap;

    __extends(DOMManager, _super);

    function DOMManager() {
      this.getControlOptionsValues = __bind(this.getControlOptionsValues, this);

      this.onControlEvent = __bind(this.onControlEvent, this);

      this.onViewEvent = __bind(this.onViewEvent, this);

      this.onApplicationEvent = __bind(this.onApplicationEvent, this);

      this.release = __bind(this.release, this);

      this.checkClickOutside = __bind(this.checkClickOutside, this);

      this.checkClickInside = __bind(this.checkClickInside, this);
      return DOMManager.__super__.constructor.apply(this, arguments);
    }

    viewEventMap = {
      click: 'click',
      dblclick: 'dblClick',
      focus: 'focus',
      blur: 'blur',
      keyup: 'keyUp',
      keydown: 'keyDown',
      keypress: 'keyPress',
      focusout: 'focusOut',
      focusin: 'focusIn',
      change: 'change',
      mouseover: 'mouseOver',
      mouseout: 'mouseOut'
    };

    DOMManager.prototype.init = function() {
      var domevent, events, i, method, v,
        _this = this;
      this.element = $(this.rootElement);
      for (domevent in viewEventMap) {
        method = viewEventMap[domevent];
        this.element.on(domevent, null, {
          eventName: method
        }, this.onApplicationEvent);
      }
      events = ((function() {
        var _results;
        _results = [];
        for (i in viewEventMap) {
          v = viewEventMap[i];
          _results.push(i);
        }
        return _results;
      })()).join(' ');
      this.element.on(events, '[view]', this.onViewEvent);
      this.element.on(events, '[data-mozart-action]', this.onControlEvent);
      this.openElements = {};
      return Util.find = function(id) {
        var control, elements, layout, _i, _len, _ref;
        _ref = _this.layouts;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          layout = _ref[_i];
          if (layout.views[id] != null) {
            Util.log("general", "" + id + ": view of", layout.rootElement);
            return layout.views[id];
          }
          control = layout.getControl(id);
          if (control != null) {
            Util.log("general", "" + id + ": control of", layout.rootElement);
            return control;
          }
        }
        elements = $("#" + id);
        if (elements.length > 0) {
          Util.log("general", "" + id + " is a an element");
          return elements[0];
        }
        return Util.log("general", "Cannot find ID " + id);
      };
    };

    DOMManager.prototype.checkClickInside = function(event) {
      var id, layout, view, _i, _len, _ref, _results;
      if (!(event.type === 'click')) {
        return;
      }
      _ref = this.layouts;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        layout = _ref[_i];
        _results.push((function() {
          var _ref1, _results1;
          _ref1 = layout.hasClickInside;
          _results1 = [];
          for (id in _ref1) {
            view = _ref1[id];
            if ($(event.target).parents('#' + id).length > 0) {
              Util.log('events', 'clickInside on', view, '(', event, ')');
              _results1.push(view.clickInside());
            } else {
              _results1.push(void 0);
            }
          }
          return _results1;
        })());
      }
      return _results;
    };

    DOMManager.prototype.checkClickOutside = function(event) {
      var id, layout, view, _i, _len, _ref, _results;
      if (!(event.type === 'click')) {
        return;
      }
      _ref = this.layouts;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        layout = _ref[_i];
        _results.push((function() {
          var _ref1, _results1;
          _ref1 = layout.hasClickOutside;
          _results1 = [];
          for (id in _ref1) {
            view = _ref1[id];
            if ($(event.target).parents('#' + id).length === 0) {
              Util.log('events', 'clickOutside on', view, '(', event, ')');
              _results1.push(view.clickOutside());
            } else {
              _results1.push(void 0);
            }
          }
          return _results1;
        })());
      }
      return _results;
    };

    DOMManager.prototype.release = function() {
      var domevent, events, i, method, v;
      for (domevent in viewEventMap) {
        method = viewEventMap[domevent];
        this.element.off(domevent, null, this._checkRootEvent);
      }
      events = ((function() {
        var _results;
        _results = [];
        for (i in viewEventMap) {
          v = viewEventMap[i];
          _results.push(i);
        }
        return _results;
      })()).join(' ');
      this.element.off(events, '[view]', this.onViewEvent);
      this.element.off(events, '[data-mozart-action]', this.onControlEvent);
      return DOMManager.__super__.release.apply(this, arguments);
    };

    DOMManager.prototype.onApplicationEvent = function(event) {
      return this.trigger(event.data.eventName, event);
    };

    DOMManager.prototype.onViewEvent = function(event) {
      var ele, layout, methodName, targetEle, view, _i, _len, _ref;
      this.checkClickInside(event);
      view = null;
      ele = targetEle = event.currentTarget;
      if (ele == null) {
        return;
      }
      _ref = this.layouts;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        layout = _ref[_i];
        view = layout.views[ele.id];
        if (view != null) {
          methodName = viewEventMap[event.type];
          this.trigger("viewEvent", event, view);
          if (typeof view[methodName] === 'function') {
            Util.log('events', methodName, 'on', view, '(', event, ')');
            view[methodName](event, view);
          }
        }
      }
      this.checkClickOutside(event);
      return true;
    };

    DOMManager.prototype.onControlEvent = function(event) {
      var control, ele, id, layout, _i, _len, _ref, _ref1;
      this.checkClickInside(event);
      ele = $(event.currentTarget);
      id = ele.attr('data-mozart-action');
      Util.log('controls', 'action', event);
      _ref = this.layouts;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        layout = _ref[_i];
        control = layout.getControl(id);
        if ((control != null) && (control.events === null || (_ref1 = event.type, __indexOf.call(control.events, _ref1) >= 0))) {
          if (typeof control.view[control.action] === 'function') {
            Util.log('events', 'method', control.action, 'on', control.view, '(', event, ')');
            Util.log('controls', 'action on control', control, event);
            this.trigger("controlEvent", event, control);
            control.view[control.action](ele, this.getControlOptionsValues(control.view, control.options), event);
            if (!control.allowDefault) {
              event.preventDefault();
            }
          } else {
            Util.warn("Action " + control.action + " does not exist on view " + control.view.id + ", " + control.view.name, control);
          }
        }
      }
      this.checkClickOutside(event);
      return event.stopImmediatePropagation();
    };

    DOMManager.prototype.getControlOptionsValues = function(view, options) {
      var k, k2, out, v;
      out = {};
      for (k in options) {
        v = options[k];
        if (Util.stringEndsWith(k, 'Lookup')) {
          k2 = Util.sliceStringBefore(k, 'Lookup');
          out[k2] = Util._getPath(view, v);
        } else {
          out[k] = v;
        }
      }
      return out;
    };

    return DOMManager;

  })(MztObject);

}).call(this);

});

require.define("/handlebars.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var Collection, I18nView, Util, View, getPath, _value;

  Util = require('./util');

  View = require('./view').View;

  I18nView = require('./i18n-view').I18nView;

  Collection = require('./collection').Collection;

  getPath = function(context, path) {
    return Util._getPath(context, path);
  };

  _value = function(context, path) {
    var value;
    if (typeof path === 'string') {
      value = Util._getPath(context, path);
    } else if (typeof path === 'function') {
      value = path.call(context);
    }
    return value;
  };

  Handlebars.registerHelper("site", function(context, options) {
    return new Handlebars.SafeString("/#");
  });

  Handlebars.registerHelper("bind", function(context, options) {
    var bindId, buffer, k, tag, v, _ref, _ref1;
    Util.log('handlebars', "handlebars helper 'bind':", this, context, options);
    if (arguments.length === 1) {
      Util.error("Bind helper must have a target.");
    }
    bindId = "bind" + (Util.getId());
    tag = (_ref = options.hash.tag) != null ? _ref : 'span';
    buffer = "<" + tag + " id='" + bindId + "'";
    _ref1 = options.hash;
    for (k in _ref1) {
      v = _ref1[k];
      if (Util.stringEndsWith(k, 'Html')) {
        buffer += ' ' + Util.sliceStringBefore(k, 'Html') + '="' + v + '"';
      }
    }
    buffer += "></" + tag + ">";
    options.data.registerDomBind(bindId, context);
    return new Handlebars.SafeString(buffer);
  });

  Handlebars.registerHelper("i18n", function(context, options) {
    var buffer, fn;
    Util.log('handlebars', "handlebars helper 'i18n':", this, context, options);
    if (arguments.length === 1) {
      buffer = "";
      Util.error("i18n helper usage must reference a key.");
    } else {
      fn = Util._getPath(window, "i18n." + context);
      if (fn == null) {
        Util.error("i18n helper: key '" + context + "' does not exist in current language file.");
        buffer = "";
      } else {
        buffer = Util.getPath(window, "i18n." + context)(options.hash);
      }
    }
    return new Handlebars.SafeString(buffer);
  });

  Handlebars.registerHelper("bindI18n", function(context, options) {
    var content, k, preElement, v, vco, view, _ref;
    Util.log('handlebars', "handlebars helper 'bindI18n':", this, context, options);
    if (arguments.length === 1) {
      Util.error("bindI18n helper must have a target.");
    }
    vco = {
      context: this,
      i18nTemplate: context,
      parent: options.data
    };
    if (options.hash != null) {
      _ref = options.hash;
      for (k in _ref) {
        v = _ref[k];
        vco[k] = v;
      }
    }
    view = vco.parent.layout.createView(I18nView, vco);
    vco.parent.addView(view);
    preElement = view.createElement();
    content = preElement.outerHTML;
    if (content == null) {
      content = "";
    }
    vco.parent.layout.queueRenderView(view);
    return new Handlebars.SafeString(content);
  });

  Handlebars.registerHelper("view", function(context, options) {
    var content, k, parentView, preElement, v, view, viewClass, viewCreateOptions, _ref;
    Util.log('handlebars', "handlebars helper 'view':", this, context, options);
    if (arguments.length === 1) {
      options = context;
      context = null;
    }
    parentView = options.data;
    if (context != null) {
      if (typeof context === "string") {
        viewClass = Util._getPath(context);
      } else {
        viewClass = context;
      }
    } else {
      viewClass = View;
    }
    if (viewClass == null) {
      Util.error("view handlebars helper: viewClass does not exist", "context", context, "this", this);
    }
    viewCreateOptions = {
      context: this,
      parent: parentView
    };
    if (options.fn != null) {
      viewCreateOptions.templateFunction = options.fn;
    }
    if (options.hash != null) {
      _ref = options.hash;
      for (k in _ref) {
        v = _ref[k];
        viewCreateOptions[k] = v;
      }
    }
    view = parentView.layout.createView(viewClass, viewCreateOptions);
    parentView.addView(view);
    preElement = view.createElement();
    content = preElement.outerHTML;
    if (content == null) {
      content = "";
    }
    parentView.layout.queueRenderView(view);
    return new Handlebars.SafeString(content);
  });

  Handlebars.registerHelper("collection", function(context, options) {
    var collectionClass, content, k, parentView, preElement, v, view, viewClass, viewOpts, _ref;
    Util.log('handlebars', "handlebars helper 'collection':", this, Util.clone(context), options);
    if (arguments.length === 1) {
      options = context;
      context = null;
      viewClass = View;
    } else {
      viewClass = Util.getPath(context);
      if (viewClass == null) {
        Util.error("View for collection does not exist", "view name", context);
      }
    }
    parentView = options.data;
    viewOpts = {
      context: this,
      viewClass: viewClass,
      parent: parentView
    };
    if (options.fn != null) {
      viewOpts.viewClassTemplateFunction = options.fn;
    }
    _ref = options.hash;
    for (k in _ref) {
      v = _ref[k];
      viewOpts[k] = v;
    }
    if (options.hash.collectionClass != null) {
      collectionClass = Util.getPath(options.hash.collectionClass);
    } else {
      collectionClass = Collection;
    }
    view = parentView.layout.createView(collectionClass, viewOpts);
    view.parent = parentView;
    parentView.addView(view);
    preElement = view.createElement();
    content = preElement.outerHTML;
    if (content == null) {
      content = "";
    }
    parentView.layout.queueRenderView(view);
    return new Handlebars.SafeString(content);
  });

  Handlebars.registerHelper("linkTo", function(record, options) {
    var ret, text, _ref;
    Util.log('handlebars', "handlebars helper 'linkTo':", this, record, options);
    if (arguments.length === 1) {
      options = record;
    }
    if (typeof record === 'string') {
      record = Util._getPath(this, record);
    } else if (typeof record === 'function') {
      record = record.call(this);
    }
    if (record != null) {
      ret = "<a href='/#" + record.showUrl() + "'";
      if (((_ref = options.hash) != null ? _ref.classNames : void 0) != null) {
        ret += " class='" + options.hash.classNames + "'";
      }
      ret += ">";
      text = options.fn(this);
      if (!((text != null) && text.length > 0)) {
        text = "(Empty Value)";
      }
      ret += text;
      ret += '</a>';
      return new Handlebars.SafeString(ret);
    } else {
      return "";
    }
  });

  Handlebars.registerHelper("valueOf", function(record, options) {
    var value;
    Util.log('handlebars', "handlebars helper 'valueOf':", this, record, options);
    if (arguments.length === 1) {
      options = record;
    }
    value = Util._getPath(this, record);
    if (value == null) {
      value = "";
    }
    return new Handlebars.SafeString(value);
  });

  Handlebars.registerHelper("rawPath", function(record, options) {
    var value;
    if (arguments.length === 1) {
      options = record;
    }
    value = Util._getPath(this, record);
    if (value == null) {
      value = "";
    }
    return value;
  });

  Handlebars.registerHelper("uriPath", function(record, options) {
    var value;
    if (arguments.length === 1) {
      options = record;
    }
    value = Util._getPath(this, record);
    if (value == null) {
      value = "";
    }
    value;

    return encodeURI(value);
  });

  Handlebars.registerHelper("valueEach", function(record, options) {
    var context, out, _i, _len, _ref, _ref1;
    Util.log('handlebars', "handlebars helper 'valueEach':", this, record, options);
    if (arguments.length === 1) {
      options = record;
    }
    record = Util.getPath(this, record);
    if (record == null) {
      return "";
    }
    out = "";
    for (_i = 0, _len = record.length; _i < _len; _i++) {
      context = record[_i];
      out += options.fn(context);
      if ((options != null ? (_ref = options.hash) != null ? _ref.seperator : void 0 : void 0) != null) {
        out += options.hash.seperator;
      }
    }
    if (((options != null ? (_ref1 = options.hash) != null ? _ref1.seperator : void 0 : void 0) != null) && out.length > 0) {
      out = out.slice(0, out.length - options.hash.seperator.length);
    }
    return new Handlebars.SafeString(out);
  });

  Handlebars.registerHelper("yesNo", function(path, options) {
    Util.log('handlebars', "handlebars helper 'yesNo':", this, path, options);
    if (arguments.length === 1) {
      options = path;
    }
    if (typeof path === 'string') {
      path = Util.getPath(this, path);
    }
    if (path == null) {
      return "No";
    }
    if (path) {
      return "Yes";
    } else {
      return "No";
    }
  });

  Handlebars.registerHelper("valueIf", function(context, options) {
    Util.log('handlebars', "handlebars helper 'valueOf':", this, context, options);
    if (typeof context === 'string') {
      context = Util._getPath(this, context);
    }
    if (context) {
      return options.fn(this);
    } else {
      return options.inverse(this);
    }
  });

  Handlebars.registerHelper("valueUnless", function(context, options) {
    if (typeof context === 'string') {
      context = Util.getPath(this, context);
    }
    if (!context) {
      return options.fn(this);
    } else {
      return options.inverse(this);
    }
  });

  Handlebars.registerHelper("action", function(action, options) {
    var actionId, allowDefault, evt, ret, target;
    Util.log('handlebars', "handlebars helper 'action':", this, action, options);
    if (arguments.length === 1) {
      options = record;
    }
    target = options.data;
    if (options.hash.target != null) {
      if (options.hash.target === "parent") {
        target = options.data.parent;
      } else {
        target = Util.getPath(options.data, options.hash.target);
      }
    }
    actionId = Util.getId();
    ret = 'data-mozart-action="' + actionId + '"';
    if (options.hash.events != null) {
      evt = options.hash.events.split(',');
    } else {
      evt = ["click"];
    }
    allowDefault = options.hash.allowDefault && true;
    options.data.layout.addControl(actionId, {
      action: action,
      view: target,
      options: options.hash,
      events: evt,
      allowDefault: allowDefault
    });
    return new Handlebars.SafeString(ret);
  });

  Handlebars.registerHelper("date", function(path) {
    var formatted, value;
    value = _value(this, path);
    formatted = Util.serverToLocalDate(value) || '(none)';
    return new Handlebars.SafeString(formatted);
  });

  Handlebars.registerHelper("dateTime", function(path) {
    var formatted, value;
    value = _value(this, path);
    formatted = Util.serverToLocalDateTime(value);
    return new Handlebars.SafeString(formatted);
  });

  Handlebars.registerHelper("timeAgo", function(path) {
    var formatted, value;
    value = _value(this, path);
    formatted = Util.serverToLocalTimeAgo(value);
    return new Handlebars.SafeString(formatted);
  });

  Handlebars.registerHelper("mozartversion", function() {
    return new Handlebars.SafeString(Mozart.version);
  });

  Handlebars.registerHelper("mozartversiondate", function() {
    return new Handlebars.SafeString(Mozart.versionDate.toLocaleDateString());
  });

}).call(this);

});

require.define("/i18n-view.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var I18nView, Util, View,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  View = require('./view').View;

  Util = require('./util');

  exports.I18nView = I18nView = (function(_super) {

    __extends(I18nView, _super);

    function I18nView() {
      return I18nView.__super__.constructor.apply(this, arguments);
    }

    I18nView.prototype.tag = 'span';

    I18nView.prototype.idPrefix = 'i18nview';

    I18nView.prototype.init = function() {
      I18nView.__super__.init.apply(this, arguments);
      if (this.i18nTemplate == null) {
        throw new Error("Mozart.I18nView must have a i18nTemplate");
      }
      return this.bind('change', this.redraw);
    };

    I18nView.prototype.templateFunction = function() {
      return Util.getPath(window, "i18n." + this.i18nTemplate)(this);
    };

    return I18nView;

  })(View);

}).call(this);

});

require.define("/layout.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var Layout, Router, Util,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  Util = require('./util');

  Router = require('./router').Router;

  exports.Layout = Layout = (function(_super) {

    __extends(Layout, _super);

    function Layout() {
      this.releaseViewControls = __bind(this.releaseViewControls, this);

      this.removeControl = __bind(this.removeControl, this);

      this.getControl = __bind(this.getControl, this);

      this.addControl = __bind(this.addControl, this);

      this.releaseViews = __bind(this.releaseViews, this);

      this.releaseView = __bind(this.releaseView, this);

      this.queueReleaseView = __bind(this.queueReleaseView, this);

      this.release = __bind(this.release, this);

      this.processRenderQueue = __bind(this.processRenderQueue, this);

      this.queueRenderView = __bind(this.queueRenderView, this);

      this._transition = __bind(this._transition, this);

      this.doRoute = __bind(this.doRoute, this);

      this.resetRoute = __bind(this.resetRoute, this);

      this.bindRoot = __bind(this.bindRoot, this);

      this.createView = __bind(this.createView, this);

      this.init = __bind(this.init, this);
      return Layout.__super__.constructor.apply(this, arguments);
    }

    Layout.prototype.init = function() {
      var state, _i, _len, _ref, _results;
      Layout.__super__.init.apply(this, arguments);
      this.viewRenderQueue = [];
      this.releaseMap = {};
      this.views = {};
      this.currentState = null;
      this.controls = {};
      this.hasClickOutside = {};
      this.hasClickInside = {};
      _ref = this.states;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        state = _ref[_i];
        if ((state.path != null) && (state.viewClass != null)) {
          _results.push(this.register(state.path, this.doRoute, state));
        }
      }
      return _results;
    };

    Layout.prototype.createView = function(viewClass, options) {
      var view;
      if (options == null) {
        options = {};
      }
      options.layout = this;
      view = viewClass.create(options);
      this.views[view.id] = view;
      if (view.clickInside != null) {
        this.hasClickInside[view.id] = view;
      }
      if (view.clickOutside != null) {
        this.hasClickOutside[view.id] = view;
      }
      return view;
    };

    Layout.prototype.bindRoot = function() {
      return this.rootEl = $(this.rootElement)[0];
    };

    Layout.prototype.resetRoute = function() {
      this.viewRenderQueue = [];
      this.currentState = null;
      return this.releaseViews();
    };

    Layout.prototype.doRoute = function(state, params) {
      if ((this.currentState != null) && !this.currentState.canExit()) {
        Util.log('layout', 'cannot exit state', this.currentState);
        return false;
      }
      this.currentState = null;
      if (!state.canEnter(params)) {
        Util.log('layout', 'cannot enter state', state, params);
        return false;
      }
      this._transition(state);
      return true;
    };

    Layout.prototype._transition = function(state) {
      this.resetRoute();
      this.currentState = state;
      this.currentState.doTitle();
      if (this.currentState.viewClass != null) {
        if (this.currentView != null) {
          this.releaseMap[this.currentView.id] = this.currentView;
        }
        this.currentView = this.createView(this.currentState.viewClass, this.currentState.viewOptions);
        this.currentView.el = this.rootEl;
        return this.queueRenderView(this.currentView);
      }
    };

    Layout.prototype.queueRenderView = function(view) {
      var _base, _name, _ref;
      Util.log('layout', "" + this._mozartId + " queueRenderView", view);
      if ((_ref = (_base = this.views)[_name = view.id]) == null) {
        _base[_name] = view;
      }
      if (this.viewRenderQueue.length === 0) {
        _.delay(this.processRenderQueue, 0);
      }
      return this.viewRenderQueue.push(view);
    };

    Layout.prototype.processRenderQueue = function() {
      var id, postRenderQueue, renderQueue, toRemove, topRenderQueue, view, view1, view2, _i, _j, _k, _l, _len, _len1, _len2, _len3, _len4, _m, _ref;
      if (this.viewRenderQueue.length === 0) {
        return;
      }
      Util.log('layout', "" + this._mozartId + " processRenderQueue with " + this.viewRenderQueue.length + " views");
      postRenderQueue = [];
      renderQueue = [];
      while (this.viewRenderQueue.length > 0) {
        view = this.viewRenderQueue.shift();
        view.beforeRender();
        view.releaseChildren();
        view.prepareElement();
        renderQueue.push(view);
      }
      toRemove = [];
      for (_i = 0, _len = renderQueue.length; _i < _len; _i++) {
        view1 = renderQueue[_i];
        for (_j = 0, _len1 = renderQueue.length; _j < _len1; _j++) {
          view2 = renderQueue[_j];
          if (view2 !== view1) {
            if (view1.hasAncestor(view2) && !_.contains(toRemove, view1)) {
              toRemove.push(view1);
            }
          }
        }
      }
      topRenderQueue = _.difference(renderQueue, toRemove);
      for (_k = 0, _len2 = topRenderQueue.length; _k < _len2; _k++) {
        view = topRenderQueue[_k];
        view.reassignElements();
      }
      for (_l = 0, _len3 = topRenderQueue.length; _l < _len3; _l++) {
        view = topRenderQueue[_l];
        view.replaceElement();
      }
      for (_m = 0, _len4 = renderQueue.length; _m < _len4; _m++) {
        view = renderQueue[_m];
        view.postRender();
      }
      _ref = this.releaseMap;
      for (id in _ref) {
        view = _ref[id];
        if (view != null) {
          view.release();
        }
      }
      this.releaseMap = {};
      Util.log('layout', "" + this._mozartId + " render finished");
      return this.trigger('render:complete');
    };

    Layout.prototype.release = function() {
      this.releaseViews();
      return Layout.__super__.release.apply(this, arguments);
    };

    Layout.prototype.queueReleaseView = function(view) {
      return this.releaseMap[view.id] = view;
    };

    Layout.prototype.releaseView = function(view) {
      this.releaseViewControls(view);
      delete this.views[view.id];
      delete this.hasClickOutside[view.id];
      return delete this.hasClickInside[view.id];
    };

    Layout.prototype.releaseViews = function() {
      var id, view, _ref, _results;
      _ref = this.views;
      _results = [];
      for (id in _ref) {
        view = _ref[id];
        Util.log('layout', "processRenderQueue:releasing", view.id, view);
        this.releaseMap[id] = view;
        _results.push(this.processRenderQueue());
      }
      return _results;
    };

    Layout.prototype.addControl = function(id, control) {
      Util.log('layout', 'adding control', id, control);
      return this.controls[id] = control;
    };

    Layout.prototype.getControl = function(id) {
      return this.controls[id];
    };

    Layout.prototype.removeControl = function(id) {
      Util.log('layout', 'removing control', id);
      return delete this.controls[id];
    };

    Layout.prototype.releaseViewControls = function(view) {
      var control, id, _ref, _results;
      _ref = this.controls;
      _results = [];
      for (id in _ref) {
        control = _ref[id];
        if (!(control.view === view)) {
          continue;
        }
        Util.log('layout', 'releasing control for view', view, 'control', control.action, control);
        _results.push(delete this.controls[id]);
      }
      return _results;
    };

    return Layout;

  })(Router);

}).call(this);

});

require.define("/router.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var MztObject, Router, Util,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  MztObject = require('./object').MztObject;

  Util = require('./util');

  exports.Router = Router = (function(_super) {

    __extends(Router, _super);

    function Router() {
      this.release = __bind(this.release, this);

      this.navigateRoute = __bind(this.navigateRoute, this);

      this.onPopState = __bind(this.onPopState, this);

      this.onNavigationEvent = __bind(this.onNavigationEvent, this);

      this.onHashChange = __bind(this.onHashChange, this);

      this.register = __bind(this.register, this);

      this.stop = __bind(this.stop, this);

      this.start = __bind(this.start, this);

      this.init = __bind(this.init, this);
      return Router.__super__.constructor.apply(this, arguments);
    }

    Router.prototype.init = function() {
      var _ref;
      this.routes = {};
      return (_ref = this.useHashRouting) != null ? _ref : this.useHashRouting = false;
    };

    Router.prototype.start = function() {
      if (this.useHashRouting) {
        $(window).bind('hashchange', this.onHashChange);
        return this.navigateRoute(window.location.hash);
      } else {
        $('body').on("click", 'a', this.onNavigationEvent);
        $(window).on("popstate", this.onPopState);
        return this.navigateRoute(document.location.pathname);
      }
    };

    Router.prototype.stop = function() {
      if (this.useHashRouting) {
        return $(window).unbind('hashchange', this.onHashChange);
      } else {
        $('body').off("click", 'a', this.onNavigationEvent);
        return $(window).off("popstate", this.onPopState);
      }
    };

    Router.prototype.register = function(route, callback, data) {
      var params, regex, token, tokens, _i, _len;
      Util.log('routes', "registering route", route, data);
      tokens = route.split('/');
      params = [];
      regex = this.useHashRouting ? '\\#' : '';
      for (_i = 0, _len = tokens.length; _i < _len; _i++) {
        token = tokens[_i];
        if (token[0] === ':') {
          regex += '([^\\/]+)\\/';
          params.push(token.substr(1));
        } else {
          regex += this._escForRegEx(token) + '\\/';
        }
      }
      if (regex.length > 2) {
        regex = regex.substr(0, regex.length - 2);
      }
      return this.routes[route] = {
        regex: new RegExp('^' + regex + '$', 'i'),
        params: params,
        callback: callback,
        data: data
      };
    };

    Router.prototype.onHashChange = function() {
      return this.navigateRoute(window.location.hash);
    };

    Router.prototype.onNavigationEvent = function(event) {
      if (event.target.host !== document.location.host || event.target.port !== document.location.port || event.target.protocol !== document.location.protocol) {
        return;
      }
      if (this.navigateRoute(event.target.pathname)) {
        history.pushState({
          one: 1
        }, null, event.target.href);
        return event.preventDefault();
      }
    };

    Router.prototype.onPopState = function() {
      return this.navigateRoute(window.location.pathname);
    };

    Router.prototype.navigateRoute = function(urlPath) {
      var i, m, obj, path, pn, route, _i, _len, _ref, _ref1;
      this.isNavigating = true;
      if (!(urlPath != null) || urlPath.length === 0) {
        route = this.routes['/'];
        if (route != null) {
          route.callback(route.data, obj);
          this.isNavigating = false;
          return false;
        } else {
          Util.log("routemanager", "WARNING: No Default route defined, no route for path", urlPath);
        }
      }
      _ref = this.routes;
      for (path in _ref) {
        route = _ref[path];
        obj = {};
        m = route.regex.exec(urlPath);
        if (m !== null) {
          i = 1;
          _ref1 = route.params;
          for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
            pn = _ref1[_i];
            if (i < m.length) {
              obj[pn] = m[i++];
            }
          }
          route.callback(route.data, obj);
          this.isNavigating = false;
          return true;
        }
      }
      this.isNavigating = false;
      this.trigger('noroute', window.location.hash);
      return false;
    };

    Router.prototype.release = function() {
      this.stop();
      return Router.__super__.release.apply(this, arguments);
    };

    Router.prototype._escForRegEx = function(str) {
      var escchars, i, _i, _len;
      str.replace('\\', '\\\\');
      escchars = "./+{}()*";
      for (_i = 0, _len = escchars.length; _i < _len; _i++) {
        i = escchars[_i];
        str = str.replace(i, '\\' + i);
      }
      return str;
    };

    return Router;

  })(MztObject);

}).call(this);

});

require.define("/model-instance.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var Instance, MztObject, Util,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  Util = require('./util');

  MztObject = require('./object').MztObject;

  exports.Instance = Instance = (function(_super) {
    var MODELFIELDS;

    __extends(Instance, _super);

    function Instance() {
      this.copyFrom = __bind(this.copyFrom, this);

      this.copyTo = __bind(this.copyTo, this);

      this.destroy = __bind(this.destroy, this);

      this.save = __bind(this.save, this);

      this.load = __bind(this.load, this);
      return Instance.__super__.constructor.apply(this, arguments);
    }

    MODELFIELDS = ['id'];

    Instance.prototype.init = function() {
      return this._type = this.modelClass.modelName;
    };

    Instance.prototype.load = function(options) {
      if (options == null) {
        options = {};
      }
      return this.modelClass.loadInstance(this, options);
    };

    Instance.prototype.save = function(options) {
      if (options == null) {
        options = {};
      }
      if (!this.modelClass.exists(this.id)) {
        this.modelClass.createInstance(this, options);
        this.trigger('create');
      } else {
        this.modelClass.updateInstance(this, options);
        this.trigger('update');
      }
      return this.trigger('change');
    };

    Instance.prototype.destroy = function(options) {
      if (options == null) {
        options = {};
      }
      this.trigger('destroy', options);
      this.trigger('change');
      return this.modelClass.destroyInstance(this, options);
    };

    Instance.prototype.get = function(key) {
      if (this.modelClass.hasAttribute(key) || Util.isFunction(this[key])) {
        if (Util.isFunction(this[key])) {
          return this[key]();
        } else {
          return Instance.__super__.get.call(this, key);
        }
      } else {
        throw new Error("" + this.modelClass.modelName + " has no attribute or relation '" + key + "' or foreign key '" + key + "_id'");
      }
    };

    Instance.prototype.set = function(key, value) {
      if (this.modelClass.hasAttribute(key) || Util.isFunction(this[key])) {
        if (Util.isFunction(this[key])) {
          return this[key](value);
        } else {
          if (key !== 'id' && this.modelClass.hasIndex(key) && this.modelClass.exists(this.id)) {
            this.modelClass.updateIndex(key, this, this[key], value);
          }
          return Instance.__super__.set.call(this, key, value);
        }
      } else {
        throw new Error("" + this.modelClass.modelName + " has no attribute or relation '" + key + "' or foreign key '" + key + "_id'");
      }
    };

    Instance.prototype.copyTo = function(object) {
      var attr, type, _ref;
      if (object == null) {
        object = MztObject.create();
      }
      _ref = this.modelClass.attrs;
      for (attr in _ref) {
        type = _ref[attr];
        if (__indexOf.call(MODELFIELDS, attr) < 0) {
          if (object.set != null) {
            object.set(attr, this[attr]);
          } else {
            object[attr] = this[attr];
          }
        }
      }
      return object;
    };

    Instance.prototype.copyFrom = function(object) {
      var attr, changed, newval, type, value;
      changed = false;
      for (attr in object) {
        value = object[attr];
        if (!(__indexOf.call(MODELFIELDS, attr) < 0)) {
          continue;
        }
        type = this.modelClass.attrs[attr];
        if (type != null) {
          newval = value;
          if (type === 'decimal') {
            newval = parseFloat(newval);
          }
          if (this[attr] !== newval) {
            changed = true;
            this.set(attr, newval);
          }
        }
      }
      return changed;
    };

    return Instance;

  })(MztObject);

}).call(this);

});

require.define("/model-instancecollection.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var InstanceCollection, MztObject, Util,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  Util = require('./util');

  MztObject = require('./object').MztObject;

  exports.InstanceCollection = InstanceCollection = (function(_super) {

    __extends(InstanceCollection, _super);

    function InstanceCollection() {
      this.unBindEvents = __bind(this.unBindEvents, this);

      this.bindEvents = __bind(this.bindEvents, this);

      this.allAsMap = __bind(this.allAsMap, this);

      this.count = __bind(this.count, this);
      return InstanceCollection.__super__.constructor.apply(this, arguments);
    }

    InstanceCollection.prototype.count = function() {
      return this.all().length;
    };

    InstanceCollection.prototype.allAsMap = function() {
      return Util.toMap(this.all());
    };

    InstanceCollection.prototype.all = function() {
      return [];
    };

    InstanceCollection.prototype.bindEvents = function(models) {
      var m, _i, _len, _results;
      _results = [];
      for (_i = 0, _len = models.length; _i < _len; _i++) {
        m = models[_i];
        m.bind('create', this.onModelChange);
        m.bind('update', this.onModelChange);
        _results.push(m.bind('destroy', this.onModelChange));
      }
      return _results;
    };

    InstanceCollection.prototype.unBindEvents = function(models) {
      var m, _i, _len, _results;
      _results = [];
      for (_i = 0, _len = models.length; _i < _len; _i++) {
        m = models[_i];
        m.unbind('create', this.onModelChange);
        m.unbind('update', this.onModelChange);
        _results.push(m.unbind('destroy', this.onModelChange));
      }
      return _results;
    };

    return InstanceCollection;

  })(MztObject);

}).call(this);

});

require.define("/model-onetomanycollection.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var InstanceCollection, OneToManyCollection,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  InstanceCollection = require('./model-instancecollection').InstanceCollection;

  exports.OneToManyCollection = OneToManyCollection = (function(_super) {

    __extends(OneToManyCollection, _super);

    function OneToManyCollection() {
      this.release = __bind(this.release, this);

      this.onModelChange = __bind(this.onModelChange, this);

      this.contains = __bind(this.contains, this);

      this.remove = __bind(this.remove, this);

      this.createFromValues = __bind(this.createFromValues, this);

      this.add = __bind(this.add, this);

      this.all = __bind(this.all, this);
      return OneToManyCollection.__super__.constructor.apply(this, arguments);
    }

    OneToManyCollection.prototype.init = function() {
      return this.bindEvents([this.otherModel]);
    };

    OneToManyCollection.prototype.all = function() {
      return this.otherModel.findByAttribute(this.fkname, this.record.id);
    };

    OneToManyCollection.prototype.add = function(instance) {
      instance.set(this.fkname, this.record.id);
      instance.save();
      return this.record.trigger("change:" + this.attribute);
    };

    OneToManyCollection.prototype.createFromValues = function(values) {
      var inst;
      inst = this.otherModel.initInstance(values);
      this.add(inst);
      return inst;
    };

    OneToManyCollection.prototype.remove = function(instance) {
      instance.set(this.fkname, null);
      return this.record.trigger("change:" + this.attribute);
    };

    OneToManyCollection.prototype.contains = function(instance) {
      return this.otherModel.findByAttribute(this.fkname, this.record.id).length > 0;
    };

    OneToManyCollection.prototype.onModelChange = function(instance) {
      return this.trigger('change', instance);
    };

    OneToManyCollection.prototype.release = function() {
      this.unBindEvents([this.otherModel]);
      return OneToManyCollection.__super__.release.apply(this, arguments);
    };

    return OneToManyCollection;

  })(InstanceCollection);

}).call(this);

});

require.define("/model-onetomanypolycollection.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var InstanceCollection, OneToManyPolyCollection,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  InstanceCollection = require('./model-instancecollection').InstanceCollection;

  exports.OneToManyPolyCollection = OneToManyPolyCollection = (function(_super) {

    __extends(OneToManyPolyCollection, _super);

    function OneToManyPolyCollection() {
      this.contains = __bind(this.contains, this);

      this.remove = __bind(this.remove, this);

      this.add = __bind(this.add, this);

      this.createFromValues = __bind(this.createFromValues, this);

      this.all = __bind(this.all, this);
      return OneToManyPolyCollection.__super__.constructor.apply(this, arguments);
    }

    OneToManyPolyCollection.prototype.all = function() {
      var query;
      query = {};
      query[this.thatFkAttr] = this.record.id;
      query[this.thatTypeAttr] = this.model.modelName;
      return this.otherModel.findByAttributes(query);
    };

    OneToManyPolyCollection.prototype.createFromValues = function(values) {
      var inst;
      inst = this.otherModel.initInstance(values);
      this.add(inst);
      return inst;
    };

    OneToManyPolyCollection.prototype.add = function(instance) {
      instance.set(this.thatFkAttr, this.record.id);
      instance.set(this.thatTypeAttr, this.model.modelName);
      return instance.save();
    };

    OneToManyPolyCollection.prototype.remove = function(instance) {
      instance.set(this.thatFkAttr, null);
      instance.set(this.thatTypeAttr, null);
      return instance.save();
    };

    OneToManyPolyCollection.prototype.contains = function(instance) {
      var query;
      query = {};
      query[this.thatFkAttr] = this.record.id;
      query[this.thatTypeAttr] = this.model.modelName;
      return this.otherModel.findByAttributes(query).length !== 0;
    };

    return OneToManyPolyCollection;

  })(InstanceCollection);

}).call(this);

});

require.define("/model-manytomanycollection.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var InstanceCollection, ManyToManyCollection,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  InstanceCollection = require('./model-instancecollection').InstanceCollection;

  exports.ManyToManyCollection = ManyToManyCollection = (function(_super) {

    __extends(ManyToManyCollection, _super);

    function ManyToManyCollection() {
      this.release = __bind(this.release, this);

      this.onModelChange = __bind(this.onModelChange, this);

      this.contains = __bind(this.contains, this);

      this.remove = __bind(this.remove, this);

      this.createFromValues = __bind(this.createFromValues, this);

      this.add = __bind(this.add, this);

      this.all = __bind(this.all, this);
      return ManyToManyCollection.__super__.constructor.apply(this, arguments);
    }

    ManyToManyCollection.prototype.init = function() {
      return this.bindEvents([this.linkModel]);
    };

    ManyToManyCollection.prototype.all = function() {
      var link, links, _i, _len, _results;
      links = this.linkModel.findByAttribute(this.thisFkAttr, this.record.id);
      _results = [];
      for (_i = 0, _len = links.length; _i < _len; _i++) {
        link = links[_i];
        _results.push(this.otherModel.findById(link[this.thatFkAttr]));
      }
      return _results;
    };

    ManyToManyCollection.prototype.add = function(instance) {
      var linkInstance, query;
      query = {};
      query[this.thisFkAttr] = this.record.id;
      query[this.thatFkAttr] = instance.id;
      if (this.linkModel.findByAttributes(query).length === 0) {
        linkInstance = this.linkModel.initInstance();
        linkInstance.set(this.thisFkAttr, this.record.id);
        linkInstance.set(this.thatFkAttr, instance.id);
        linkInstance.save();
        return linkInstance;
      }
    };

    ManyToManyCollection.prototype.createFromValues = function(values) {
      var inst;
      inst = this.otherModel.initInstance(values);
      inst.save();
      this.add(inst);
      return inst;
    };

    ManyToManyCollection.prototype.remove = function(instance) {
      var linkInstance, links, query, _i, _len, _results;
      query = {};
      query[this.thisFkAttr] = this.record.id;
      query[this.thatFkAttr] = instance.id;
      links = this.linkModel.findByAttributes(query);
      _results = [];
      for (_i = 0, _len = links.length; _i < _len; _i++) {
        linkInstance = links[_i];
        _results.push(linkInstance.destroy());
      }
      return _results;
    };

    ManyToManyCollection.prototype.contains = function(instance) {
      var query;
      query = {};
      query[this.thisFkAttr] = this.record.id;
      query[this.thatFkAttr] = instance.id;
      return this.linkModel.findByAttributes(query).length !== 0;
    };

    ManyToManyCollection.prototype.onModelChange = function(link) {
      var instance;
      if (link.get(this.thisFkAttr) === this.record.id) {
        instance = this.otherModel.findById(link[this.thatFkAttr]);
        return this.trigger('change', instance);
      }
    };

    ManyToManyCollection.prototype.release = function() {
      this.unBindEvents([this.linkModel]);
      return ManyToManyCollection.__super__.release.apply(this, arguments);
    };

    return ManyToManyCollection;

  })(InstanceCollection);

}).call(this);

});

require.define("/model-manytomanypolycollection.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var InstanceCollection, ManyToManyPolyCollection,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  InstanceCollection = require('./model-instancecollection').InstanceCollection;

  exports.ManyToManyPolyCollection = ManyToManyPolyCollection = (function(_super) {

    __extends(ManyToManyPolyCollection, _super);

    function ManyToManyPolyCollection() {
      this.release = __bind(this.release, this);

      this.onModelChange = __bind(this.onModelChange, this);

      this.contains = __bind(this.contains, this);

      this.remove = __bind(this.remove, this);

      this.add = __bind(this.add, this);

      this.createFromValues = __bind(this.createFromValues, this);

      this.all = __bind(this.all, this);
      return ManyToManyPolyCollection.__super__.constructor.apply(this, arguments);
    }

    ManyToManyPolyCollection.prototype.init = function() {
      return this.bindEvents([this.linkModel]);
    };

    ManyToManyPolyCollection.prototype.all = function() {
      var link, links, query, _i, _len, _results;
      query = {};
      query[this.thisFkAttr] = this.record.id;
      query[this.thatTypeAttr] = this.otherModel.modelName;
      links = this.linkModel.findByAttributes(query);
      _results = [];
      for (_i = 0, _len = links.length; _i < _len; _i++) {
        link = links[_i];
        _results.push(this.otherModel.findById(link[this.thatFkAttr]));
      }
      return _results;
    };

    ManyToManyPolyCollection.prototype.createFromValues = function(values) {
      var inst;
      inst = this.otherModel.initInstance(values);
      inst.save();
      this.add(inst);
      return inst;
    };

    ManyToManyPolyCollection.prototype.add = function(instance) {
      var linkInstance, query;
      query = {};
      query[this.thisFkAttr] = this.record.id;
      query[this.thatFkAttr] = instance.id;
      query[this.thatTypeAttr] = this.otherModel.modelName;
      if (this.linkModel.findByAttributes(query).length === 0) {
        linkInstance = this.linkModel.initInstance();
        linkInstance.set(this.thisFkAttr, this.record.id);
        linkInstance.set(this.thatFkAttr, instance.id);
        linkInstance.set(this.thatTypeAttr, this.otherModel.modelName);
        linkInstance.save();
        return linkInstance;
      }
    };

    ManyToManyPolyCollection.prototype.remove = function(instance) {
      var link, query, _i, _len, _ref, _results;
      query = {};
      query[this.thisFkAttr] = this.record.id;
      query[this.thatFkAttr] = instance.id;
      query[this.thatTypeAttr] = this.otherModel.modelName;
      _ref = this.linkModel.findByAttributes(query);
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        link = _ref[_i];
        _results.push(link.destroy());
      }
      return _results;
    };

    ManyToManyPolyCollection.prototype.contains = function(instance) {
      var query;
      query = {};
      query[this.thisFkAttr] = this.record.id;
      query[this.thatFkAttr] = instance.id;
      query[this.thatTypeAttr] = this.otherModel.modelName;
      return this.linkModel.findByAttributes(query).length !== 0;
    };

    ManyToManyPolyCollection.prototype.onModelChange = function(link) {
      var instance;
      if (link[this.thisFkAttr] === this.record.id && link[this.thatTypeAttr] === this.otherModel.modelName) {
        instance = this.otherModel.findById(link[this.thatFkAttr]);
        return this.trigger('change', instance);
      }
    };

    ManyToManyPolyCollection.prototype.release = function() {
      this.unBindEvents([this.linkModel]);
      return ManyToManyPolyCollection.__super__.release.apply(this, arguments);
    };

    return ManyToManyPolyCollection;

  })(InstanceCollection);

}).call(this);

});

require.define("/model-manytomanypolyreversecollection.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var InstanceCollection, ManyToManyPolyReverseCollection,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  InstanceCollection = require('./model-instancecollection').InstanceCollection;

  exports.ManyToManyPolyReverseCollection = ManyToManyPolyReverseCollection = (function(_super) {

    __extends(ManyToManyPolyReverseCollection, _super);

    function ManyToManyPolyReverseCollection() {
      this.release = __bind(this.release, this);

      this.onModelChange = __bind(this.onModelChange, this);

      this.contains = __bind(this.contains, this);

      this.remove = __bind(this.remove, this);

      this.add = __bind(this.add, this);

      this.createFromValues = __bind(this.createFromValues, this);

      this.all = __bind(this.all, this);
      return ManyToManyPolyReverseCollection.__super__.constructor.apply(this, arguments);
    }

    ManyToManyPolyReverseCollection.prototype.init = function() {
      return this.bindEvents([this.linkModel]);
    };

    ManyToManyPolyReverseCollection.prototype.all = function() {
      var link, links, query, _i, _len, _results;
      query = {};
      query[this.thatFkAttr] = this.record.id;
      query[this.thatTypeAttr] = this.model.modelName;
      links = this.linkModel.findByAttributes(query);
      _results = [];
      for (_i = 0, _len = links.length; _i < _len; _i++) {
        link = links[_i];
        _results.push(this.otherModel.findById(link[this.thisFkAttr]));
      }
      return _results;
    };

    ManyToManyPolyReverseCollection.prototype.createFromValues = function(values) {
      var inst;
      inst = this.otherModel.initInstance(values);
      inst.save();
      this.add(inst);
      return inst;
    };

    ManyToManyPolyReverseCollection.prototype.add = function(instance) {
      var linkInstance, query;
      query = {};
      query[this.thisFkAttr] = instance.id;
      query[this.thatFkAttr] = this.record.id;
      query[this.thatTypeAttr] = this.model.modelName;
      if (this.linkModel.findByAttributes(query).length === 0) {
        linkInstance = this.linkModel.initInstance();
        linkInstance.set(this.thisFkAttr, instance.id);
        linkInstance.set(this.thatFkAttr, this.record.id);
        linkInstance.set(this.thatTypeAttr, this.model.modelName);
        linkInstance.save();
        return linkInstance;
      }
    };

    ManyToManyPolyReverseCollection.prototype.remove = function(instance) {
      var link, query, _i, _len, _ref, _results;
      query = {};
      query[this.thisFkAttr] = instance.id;
      query[this.thatFkAttr] = this.record.id;
      query[this.thatTypeAttr] = this.model.modelName;
      _ref = this.linkModel.findByAttributes(query);
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        link = _ref[_i];
        _results.push(link.destroy());
      }
      return _results;
    };

    ManyToManyPolyReverseCollection.prototype.contains = function(instance) {
      var query;
      query = {};
      query[this.thisFkAttr] = instance.id;
      query[this.thatFkAttr] = this.record.id;
      query[this.thatTypeAttr] = this.model.modelName;
      return this.linkModel.findByAttributes(query).length !== 0;
    };

    ManyToManyPolyReverseCollection.prototype.onModelChange = function(link) {
      var instance;
      if (link[this.thatFkAttr] === this.record.id && link[this.thatTypeAttr] === this.model.modelName) {
        instance = this.model.findById(link[this.thisFkAttr]);
        return this.trigger('change', instance);
      }
    };

    ManyToManyPolyReverseCollection.prototype.release = function() {
      this.unBindEvents([this.linkModel]);
      return ManyToManyPolyReverseCollection.__super__.release.apply(this, arguments);
    };

    return ManyToManyPolyReverseCollection;

  })(InstanceCollection);

}).call(this);

});

require.define("/model-ajax.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var Model, Util, _clientToServerId, _serverToClientId;

  Model = require('./model').Model;

  Util = require('./util');

  _serverToClientId = {};

  _clientToServerId = {};

  Model.extend({
    ajax: function(options) {
      var field, _i, _len, _name, _name1, _ref, _ref1, _ref2, _ref3;
      _ref = ['url', 'interface', 'plural'];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        field = _ref[_i];
        if (options[field] != null) {
          this[field] = options[field];
        }
      }
      this.bind('load', this.loadServer);
      this.bind('create', this.createServer);
      this.bind('update', this.updateServer);
      this.bind('destroy', this.destroyServer);
      if ((_ref1 = _serverToClientId[_name = this.modelName]) == null) {
        _serverToClientId[_name] = {};
      }
      if ((_ref2 = _clientToServerId[_name1 = this.modelName]) == null) {
        _clientToServerId[_name1] = {};
      }
      if ((_ref3 = Mozart.Ajax) == null) {
        Mozart.Ajax = Mozart.MztObject.create({
          handleError: function(jqXHR, status, context, errorThrown) {
            switch (jqXHR.status) {
              case 401:
                return Mozart.Ajax.trigger('httpAuthorizationRequired', context, jqXHR);
              case 404:
                return Mozart.Ajax.trigger('httpForbidden', context, jqXHR);
              default:
                return Util.error('Model.Ajax.handleError', jqXHR, status, errorThrown);
            }
          }
        });
      }
      return this.instanceClass.extend({
        getServerId: function() {
          return this.modelClass.getServerId(this.id);
        },
        existsOnServer: function() {
          return this.modelClass.getServerId(this.id) != null;
        },
        loadServer: function() {
          return this.modelClass.load(this.modelClass.getServerId(this.id));
        }
      });
    },
    registerServerId: function(id, serverId) {
      if (_serverToClientId[this.modelName] == null) {
        throw new Error("Model.registerServerId: " + this.modelName + " is not registered for ajax.");
      }
      _serverToClientId[this.modelName][serverId] = id;
      return _clientToServerId[this.modelName][id] = serverId;
    },
    unRegisterServerId: function(id, serverId) {
      delete _serverToClientId[this.modelName][serverId];
      return delete _clientToServerId[this.modelName][id];
    },
    getServerId: function(id) {
      return _clientToServerId[this.modelName][id];
    },
    getClientId: function(serverId) {
      return _serverToClientId[this.modelName][serverId];
    },
    toServerObject: function(instance) {
      var field, model, obj, type, typeField, _ref, _ref1, _ref2;
      obj = {};
      _ref = this.attrs;
      for (field in _ref) {
        type = _ref[field];
        if (field !== 'id') {
          obj[field] = instance[field];
        }
      }
      obj.id = this.getServerId(instance.id);
      _ref1 = this.fks;
      for (field in _ref1) {
        model = _ref1[field];
        obj[field] = model.getServerId(instance[field]);
      }
      _ref2 = this.polyFks;
      for (field in _ref2) {
        typeField = _ref2[field];
        if (instance[typeField] != null) {
          obj[field] = Model.models[instance[typeField]].getServerId(instance[field]);
        } else {
          obj[field] = null;
        }
      }
      return obj;
    },
    toClientObject: function(serverObject) {
      var field, model, obj, type, typeField, _ref, _ref1, _ref2;
      obj = {};
      _ref = this.attrs;
      for (field in _ref) {
        type = _ref[field];
        if (field !== 'id') {
          if (typeof serverObject[field] !== 'undefined') {
            obj[field] = serverObject[field];
          }
        }
      }
      obj.id = this.getClientId(serverObject.id);
      _ref1 = this.fks;
      for (field in _ref1) {
        model = _ref1[field];
        if (typeof serverObject[field] !== 'undefined') {
          obj[field] = model.getClientId(serverObject[field]);
          if (typeof obj[field] === 'undefined') {
            obj[field] = null;
          }
        }
      }
      _ref2 = this.polyFks;
      for (field in _ref2) {
        typeField = _ref2[field];
        if (typeof serverObject[field] !== 'undefined' && (serverObject[typeField] != null)) {
          obj[field] = Model.models[serverObject[typeField]].getClientId(serverObject[field]);
        } else {
          obj[field] = null;
        }
      }
      return obj;
    },
    loadServer: function(instance) {
      var serverId;
      serverId = instance.modelClass.getServerId(instance.id);
      if (serverId == null) {
        return;
      }
      return instance.modelClass.load(serverId);
    },
    createServer: function(instance) {
      return instance.modelClass.createAjax(instance.id, instance.modelClass.toServerObject(instance));
    },
    updateServer: function(instance) {
      var serverId;
      serverId = instance.modelClass.getServerId(instance.id);
      if (serverId == null) {
        return;
      }
      return instance.modelClass.updateAjax(serverId, instance.id, instance.modelClass.toServerObject(instance));
    },
    destroyServer: function(instance) {
      var serverId;
      serverId = instance.modelClass.getServerId(instance.id);
      if (serverId == null) {
        return;
      }
      return instance.modelClass.destroyAjax(instance.modelClass.getServerId(instance.id), instance.id);
    },
    loadAll: function() {
      var onComplete, onError, onSuccess;
      onSuccess = function(data, jqXHR, status) {
        var obj, _i, _len;
        if (this.model.plural != null) {
          data = data[this.model.plural];
        }
        for (_i = 0, _len = data.length; _i < _len; _i++) {
          obj = data[_i];
          this.model._processLoad(obj, this.model, jqXHR);
        }
        return this.model.trigger('loadAllComplete');
      };
      onError = function(jqXHR, status, errorThrown) {
        return Mozart.Ajax.handleError(jqXHR, status, this, errorThrown);
      };
      onComplete = function(jqXHR, status) {
        return Util.log('ajax', 'Model.loadAll.onComplete', jqXHR, status);
      };
      return $.ajax({
        url: this.url,
        type: 'GET',
        success: onSuccess,
        error: onError,
        complete: onComplete,
        context: {
          model: this
        },
        dataType: 'json',
        contentType: 'application/json'
      });
    },
    load: function(serverId) {
      var onComplete, onError, onSuccess;
      onSuccess = function(data, jqXHR, status) {
        if (this.model.plural != null) {
          data = data[this.model.plural];
        }
        return this.model._processLoad(data, this.model, jqXHR);
      };
      onError = function(jqXHR, status, errorThrown) {
        return Mozart.Ajax.handleError(jqXHR, status, this, errorThrown);
      };
      onComplete = function(jqXHR, status) {
        return Util.log('ajax', 'Model.load.onComplete', jqXHR, status);
      };
      return $.ajax({
        url: this.url + "/" + serverId,
        type: 'GET',
        success: onSuccess,
        error: onError,
        complete: onComplete,
        context: {
          model: this,
          id: serverId
        },
        dataType: 'json',
        contentType: 'application/json'
      });
    },
    _processLoad: function(data, model, jqXHR) {
      var clientObject, instance, serverId;
      serverId = data.id;
      clientObject = model.toClientObject(data);
      instance = model.findById(clientObject.id);
      if (instance == null) {
        instance = model.initInstance(data);
      }
      model.registerServerId(instance.id, serverId);
      instance.copyFrom(clientObject);
      instance.save({
        disableModelCreateEvent: true,
        disableModelUpdateEvent: true
      });
      Util.log('ajax', 'Model._processLoad.onSuccess', jqXHR, data);
      return model.trigger('loadComplete', instance);
    },
    createAjax: function(clientId, data) {
      var onComplete, onError, onSuccess;
      onSuccess = function(data, jqXHR, status) {
        this.model.registerServerId(this.clientId, data.id);
        Util.log('ajax', 'Model.createAjax.onSuccess', jqXHR, data);
        return this.model.trigger('createComplete', this.model.findById(clientId));
      };
      onError = function(jqXHR, status, errorThrown) {
        return Mozart.Ajax.handleError(jqXHR, status, this, errorThrown);
      };
      onComplete = function(jqXHR, status) {
        return Util.log('ajax', 'Model.createAjax.onComplete', jqXHR, status);
      };
      return $.ajax({
        url: this.url,
        type: 'POST',
        data: JSON.stringify(data),
        success: onSuccess,
        error: onError,
        complete: onComplete,
        context: {
          model: this,
          clientId: clientId
        },
        dataType: 'json',
        contentType: 'application/json'
      });
    },
    updateAjax: function(serverId, clientId, data) {
      var onComplete, onError, onSuccess;
      onSuccess = function(data, jqXHR, status) {
        Util.log('ajax', 'Model.updateAjax.onSuccess', jqXHR, data);
        return this.model.trigger('updateComplete', this.model.findById(clientId));
      };
      onError = function(jqXHR, status, errorThrown) {
        return Mozart.Ajax.handleError(jqXHR, status, this, errorThrown);
      };
      onComplete = function(jqXHR, status) {
        return Util.log('ajax', 'Model.updateAjax.onComplete', jqXHR, status);
      };
      return $.ajax({
        url: this.url + '/' + serverId,
        type: 'PUT',
        data: JSON.stringify(data),
        success: onSuccess,
        error: onError,
        complete: onComplete,
        context: {
          model: this,
          clientId: this.clientId,
          serverId: this.serverId
        },
        dataType: 'json',
        contentType: 'application/json'
      });
    },
    destroyAjax: function(serverId, clientId) {
      var onComplete, onError, onSuccess;
      onSuccess = function(data, jqXHR, status) {
        this.model.unRegisterServerId(clientId, serverId);
        Util.log('ajax', 'Model.destroyAjax.onSuccess', jqXHR, data);
        return this.model.trigger('destroyComplete', serverId);
      };
      onError = function(jqXHR, status, errorThrown) {
        return Mozart.Ajax.handleError(jqXHR, status, this, errorThrown);
      };
      onComplete = function(jqXHR, status) {
        return Util.log('ajax', 'Model.destroyAjax.onComplete', jqXHR, status);
      };
      return $.ajax({
        url: this.url + '/' + serverId,
        type: 'DELETE',
        success: onSuccess,
        error: onError,
        complete: onComplete,
        context: {
          model: this,
          clientId: clientId,
          serverId: serverId
        },
        dataType: 'json',
        contentType: 'application/json'
      });
    }
  });

}).call(this);

});

require.define("/model.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var DataIndex, Instance, InstanceCollection, ManyToManyCollection, ManyToManyPolyCollection, ManyToManyPolyReverseCollection, Model, MztObject, OneToManyCollection, OneToManyPolyCollection, Util,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  Util = require('./util');

  MztObject = require('./object').MztObject;

  DataIndex = require('./data-index').DataIndex;

  Instance = require('./model-instance').Instance;

  InstanceCollection = require('./model-instancecollection').InstanceCollection;

  OneToManyCollection = require('./model-onetomanycollection').OneToManyCollection;

  OneToManyPolyCollection = require('./model-onetomanypolycollection').OneToManyPolyCollection;

  ManyToManyCollection = require('./model-manytomanycollection').ManyToManyCollection;

  ManyToManyPolyCollection = require('./model-manytomanypolycollection').ManyToManyPolyCollection;

  ManyToManyPolyReverseCollection = require('./model-manytomanypolyreversecollection').ManyToManyPolyReverseCollection;

  exports.Model = Model = (function(_super) {

    __extends(Model, _super);

    function Model() {
      this.index = __bind(this.index, this);

      this._generateId = __bind(this._generateId, this);

      this._getInstance = __bind(this._getInstance, this);

      this.toSnakeCase = __bind(this.toSnakeCase, this);

      this.destroyInstance = __bind(this.destroyInstance, this);

      this.updateInstance = __bind(this.updateInstance, this);

      this.createInstance = __bind(this.createInstance, this);

      this.loadInstance = __bind(this.loadInstance, this);

      this.createFromValues = __bind(this.createFromValues, this);

      this.initInstance = __bind(this.initInstance, this);

      this.exists = __bind(this.exists, this);

      this.findByAttributes = __bind(this.findByAttributes, this);

      this.findByAttribute = __bind(this.findByAttribute, this);

      this.selectAsMap = __bind(this.selectAsMap, this);

      this.selectIds = __bind(this.selectIds, this);

      this.select = __bind(this.select, this);

      this.findAll = __bind(this.findAll, this);

      this.findById = __bind(this.findById, this);

      this.count = __bind(this.count, this);

      this.allAsMap = __bind(this.allAsMap, this);

      this.all = __bind(this.all, this);

      this.hasManyThrough = __bind(this.hasManyThrough, this);

      this.hasMany = __bind(this.hasMany, this);

      this.belongsToPoly = __bind(this.belongsToPoly, this);

      this.belongsTo = __bind(this.belongsTo, this);

      this.polyForeignKeys = __bind(this.polyForeignKeys, this);

      this.foreignKeys = __bind(this.foreignKeys, this);

      this.attributes = __bind(this.attributes, this);

      this.reset = __bind(this.reset, this);
      return Model.__super__.constructor.apply(this, arguments);
    }

    Model.idCount = 1;

    Model.indexForeignKeys = true;

    Model.models = {};

    Model.prototype.toString = function() {
      return "Model: " + this.modelName;
    };

    Model.prototype.init = function() {
      var ModelInstance;
      if (this.modelName == null) {
        throw new Error("Model must have a modelName");
      }
      this.records = {};
      this.fks = {};
      this.polyFks = {};
      this.attrs = {
        id: 'integer'
      };
      this.relations = {};
      this.indexes = {};
      Model.models[this.modelName] = this;
      return this.instanceClass = ModelInstance = (function(_super1) {

        __extends(ModelInstance, _super1);

        function ModelInstance() {
          return ModelInstance.__super__.constructor.apply(this, arguments);
        }

        return ModelInstance;

      })(Instance);
    };

    Model.prototype.reset = function() {
      var id, inst, _ref;
      _ref = this.records;
      for (id in _ref) {
        inst = _ref[id];
        inst.release();
      }
      this.records = {};
      return this.rebuildAllIndexes();
    };

    Model.prototype.attributes = function(attrs) {
      var k, v, _results;
      _results = [];
      for (k in attrs) {
        v = attrs[k];
        _results.push(this.attrs[k] = v);
      }
      return _results;
    };

    Model.prototype.hasAttribute = function(attrName) {
      return (this.attrs[attrName] != null) || (this.fks[attrName + "_id"] != null);
    };

    Model.prototype.hasRelation = function(relationName) {
      return this.relations[relationName] != null;
    };

    Model.prototype.foreignKeys = function(foreignKeys) {
      var k, v, _results;
      _results = [];
      for (k in foreignKeys) {
        v = foreignKeys[k];
        this.fks[k] = v;
        if (Model.DataIndexForeignKeys) {
          _results.push(this.index(k));
        } else {
          _results.push(void 0);
        }
      }
      return _results;
    };

    Model.prototype.polyForeignKeys = function(foreignKeys) {
      var k, v, _results;
      _results = [];
      for (k in foreignKeys) {
        v = foreignKeys[k];
        this.polyFks[k] = v;
        if (Model.DataIndexForeignKeys) {
          _results.push(this.index(k));
        } else {
          _results.push(void 0);
        }
      }
      return _results;
    };

    Model.prototype.belongsTo = function(model, attribute, fkname) {
      var Xthis, fk, fkn, obj, onDelete;
      if (attribute == null) {
        if (attribute == null) {
          attribute = this.toSnakeCase(model.modelName);
        }
      }
      fk = {};
      if (fkname == null) {
        fkname = attribute + "_id";
      }
      fk[fkname] = 'integer';
      this.attributes(fk);
      fkn = {};
      fkn[fkname] = model;
      this.foreignKeys(fkn);
      obj = {};
      obj[attribute] = function(value) {
        var id;
        if (arguments.length === 1) {
          if (!(value === null || ((value.modelClass != null) && value.modelClass === model))) {
            throw new Error("Cannot assign " + value + " to belongsTo " + this.modelClass.modelName + ":" + attribute + " (Value is not an Instance or incorrect ModelClass)");
          }
          if (value != null) {
            return this.set(fkname, value.id);
          } else {
            return this.set(fkname, null);
          }
        } else {
          id = this[fkname];
          if (id == null) {
            return null;
          }
          return model.findById(id);
        }
      };
      this.instanceClass.extend(obj);
      Xthis = this;
      onDelete = function(instance) {
        var inst, _i, _len, _ref, _results;
        _ref = model.findByAttribute(fkname, instance.id);
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          inst = _ref[_i];
          inst.set(fkname, null);
          _results.push(inst.save());
        }
        return _results;
      };
      return model.bind('destroy', onDelete);
    };

    Model.prototype.hasOne = function(model, attribute, fkname) {
      var Xthis, fk, fkn, onDelete;
      if (attribute == null) {
        attribute = this.toSnakeCase(this.modelName);
      }
      fk = {};
      if (fkname == null) {
        fkname = attribute + "_id";
      }
      fk[fkname] = 'integer';
      model.attributes(fk);
      fkn = {};
      fkn[fkname] = this;
      model.foreignKeys(fkn);
      this.instanceClass.prototype[attribute] = function(value) {
        var inst, l, _i, _len, _ref;
        if (arguments.length === 1) {
          _ref = model.findByAttribute(fkname, this.id);
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            inst = _ref[_i];
            if (inst !== value) {
              inst.set(fkname, null);
              inst.save();
            }
          }
          if (value === null) {
            return;
          }
          value.set(fkname, this.id);
          value.save();
          this.trigger('change:' + attribute);
          return this.trigger('change');
        } else {
          l = model.findByAttribute(fkname, this.id);
          if (!(l.length > 0)) {
            return null;
          }
          return l[0];
        }
      };
      Xthis = this;
      onDelete = function(instance) {
        var inst, _i, _len, _ref, _results;
        _ref = model.findByAttribute(fkname, instance.id);
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          inst = _ref[_i];
          inst.set(fkname, null);
          _results.push(inst.save());
        }
        return _results;
      };
      return this.bind('destroy', onDelete);
    };

    Model.prototype.belongsToPoly = function(models, attribute, fkname, fktypename) {
      var Xthis, fk, fkn, model, obj, onDelete, _i, _len, _results;
      if (attribute == null) {
        attribute = this.toSnakeCase(model.modelName);
      }
      fk = {};
      if (fkname == null) {
        fkname = attribute + "_id";
      }
      fk[fkname] = 'integer';
      if (fktypename == null) {
        fktypename = attribute + "_type";
      }
      fk[fktypename] = 'string';
      this[attribute + "_allowed_models"] = models;
      this.attributes(fk);
      fkn = {};
      fkn[fkname] = fktypename;
      this.polyForeignKeys(fkn);
      obj = {};
      obj[attribute] = function(value, options) {
        var id, modelClass;
        if (arguments.length > 0) {
          if (value != null) {
            if (!_.contains(models, value.modelClass)) {
              Util.error("Cannot assign a model of type {{value.modelClass.modelName}} to this belongsToPoly - allowed model types are " + models.join(', '));
            }
            this.set(fkname, value.id);
            this.set(fktypename, value.modelClass.modelName);
          } else {
            this[fkname] = null;
            this[fktypename] = null;
          }
          return this.save(options);
        } else {
          id = this[fkname];
          modelClass = Model.models[this[fktypename]];
          if (!((id != null) && (modelClass != null))) {
            return null;
          }
          return modelClass.findById(id);
        }
      };
      this.instanceClass.extend(obj);
      Xthis = this;
      onDelete = function(instance, options) {
        var inst, query, _i, _len, _ref, _results;
        if (options == null) {
          options = {};
        }
        query = {};
        query[fkname] = instance.id;
        query[fktypename] = instance.modelClass.modelName;
        _ref = Xthis.findByAttributes(query);
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          inst = _ref[_i];
          inst.set(fkname, null);
          inst.set(fktypename, null);
          _results.push(inst.save(options));
        }
        return _results;
      };
      _results = [];
      for (_i = 0, _len = models.length; _i < _len; _i++) {
        model = models[_i];
        _results.push(model.bind('destroy', onDelete));
      }
      return _results;
    };

    Model.prototype.hasMany = function(model, attribute, fkname) {
      var Xthis, fk, fkn, obj, onDelete;
      if (attribute == null) {
        attribute = this.toSnakeCase(model.modelName);
      }
      fk = {};
      if (fkname == null) {
        fkname = this.toSnakeCase(this.modelName + "_id");
      }
      fk[fkname] = 'integer';
      model.attributes(fk);
      fkn = {};
      fkn[fkname] = this;
      model.foreignKeys(fkn);
      this.relations[attribute] = {
        type: 'hasMany',
        otherModel: model,
        foreignKeyAttribute: fkname
      };
      Xthis = this;
      obj = {};
      obj[attribute] = function(value) {
        if (arguments.length > 0) {
          throw new Error("Cannot set a hasMany relation");
        }
        if (this[attribute + "_hasMany_collection"] == null) {
          this[attribute + "_hasMany_collection"] = OneToManyCollection.create({
            record: this,
            attribute: this.attribute,
            model: Xthis,
            otherModel: model,
            fkname: fkname
          });
        }
        return this[attribute + "_hasMany_collection"];
      };
      this.instanceClass.extend(obj);
      onDelete = function(instance, options) {
        var inst, _i, _len, _ref, _results;
        if (options == null) {
          options = {};
        }
        _ref = model.findByAttribute(fkname, instance.id);
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          inst = _ref[_i];
          inst.set(fkname, null);
          _results.push(inst.save(options));
        }
        return _results;
      };
      return this.bind('destroy', onDelete);
    };

    Model.prototype.hasManyPoly = function(model, attribute, thatFkAttr, thatTypeAttr) {
      var Xthis, fk, fkn, onDeleteF;
      if (attribute == null) {
        attribute = this.toSnakeCase(model.modelName);
      }
      if (thatFkAttr == null) {
        thatFkAttr = attribute + "_id";
      }
      if (thatTypeAttr == null) {
        thatTypeAttr = attribute + "_type";
      }
      fk = {};
      fk[thatFkAttr] = 'integer';
      fk[thatTypeAttr] = 'string';
      model.attributes(fk);
      fkn = {};
      fkn[thatFkAttr] = thatTypeAttr;
      model.polyForeignKeys(fkn);
      this.relations[attribute] = {
        type: 'hasManyPoly',
        otherModel: model,
        foreignKeyAttribute: thatFkAttr,
        foreignModelTypeAttribute: thatTypeAttr
      };
      Xthis = this;
      this.instanceClass.prototype[attribute] = function(value) {
        if (arguments.length > 0) {
          throw new Error("Cannot set a hasManyPoly relation");
        }
        if (this[attribute + "_hasManyPoly_collection"] == null) {
          this[attribute + "_hasManyPoly_collection"] = OneToManyPolyCollection.create({
            record: this,
            model: Xthis,
            otherModel: model,
            thatFkAttr: thatFkAttr,
            thatTypeAttr: thatTypeAttr
          });
        }
        return this[attribute + "_hasManyPoly_collection"];
      };
      onDeleteF = function(instance, options) {
        var inst, query, _i, _len, _ref, _results;
        if (options == null) {
          options = {};
        }
        query = {};
        query[thatFkAttr] = instance.id;
        query[thatTypeAttr] = Xthis.modelName;
        _ref = model.findByAttributes(query);
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          inst = _ref[_i];
          inst.set(thatFkAttr, null);
          inst.set(thatTypeAttr, null);
          _results.push(inst.save(options));
        }
        return _results;
      };
      return this.bind('destroy', onDeleteF);
    };

    Model.prototype.hasManyThrough = function(model, attribute, linkModel, thisFkAttr, thatFkAttr) {
      var Xthis, fk, fkn, onDeleteB, onDeleteF;
      if (attribute == null) {
        attribute = this.toSnakeCase(model.modelName);
      }
      fk = {};
      if (thisFkAttr == null) {
        thisFkAttr = this.toSnakeCase(this.modelName + "_id");
      }
      if (thatFkAttr == null) {
        thatFkAttr = this.toSnakeCase(model.modelName) + "_id";
      }
      fk[thisFkAttr] = 'integer';
      fk[thatFkAttr] = 'integer';
      linkModel.attributes(fk);
      fkn = {};
      fkn[thisFkAttr] = this;
      fkn[thatFkAttr] = model;
      linkModel.foreignKeys(fkn);
      this.relations[attribute] = {
        type: 'hasManyThrough',
        otherModel: model,
        linkModel: linkModel,
        foreignKeyAttribute: thisFkAttr,
        otherModelForeignKeyAttribute: thatFkAttr
      };
      Xthis = this;
      this.instanceClass.prototype[attribute] = function(value) {
        if (arguments.length > 0) {
          throw new Error("Cannot set a hasManyThrough relation");
        }
        if (this[attribute + "_hasManyThrough_collection"] == null) {
          this[attribute + "_hasManyThrough_collection"] = ManyToManyCollection.create({
            record: this,
            model: Xthis,
            otherModel: model,
            linkModel: linkModel,
            thisFkAttr: thisFkAttr,
            thatFkAttr: thatFkAttr
          });
        }
        return this[attribute + "_hasManyThrough_collection"];
      };
      onDeleteF = function(instance, options) {
        var link, _i, _len, _ref, _results;
        if (options == null) {
          options = {};
        }
        _ref = linkModel.findByAttribute(thisFkAttr, instance.id);
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          link = _ref[_i];
          _results.push(link.destroy(options));
        }
        return _results;
      };
      this.bind('destroy', onDeleteF);
      onDeleteB = function(instance, options) {
        var link, _i, _len, _ref, _results;
        if (options == null) {
          options = {};
        }
        _ref = linkModel.findByAttribute(thatFkAttr, instance.id);
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          link = _ref[_i];
          _results.push(link.destroy(options));
        }
        return _results;
      };
      return model.bind('destroy', onDeleteB);
    };

    Model.prototype.hasManyThroughPoly = function(model, attribute, linkModel, thisFkAttr, thatFkAttr, thatTypeAttr) {
      var Xthis, fk, fkn, onDeleteB, onDeleteF;
      if (attribute == null) {
        attribute = this.toSnakeCase(model.modelName);
      }
      if (thisFkAttr == null) {
        thisFkAttr = this.toSnakeCase(this.modelName + "_id");
      }
      if (thatFkAttr == null) {
        thatFkAttr = attribute + "_id";
      }
      if (thatTypeAttr == null) {
        thatTypeAttr = attribute + "_type";
      }
      fk = {};
      fk[thisFkAttr] = 'integer';
      fk[thatFkAttr] = 'integer';
      fk[thatTypeAttr] = 'string';
      linkModel.attributes(fk);
      fkn = {};
      fkn[thisFkAttr] = this;
      linkModel.foreignKeys(fkn);
      fkn = {};
      fkn[thatFkAttr] = thatTypeAttr;
      linkModel.polyForeignKeys(fkn);
      this.relations[attribute] = {
        type: 'hasManyThroughPoly',
        otherModel: model,
        linkModel: linkModel,
        foreignKeyAttribute: thisFkAttr,
        otherModelForeignKeyAttribute: thatFkAttr,
        otherModelModelTypeAttribute: thatTypeAttr
      };
      Xthis = this;
      this.instanceClass.prototype[attribute] = function(value) {
        if (arguments.length > 0) {
          throw new Error("Cannot set a hasManyThroughPoly relation");
        }
        if (this[attribute + "_hasManyThroughPoly_collection"] == null) {
          this[attribute + "_hasManyThroughPoly_collection"] = ManyToManyPolyCollection.create({
            record: this,
            model: Xthis,
            otherModel: model,
            linkModel: linkModel,
            thisFkAttr: thisFkAttr,
            thatFkAttr: thatFkAttr,
            thatTypeAttr: thatTypeAttr
          });
        }
        return this[attribute + "_hasManyThroughPoly_collection"];
      };
      onDeleteF = function(instance, options) {
        var link, query, _i, _len, _ref, _results;
        if (options == null) {
          options = {};
        }
        query = {};
        query[thisFkAttr] = instance.id;
        _ref = linkModel.findByAttributes(query);
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          link = _ref[_i];
          _results.push(link.destroy(options));
        }
        return _results;
      };
      this.bind('destroy', onDeleteF);
      onDeleteB = function(instance, options) {
        var link, query, _i, _len, _ref, _results;
        if (options == null) {
          options = {};
        }
        query = {};
        query[thatFkAttr] = instance.id;
        query[thatTypeAttr] = instance.modelClass.modelName;
        _ref = linkModel.findByAttributes(query);
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          link = _ref[_i];
          _results.push(link.destroy(options));
        }
        return _results;
      };
      return model.bind('destroy', onDeleteB);
    };

    Model.prototype.hasManyThroughPolyReverse = function(model, attribute, linkModel, thisFkAttr, thatFkAttr, thatTypeAttr) {
      var Xthis;
      if (attribute == null) {
        attribute = this.toSnakeCase(model.modelName);
      }
      if (thisFkAttr == null) {
        thisFkAttr = this.toSnakeCase(this.modelName + "_id");
      }
      if (thatFkAttr == null) {
        thatFkAttr = attribute + "_id";
      }
      if (thatTypeAttr == null) {
        thatTypeAttr = attribute + "_type";
      }
      this.relations[attribute] = {
        type: 'hasManyThroughPolyReverse',
        otherModel: model,
        linkModel: linkModel,
        foreignKeyAttribute: thisFkAttr,
        otherModelForeignKeyAttribute: thatFkAttr,
        otherModelModelTypeAttribute: thatTypeAttr
      };
      if (!((linkModel.fks[thisFkAttr] != null) && (linkModel.polyFks[thatFkAttr] != null) && linkModel.polyFks[thatFkAttr] !== (thatTypeAttr != null))) {
        console.error("WARNING: hasManyThroughPolyReverse - " + thisFkAttr + ", " + thatFkAttr + " or " + thatTypeAttr + " do not exist on link model '" + linkModel.modelName + "' - there should be an existing hasManyThroughPoly to support this hasManyThroughPolyReverse");
      }
      Xthis = this;
      return this.instanceClass.prototype[attribute] = function(value) {
        if (arguments.length > 0) {
          throw new Error("Cannot set a hasManyThroughPolyReverse relation");
        }
        if (this[attribute + "_hasManyThroughPolyReverse_collection"] == null) {
          this[attribute + "_hasManyThroughPolyReverse_collection"] = ManyToManyPolyReverseCollection.create({
            record: this,
            model: Xthis,
            otherModel: model,
            linkModel: linkModel,
            thisFkAttr: thisFkAttr,
            thatFkAttr: thatFkAttr,
            thatTypeAttr: thatTypeAttr
          });
        }
        return this[attribute + "_hasManyThroughPolyReverse_collection"];
      };
    };

    Model.prototype.all = function() {
      return _(this.records).values();
    };

    Model.prototype.allAsMap = function() {
      return this.records;
    };

    Model.prototype.count = function() {
      return _(this.records).keys().length;
    };

    Model.prototype.findById = function(id) {
      if (id == null) {
        return void 0;
      }
      return this.records[id];
    };

    Model.prototype.findAll = function(ids) {
      var id, lst, _i, _len;
      lst = [];
      for (_i = 0, _len = ids.length; _i < _len; _i++) {
        id = ids[_i];
        if (this.exists(id) != null) {
          lst.push(this.records[id]);
        }
      }
      return lst;
    };

    Model.prototype.select = function(callback) {
      return this.findAll(this.selectIds(callback));
    };

    Model.prototype.selectIds = function(callback) {
      var id, rec, res, _ref;
      res = [];
      _ref = this.records;
      for (id in _ref) {
        rec = _ref[id];
        if (callback(rec)) {
          res.push(id);
        }
      }
      return res;
    };

    Model.prototype.selectAsMap = function(callback) {
      var id, rec, res, _ref;
      res = {};
      _ref = this.records;
      for (id in _ref) {
        rec = _ref[id];
        if (callback(rec)) {
          res[id] = rec;
        }
      }
      return res;
    };

    Model.prototype.findByAttribute = function(attribute, value) {
      var query;
      query = {};
      query[attribute] = value;
      return this.findByAttributes(query);
    };

    Model.prototype.findByAttributes = function(query) {
      var attributeName, i, k, out, out2, res, res2, value,
        _this = this;
      res = [];
      for (attributeName in query) {
        value = query[attributeName];
        if (this.hasIndex(attributeName)) {
          res.push(this.getIndexFor(attributeName, value));
        } else {
          res.push(this.selectAsMap(function(rec) {
            return rec[attributeName] === value;
          }));
        }
      }
      out = res.pop() || {};
      while (res.length > 0) {
        res2 = res.pop();
        out2 = {};
        for (i in res2) {
          k = res2[i];
          if (out[i] != null) {
            out2[i] = k;
          }
        }
        out = out2;
      }
      return _(out).values();
    };

    Model.prototype.exists = function(id) {
      return this.records[id] != null;
    };

    Model.prototype.initInstance = function(data) {
      var inst, k, v, _ref;
      inst = this._getInstance();
      _ref = this.attrs;
      for (k in _ref) {
        v = _ref[k];
        if ((data != null) && (data[k] != null)) {
          inst.set(k, data[k]);
        } else {
          inst.set(k, null);
        }
      }
      inst.set('id', this._generateId());
      return inst;
    };

    Model.prototype.createFromValues = function(values) {
      var inst;
      inst = this.initInstance(values);
      inst.save();
      return inst;
    };

    Model.prototype.loadInstance = function(instance, options) {
      if (options == null) {
        options = {};
      }
      return this.trigger('load', instance);
    };

    Model.prototype.createInstance = function(instance, options) {
      var id;
      if (options == null) {
        options = {};
      }
      id = instance.id;
      if (this.exists(id)) {
        Util.error("createInstance: ID Already Exists", 'collection', "model", this.name, "id", id);
      }
      this.records[id] = instance;
      this.addToIndexes(instance);
      if (!options.disableModelCreateEvent) {
        this.trigger('create', instance, options);
      }
      if (!options.disableModelChangeEvent) {
        this.trigger('change', instance, options);
      }
      return instance;
    };

    Model.prototype.updateInstance = function(instance, options) {
      var id;
      if (options == null) {
        options = {};
      }
      if (!options.disableModelUpdateEvent) {
        this.trigger('update', instance, options);
      }
      if (!options.disableModelChangeEvent) {
        this.trigger('change', instance, options);
      }
      id = instance.id;
      if (!this.exists(id)) {
        return Util.error("updateInstance: ID does not exist", 'collection', "model", this.name, "id", id);
      }
    };

    Model.prototype.destroyInstance = function(instance, options) {
      var id;
      if (options == null) {
        options = {};
      }
      id = instance.id;
      if (!this.exists(id)) {
        Util.error("destroyInstance: ID does not exist", 'collection', "model", this.name, "id", id);
      }
      delete this.records[instance.id];
      instance.modelClass.removeFromIndexes(instance);
      if (!options.disableModelDestroyEvent) {
        this.trigger('destroy', instance, options);
      }
      if (!options.disableModelChangeEvent) {
        return this.trigger('change', instance, options);
      }
    };

    Model.prototype.toSnakeCase = function(name) {
      var x,
        _this = this;
      x = name.replace(/[A-Z]{1,1}/g, function(match) {
        return "_" + match.toLowerCase();
      });
      return x.replace(/^_/, '');
    };

    Model.prototype._getInstance = function() {
      return this.instanceClass.create({
        modelClass: this
      });
    };

    Model.prototype._generateId = function() {
      return "c-" + (Model.idCount++);
    };

    Model.prototype.index = function(attrName, type, options) {
      var idxClass;
      if (type == null) {
        type = 'map';
      }
      if (this.indexes[attrName] == null) {
        idxClass = DataIndex.getIndexClassType(type);
        if (idxClass != null) {
          return this.indexes[attrName] = idxClass.create({
            modelClass: this,
            attribute: attrName,
            options: options
          });
        } else {
          throw new Error("Model: Index Type " + type + " is not supported");
        }
      } else {
        return this.rebuildIndex(attrName);
      }
    };

    Model.prototype.hasIndex = function(attrName) {
      return this.indexes[attrName] != null;
    };

    Model.prototype.getIndexFor = function(attrName, value) {
      if (this.indexes[attrName] == null) {
        throw new Error("Model.rebuildIndex: Index " + attrName + " does not exist");
      }
      return this.indexes[attrName].load(value);
    };

    Model.prototype.updateIndex = function(attrName, record, oldValue, newValue) {
      if (this.indexes[attrName] == null) {
        throw new Error("Model.rebuildIndex: Index " + attrName + " does not exist");
      }
      return this.indexes[attrName].update(record, oldValue, newValue);
    };

    Model.prototype.addToIndexes = function(record) {
      var attrName, index, _ref, _results;
      _ref = this.indexes;
      _results = [];
      for (attrName in _ref) {
        index = _ref[attrName];
        _results.push(index.add(record));
      }
      return _results;
    };

    Model.prototype.removeFromIndexes = function(record) {
      var attrName, index, _ref, _results;
      _ref = this.indexes;
      _results = [];
      for (attrName in _ref) {
        index = _ref[attrName];
        _results.push(index.remove(record));
      }
      return _results;
    };

    Model.prototype.rebuildIndex = function(attrName) {
      if (this.indexes[attrName] == null) {
        throw new Error("Model.rebuildIndex: Index " + attrName + " does not exist");
      }
      return this.indexes[attrName].rebuild();
    };

    Model.prototype.dropIndex = function(attrName) {
      return delete this.indexes[attrName];
    };

    Model.prototype.rebuildAllIndexes = function() {
      var attrName, _i, _len, _ref, _results;
      _ref = _(this.indexes).keys();
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        attrName = _ref[_i];
        _results.push(this.rebuildIndex(attrName));
      }
      return _results;
    };

    return Model;

  })(MztObject);

}).call(this);

});

require.define("/model-localstorage.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var Model, Util, _clientToLocalStorageId, _localStorageToClientId;

  Model = require('./model').Model;

  Util = require('./util');

  _localStorageToClientId = {};

  _clientToLocalStorageId = {};

  Model.extend({
    localStorage: function(options) {
      var idx, localStorageId, prefix, _name, _name1, _ref, _ref1, _ref2, _ref3;
      if (window.localStorage == null) {
        Mozart.error(this.modelName + ".localStorage - localStorage not available in this browser");
      }
      if (options == null) {
        options = {};
      }
      if ((_ref = options.prefix) == null) {
        options.prefix = "MozartLS";
      }
      this.localStorageOptions = options;
      this.bind('load', this.loadLocalStorage);
      this.bind('create', this.createLocalStorage);
      this.bind('update', this.updateLocalStorage);
      this.bind('destroy', this.destroyLocalStorage);
      if ((_ref1 = _localStorageToClientId[_name = this.modelName]) == null) {
        _localStorageToClientId[_name] = {};
      }
      if ((_ref2 = _clientToLocalStorageId[_name1 = this.modelName]) == null) {
        _clientToLocalStorageId[_name1] = {};
      }
      if ((_ref3 = Mozart.LocalStorage) == null) {
        Mozart.LocalStorage = Mozart.MztObject.create({
          handleError: function(model, id, error) {
            return Mozart.LocalStorage.trigger('notFound', model, id, error);
          }
        });
      }
      prefix = this.getLocalStoragePrefix();
      this.instanceClass.extend({
        getLocalStorageId: function() {
          return this.modelClass.getLocalStorageId(this.id);
        },
        existsInLocalStorage: function() {
          var localStorageId;
          localStorageId = this.modelClass.getLocalStorageId(this.id);
          return window.localStorage[this + ("-" + localStorageId)] != null;
        },
        loadLocalStorage: function() {
          return this.modelClass.loadLocalStorage(this);
        }
      });
      localStorageId = window.localStorage[prefix + "-nextPK"];
      if (localStorageId == null) {
        window.localStorage[prefix + "-nextPK"] = "1";
      }
      idx = window.localStorage[prefix + "-index"];
      if (idx == null) {
        return window.localStorage[prefix + "-index"] = "[]";
      }
    },
    getLocalStoragePrefix: function() {
      return this.localStorageOptions.prefix + "-" + this.modelName;
    },
    registerLocalStorageId: function(id, localStorageId) {
      if (_localStorageToClientId[this.modelName] == null) {
        throw new Error("Model.registerLocalStorageId: " + this.modelName + " is not registered for localStorage.");
      }
      _localStorageToClientId[this.modelName][localStorageId] = id;
      return _clientToLocalStorageId[this.modelName][id] = localStorageId;
    },
    unRegisterLocalStorageId: function(id, localStorageId) {
      delete _localStorageToClientId[this.modelName][localStorageId];
      return delete _clientToLocalStorageId[this.modelName][id];
    },
    getLocalStorageId: function(id) {
      return _clientToLocalStorageId[this.modelName][id];
    },
    getLocalStorageClientId: function(localStorageId) {
      return _localStorageToClientId[this.modelName][localStorageId];
    },
    toLocalStorageObject: function(instance) {
      var field, model, obj, type, typeField, _ref, _ref1, _ref2;
      obj = {};
      _ref = this.attrs;
      for (field in _ref) {
        type = _ref[field];
        if (field !== 'id') {
          obj[field] = instance[field];
        }
      }
      obj.id = this.getLocalStorageId(instance.id);
      _ref1 = this.fks;
      for (field in _ref1) {
        model = _ref1[field];
        obj[field] = model.getLocalStorageId(instance[field]);
      }
      _ref2 = this.polyFks;
      for (field in _ref2) {
        typeField = _ref2[field];
        if (instance[typeField] != null) {
          obj[field] = Model.models[instance[typeField]].getLocalStorageId(instance[field]);
        } else {
          obj[field] = null;
        }
      }
      return obj;
    },
    toLocalStorageClientObject: function(localStorageObject) {
      var field, model, obj, type, typeField, _ref, _ref1, _ref2;
      obj = {};
      _ref = this.attrs;
      for (field in _ref) {
        type = _ref[field];
        if (field !== 'id') {
          obj[field] = localStorageObject[field];
        }
      }
      obj.id = this.getLocalStorageClientId(localStorageObject.id);
      _ref1 = this.fks;
      for (field in _ref1) {
        model = _ref1[field];
        obj[field] = model.getLocalStorageClientId(localStorageObject[field]);
        if (typeof obj[field] === 'undefined') {
          obj[field] = null;
        }
      }
      _ref2 = this.polyFks;
      for (field in _ref2) {
        typeField = _ref2[field];
        if (localStorageObject[typeField] != null) {
          obj[field] = Model.models[localStorageObject[typeField]].getLocalStorageClientId(localStorageObject[field]);
        } else {
          obj[field] = null;
        }
      }
      return obj;
    },
    loadAllLocalStorage: function() {
      var data, idx, localStorageId, prefix, _i, _len;
      prefix = this.getLocalStoragePrefix();
      idx = JSON.parse(window.localStorage[prefix + "-index"]);
      for (_i = 0, _len = idx.length; _i < _len; _i++) {
        localStorageId = idx[_i];
        data = JSON.parse(window.localStorage[prefix + ("-" + localStorageId)]);
        this._processLocalStorageLoad(localStorageId, data, this);
      }
      this.trigger('loadAllLocalStorageComplete');
      return Util.log('localStorage', 'Model.loadAllLocalStorage.onComplete');
    },
    loadLocalStorage: function(instance) {
      var localStorageId;
      localStorageId = instance.modelClass.getLocalStorageId(instance.id);
      return this.loadLocalStorageId(localStorageId);
    },
    loadLocalStorageId: function(localStorageId) {
      var data, prefix;
      prefix = this.getLocalStoragePrefix();
      data = window.localStorage[prefix + ("-" + localStorageId)];
      if (data == null) {
        Mozart.LocalStorage.handleError(this, localStorageId, "record does not exist");
      }
      data = JSON.parse(data);
      data.id = localStorageId;
      return this._processLocalStorageLoad(localStorageId, data, this);
    },
    _processLocalStorageLoad: function(localStorageId, data, model) {
      var clientId, clientObject, instance;
      clientId = model.getLocalStorageClientId(localStorageId);
      clientObject = model.toLocalStorageClientObject(data);
      if (clientId != null) {
        instance = model.findById(clientId);
        instance.copyFrom(clientObject);
      } else {
        instance = model.initInstance(data);
      }
      instance.save({
        disableModelCreateEvent: true,
        disableModelUpdateEvent: true
      });
      model.registerLocalStorageId(instance.id, localStorageId);
      Util.log('localStorage', 'Model._processLocalStorageLoad.onSuccess', data, model);
      return model.trigger('loadLocalStorageComplete', instance);
    },
    createLocalStorage: function(instance) {
      var data, idx, localStorageId, prefix;
      data = instance.modelClass.toLocalStorageObject(instance);
      prefix = instance.modelClass.getLocalStoragePrefix();
      localStorageId = parseInt(window.localStorage[prefix + "-nextPK"]);
      window.localStorage[prefix + "-nextPK"] = (localStorageId + 1).toString();
      window.localStorage[prefix + ("-" + localStorageId)] = JSON.stringify(data);
      instance.modelClass.registerLocalStorageId(instance.id, localStorageId);
      idx = JSON.parse(window.localStorage[prefix + "-index"]);
      idx.push(localStorageId);
      window.localStorage[prefix + "-index"] = JSON.stringify(idx);
      Util.log('localStorage', 'Model.createLocalStorageComplete', instance);
      return instance.modelClass.trigger('createLocalStorageComplete', instance);
    },
    updateLocalStorage: function(instance) {
      var data, localStorageId, prefix;
      localStorageId = instance.modelClass.getLocalStorageId(instance.id);
      if (localStorageId == null) {
        return;
      }
      data = instance.modelClass.toLocalStorageObject(instance);
      prefix = instance.modelClass.getLocalStoragePrefix();
      if (window.localStorage[prefix + ("-" + localStorageId)] == null) {
        Mozart.LocalStorage.handleError(instance.modelClass, localStorageId, "updateLocalStorage: record does not exist");
      }
      window.localStorage[prefix + ("-" + localStorageId)] = JSON.stringify(data);
      instance.modelClass.trigger('updateLocalStorageComplete', instance);
      return Util.log('localStorage', 'Model.updateLocalStorage.onComplete', instance);
    },
    destroyLocalStorage: function(instance) {
      var idx, localStorageId, prefix;
      localStorageId = instance.modelClass.getLocalStorageId(instance.id);
      if (localStorageId == null) {
        return;
      }
      prefix = instance.modelClass.getLocalStoragePrefix();
      if (window.localStorage[prefix + ("-" + localStorageId)] == null) {
        Mozart.LocalStorage.handleError(instance.modelClass, localStorageId, "destroyLocalStorage: record does not exist");
      }
      window.localStorage.removeItem(prefix + ("-" + localStorageId));
      instance.modelClass.unRegisterLocalStorageId(instance.id, localStorageId);
      idx = JSON.parse(window.localStorage[prefix + "-index"]);
      idx = _.without(idx, localStorageId);
      window.localStorage[prefix + "-index"] = JSON.stringify(idx);
      Util.log('localStorage', 'Model.destroyLocalStorage.onSuccess', instance);
      return instance.modelClass.trigger('destroyLocalStorageComplete', localStorageId);
    },
    destroyAllLocalStorage: function() {
      var i, idx, prefix, _i, _len;
      prefix = this.getLocalStoragePrefix();
      idx = JSON.parse(window.localStorage[prefix + "-index"]);
      for (_i = 0, _len = idx.length; _i < _len; _i++) {
        i = idx[_i];
        window.localStorage.removeItem(prefix + ("-" + i));
      }
      window.localStorage[prefix + "-index"] = "[]";
      window.localStorage[prefix + "-nextPK"] = "1";
      _localStorageToClientId[this.modelName] = {};
      return _clientToLocalStorageId[this.modelName] = {};
    }
  });

}).call(this);

});

require.define("/route.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var MztObject, Route, Util,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  Util = require('./util');

  MztObject = require('./object').MztObject;

  exports.Route = Route = (function(_super) {

    __extends(Route, _super);

    function Route() {
      this.doTitle = __bind(this.doTitle, this);

      this.canEnter = __bind(this.canEnter, this);

      this.canExit = __bind(this.canExit, this);
      return Route.__super__.constructor.apply(this, arguments);
    }

    Route.prototype.init = function() {
      if (!((this.path != null) && this.path.length > 0)) {
        Util.warn('Route must have a path', this);
      }
      if (this.viewClass == null) {
        return Util.warn('Route must have a viewClass', this);
      }
    };

    Route.prototype.canExit = function() {
      return !(this.exit != null) || this.exit() === true;
    };

    Route.prototype.canEnter = function(params) {
      return !(this.enter != null) || this.enter(params) === true;
    };

    Route.prototype.doTitle = function() {
      if (this.title != null) {
        if (typeof this.title === 'function') {
          return document.title = this.title(this);
        } else {
          return document.title = this.title;
        }
      }
    };

    return Route;

  })(MztObject);

}).call(this);

});

require.define("/switch-view.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var SwitchView, View,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  View = require('./view').View;

  exports.SwitchView = SwitchView = (function(_super) {

    __extends(SwitchView, _super);

    function SwitchView() {
      this.beforeRender = __bind(this.beforeRender, this);
      return SwitchView.__super__.constructor.apply(this, arguments);
    }

    SwitchView.prototype.beforeRender = function() {
      var template;
      template = HandlebarsTemplates[this.templateBase + "/" + this.content[this.templateField]];
      if (template != null) {
        return this.templateFunction = template;
      } else {
        Util.log("views", "SwitchView: No view found for " + this.templateBase + "/" + this.content[this.templateField]);
        return this.templateFunction = function() {
          return '';
        };
      }
    };

    return SwitchView;

  })(View);

}).call(this);

});

require.define("/cookies.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var Cookies, MztObject,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  MztObject = require('./object').MztObject;

  exports.Cookies = Cookies = (function(_super) {

    __extends(Cookies, _super);

    function Cookies() {
      return Cookies.__super__.constructor.apply(this, arguments);
    }

    Cookies.setCookie = function(name, value, options) {
      var domain, expires, maxAge, nameValue, path, secure;
      options = options || {};
      if (document.cookie !== void 0) {
        if (!options["path"]) {
          options["path"] = "/";
        }
        nameValue = "" + (encodeURIComponent(name)) + "=" + (encodeURIComponent(value));
        path = options["path"] ? ";path=" + options["path"] : "";
        domain = options["domain"] ? ";domain=" + options["domain"] : "";
        maxAge = options["max-age"] ? ";max-age=" + options["max-age"] : "";
        expires = "";
        if (options["expires"] instanceof Date) {
          expires = ";expires=" + (options["expires"].toUTCString());
        }
        secure = options["secure"] ? ";secure" : "";
        document.cookie = nameValue + path + domain + maxAge + expires + secure;
      }
      return this;
    };

    Cookies.getCookie = function(name) {
      var cookie, cookies, currentName, currentParts, _i, _len;
      cookies = document.cookie.split(/;\s*/);
      for (_i = 0, _len = cookies.length; _i < _len; _i++) {
        cookie = cookies[_i];
        currentParts = cookie.split("=");
        currentName = decodeURIComponent(currentParts[0]);
        if (currentName === name) {
          return decodeURIComponent(currentParts[1]);
        }
      }
      return null;
    };

    Cookies.removeCookie = function(name) {
      var date;
      date = new Date();
      date.setTime(date.getTime() - 1);
      this.setCookie(name, '', {
        expires: date
      });
      return this;
    };

    Cookies.hasCookie = function(name) {
      return this.getCookie(name) !== null;
    };

    return Cookies;

  })(MztObject);

}).call(this);

});

require.define("/synapse-mozart-hook.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var MztObject, SynapseCore, Util,
    __slice = [].slice;

  MztObject = require('./object').MztObject;

  Util = require('./util');

  SynapseCore = require('./synapse-core');

  module.exports = (function() {
    var interfaces;
    interfaces = (function() {
      return {
        registry: {},
        register: function(config) {
          return this.registry[config.name] = config;
        },
        unregister: function(name) {
          return delete this.registry[name];
        },
        get: function() {
          var args, iface, key, name, object, _ref;
          object = arguments[0], name = arguments[1], args = 3 <= arguments.length ? __slice.call(arguments, 2) : [];
          _ref = name.split('.'), name = _ref[0], key = _ref[1];
          if (key != null) {
            args = [key].concat(args);
          }
          if ((iface = this.registry[name])) {
            return iface.get.apply(object, args);
          }
        },
        set: function() {
          var args, iface, key, name, object, _ref;
          object = arguments[0], name = arguments[1], args = 3 <= arguments.length ? __slice.call(arguments, 2) : [];
          _ref = name.split('.'), name = _ref[0], key = _ref[1];
          if (key != null) {
            args = [key].concat(args);
          }
          if ((iface = this.registry[name])) {
            return iface.set.apply(object, args);
          }
        }
      };
    })();
    (function() {
      return interfaces.register({
        name: 'attributes',
        get: function(key) {
          return this.get(key);
        },
        set: function(key, value) {
          return this.set(key, value);
        }
      });
    })();
    return {
      typeName: 'Mozart Object',
      interfaces: interfaces,
      checkObjectType: function(object) {
        return SynapseCore.isObject(object) && object instanceof MztObject;
      },
      getHandler: function(object, key) {
        var result;
        Util.log('synapse', "getting " + key + " on ", object, object[key]);
        result = {};
        if (SynapseCore.isFunction(object[key])) {
          result = object[key]();
        } else {
          result = object.get(key);
        }
        return result;
      },
      setHandler: function(object, key, value) {
        Util.log('synapse', "setting " + key + ": ", value, " on ", object);
        if (SynapseCore.isFunction(object[key])) {
          return object[key](value);
        } else {
          return object.set(key, value);
        }
      },
      onEventHandler: function(object, event, handler) {
        return object.bind(event, handler);
      },
      offEventHandler: function(object, event, handler) {
        return object.unbind(event, handler);
      },
      triggerEventHandler: function(object, event) {
        Util.log('synapse', "triggerEventHandler", object, event);
        return object.trigger(event);
      },
      detectEvent: function(object, iface) {
        if ((iface != null) && Object.prototype.hasOwnProperty.call(object, iface) || (object.__proto__ !== void 0 && Object.prototype.hasOwnProperty.call(object.__proto__, iface))) {
          return "change:" + iface;
        }
        return 'change';
      }
    };
  })();

}).call(this);

});

require.define("/synapse-jquery.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var SynapseCore,
    __slice = [].slice;

  SynapseCore = require('./synapse-core');

  module.exports = (function() {
    var domEvents, elementBindAttributes, elementInterfaces, interfaces;
    interfaces = (function() {
      return {
        registry: {},
        register: function(config) {
          return this.registry[config.name] = config;
        },
        unregister: function(name) {
          return delete this.registry[name];
        },
        get: function() {
          var args, iface, key, name, object, _ref;
          object = arguments[0], name = arguments[1], args = 3 <= arguments.length ? __slice.call(arguments, 2) : [];
          _ref = name.split('.'), name = _ref[0], key = _ref[1];
          if (key != null) {
            args = [key].concat(args);
          }
          if ((iface = this.registry[name])) {
            return iface.get.apply(object, args);
          }
        },
        set: function() {
          var args, iface, key, name, object, _ref;
          object = arguments[0], name = arguments[1], args = 3 <= arguments.length ? __slice.call(arguments, 2) : [];
          _ref = name.split('.'), name = _ref[0], key = _ref[1];
          if (key != null) {
            args = [key].concat(args);
          }
          if ((iface = this.registry[name])) {
            return iface.set.apply(object, args);
          }
        }
      };
    })();
    (function() {
      var getAttribute, getCss, getProperty, setAttribute, setCss, setProperty;
      getProperty = function(key) {
        if (this.prop != null) {
          return this.prop(key);
        }
        return getAttribute.call(this, key);
      };
      setProperty = function(key, value) {
        if (this.prop != null) {
          if (typeof key === 'object') {
            return this.prop(key);
          }
          return this.prop(key, value);
        }
        return setAttribute.call(this, key, value);
      };
      getAttribute = function(key) {
        return this.attr(key);
      };
      setAttribute = function(key, value) {
        if (SynapseCore.isObject(key)) {
          return this.attr(key);
        } else {
          return this.attr(key, value);
        }
      };
      getCss = function(key) {
        return this.css(key);
      };
      setCss = function(key, value) {
        if (SynapseCore.isObject(key)) {
          return this.css(key);
        } else {
          return this.css(key, value);
        }
      };
      interfaces.register({
        name: 'text',
        get: function() {
          return this.text();
        },
        set: function(value) {
          return this.text((value != null ? value : '').toString());
        }
      });
      interfaces.register({
        name: 'html',
        get: function() {
          return this.html();
        },
        set: function(value) {
          return this.html((value != null ? value : '').toString());
        }
      });
      interfaces.register({
        name: 'value',
        get: function() {
          return this.val();
        },
        set: function(value) {
          return this.val(value != null ? value : '');
        }
      });
      interfaces.register({
        name: 'enabled',
        get: function() {
          return !getProperty.call(this, 'disabled');
        },
        set: function(value) {
          if (SynapseCore.isArray(value) && value.length === 0) {
            value = false;
          }
          return setProperty.call(this, 'disabled', !Boolean(value));
        }
      });
      interfaces.register({
        name: 'disabled',
        get: function() {
          return getProperty.call(this, 'disabled');
        },
        set: function(value) {
          if (SynapseCore.isArray(value) && value.length === 0) {
            value = false;
          }
          return setProperty.call(this, 'disabled', Boolean(value));
        }
      });
      interfaces.register({
        name: 'checked',
        get: function() {
          return getProperty.call(this, 'checked');
        },
        set: function(value) {
          if (SynapseCore.isArray(value) && value.length === 0) {
            value = false;
          }
          return setProperty.call(this, 'checked', Boolean(value));
        }
      });
      interfaces.register({
        name: 'visible',
        get: function() {
          return getCss.call(this, 'display') === !'none';
        },
        set: function(value) {
          if (SynapseCore.isArray(value) && value.length === 0) {
            value = false;
          }
          if (Boolean(value)) {
            return this.show();
          } else {
            return this.hide();
          }
        }
      });
      interfaces.register({
        name: 'hidden',
        get: function() {
          return getCss.call(this, 'display') === 'none';
        },
        set: function(value) {
          if (SynapseCore.isArray(value) && value.length === 0) {
            value = false;
          }
          if (Boolean(value)) {
            return this.hide();
          } else {
            return this.show();
          }
        }
      });
      interfaces.register({
        name: 'prop',
        get: function(key) {
          return getProperty.call(this, key);
        },
        set: function(key, value) {
          return setProperty.call(this, key, value);
        }
      });
      interfaces.register({
        name: 'attr',
        get: function(key) {
          return getAttribute.call(this, key);
        },
        set: function(key, value) {
          return setAttribute.call(this, key, value);
        }
      });
      interfaces.register({
        name: 'css',
        get: function(key) {
          return getCss.call(this, key);
        },
        set: function(key, value) {
          return setCss.call(this, key, value);
        }
      });
      interfaces.register({
        name: 'data',
        get: function(key) {
          return this.data(key);
        },
        set: function(key, value) {
          return this.data(key, value);
        }
      });
      return interfaces.register({
        name: 'class',
        get: function(key) {
          return this.hasClass(key);
        },
        set: function(key, value) {
          return this.toggleClass(key, Boolean(value));
        }
      });
    })();
    domEvents = [['a,button,[type=button],[type=reset]', 'click'], ['select,[type=checkbox],[type=radio],textarea', 'change'], ['[type=submit]', 'submit'], ['input', 'keyup']];
    elementInterfaces = [['[type=checkbox],[type=radio]', 'checked'], ['input,textarea,select', 'value']];
    elementBindAttributes = ['name', 'role', 'data-bind'];
    return {
      typeName: 'jQuery',
      domEvents: domEvents,
      elementBindAttributes: elementBindAttributes,
      elementInterfaces: elementInterfaces,
      interfaces: interfaces,
      checkObjectType: function(object) {
        return object instanceof $ || object.nodeType === 1 || SynapseCore.isString(object);
      },
      coerceObject: function(object) {
        return $(object);
      },
      getHandler: function(object, key) {
        var value;
        value = interfaces.get(object, key);
        if (value && object.is('[type=number]')) {
          if (value.indexOf('.') > -1) {
            return parseFloat(value);
          } else {
            return parseInt(value);
          }
        }
        return value;
      },
      setHandler: function(object, key, value) {
        return interfaces.set(object, key, value);
      },
      onEventHandler: function(object, event, handler) {
        return object.bind(event, handler);
      },
      offEventHandler: function(object, event, handler) {
        return object.unbind(event, handler);
      },
      triggerEventHandler: function(object, event) {
        return object.trigger(event);
      },
      detectEvent: function(object) {
        var event, item, selector, _i, _len;
        for (_i = 0, _len = domEvents.length; _i < _len; _i++) {
          item = domEvents[_i];
          selector = item[0], event = item[1];
          if (object.is(selector)) {
            return event;
          }
        }
      },
      detectInterface: function(object) {
        var iface, item, selector, _i, _len;
        for (_i = 0, _len = elementInterfaces.length; _i < _len; _i++) {
          item = elementInterfaces[_i];
          selector = item[0], iface = item[1];
          if (object.is(selector)) {
            return iface;
          }
        }
        return 'text';
      },
      detectOtherInterface: function(object) {
        var attr, value, _i, _len;
        for (_i = 0, _len = elementBindAttributes.length; _i < _len; _i++) {
          attr = elementBindAttributes[_i];
          if ((value = object.attr(attr))) {
            return value;
          }
        }
      }
    };
  })();

}).call(this);

});

require.define("/mozart.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var Mozart, Synapse, method, module, name, _i, _len, _ref, _ref1,
    __hasProp = {}.hasOwnProperty;

  Mozart = {
    version: "0.1.4",
    versionDate: new Date(2013, 1, 20)
  };

  _ref = [require("./collection"), require("./control"), require("./controller"), require("./data-index"), require("./dom-manager"), require("./events"), require("./handlebars"), require("./layout"), require("./model-instance"), require("./model-instancecollection"), require("./model-onetomanycollection"), require("./model-onetomanypolycollection"), require("./model-manytomanycollection"), require("./model-manytomanypolycollection"), require("./model-manytomanypolyreversecollection"), require("./model-ajax"), require("./model-localstorage"), require("./model"), require("./object"), require("./route"), require("./router"), require("./switch-view"), require("./util"), require("./view"), require("./cookies")];
  for (_i = 0, _len = _ref.length; _i < _len; _i++) {
    module = _ref[_i];
    for (name in module) {
      if (!__hasProp.call(module, name)) continue;
      method = module[name];
      Mozart[name] = method;
    }
  }

  Synapse = require("./synapse").Synapse;

  Synapse.hooks = [require('./synapse-mozart-hook'), require('./synapse-jquery')];

  if (global.module != null) {
    module.exports = Mozart;
  } else if (((_ref1 = global.define) != null ? _ref1.amd : void 0) != null) {
    define("mozart", Mozart);
  } else {
    global.Mozart = Mozart;
    global.Synapse = Synapse;
    global.jQueryHook = require('./synapse-jquery');
    global.MozartHook = require('./synapse-mozart-hook');
  }

}).call(this);

});
require("/mozart.coffee");

})();
