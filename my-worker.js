importScripts("bower_components/ace-worker/worker.js");
importScripts("bower_components/ace-builds/src-noconflict/ace.js");
importScripts("bower_components/ace-worker/mirror.js");

ace.define('ace/worker/my-worker',["require","exports","module","ace/lib/oop","ace/worker/mirror"], function(require, exports, module) {
  "use strict";

  var oop = require("ace/lib/oop");
  var Mirror = require("ace/worker/mirror").Mirror;

  var MyWorker = function(sender) {
    Mirror.call(this, sender);
    this.setTimeout(200);
    this.$dialect = null;
  };

  oop.inherits(MyWorker, Mirror);

  // load nodejs compatible require
  var ace_require = require;
  window.require = undefined; // prevent error: "Honey: 'require' already defined in global scope"
  var Honey = { 'requirePath': ['..'] }; // walk up to js folder, see Honey docs
  importScripts("./require.js");
  var antlr4_require = window.require;
  window.require = require = ace_require;

  // load antlr4 and myLanguage
  var antlr4, RtypeLexer, RtypeParser;
  try {
    window.require = antlr4_require;
    antlr4 = antlr4_require('antlr4/index');
    RtypeLexer = antlr4_require('parser/RtypeLexer').RtypeLexer;
    RtypeParser = antlr4_require('parser/RtypeParser').RtypeParser;
  } finally {
    window.require = ace_require;
  }

  // class for gathering errors and posting them to ACE editor
  var AnnotatingErrorListener = function(annotations) {
    antlr4.error.ErrorListener.call(this);
    this.annotations = annotations;
    return this;
  };

  AnnotatingErrorListener.prototype = Object.create(antlr4.error.ErrorListener.prototype);
  AnnotatingErrorListener.prototype.constructor = AnnotatingErrorListener;

  AnnotatingErrorListener.prototype.syntaxError = function(recognizer, offendingSymbol, line, column, msg, e) {
    this.annotations.push({
      row: line - 1,
      column: column,
      text: msg,
      type: "error"
    });
  };

  function validate(input) {
    // create parser and lexer
    var stream = new antlr4.InputStream(input);
    var lexer = new RtypeLexer(stream);
    var tokens = new antlr4.CommonTokenStream(lexer);
    var parser = new RtypeParser(tokens);
    // add error listener
    var annotations = [];
    var listener = new AnnotatingErrorListener(annotations);
    // TODO bug? parser listener is not notified when no lexer listener exists
    lexer.removeErrorListeners();
    lexer.addErrorListener(listener);
    parser.removeErrorListeners();
    parser.addErrorListener(listener);
    // parse
    parser.file();
    return annotations;
  }

  (function() {

    this.onUpdate = function() {
      var value = this.doc.getValue();
      var annotations = validate(value);
      this.sender.emit("annotate", annotations);
    };

  }).call(MyWorker.prototype);

  exports.MyWorker = MyWorker;
});