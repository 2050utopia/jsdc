var homunculus = require('homunculus');
var JsNode = homunculus.getClass('Node', 'es6');

var Class = require('./util/Class');

var Genarator = Class(function(jsdc) {
  this.jsdc = jsdc;
}).methods({
  parse: function(node) {
    this.jsdc.ignore(node.leaf(1));
  }
});

module.exports = Genarator;
