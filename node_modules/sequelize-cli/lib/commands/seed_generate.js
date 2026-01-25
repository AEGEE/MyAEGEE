"use strict";

var _process = _interopRequireDefault(require("process"));
var _yargs = require("../core/yargs");
var _helpers = _interopRequireDefault(require("../helpers"));
var _fs = _interopRequireDefault(require("fs"));
var _picocolors = _interopRequireDefault(require("picocolors"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
exports.builder = yargs => (0, _yargs._baseOptions)(yargs).option('name', {
  describe: 'Defines the name of the seed',
  type: 'string',
  demandOption: true
}).argv;
exports.handler = function (args) {
  _helpers.default.init.createSeedersFolder();
  _fs.default.writeFileSync(_helpers.default.path.getSeederPath(args.name), _helpers.default.template.render('seeders/skeleton.js', {}, {
    beautify: false
  }));
  _helpers.default.view.log('New seed was created at', _picocolors.default.blueBright(_helpers.default.path.getSeederPath(args.name)), '.');
  _process.default.exit(0);
};